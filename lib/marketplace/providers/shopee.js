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

  const shopInfo = await shopeeShopGet(
    '/api/v2/shop/get_shop_info',
    data.access_token,
    shop_id
  )

  console.log('SHOP INFO RESULT:', shopInfo)

  console.log(
    'SHOP RESPONSE:',
    JSON.stringify(shopInfo.response, null, 2)
  )

  const shopName = shopInfo.response?.shop_name || shop_id

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
        shop_name: shopName,
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
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  const supabase = getSupabaseAdmin()

  const { data: connections, error: loadError } = await supabase
    .from('marketplace_connections')
    .select('id, shop_id, refresh_token')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')
    .limit(1)

  if (loadError) {
    throw new Error(`Failed to load marketplace connection: ${loadError.message}`)
  }

  const connection = connections?.[0]
  if (!connection) {
    throw new Error('No active Shopee connection found.')
  }

  const shop_id = String(connection.shop_id)
  const refresh_token = connection.refresh_token

  if (!refresh_token) {
    throw new Error('Active Shopee connection is missing refresh_token. Reconnect the shop.')
  }

  const path      = '/api/v2/auth/access_token/get'
  const timestamp = Math.floor(Date.now() / 1000)
  const baseStr   = `${PARTNER_ID}${path}${timestamp}`
  const sign      = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const res = await fetch(
    `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token,
        shop_id: Number(shop_id),
        partner_id: Number(PARTNER_ID),
      }),
    }
  )

  const data = await res.json()

  if (data.error && data.error !== '') {
    const msg = data.message || data.error || 'Shopee token refresh failed.'
    if (
      String(data.error).toLowerCase().includes('refresh') ||
      String(msg).toLowerCase().includes('refresh_token') ||
      String(msg).toLowerCase().includes('invalid')
    ) {
      throw new Error(`Invalid or expired refresh_token: ${msg}. Reconnect the Shopee shop.`)
    }
    throw new Error(msg)
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Shopee refresh response missing access_token or refresh_token.')
  }

  const expireIn = Number(data.expire_in) || 0
  const tokenExpiredAt = expireIn > 0
    ? new Date(Date.now() + expireIn * 1000).toISOString()
    : null

  const updatedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('marketplace_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expired_at: tokenExpiredAt,
      updated_at: updatedAt,
      last_error: null,
    })
    .eq('id', connection.id)

  if (updateError) {
    throw new Error(`Failed to update marketplace connection tokens: ${updateError.message}`)
  }

  return {
    success: true,
    refreshed: true,
    shop_id,
    expires_at: tokenExpiredAt,
  }
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
  const controller = new AbortController()

  const timeout = setTimeout(
    () => controller.abort(),
    15000
  )

  try {

    const start = Date.now()

    const res = await fetch(
      `https://partner.shopeemobile.com${path}?${qs}`,
      {
        signal: controller.signal,
      }
    )

    console.log(
      'SHOPEE API',
      path,
      Date.now() - start,
      'ms'
    )

    return await res.json()

  } catch(error){

    if(error.name === 'AbortError'){
      throw new Error(
        `Shopee API timeout: ${path}`
      )
    }

    throw error

  } finally {

    clearTimeout(timeout)

  }
}

/**
 * Fetch shop profile via signed Shop API.
 * Uses existing HMAC signing (GET /api/v2/shop/get_shop_info).
 */
async function getShopInfo(accessToken, shopId) {
  const result = await shopeeShopGet(
    '/api/v2/shop/get_shop_info',
    accessToken,
    shopId
  )

  if (result.error && result.error !== '') {
    throw new Error(result.message || result.error || 'Shopee get_shop_info failed.')
  }

  return result.response
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

  const chunks = []

  for (let i = 0; i < orderSns.length; i += 50) {
    chunks.push(
      orderSns.slice(i, i + 50)
    )
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const data = await shopeeShopGet(
        path,
        accessToken,
        shopId,
        {
          order_sn_list: chunk.join(','),
          response_optional_fields:
            'total_amount,item_list',
        }
      )

      if (data.error && data.error !== '') {
        throw new Error(
          data.message ||
          data.error ||
          'Shopee get_order_detail failed.'
        )
      }

      return data.response?.order_list || []
    })
  )

  return results.flat()
}

function toDateStr(unixSeconds) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(unixSeconds * 1000))
}

function countProductsSold(order) {
  const items = order.item_list || []
  return items.reduce((sum, item) => {
    return sum + (Number(item.model_quantity_purchased) || 0)
  }, 0)
}

