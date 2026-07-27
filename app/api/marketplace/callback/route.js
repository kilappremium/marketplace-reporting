import { getProvider } from '../../../../lib/marketplace/service.js'

/**
 * GET /api/marketplace/callback?provider=shopee&code=...&shop_id=...
 * Handles the OAuth redirect callback for the given provider.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const providerName = searchParams.get('provider')

  if (!providerName) {
    return Response.json(
      { error: 'Query parameter "provider" is required.' },
      { status: 400 }
    )
  }

  try {
    const provider = getProvider(providerName)
    const result = await provider.callback({ searchParams })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
