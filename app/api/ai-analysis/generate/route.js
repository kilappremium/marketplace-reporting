import { buildSalesContext } from '../../../../lib/ai/dataBuilder.js'
import { generateBrandInsight } from '../../../../lib/ai/insight.js'

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
    const result = await generateBrandInsight(context)

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
