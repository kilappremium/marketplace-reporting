import supabaseAdmin from '@/lib/supabase-admin'


export async function GET(request) {

  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const shop_id = searchParams.get('shop_id')


  if (!code || !shop_id) {
    return Response.json(
      {
        error: 'code atau shop_id tidak ditemukan'
      },
      {
        status:400
      }
    )
  }


  const PARTNER_ID = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY


  const timestamp = Math.floor(Date.now()/1000)

  const path = '/api/v2/auth/token/get'


  const crypto = await import('crypto')


  const baseString =
    `${PARTNER_ID}${path}${timestamp}`


  const sign =
    crypto
    .createHmac('sha256', PARTNER_KEY)
    .update(baseString)
    .digest('hex')


  const response = await fetch(
    `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        code,
        shop_id:Number(shop_id),
        partner_id:Number(PARTNER_ID)
      })
    }
  )


  const data = await response.json()


  if(data.error){
    return Response.json(data,{status:400})
  }



  // SIMPAN KE MARKETPLACE CONNECTIONS

  const expireIn = Number(data.expire_in) || 0

  const tokenExpiredAt = expireIn > 0
    ? new Date(Date.now() + expireIn * 1000).toISOString()
    : null


  // ambil nama toko
  const shopInfoPath = '/api/v2/shop/get_shop_info'

  const shopTimestamp = Math.floor(Date.now()/1000)

  const shopSignString =
    `${PARTNER_ID}${shopInfoPath}${shopTimestamp}${data.access_token}${shop_id}`

  const shopSign = crypto
    .createHmac('sha256', PARTNER_KEY)
    .update(shopSignString)
    .digest('hex')


  const shopResponse = await fetch(
    `https://partner.shopeemobile.com${shopInfoPath}?partner_id=${PARTNER_ID}&timestamp=${shopTimestamp}&access_token=${data.access_token}&shop_id=${shop_id}&sign=${shopSign}`
  )


  const shopData = await shopResponse.json()

  const shopName =
    shopData.response?.shop_name || 'Shopee Store'


  const {error} = await supabaseAdmin
    .from('marketplace_connections')
    .upsert(
      {
        marketplace:'shopee',
        shop_id:String(shop_id),
        shop_name:shopName,
        partner_id:String(PARTNER_ID),
        access_token:data.access_token,
        refresh_token:data.refresh_token,
        token_expired_at:tokenExpiredAt,
        status:'active',
        last_error:null
      },
      {
        onConflict:'marketplace,shop_id'
      }
    )


  if(error){

    return Response.json(
      {
        error:error.message,
        detail:error
      },
      {
        status:500
      }
    )

  }



  return Response.json({

    success:true,

    message:'Shopee berhasil terhubung',

    shop_id,

    shop_name:shopName,

    expire_in:data.expire_in

  })

}