function aggregateOrdersByDay(orderDetails, connection = {}) {
  const byDay = {}

  for (const order of orderDetails) {
    const tanggal = toDateStr(order.create_time || order.update_time || Math.floor(Date.now() / 1000))
    if (!byDay[tanggal]) {
      byDay[tanggal] = {
        tanggal,
        channel:'Shopee',
        source:'shopee_api',
        omzet: 0,
        pesanan_masuk: 0,
        pesanan_batal: 0,
        jumlah_produk_terjual: 0,
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
      row.jumlah_produk_terjual += countProductsSold(order)
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
      jumlah_produk_terjual: row.jumlah_produk_terjual,
      pesanan_batal: row.pesanan_batal,

      shop_id: connection.shop_id,
      shop_name: connection.shop_name,
      brand: connection.brand || null,

      source: 'shopee_api',

      cancel_rate,
      aov_order,
    }
  })
}

async function savePenjualanHarian(supabase, rows) {
  let updatedRows = 0
  let insertedRows = 0

  for (const row of rows) {
    console.log('SAVE ROW:', {
      shop_id: row.shop_id,
      shop_name: row.shop_name,
      source: row.source,
    })

    const metrics = {
      shop_id: row.shop_id,
      shop_name: row.shop_name,

      omzet: row.omzet,
      pesanan_masuk: row.pesanan_masuk,
      jumlah_produk_terjual: row.jumlah_produk_terjual,
      pesanan_batal: row.pesanan_batal,
      cancel_rate: row.cancel_rate,
      aov_order: row.aov_order,
      source: row.source || 'shopee_api',
    }

    let existingQuery = supabase
      .from('penjualan_harian')
      .select('id')
      .eq('tanggal', row.tanggal)
      .eq('channel', 'Shopee')
      .eq('source', 'shopee_api')

    if (row.brand) {
      existingQuery = existingQuery.eq('brand', row.brand)
    }

    const { data: existing, error: findErr } = await existingQuery.limit(1)

    if (findErr) {
      throw new Error(`Failed to query penjualan_harian: ${findErr.message}`)
    }

    let targetId = existing?.[0]?.id

    // Backfill: older sync rows may have null brand for the same day/channel.
    if (!targetId && row.brand) {
      const { data: legacyRows, error: legacyErr } = await supabase
        .from('penjualan_harian')
        .select('id')
        .eq('tanggal', row.tanggal)
        .eq('channel', 'Shopee')
        .is('brand', null)
        .limit(1)

      if (legacyErr) {
        throw new Error(`Failed to query legacy penjualan_harian: ${legacyErr.message}`)
      }
      targetId = legacyRows?.[0]?.id
    }

    if (targetId) {
      console.log('UPDATE PAYLOAD', metrics)

      const { error } = await supabase
        .from('penjualan_harian')
        .update(metrics)
        .eq('id', targetId)

      if (error) {
        throw new Error(`Failed to update penjualan_harian: ${error.message}`)
      }

      console.log('UPDATE EXISTING', row.tanggal)
      updatedRows += 1
    } else {
      const { error } = await supabase
        .from('penjualan_harian')
        .insert({
          tanggal: row.tanggal,
          channel: 'Shopee',
          source: 'shopee_api',
          ...metrics,
        })

      if (error) {
        throw new Error(`Failed to insert penjualan_harian: ${error.message}`)
      }

      console.log('INSERT NEW', row.tanggal)
      insertedRows += 1
    }
  }

  return { updatedRows, insertedRows }
}

