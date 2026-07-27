import { getProvider } from '../../../../lib/marketplace/service.js'

/**
 * POST /api/marketplace/sync
 * Body: { provider: string, connectionId?: string, dateStart?: string, dateEnd?: string }
 * Triggers a data sync for the given provider.
 */
export async function POST(request) {
  let body = {}

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { provider: providerName, connectionId, dateStart, dateEnd } = body

  if (!providerName) {
    return Response.json(
      { error: 'Body field "provider" is required.' },
      { status: 400 }
    )
  }

  try {
    const provider = getProvider(providerName)
    const result = await provider.sync({ connectionId, dateStart, dateEnd })
    return Response.json(result)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }
}
