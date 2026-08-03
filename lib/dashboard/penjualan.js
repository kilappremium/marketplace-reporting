import { supabase } from '../supabase'

const SALES_COLUMNS = [
  'id',
  'tanggal',
  'channel',
  'brand',
  'officer',
  'omzet',
  'pesanan_masuk',
  'jumlah_produk_terjual',
  'pesanan_batal',
  'cancel_rate',
  'aov_order',
  'pengunjung_toko',
  'visitor_cvr',
  'customer_baru',
  'customer_repeat',
  'repeat_customer_rate',
  'jumlah_gagal_pickup',
  'fail_to_pickup_rate',
  'jumlah_campaign_didaftarkan',
  'omzet_affiliate',
  'biaya_affiliate',
  'pesanan_affiliate',
  'roi_affiliate',
  'biaya_ads',
  'omzet_ads',
  'pesanan_ads',
].join(',')

const PAGE_SIZE = 25

function applyFilters(query, filters = {}) {
  const { dateStart, dateEnd, channel, brand, officer } = filters

  if (dateStart) query = query.gte('tanggal', dateStart)
  if (dateEnd) query = query.lte('tanggal', dateEnd)
  if (channel) query = query.eq('channel', channel)
  if (brand) query = query.eq('brand', brand)
  if (officer) query = query.eq('officer', officer)

  return query
}

function buildSummary(rows = []) {
  const total_omzet = rows.reduce((a, r) => a + (Number(r.omzet) || 0), 0)
  const total_pesanan = rows.reduce((a, r) => a + (Number(r.pesanan_masuk) || 0), 0)
  const total_batal = rows.reduce((a, r) => a + (Number(r.pesanan_batal) || 0), 0)

  const average_aov = total_pesanan > 0
    ? total_omzet / total_pesanan
    : 0

  const average_cancel_rate = total_pesanan > 0
    ? (total_batal / total_pesanan) * 100
    : 0

  return {
    total_omzet: Number(total_omzet.toFixed(0)),
    total_pesanan,
    average_aov: Number(average_aov.toFixed(0)),
    average_cancel_rate: Number(average_cancel_rate.toFixed(2)),
  }
}

/**
 * Filtered, paginated sales list from penjualan_harian.
 *
 * @param {{
 *   dateStart?: string,
 *   dateEnd?: string,
 *   channel?: string,
 *   brand?: string,
 *   officer?: string,
 *   page?: number,
 *   pageSize?: number,
 * }} filters
 */
export async function getSalesList(filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1)
  const pageSize = Math.max(1, Number(filters.pageSize) || PAGE_SIZE)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let listQuery = supabase
    .from('penjualan_harian')
    .select(SALES_COLUMNS, { count: 'exact' })
    .order('tanggal', { ascending: false })
    .range(from, to)

  listQuery = applyFilters(listQuery, filters)

  let summaryQuery = supabase
    .from('penjualan_harian')
    .select('omzet, pesanan_masuk, pesanan_batal, aov_order, cancel_rate')

  summaryQuery = applyFilters(summaryQuery, filters)

  const [listRes, summaryRes] = await Promise.all([listQuery, summaryQuery])

  if (listRes.error) {
    throw new Error(listRes.error.message || 'Failed to load sales list.')
  }
  if (summaryRes.error) {
    throw new Error(summaryRes.error.message || 'Failed to load sales summary.')
  }

  const rows = listRes.data || []
  const total = listRes.count ?? rows.length
  const summary = buildSummary(summaryRes.data || [])

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary,
  }
}
