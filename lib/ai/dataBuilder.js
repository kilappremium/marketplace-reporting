import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return createClient(supabaseUrl, serviceKey)
}

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

function daysAgo(n, from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return toDateStr(d)
}

function num(v) {
  return Number(v) || 0
}

function emptyDay(tanggal) {
  return {
    tanggal,
    omzet: 0,
    orders: 0,
    cancel_rate: 0,
    aov: 0,
  }
}

function findDay(byDate, tanggal) {
  return byDate.get(tanggal) || emptyDay(tanggal)
}

function growthRate(todayVal, yesterdayVal) {
  if (!yesterdayVal) return 0
  return (todayVal - yesterdayVal) / yesterdayVal
}

function averageMetrics(days = []) {
  if (!days.length) {
    return { omzet: 0, orders: 0, cancel_rate: 0, aov: 0 }
  }

  const n = days.length
  const omzet = days.reduce((a, d) => a + d.omzet, 0) / n
  const orders = days.reduce((a, d) => a + d.orders, 0) / n
  const cancel_rate = days.reduce((a, d) => a + d.cancel_rate, 0) / n
  const aov = days.reduce((a, d) => a + d.aov, 0) / n

  return {
    omzet: Number(omzet.toFixed(2)),
    orders: Number(orders.toFixed(2)),
    cancel_rate: Number(cancel_rate.toFixed(4)),
    aov: Number(aov.toFixed(2)),
  }
}

/**
 * Build numeric sales context for a brand from penjualan_harian.
 * No AI / text generation — data only.
 *
 * @param {string} brand
 */
export async function buildSalesContext(brand) {
  if (!brand || !String(brand).trim()) {
    throw new Error('brand is required.')
  }

  const brandName = String(brand).trim()
  const todayStr = daysAgo(0)
  const yesterdayStr = daysAgo(1)
  const start30 = daysAgo(29)

  const supabase = getSupabaseAdmin()

  const { data: rows, error } = await supabase
    .from('penjualan_harian')
    .select('tanggal, omzet, pesanan_masuk, cancel_rate, aov_order')
    .eq('brand', brandName)
    .gte('tanggal', start30)
    .lte('tanggal', todayStr)
    .order('tanggal', { ascending: true })

  if (error) {
    throw new Error(`Failed to load penjualan_harian: ${error.message}`)
  }

  // Aggregate multiple channels/rows per day into one numeric day
  const byDate = new Map()
  for (const row of rows || []) {
    const tanggal = row.tanggal
    const prev = byDate.get(tanggal) || emptyDay(tanggal)
    const omzet = prev.omzet + num(row.omzet)
    const orders = prev.orders + num(row.pesanan_masuk)
    const batalShare = num(row.cancel_rate) * num(row.pesanan_masuk)
    const prevBatalShare = prev.cancel_rate * prev.orders

    byDate.set(tanggal, {
      tanggal,
      omzet,
      orders,
      // weighted cancel_rate by orders; fall back to simple if no orders
      cancel_rate: orders > 0
        ? (prevBatalShare + batalShare) / orders
        : prev.cancel_rate,
      aov: orders > 0 ? omzet / orders : 0,
    })
  }

  // Normalize stored rates to plain numbers
  for (const [key, day] of byDate) {
    byDate.set(key, {
      tanggal: day.tanggal,
      omzet: num(day.omzet),
      orders: num(day.orders),
      cancel_rate: Number(num(day.cancel_rate).toFixed(4)),
      aov: Number(num(day.aov).toFixed(2)),
    })
  }

  const today = findDay(byDate, todayStr)
  const yesterday = findDay(byDate, yesterdayStr)

  const trend7Days = []
  for (let i = 6; i >= 0; i -= 1) {
    trend7Days.push(findDay(byDate, daysAgo(i)))
  }

  const trend30Days = []
  for (let i = 29; i >= 0; i -= 1) {
    trend30Days.push(findDay(byDate, daysAgo(i)))
  }

  const averages = averageMetrics(trend30Days)

  const growth = {
    omzet: Number(growthRate(today.omzet, yesterday.omzet).toFixed(6)),
    orders: Number(growthRate(today.orders, yesterday.orders).toFixed(6)),
    cancel_rate: Number(growthRate(today.cancel_rate, yesterday.cancel_rate).toFixed(6)),
    aov: Number(growthRate(today.aov, yesterday.aov).toFixed(6)),
  }

  const context = {
    brand: brandName,
    today,
    yesterday,
    trend7Days,
    trend30Days,
    averages,
    growth,
  }

  console.log('AI Context Built')

  return context
}
