import crypto from 'crypto'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code    = searchParams.get('code')
  const shop_id = searchParams.get('shop_id')

  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!code || !shop_id) {
    return new Response(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>❌ Parameter tidak lengkap</h2>
        <p>code: ${code || 'tidak ada'}</p>
        <p>shop_id: ${shop_id || 'tidak ada'}</p>
        <p>Semua parameter dari Shopee: ${searchParams.toString()}</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const path      = '/api/v2/auth/token/get'
  const baseStr   = `${PARTNER_ID}${path}${timestamp}`
  const sign      = crypto
    .createHmac('sha256', PARTNER_KEY)
    .update(baseStr)
    .digest('hex')

  const res = await fetch(
    `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        shop_id:    Number(shop_id),
        partner_id: Number(PARTNER_ID),
      }),
    }
  )

  const data = await res.json()

  if (data.error && data.error !== '') {
    return new Response(`
      <html><body style="font-family:sans-serif;padding:40px">
        <h2>❌ Gagal mendapat token</h2>
        <pre style="background:#fee;padding:16px;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }

  return new Response(`
    <html>
    <head><title>Shopee Auth Berhasil</title></head>
    <body style="font-family:sans-serif;padding:40px;max-width:700px;margin:0 auto">
      <div style="background:#FFF0E6;border:2px solid #EE4D2D;border-radius:12px;padding:24px;margin-bottom:24px">
        <h2 style="color:#EE4D2D;margin:0 0 8px">✅ Access Token Berhasil Didapat!</h2>
        <p style="color:#666;margin:0">Salin nilai berikut ke Vercel Environment Variables</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#FFF0E6">
          <td style="padding:12px;border:1px solid #ddd;font-weight:bold;width:220px">SHOPEE_ACCESS_TOKEN</td>
          <td style="padding:12px;border:1px solid #ddd;word-break:break-all;font-family:monospace">${data.access_token}</td>
        </tr>
        <tr>
          <td style="padding:12px;border:1px solid #ddd;font-weight:bold">SHOPEE_REFRESH_TOKEN</td>
          <td style="padding:12px;border:1px solid #ddd;word-break:break-all;font-family:monospace">${data.refresh_token}</td>
        </tr>
        <tr style="background:#FFF0E6">
          <td style="padding:12px;border:1px solid #ddd;font-weight:bold">SHOPEE_SHOP_ID</td>
          <td style="padding:12px;border:1px solid #ddd;font-family:monospace">${shop_id}</td>
        </tr>
        <tr>
          <td style="padding:12px;border:1px solid #ddd;font-weight:bold">Token Berlaku Hingga</td>
          <td style="padding:12px;border:1px solid #ddd">${new Date((Math.floor(Date.now()/1000) + (data.expire_in || 0)) * 1000).toLocaleString('id-ID')}</td>
        </tr>
      </table>

      <div style="margin-top:24px;padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;font-size:13px;color:#166534">
        <strong>Langkah selanjutnya:</strong><br>
        1. Copy semua nilai di atas<br>
        2. Buka Vercel → Settings → Environment Variables<br>
        3. Tambahkan ketiga variable tersebut<br>
        4. Klik Save → Redeploy
      </div>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } })
}