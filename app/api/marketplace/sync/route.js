import { getProvider } from '../../../../lib/marketplace/service.js'

/**
 * Shared sync runner used by POST and GET.
 * @param {{ provider?: string, connectionId?: string, dateStart?: string, dateEnd?: string }}
 */
async function runSync({ provider: providerName, connectionId, dateStart, dateEnd }) {
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

  return runSync({ provider: providerName, connectionId, dateStart, dateEnd })
}

/**
 * GET /api/marketplace/sync
 * Query: provider?=shopee, connectionId?, dateStart?, dateEnd?
 * Defaults: provider=shopee.
 * Returns the same JSON as POST.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  return runSync({
    provider: searchParams.get('provider') || 'shopee',
    connectionId: searchParams.get('connectionId') || undefined,
    dateStart: searchParams.get('dateStart') || undefined,
    dateEnd: searchParams.get('dateEnd') || undefined,
  })
}
