import { getProvider } from '../../../../lib/marketplace/service.js'

export async function GET(request) {

  console.log("=== CALLBACK MASUK ===")

  const { searchParams } = new URL(request.url)

  console.log(searchParams.toString())

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