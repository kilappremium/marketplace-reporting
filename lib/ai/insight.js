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

function buildInsightPrompt(context) {
  return `Kamu adalah analis marketplace e-commerce untuk brand "${context.brand}".
Analisis konteks penjualan numerik berikut (hari ini, kemarin, tren 7 & 30 hari, averages, growth).

CONTEXT:
${JSON.stringify(context, null, 2)}

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
 * Generate AI insight using a pre-built sales context from buildSalesContext().
 * Uses the existing Groq AI client — does not create a new AI provider.
 *
 * @param {object} context — output of buildSalesContext(brand)
 */
export async function generateBrandInsight(context) {
  if (!context?.brand) {
    throw new Error('sales context with brand is required.')
  }

  const hasSignal =
    Number(context.today?.omzet) > 0 ||
    Number(context.yesterday?.omzet) > 0 ||
    (context.trend30Days || []).some(d => Number(d.omzet) > 0 || Number(d.orders) > 0)

  if (!hasSignal) {
    throw new Error(
      `No penjualan_harian data found for brand "${context.brand}" in the last 30 days.`
    )
  }

  const prompt = buildInsightPrompt(context)

  const { text, model_used } = await generateAiText(prompt, {
    max_tokens: 1200,
    temperature: 0.4,
  })

  const insight = parseInsightJson(text)
  const supabase = getSupabaseAdmin()

  const periodStart = context.trend30Days?.[0]?.tanggal || null
  const periodEnd = context.today?.tanggal || null

  const { data: saved, error: saveError } = await supabase
    .from('ai_insight')
    .insert({
      brand: context.brand,
      period_start: periodStart,
      period_end: periodEnd,
      kpi_summary: {
        today: context.today,
        yesterday: context.yesterday,
        averages: context.averages,
        growth: context.growth,
      },
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
    brand: context.brand,
    insight,
    saved,
    model_used,
    context,
  }
}
