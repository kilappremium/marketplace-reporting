/**
 * Shopee provider.
 * Existing Shopee routes (app/api/shopee-auth, app/api/shopee-callback) are untouched.
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function connect(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
  const APP_URL     = process.env.NEXT_PUBLIC_APP_URL

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }
  if (!APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set.')
  }

  const redirectUri = `${APP_URL}/api/marketplace/callback?provider=shopee`
  const path        = '/api/v2/shop/auth_partner'
  const timestamp   = Math.floor(Date.now() / 1000)
  const baseStr     = `${PARTNER_ID}${path}${timestamp}`
  const sign        = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const authUrl = (
    `https://partner.shopeemobile.com${path}` +
    `?partner_id=${PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}` +
    `&redirect=${encodeURIComponent(redirectUri)}`
  )

  return { success: true, authUrl }
}

export async function callback(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  const searchParams = params.searchParams
  const code    = searchParams?.get?.('code')    ?? searchParams?.code
  const shop_id = String(searchParams?.get?.('shop_id') ?? searchParams?.shop_id ?? '')

  if (!code || !shop_id) {
    throw new Error('code and shop_id are required.')
  }

  const path      = '/api/v2/auth/token/get'
  const timestamp = Math.floor(Date.now() / 1000)
  const baseStr   = `${PARTNER_ID}${path}${timestamp}`
  const sign      = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const res = await fetch(
    `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        shop_id: Number(shop_id),
        partner_id: Number(PARTNER_ID),
      }),
    }
  )

  const data = await res.json()

  if (data.error && data.error !== '') {
    throw new Error(data.message || data.error || 'Shopee token exchange failed.')
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Shopee response missing access_token or refresh_token.')
  }

  const expireIn = Number(data.expire_in) || 0
  const tokenExpiredAt = expireIn > 0
    ? new Date(Date.now() + expireIn * 1000).toISOString()
    : null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: savedData, error } = await supabase
    .from('marketplace_connections')
    .upsert(
      {
        marketplace: 'shopee',
        shop_id,
        shop_name: shop_id,
        partner_id: String(PARTNER_ID),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expired_at: tokenExpiredAt,
        status: 'active',
        last_error: null,
      },
      {
        onConflict: 'marketplace,shop_id'
      }
    )
    .select()

    if (error) {
      console.error('SUPABASE INSERT ERROR:', error)
      throw new Error(`Failed to save marketplace connection: ${error.message}`)
  }
  
  console.log('SUPABASE SAVE SUCCESS:', {
      marketplace: 'shopee',
      shop_id,
  })
    
    return {
      success: true,
      connected: true,
      shop_id,
      savedData,
    }
}

export async function refreshToken(params = {}) {
  // TODO: call Shopee /api/v2/auth/access_token/get to refresh tokens
  return { status: 'todo', message: 'Shopee refreshToken not implemented yet', params }
}

export async function disconnect(params = {}) {
  // TODO: revoke token and mark connection inactive in marketplace_connections
  return { status: 'todo', message: 'Shopee disconnect not implemented yet', params }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return createClient(supabaseUrl, serviceKey)
}

function buildShopSign(path, accessToken, shopId) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
  const timestamp   = Math.floor(Date.now() / 1000)
  const baseStr     = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`
  const sign        = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')
  return { PARTNER_ID, timestamp, sign }
}

async function shopeeShopGet(path, accessToken, shopId, extraParams = {}) {
  const { PARTNER_ID, timestamp, sign } = buildShopSign(path, accessToken, shopId)
  const qs = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(timestamp),
    access_token: accessToken,
    shop_id: String(shopId),
    sign,
    ...Object.fromEntries(
      Object.entries(extraParams).map(([k, v]) => [k, String(v)])
    ),
  })
  const res = await fetch(`https://partner.shopeemobile.com${path}?${qs}`)
  return res.json()
}

async function fetchAllOrderSns(accessToken, shopId, timeFrom, timeTo) {
  const path = '/api/v2/order/get_order_list'
  const orderSns = []
  let cursor = ''
  let more = true

  while (more) {
    const data = await shopeeShopGet(path, accessToken, shopId, {
      time_range_field: 'create_time',
      time_from: timeFrom,
      time_to: timeTo,
      page_size: 100,
      cursor,
    })

    if (data.error && data.error !== '') {
      throw new Error(data.message || data.error || 'Shopee get_order_list failed.')
    }

    const list = data.response?.order_list || []
    for (const o of list) {
      if (o.order_sn) orderSns.push(o.order_sn)
    }

    more = Boolean(data.response?.more)
    cursor = data.response?.next_cursor || ''
    if (!more || !cursor) break
  }

  return orderSns
}

async function fetchOrderDetails(accessToken, shopId, orderSns) {
  const path = '/api/v2/order/get_order_detail'
  const details = []

  for (let i = 0; i < orderSns.length; i += 50) {
    const chunk = orderSns.slice(i, i + 50)
    const data = await shopeeShopGet(path, accessToken, shopId, {
      order_sn_list: chunk.join(','),
      response_optional_fields: 'total_amount',
    })

    if (data.error && data.error !== '') {
      throw new Error(data.message || data.error || 'Shopee get_order_detail failed.')
    }

    details.push(...(data.response?.order_list || []))
  }

  return details
}

function toDateStr(unixSeconds) {
  return new Date(unixSeconds * 1000).toISOString().split('T')[0]
}

function aggregateOrdersByDay(orderDetails) {
  const byDay = {}

  for (const order of orderDetails) {
    const tanggal = toDateStr(order.create_time || order.update_time || Math.floor(Date.now() / 1000))
    if (!byDay[tanggal]) {
      byDay[tanggal] = {
        tanggal,
        channel: 'Shopee',
        omzet: 0,
        pesanan_masuk: 0,
        pesanan_batal: 0,
      }
    }

    const row = byDay[tanggal]
    const status = String(order.order_status || '').toUpperCase()
    const isCancelled = status === 'CANCELLED' || status === 'IN_CANCEL'

    row.pesanan_masuk += 1
    if (isCancelled) {
      row.pesanan_batal += 1
    } else {
      row.omzet += Number(order.total_amount) || 0
    }
  }

  return Object.values(byDay).map(row => {
    const cancel_rate = row.pesanan_masuk > 0
      ? Number(((row.pesanan_batal / row.pesanan_masuk) * 100).toFixed(2))
      : 0
    const paidOrders = Math.max(row.pesanan_masuk - row.pesanan_batal, 0)
    const aov_order = paidOrders > 0
      ? Number((row.omzet / paidOrders).toFixed(0))
      : 0

    return {
      tanggal: row.tanggal,
      channel: 'Shopee',
      omzet: Number(row.omzet.toFixed(0)),
      pesanan_masuk: row.pesanan_masuk,
      pesanan_batal: row.pesanan_batal,
      cancel_rate,
      aov_order,
    }
  })
}

async function upsertPenjualanHarian(supabase, rows) {
  let saved = 0

  for (const row of rows) {
    const { data: existing, error: findErr } = await supabase
      .from('penjualan_harian')
      .select('id')
      .eq('tanggal', row.tanggal)
      .eq('channel', 'Shopee')
      .limit(1)

    if (findErr) {
      throw new Error(`Failed to query penjualan_harian: ${findErr.message}`)
    }

    if (existing?.[0]?.id) {
      const { error } = await supabase
        .from('penjualan_harian')
        .update(row)
        .eq('id', existing[0].id)
      if (error) throw new Error(`Failed to update penjualan_harian: ${error.message}`)
    } else {
      const { error } = await supabase
        .from('penjualan_harian')
        .insert(row)
      if (error) throw new Error(`Failed to insert penjualan_harian: ${error.message}`)
    }
    saved += 1
  }

  return saved
}

export async function sync(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  const supabase = getSupabaseAdmin()

  const { data: connections, error } = await supabase
    .from('marketplace_connections')
    .select('id, shop_id, access_token')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)

  if (error) {
    throw new Error(`Failed to load marketplace connection: ${error.message}`)
  }

  const connection = connections?.[0]
  if (!connection) {
    throw new Error('No active Shopee connection found.')
  }

  const shop_id = String(connection.shop_id)
  const access_token = connection.access_token

  if (!access_token) {
    throw new Error('Active Shopee connection is missing access_token.')
  }

  // Default: last 7 days (API max window per call is 15 days)
  const endDate = params.dateEnd
    ? new Date(params.dateEnd)
    : new Date()
  const startDate = params.dateStart
    ? new Date(params.dateStart)
    : new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000)

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  const timeFrom = Math.floor(startDate.getTime() / 1000)
  const timeTo   = Math.floor(endDate.getTime() / 1000)

  // Shop Performance / Sales: aggregate order metrics for the period
  const orderSns = await fetchAllOrderSns(access_token, shop_id, timeFrom, timeTo)
  const orderDetails = orderSns.length
    ? await fetchOrderDetails(access_token, shop_id, orderSns)
    : []

  const dailyRows = aggregateOrdersByDay(orderDetails)
  const recordsSaved = await upsertPenjualanHarian(supabase, dailyRows)

  await supabase
    .from('marketplace_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
      shop_name: connection.shop_id ? String(connection.shop_id) : shop_id,
    })
    .eq('id', connection.id)

  return {
    success: true,
    marketplace: 'shopee',
    shop_id,
    date_range: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    orders_fetched: orderDetails.length,
    records_saved: recordsSaved,
    apiResponse: {
      order_count: orderDetails.length,
      days: dailyRows.length,
      sample: dailyRows.slice(0, 3),
    },
  }
}
