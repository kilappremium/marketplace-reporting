import { getProvider } from '../../../../lib/marketplace/service.js'

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

    const result = await provider.connect({
      origin: new URL(request.url).origin,
      searchParams
    })

    return Response.redirect(result.authUrl, 302)
  } catch (err) {
    return Response.json(
      { error: err.message },
      { status: 400 }
    )
  }
}
