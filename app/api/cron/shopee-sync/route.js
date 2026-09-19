import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

import {
  createSyncLog,
  finishSyncLog,
  failSyncLog,
} from '@/lib/sync/logger'

export const dynamic = 'force-dynamic'

const SHOPEE_HOST = 'https://partner.shopeemobile.com'
const ORDER_LIST_PATH = '/api/v2/order/get_order_list'
const ORDER_DETAIL_PATH = '/api/v2/order/get_order_detail'
const TOKEN_REFRESH_PATH = '/api/v2/auth/access_token/get'

const UPDATE_TIME_OVERLAP_SECONDS = 15 * 60
const RECONCILE_DAYS = 3
const INITIAL_RECONCILE_DAYS = 7
const MAX_ORDER_RANGE_DAYS = 15
const PAGE_SIZE = 100
const DETAIL_CHUNK_SIZE = 50
const MAX_PAGES = 200
const UPSERT_CHUNK_SIZE = 100
const API_TIMEOUT_MS = 15000

class ShopeeSyncError extends Error {
  constructor(message, { ambiguous = false } = {}) {
    super(message)
    this.name = 'ShopeeSyncError'
    this.ambiguous = ambiguous
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return createClient(supabaseUrl, serviceKey)
}

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: 'CRON_SECRET is not set.' }
  }

  const header = request.headers.get('authorization') || ''
  const bearer = header.toLowerCase().startsWith('bearer ')
    ? header.slice(7).trim()
    : ''
  const xCron = (request.headers.get('x-cron-secret') || '').trim()
  const query = new URL(request.url).searchParams.get('secret') || ''
  const provided = bearer || xCron || query

  if (!provided || provided !== secret) {
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }

  return { ok: true }
}

function toDateStr(unixSeconds) {
  const n = Number(unixSeconds)
  if (!n) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(n * 1000))
}

function unixToIso(unixSeconds) {
  const n = Number(unixSeconds)
  if (!n) return null
  return new Date(n * 1000).toISOString()
}

function isCancelledStatus(status) {
  const normalized = String(status || '').toUpperCase()
  return normalized === 'CANCELLED' || normalized === 'IN_CANCEL'
}

function countProductsSold(order) {
  const items = order.item_list || []
  return items.reduce((sum, item) => {
    return sum + (Number(item.model_quantity_purchased) || 0)
  }, 0)
}

function isTokenExpired(tokenExpiredAt) {
  if (!tokenExpiredAt) return true
  return new Date(tokenExpiredAt).getTime() <= Date.now()
}

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

function resolveSyncWindows(lastSyncAt) {
  const timeTo = Math.floor(Date.now() / 1000)
  const isInitial = !lastSyncAt
  const reconcileDays = isInitial ? INITIAL_RECONCILE_DAYS : RECONCILE_DAYS

  let incrementalFrom
  if (isInitial) {
    incrementalFrom = timeTo - INITIAL_RECONCILE_DAYS * 24 * 60 * 60
  } else {
    incrementalFrom =
      Math.floor(new Date(lastSyncAt).getTime() / 1000) -
      UPDATE_TIME_OVERLAP_SECONDS
  }

  if (!Number.isFinite(incrementalFrom) || incrementalFrom >= timeTo) {
    incrementalFrom = timeTo - UPDATE_TIME_OVERLAP_SECONDS
  }

  const reconcileFrom = timeTo - reconcileDays * 24 * 60 * 60

  return {
    isInitial,
    timeTo,
    incremental: { timeFrom: incrementalFrom, timeTo },
    reconcile: { timeFrom: reconcileFrom, timeTo },
  }
}

function buildShopSign(path, accessToken, shopId) {
  const PARTNER_ID = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
  const timestamp = Math.floor(Date.now() / 1000)
  const baseStr = `${PARTNER_ID}${path}${timestamp}${accessToken}${shopId}`
  const sign = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')
  return { PARTNER_ID, timestamp, sign }
}

