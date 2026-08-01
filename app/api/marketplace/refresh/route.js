import { getProvider } from '../../../../lib/marketplace/service.js'

export async function GET() {
  try {
    const provider = getProvider('shopee')
    const result = await provider.refreshToken()
    return Response.json(result)
  } catch (err) {
    return Response.json(
      { error: err.message },
      { status: 400 }
    )
  }
}