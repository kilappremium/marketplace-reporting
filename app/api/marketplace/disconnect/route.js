import { getProvider } from '../../../../lib/marketplace/service.js'

/**
 * POST /api/marketplace/disconnect
 * Body: { provider: string, connectionId: string }
 * Disconnects and revokes the given provider connection.
 */
export async function POST(request) {
  let body = {}

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { provider: providerName, connectionId } = body

  if (!providerName) {
    return Response.json(
      { error: 'Body field "provider" is required.' },
      { status: 400 }
    )
  }

  try {
    const provider = getProvider(providerName)
    const result = await provider.disconnect({ connectionId })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
