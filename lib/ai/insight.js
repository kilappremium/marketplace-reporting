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

function buildUserPrompt(context) {
  return `Brand: ${context.brand}

Analyze the supplied Kilap Premium Shopee KPI context below.
Use only these numbers. Do not invent metrics that are missing.

KPI_CONTEXT:
${JSON.stringify(context, null, 2)}

Return JSON only matching the required schema.`
}

function clampScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizePriority(value) {
  const p = String(value || '').toUpperCase()
  if (p === 'LOW' || p === 'MEDIUM' || p === 'HIGH') return p
  return 'MEDIUM'
}

function limitBullets(arr, max = 5) {
  if (!Array.isArray(arr)) return []
  return arr.map(String).filter(Boolean).slice(0, max)
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
  const summary = String(parsed.summary || '').trim()
  const words = summary.split(/\s+/).filter(Boolean)
  const summaryLimited = words.length > 120
    ? words.slice(0, 120).join(' ')
    : summary

  return {
    summary: summaryLimited,
    strengths: limitBullets(parsed.strengths, 5),
    weaknesses: limitBullets(parsed.weaknesses, 5),
    recommendations: limitBullets(parsed.recommendations, 5),
    priority: normalizePriority(parsed.priority),
    score: clampScore(parsed.score),
  }
}

/**
 * Generate AI insight using a pre-built sales context from buildSalesContext().
 * Uses the existing Groq AI client — does not create a new AI provider.
 *
 * @param {object} context — output of buildSalesContext(brand)
 * @param {{ systemPrompt?: string }} [options]
 */
export async function generateBrandInsight(context, options = {}) {
  if (!context?.brand) {
    throw new Error('sales context with brand is required.')
  }

  if (!options.systemPrompt) {
    throw new Error('systemPrompt is required for business AI analysis.')
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

  const { text, model_used } = await generateAiText(buildUserPrompt(context), {
    max_tokens: 1200,
    temperature: 0.3,
    systemPrompt: options.systemPrompt,
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
