import { supabase } from '../supabase'

/**
 * Latest Shopee daily sales row from penjualan_harian.
 */
export async function getTodaySales() {
  const { data, error } = await supabase
    .from('penjualan_harian')
    .select('omzet, pesanan_masuk, pesanan_batal, cancel_rate, aov_order')
    .eq('channel', 'Shopee')
    .order('tanggal', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load today sales.')
  }

  console.log('Today Sales Loaded')

  if (!data) {
    return {
      omzet: 0,
      pesanan_masuk: 0,
      pesanan_batal: 0,
      cancel_rate: 0,
      aov_order: 0,
      _empty: true,
    }
  }

  return {
    omzet: Number(data.omzet) || 0,
    pesanan_masuk: Number(data.pesanan_masuk) || 0,
    pesanan_batal: Number(data.pesanan_batal) || 0,
    cancel_rate: Number(data.cancel_rate) || 0,
    aov_order: Number(data.aov_order) || 0,
    _empty: false,
  }
}

/**
 * Last N Shopee daily rows for trend charts (ascending by tanggal).
 */
export async function getSalesTrend(days = 30) {
  const { data, error } = await supabase
    .from('penjualan_harian')
    .select('tanggal, omzet, pesanan_masuk')
    .eq('channel', 'Shopee')
    .order('tanggal', { ascending: false })
    .limit(days)

  if (error) {
    throw new Error(error.message || 'Failed to load sales trend.')
  }

  console.log('Trend Loaded')

  const rows = data || []
  return [...rows]
    .reverse()
    .map(row => ({
      tanggal: row.tanggal,
      omzet: Number(row.omzet) || 0,
      pesanan_masuk: Number(row.pesanan_masuk) || 0,
    }))
}