function isTokenExpired(tokenExpiredAt) {
  if (!tokenExpiredAt) return true
  return new Date(tokenExpiredAt).getTime() <= Date.now()
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ORDER_RANGE_DAYS = 15
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

function parseWibDateStartMs(dateStr) {
  if (!DATE_RE.test(dateStr)) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`)
  }
  const [y, m, d] = dateStr.split('-').map(Number)
  // Asia/Jakarta = UTC+7 → local midnight as UTC epoch
  return Date.UTC(y, m - 1, d, 0, 0, 0) - WIB_OFFSET_MS
}

function wibTodayStartMs() {
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parseWibDateStartMs(todayStr)
}

/** Default window: yesterday 00:00 → today 23:59:59 WIB. */
function yesterdayToTodayUnixRange() {
  const todayStartMs = wibTodayStartMs()
  const yesterdayStartMs = todayStartMs - 24 * 60 * 60 * 1000
  const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000 - 1000

  return {
    timeFrom: Math.floor(yesterdayStartMs / 1000),
    timeTo: Math.floor(todayEndMs / 1000),
  }
}

function lastHoursUnixRange(hours = 3) {

  const now = Date.now()

  const start =
    now - hours * 60 * 60 * 1000

  return {
    timeFrom: Math.floor(start / 1000),
    timeTo: Math.floor(now / 1000),
  }

}

/**
 * Resolve sync window from optional YYYY-MM-DD filters (inclusive, WIB).
 * Falls back to yesterday→today when both are omitted.
 */
function resolveUnixRange(dateStart, dateEnd) {
  if (!dateStart && !dateEnd) {
    return lastHoursUnixRange()
  }

  if ((dateStart && !dateEnd) || (!dateStart && dateEnd)) {
    throw new Error('Both dateStart and dateEnd are required when filtering by date.')
  }

  const startMs = parseWibDateStartMs(dateStart)
  const endMs = parseWibDateStartMs(dateEnd) + 24 * 60 * 60 * 1000 - 1000

  if (endMs < startMs) {
    throw new Error('dateEnd must be on or after dateStart.')
  }

  return {
    timeFrom: Math.floor(startMs / 1000),
    timeTo: Math.floor(endMs / 1000),
  }
}

/** Shopee get_order_list allows at most 15 days per request. */
function chunkUnixRanges(timeFrom, timeTo, maxDays = MAX_ORDER_RANGE_DAYS) {
  const maxSpanSec = maxDays * 24 * 60 * 60 - 1
  const chunks = []
  let cursor = timeFrom

  while (cursor <= timeTo) {
    const chunkEnd = Math.min(cursor + maxSpanSec, timeTo)
    chunks.push({ timeFrom: cursor, timeTo: chunkEnd })
    cursor = chunkEnd + 1
  }

  return chunks
}

async function syncSingleConnection(connection, params = {}) {

  const supabase = getSupabaseAdmin()

  const { dateStart, dateEnd } = params

  if (isTokenExpired(connection.token_expired_at)) {
    await refreshToken()
    const { data: refreshedRows, error: reloadError } = await supabase
      .from('marketplace_connections')
      .select('id, shop_id, shop_name, brand, access_token, token_expired_at')
      .eq('id', connection.id)
      .limit(1)

    if (reloadError) {
      throw new Error(`Failed to reload connection after refresh: ${reloadError.message}`)
    }
    connection = refreshedRows?.[0]
    if (!connection?.access_token) {
      throw new Error('Shopee access_token missing after refresh.')
    }
  }

  const shop_id = String(connection.shop_id)
  const access_token = connection.access_token
  const brand = connection.brand || null

  if (!access_token) {
    throw new Error('Active Shopee connection is missing access_token.')
  }

  const { timeFrom, timeTo } = resolveUnixRange(dateStart, dateEnd)

  console.log(
    'SYNC RANGE HUMAN',
    {
      from: new Date(timeFrom * 1000).toISOString(),
      to: new Date(timeTo * 1000).toISOString()
    }
  )

  const ranges = chunkUnixRanges(timeFrom, timeTo)

  console.log('SYNC RANGE', {
    dateStart: dateStart || null,
    dateEnd: dateEnd || null,
    timeFrom,
    timeTo,
    chunks: ranges.length,
    brand,
    shop_id,
  })

  console.log(
    'SYNC TIME CHECK',
    {
      from: new Date(timeFrom * 1000).toString(),
      to: new Date(timeTo * 1000).toString(),
    }
  )

  const orderSns = []
  for (const range of ranges) {
    const chunkSns = await fetchAllOrderSns(access_token, shop_id, range.timeFrom, range.timeTo)
    orderSns.push(...chunkSns)
  }

  const uniqueOrderSns = [...new Set(orderSns)]
  const orderDetails = uniqueOrderSns.length
    ? await fetchOrderDetails(access_token, shop_id, uniqueOrderSns)
    : []

  console.log('TOTAL ORDERS', orderDetails.length)

  const dailyRows = aggregateOrdersByDay(orderDetails, connection)

  console.log(
    'DAILY ROW BEFORE SAVE:',
    JSON.stringify(dailyRows, null, 2)
  )

  const { updatedRows, insertedRows } = await savePenjualanHarian(
    supabase,
    dailyRows
  )

  await supabase
    .from('marketplace_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', connection.id)

  console.log('SYNC COMPLETE')

  return {
    success: true,
    connection_id: connection.id,
    synced_days: dailyRows.length,
    total_orders: orderDetails.length,
    updated_rows: updatedRows,
    inserted_rows: insertedRows,
    date_start: dateStart || toDateStr(timeFrom),
    date_end: dateEnd || toDateStr(timeTo),
    brand,
    shop_name: connection.shop_name || null,
  }
}

export async function sync(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  console.log('SYNC START')

  const supabase = getSupabaseAdmin()
  const { connectionId } = params

  let connectionQuery = supabase
    .from('marketplace_connections')
    .select('id, shop_id, shop_name, brand, access_token, token_expired_at')
    .eq('marketplace', 'shopee')
    .eq('status', 'active')

  if (connectionId) {
    connectionQuery = connectionQuery.eq('id', connectionId)
  }

  const { data: connections, error } = await connectionQuery

  if (error) {
    throw new Error(`Failed to load marketplace connection: ${error.message}`)
  }

  if (!connections?.length) {
    throw new Error('No active Shopee connection found.')
  }

  const results = []

  for (const connection of connections) {

    const result = await syncSingleConnection(
      connection,
      params
    )

    results.push(result)

  }

  return {

    success: true,

    total_connections: results.length,

    results

  }
}
