import { createClient } from '@supabase/supabase-js'
import { generateAiText } from './client.js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return createClient(supabaseUrl, serviceKey)
}

function last30DaysRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)

  const toDate = (d) => d.toISOString().split('T')[0]
  return { dateStart: toDate(start), dateEnd: toDate(end) }
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/**
 * Aggregate penjualan_harian rows into KPI summary for AI.
 */
export function buildKpiSummary(rows = []) {
  const omzet = rows.reduce((a, r) => a + (Number(r.omzet) || 0), 0)
  const pesanan_masuk = rows.reduce((a, r) => a + (Number(r.pesanan_masuk) || 0), 0)
  const pesanan_batal = rows.reduce((a, r) => a + (Number(r.pesanan_batal) || 0), 0)
  const customer_repeat = rows.reduce((a, r) => a + (Number(r.customer_repeat) || 0), 0)
  const omzet_ads = rows.reduce((a, r) => a + (Number(r.omzet_ads) || 0), 0)
  const omzet_affiliate = rows.reduce((a, r) => a + (Number(r.omzet_affiliate) || 0), 0)

  const cancel_rate = pesanan_masuk > 0
    ? (pesanan_batal / pesanan_masuk) * 100
    : avg(rows.map(r => Number(r.cancel_rate) || 0))

  const aov_order = pesanan_masuk > 0
    ? omzet / pesanan_masuk
    : avg(rows.map(r => Number(r.aov_order) || 0))

  const visitor_cvr = avg(rows.map(r => Number(r.visitor_cvr) || 0))

  return {
    omzet: Number(omzet.toFixed(0)),
    pesanan_masuk,
    cancel_rate: Number(cancel_rate.toFixed(2)),
    aov_order: Number(aov_order.toFixed(0)),
    visitor_cvr: Number(visitor_cvr.toFixed(2)),
    customer_repeat,
    omzet_ads: Number(omzet_ads.toFixed(0)),
    omzet_affiliate: Number(omzet_affiliate.toFixed(0)),
    days: rows.length,
  }
}

function buildInsightPrompt(brand, kpi, { dateStart, dateEnd }) {
  return `Kamu adalah analis marketplace e-commerce untuk brand "${brand}".
Analisis KPI 30 hari terakhir (${dateStart} s/d ${dateEnd}) berikut.

KPI:
${JSON.stringify(kpi, null, 2)}

Jawab HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan lain) dengan format tepat:
{
  "summary": "ringkasan performa 2-3 kalimat dalam Bahasa Indonesia",
  "strengths": ["kekuatan 1", "kekuatan 2"],
  "weaknesses": ["kelemahan 1", "kelemahan 2"],
  "recommendations": ["rekomendasi 1", "rekomendasi 2", "rekomendasi 3"]
}`
}

function parseInsightJson(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response is not valid JSON.')
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1))

  return {
    summary: String(parsed.summary || ''),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : [],
  }
}

/**
 * Generate AI insight for a brand from penjualan_harian (last 30 days).
 * Uses the existing Groq AI client — does not create a new AI provider.
 *
 * @param {string} brand
 */
export async function generateBrandInsight(brand) {
  if (!brand || !String(brand).trim()) {
    throw new Error('brand is required.')
  }

  const brandName = String(brand).trim()
  const { dateStart, dateEnd } = last30DaysRange()
  const supabase = getSupabaseAdmin()

  const { data: rows, error } = await supabase
    .from('penjualan_harian')
    .select(
      'tanggal, omzet, pesanan_masuk, pesanan_batal, cancel_rate, aov_order, visitor_cvr, customer_repeat, omzet_ads, omzet_affiliate'
    )
    .eq('brand', brandName)
    .gte('tanggal', dateStart)
    .lte('tanggal', dateEnd)
    .order('tanggal', { ascending: true })

  if (error) {
    throw new Error(`Failed to load penjualan_harian: ${error.message}`)
  }

  if (!rows?.length) {
    throw new Error(`No penjualan_harian data found for brand "${brandName}" in the last 30 days.`)
  }

  const kpi = buildKpiSummary(rows)
  const prompt = buildInsightPrompt(brandName, kpi, { dateStart, dateEnd })

  const { text, model_used } = await generateAiText(prompt, {
    max_tokens: 1200,
    temperature: 0.4,
  })

  const insight = parseInsightJson(text)

  const { data: saved, error: saveError } = await supabase
    .from('ai_insight')
    .insert({
      brand: brandName,
      period_start: dateStart,
      period_end: dateEnd,
      kpi_summary: kpi,
      summary: insight.summary,
      strengths: insight.strengths,
      weaknesses: insight.weaknesses,
      recommendations: insight.recommendations,
      insight,
      model_used,
    })
    .select()
    .single()

  if (saveError) {
    throw new Error(`Failed to save ai_insight: ${saveError.message}`)
  }

  return {
    success: true,
    brand: brandName,
    insight,
    saved,
    model_used,
    kpi,
  }
}