async function parseShopeeJson(res, path) {
  let data
  try {
    data = await res.json()
  } catch {
    throw new ShopeeSyncError(
      `Shopee API returned non-JSON for ${path}.`,
      { ambiguous: true }
    )
  }

  if (!res.ok) {
    throw new ShopeeSyncError(
      data?.message || data?.error || `Shopee API HTTP ${res.status} for ${path}.`
    )
  }

  if (data.error && data.error !== '') {
    throw new ShopeeSyncError(data.message || data.error || `Shopee ${path} failed.`)
  }

  return data
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
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const res = await fetch(`${SHOPEE_HOST}${path}?${qs}`, {
      signal: controller.signal,
    })
    return await parseShopeeJson(res, path)
  } catch (error) {
    if (error instanceof ShopeeSyncError) throw error
    if (error.name === 'AbortError') {
      throw new ShopeeSyncError(`Shopee API timeout: ${path}`)
    }
    throw new ShopeeSyncError(error.message || `Shopee API request failed: ${path}`)
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshConnectionToken(supabase, connection) {
  const PARTNER_ID = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
  const shop_id = String(connection.shop_id)
  const refresh_token = connection.refresh_token

  if (!refresh_token) {
    throw new ShopeeSyncError(
      'Active Shopee connection is missing refresh_token. Reconnect the shop.'
    )
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const baseStr = `${PARTNER_ID}${TOKEN_REFRESH_PATH}${timestamp}`
  const sign = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  let data
  try {
    const res = await fetch(
      `${SHOPEE_HOST}${TOKEN_REFRESH_PATH}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token,
          shop_id: Number(shop_id),
          partner_id: Number(PARTNER_ID),
        }),
        signal: controller.signal,
      }
    )
    data = await parseShopeeJson(res, TOKEN_REFRESH_PATH)
  } catch (error) {
    if (error instanceof ShopeeSyncError) throw error
    if (error.name === 'AbortError') {
      throw new ShopeeSyncError(`Shopee API timeout: ${TOKEN_REFRESH_PATH}`)
    }
    throw new ShopeeSyncError(error.message || 'Shopee token refresh failed.')
  } finally {
    clearTimeout(timeout)
  }

  if (!data.access_token || !data.refresh_token) {
    throw new ShopeeSyncError('Shopee refresh response missing access_token or refresh_token.')
  }

  const expireIn = Number(data.expire_in) || 0
  const tokenExpiredAt = expireIn > 0
    ? new Date(Date.now() + expireIn * 1000).toISOString()
    : null

  const { data: updated, error } = await supabase
    .from('marketplace_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expired_at: tokenExpiredAt,
      last_error: null,
    })
    .eq('id', connection.id)
    .select('id, shop_id, shop_name, brand, access_token, refresh_token, token_expired_at, last_sync_at')
    .single()

  if (error) {
    throw new ShopeeSyncError(`Failed to save refreshed Shopee tokens: ${error.message}`)
  }

  return updated
}

function assertOrderListResponse(data) {
  if (!data || typeof data !== 'object' || data.response == null) {
    throw new ShopeeSyncError(
      'Shopee get_order_list returned an empty or malformed response.',
      { ambiguous: true }
    )
  }

  if (!Array.isArray(data.response.order_list)) {
    throw new ShopeeSyncError(
      'Shopee get_order_list omitted order_list; empty result is ambiguous.',
      { ambiguous: true }
    )
  }

  return data.response.order_list
}

function assertOrderDetailResponse(data) {
  if (!data || typeof data !== 'object' || data.response == null) {
    throw new ShopeeSyncError(
      'Shopee get_order_detail returned an empty or malformed response.',
      { ambiguous: true }
    )
  }

  if (!Array.isArray(data.response.order_list)) {
    throw new ShopeeSyncError(
      'Shopee get_order_detail omitted order_list; empty result is ambiguous.',
      { ambiguous: true }
    )
  }

  return data.response.order_list
}

async function fetchOrderSnsByTimeField(accessToken, shopId, timeRangeField, timeFrom, timeTo) {
  const orderSns = []

  for (const range of chunkUnixRanges(timeFrom, timeTo)) {
    let cursor = ''
    let page = 0

    do {
      page += 1
      if (page > MAX_PAGES) {
        throw new ShopeeSyncError(
          `Shopee get_order_list exceeded ${MAX_PAGES} pages for ${timeRangeField}.`
        )
      }

      const data = await shopeeShopGet(ORDER_LIST_PATH, accessToken, shopId, {
        time_range_field: timeRangeField,
        time_from: range.timeFrom,
        time_to: range.timeTo,
        page_size: PAGE_SIZE,
        cursor,
      })

      const list = assertOrderListResponse(data)
      for (const order of list) {
        if (order.order_sn) orderSns.push(order.order_sn)
      }

      cursor = data.response?.next_cursor || ''
    } while (cursor)
  }

  return [...new Set(orderSns)]
}

async function fetchOrderDetails(accessToken, shopId, orderSns) {
  const chunks = []
  for (let i = 0; i < orderSns.length; i += DETAIL_CHUNK_SIZE) {
    chunks.push(orderSns.slice(i, i + DETAIL_CHUNK_SIZE))
  }

  const results = []
  for (const chunk of chunks) {
    const data = await shopeeShopGet(ORDER_DETAIL_PATH, accessToken, shopId, {
      order_sn_list: chunk.join(','),
      response_optional_fields:
        'total_amount,item_list,pay_time,update_time,invoice_data',
    })
    results.push(...assertOrderDetailResponse(data))
  }

  return results
}

function mapOrderRow(order, connection, syncedAt) {
  const createUnix = Number(order.create_time) || 0
  const updateUnix = Number(order.update_time) || 0
  const payUnix = Number(order.pay_time) || 0
  const status = order.order_status || null

  return {
    connection_id: connection.id,
    shop_id: String(connection.shop_id),
    shop_name: connection.shop_name || null,
    brand: connection.brand || null,
    order_sn: order.order_sn,
    order_status: status,
    currency: order.currency || null,
    create_time: unixToIso(createUnix),
    update_time: unixToIso(updateUnix),
    pay_time: unixToIso(payUnix),
    create_date: toDateStr(createUnix),
    pay_date: toDateStr(payUnix),
    update_date: toDateStr(updateUnix),
    total_amount: Number(order.total_amount) || 0,
    item_count: countProductsSold(order),
    is_cancelled: isCancelledStatus(status),
    raw: order,
    last_synced_at: syncedAt,
  }
}

function collectAffectedDates(rows) {
  const dates = new Set()
  for (const row of rows) {
    if (row.create_date) dates.add(row.create_date)
    if (row.pay_date) dates.add(row.pay_date)
    if (row.is_cancelled && row.update_date) dates.add(row.update_date)
  }
  return [...dates].sort()
}

function emptyDailyRow(tanggal, connection) {
  return {
    tanggal,
    channel: 'Shopee',
    source: 'shopee_api',
    omzet: 0,
    pesanan_masuk: 0,
    pesanan_batal: 0,
    jumlah_produk_terjual: 0,
    shop_id: String(connection.shop_id),
    shop_name: connection.shop_name || null,
    brand: connection.brand || null,
  }
}

function finalizeDailyRow(row) {
  const cancel_rate =
    row.pesanan_masuk > 0
      ? Number(((row.pesanan_batal / row.pesanan_masuk) * 100).toFixed(2))
      : 0

  const aov_order =
    row.pesanan_masuk > 0
      ? Number((row.omzet / row.pesanan_masuk).toFixed(0))
      : 0

  return {
    ...row,
    omzet: Number(Number(row.omzet).toFixed(0)),
    cancel_rate,
    aov_order,
  }
}

function isZeroDailyRow(row) {
  return (
    Number(row.omzet) === 0 &&
    Number(row.pesanan_masuk) === 0 &&
    Number(row.pesanan_batal) === 0 &&
    Number(row.jumlah_produk_terjual) === 0
  )
}

async function loadExistingOrderDates(supabase, shopId, orderSns) {
  if (!orderSns.length) return []

  const existing = []
  for (let i = 0; i < orderSns.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = orderSns.slice(i, i + UPSERT_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('shopee_orders')
      .select('order_sn, create_date, pay_date, update_date, is_cancelled')
      .eq('shop_id', shopId)
      .in('order_sn', chunk)

    if (error) {
      throw new ShopeeSyncError(`Failed to load existing shopee_orders: ${error.message}`)
    }
    existing.push(...(data || []))
  }

  return existing
}

async function upsertOrders(supabase, rows) {
  if (!rows.length) return 0

  let upserted = 0
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error } = await supabase
      .from('shopee_orders')
      .upsert(chunk, { onConflict: 'shop_id,order_sn' })

    if (error) {
      throw new ShopeeSyncError(`Failed to upsert shopee_orders: ${error.message}`)
    }
    upserted += chunk.length
  }

  return upserted
}

async function loadOrdersForDates(supabase, shopId, dates) {
  if (!dates.length) return []

  const orFilter = dates
    .flatMap((date) => [
      `create_date.eq.${date}`,
      `pay_date.eq.${date}`,
      `update_date.eq.${date}`,
    ])
    .join(',')

  const { data, error } = await supabase
    .from('shopee_orders')
    .select(
      'order_sn, order_status, create_date, pay_date, update_date, total_amount, item_count, is_cancelled, shop_id, shop_name, brand'
    )
    .eq('shop_id', shopId)
    .or(orFilter)

  if (error) {
    throw new ShopeeSyncError(
      `Failed to load shopee_orders for aggregate rebuild: ${error.message}`
    )
  }

  return data || []
}

function rebuildDailyRows(orders, affectedDates, connection) {
  const byDay = {}
  for (const tanggal of affectedDates) {
    byDay[tanggal] = emptyDailyRow(tanggal, connection)
  }

  for (const order of orders) {
    if (order.create_date && byDay[order.create_date]) {
      byDay[order.create_date].pesanan_masuk += 1
    }

    if (order.pay_date && byDay[order.pay_date]) {
      byDay[order.pay_date].omzet += Number(order.total_amount) || 0
      byDay[order.pay_date].jumlah_produk_terjual += Number(order.item_count) || 0
    }

    if (order.is_cancelled && order.update_date && byDay[order.update_date]) {
      byDay[order.update_date].pesanan_batal += 1
    }
  }

  return affectedDates.map((tanggal) => finalizeDailyRow(byDay[tanggal]))
}

async function saveAffectedDailyRows(supabase, rows) {
  let updatedRows = 0
  let insertedRows = 0
  let skippedZeroInserts = 0

  for (const row of rows) {
    const metrics = {
      shop_id: row.shop_id,
      shop_name: row.shop_name,
      brand: row.brand || null,
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
      throw new ShopeeSyncError(`Failed to query penjualan_harian: ${findErr.message}`)
    }

    let targetId = existing?.[0]?.id

    if (!targetId && row.brand) {
      const { data: legacyRows, error: legacyErr } = await supabase
        .from('penjualan_harian')
        .select('id')
        .eq('tanggal', row.tanggal)
        .eq('channel', 'Shopee')
        .is('brand', null)
        .limit(1)

      if (legacyErr) {
        throw new ShopeeSyncError(
          `Failed to query legacy penjualan_harian: ${legacyErr.message}`
        )
      }
      targetId = legacyRows?.[0]?.id
    }

    if (targetId) {
      const { error } = await supabase
        .from('penjualan_harian')
        .update(metrics)
        .eq('id', targetId)

      if (error) {
        throw new ShopeeSyncError(`Failed to update penjualan_harian: ${error.message}`)
      }
      updatedRows += 1
      continue
    }

    if (isZeroDailyRow(row)) {
      skippedZeroInserts += 1
      continue
    }

    const { error } = await supabase
      .from('penjualan_harian')
      .insert({
        tanggal: row.tanggal,
        channel: 'Shopee',
        source: 'shopee_api',
        ...metrics,
      })

    if (error) {
      throw new ShopeeSyncError(`Failed to insert penjualan_harian: ${error.message}`)
    }
    insertedRows += 1
  }

  return { updatedRows, insertedRows, skippedZeroInserts }
}

async function markConnectionError(supabase, connectionId, message) {
  await supabase
    .from('marketplace_connections')
    .update({ last_error: message })
    .eq('id', connectionId)
}

async function markConnectionSuccess(supabase, connectionId, syncedAt) {
  const { error } = await supabase
    .from('marketplace_connections')
    .update({
      last_sync_at: syncedAt,
      last_error: null,
    })
    .eq('id', connectionId)

  if (error) {
    throw new ShopeeSyncError(`Failed to update last_sync_at: ${error.message}`)
  }
}

async function syncSingleConnection(supabase, connection) {
  if (isTokenExpired(connection.token_expired_at)) {
    connection = await refreshConnectionToken(supabase, connection)
  }

  if (!connection.access_token) {
    throw new ShopeeSyncError('Active Shopee connection is missing access_token.')
  }

  const shopId = String(connection.shop_id)
  const windows = resolveSyncWindows(connection.last_sync_at)
  const syncedAt = new Date().toISOString()

  const incrementalSns = await fetchOrderSnsByTimeField(
    connection.access_token,
    shopId,
    'update_time',
    windows.incremental.timeFrom,
    windows.incremental.timeTo
  )

  const reconcileSns = await fetchOrderSnsByTimeField(
    connection.access_token,
    shopId,
    'create_time',
    windows.reconcile.timeFrom,
    windows.reconcile.timeTo
  )

  const orderSns = [...new Set([...incrementalSns, ...reconcileSns])]

  const orderDetails = orderSns.length
    ? await fetchOrderDetails(connection.access_token, shopId, orderSns)
    : []

  const mappedRows = orderDetails
    .filter((order) => order.order_sn)
    .map((order) => mapOrderRow(order, connection, syncedAt))

  const previousRows = await loadExistingOrderDates(
    supabase,
    shopId,
    mappedRows.map((row) => row.order_sn)
  )

  const affectedDates = collectAffectedDates([...previousRows, ...mappedRows])

  const upserted = await upsertOrders(supabase, mappedRows)

  let updatedRows = 0
  let insertedRows = 0
  let skippedZeroInserts = 0

  if (affectedDates.length) {
    const dbOrders = await loadOrdersForDates(supabase, shopId, affectedDates)
    const dailyRows = rebuildDailyRows(dbOrders, affectedDates, connection)
    const saved = await saveAffectedDailyRows(supabase, dailyRows)
    updatedRows = saved.updatedRows
    insertedRows = saved.insertedRows
    skippedZeroInserts = saved.skippedZeroInserts
  }

  await markConnectionSuccess(supabase, connection.id, syncedAt)

  return {
    success: true,
    connection_id: connection.id,
    shop_id: shopId,
    shop_name: connection.shop_name || null,
    brand: connection.brand || null,
    initial: windows.isInitial,
    incremental_orders: incrementalSns.length,
    reconcile_orders: reconcileSns.length,
    total_orders: mappedRows.length,
    upserted_orders: upserted,
    affected_dates: affectedDates,
    updated_rows: updatedRows,
    inserted_rows: insertedRows,
    skipped_zero_inserts: skippedZeroInserts,
    last_sync_at: syncedAt,
  }
}

async function runReliableShopeeSync({ connectionId } = {}) {
  const PARTNER_ID = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('marketplace_connections')
    .select(
      'id, shop_id, shop_name, brand, access_token, refresh_token, token_expired_at, last_sync_at'
    )
    .eq('marketplace', 'shopee')
    .eq('status', 'active')

  if (connectionId) {
    query = query.eq('id', connectionId)
  }

  const { data: connections, error } = await query
  if (error) {
    throw new Error(`Failed to load marketplace connection: ${error.message}`)
  }

  if (!connections?.length) {
    return {
      success: true,
      total_connections: 0,
      results: [],
      message: 'No active Shopee connection found.',
    }
  }

  const results = []

  for (const connection of connections) {
    let log = null
    try {
      log = await createSyncLog(connection.id)
    } catch (logError) {
      console.error('SHOPEE SYNC LOG CREATE FAILED', logError)
    }

    try {
      const result = await syncSingleConnection(supabase, connection)
      results.push(result)
      if (log?.id) {
        await finishSyncLog(log.id, result)
      }
    } catch (error) {
      const message = error.message || 'Unknown Shopee sync error'
      const ambiguous = Boolean(error.ambiguous)
      console.error('SHOPEE RELIABLE SYNC ERROR', {
        connection_id: connection.id,
        ambiguous,
        message,
      })

      await markConnectionError(supabase, connection.id, message)

      if (log?.id) {
        await failSyncLog(log.id, error)
      }

      results.push({
        success: false,
        connection_id: connection.id,
        shop_id: connection.shop_id,
        ambiguous,
        wrote_aggregates: false,
        last_sync_at_updated: false,
        error: message,
      })
    }
  }

  const successCount = results.filter((result) => result.success).length

  return {
    success: successCount === results.length,
    total_connections: results.length,
    success_count: successCount,
    failed_count: results.length - successCount,
    results,
  }
}

export async function GET(request) {
  const auth = authorizeCron(request)
  if (!auth.ok) {
    return Response.json({ success: false, error: auth.error }, { status: auth.status })
  }

  try {
    const connectionId =
      new URL(request.url).searchParams.get('connectionId') || undefined
    const result = await runReliableShopeeSync({ connectionId })
    return Response.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    console.error('CRON SHOPEE SYNC ERROR', error)
    return Response.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
