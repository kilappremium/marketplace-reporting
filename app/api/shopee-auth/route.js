import crypto from 'crypto'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  const PARTNER_ID   = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY  = process.env.SHOPEE_PARTNER_KEY
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/marketplace/callback?provider=shopee`

  if (!PARTNER_ID || !PARTNER_KEY) {
    return Response.json({ error: 'SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum diset' }, { status: 500 })
  }

  // ── Get URL (return JSON, bukan redirect) ─────────────
  if (action === 'get_url') {
    const timestamp = Math.floor(Date.now() / 1000)
    const path      = '/api/v2/shop/auth_partner'
    const baseStr   = `${PARTNER_ID}${path}${timestamp}`
    const sign      = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')
    const authUrl   = `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(REDIRECT_URI)}`
    return Response.json({ auth_url: authUrl })
  }

  // ── Auth URL dengan redirect langsung ─────────────────
  if (action === 'auth_url') {
    const timestamp = Math.floor(Date.now() / 1000)
    const path      = '/api/v2/shop/auth_partner'
    const baseStr   = `${PARTNER_ID}${path}${timestamp}`
    const sign      = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')
    const authUrl   = `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(REDIRECT_URI)}`
    return Response.redirect(authUrl, 302)
  }

  return Response.json({
    status: 'Shopee Auth API aktif',
    partner_id_exists:  !!PARTNER_ID,
    partner_key_exists: !!PARTNER_KEY,
  })
}
