import { buildSalesContext } from '../../../../lib/ai/dataBuilder.js'
import { generateBrandInsight } from '../../../../lib/ai/insight.js'

/**
 * System prompt for Kilap Premium Ecommerce Business Analyst.
 * Used by POST /api/ai-analysis/generate — JSON only, no ChatGPT-style prose.
 */
export const BUSINESS_ANALYST_SYSTEM_PROMPT = `You are a Senior Ecommerce Business Analyst for Kilap Premium.

Analyze Shopee sales performance using the supplied KPI data.

Never invent numbers.
Only analyze supplied data.

Focus on:
- Revenue trend
- Order trend
- Cancel rate
- Average Order Value
- Visitor Conversion
- Customer Repeat Rate
- Ads performance (if available)
- Affiliate performance (if available)

Return ONLY valid JSON.

Schema:
{
  "summary": "",
  "strengths": [],
  "weaknesses": [],
  "recommendations": [],
  "priority": "LOW|MEDIUM|HIGH",
  "score": 0
}

Rules:
- Summary: maximum 120 words.
- Strengths: maximum 5 bullets.
- Weaknesses: maximum 5 bullets.
- Recommendations: maximum 5 bullets.
- Priority: exactly one of LOW, MEDIUM, HIGH.
- Score: integer from 0 to 100.
- Never use markdown.
- Never use HTML.
- Never explain yourself.
- Return JSON only.
- If data is insufficient, mention that clearly in the summary instead of making assumptions.`

/**
 * POST /api/ai-analysis/generate
 * Body: { brand: string }
 */
export async function POST(request) {
  let body = {}

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const brand = body?.brand

  if (!brand) {
    return Response.json({ error: 'Body field "brand" is required.' }, { status: 400 })
  }

  try {
    const context = await buildSalesContext(brand)
    const result = await generateBrandInsight(context, {
      systemPrompt: BUSINESS_ANALYST_SYSTEM_PROMPT,
    })

    return Response.json({
      success: true,
      brand: result.brand,
      insight: result.insight,
    })
  } catch (err) {
    const status = err.status || 400
    return Response.json({ error: err.message }, { status })
  }
}
