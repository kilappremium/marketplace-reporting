'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getTodaySales, getSalesTrend } from '../../lib/dashboard/sales'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

// ─── Format helpers ───────────────────────────────────────
const fmtRp  = n => 'Rp ' + (Number(n)||0).toLocaleString('id-ID')
const fmt    = n => (Number(n)||0).toLocaleString('id-ID')
const fmtPct = n => (Number(n)||0).toFixed(2) + '%'
const fmtX   = n => (Number(n)||0).toFixed(2) + 'x'
const sum    = (arr, f) => arr.reduce((a,b) => a+(Number(b[f])||0), 0)
const growthPct = (curr, prev) => prev > 0 ? ((curr-prev)/prev*100) : 0

// ─── GrowthBadge ─────────────────────────────────────────
function GrowthBadge({ value, light }) {
  const up = Number(value) >= 0
  return (
    <span style={{
      fontSize:11, fontWeight:600, padding:'2px 8px',
      borderRadius:20, display:'inline-flex',
      alignItems:'center', gap:3,
      background: light
        ? (up ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)')
        : (up ? '#DCFCE7' : '#FEE2E2'),
      color: light ? '#fff' : (up ? '#166534' : '#991B1B'),
    }}>
      {up ? '▲' : '▼'} {Math.abs(Number(value)).toFixed(1)}%
      <span style={{ fontWeight:400, opacity:0.75, fontSize:10 }}>
        vs periode sblm
      </span>
    </span>
  )
}

// ─── MetricCard ───────────────────────────────────────────
function MetricCard({ label, value, growth, sub, highlight, warning }) {
  return (
    <div style={{
      background: highlight
        ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : '#fff',
      border: warning ? '1px solid #FECACA'
        : highlight ? 'none' : '1px solid #FFE0CC',
      borderRadius:12, padding:'16px 18px',
      boxShadow:'0 2px 8px rgba(255,100,0,0.08)',
    }}>
      <p style={{ margin:'0 0 4px', fontSize:12, fontWeight:500,
        color: highlight ? 'rgba(255,255,255,0.8)' : '#999' }}>
        {label}
      </p>
      <p style={{ margin:'0 0 8px', fontSize:22, fontWeight:700,
        lineHeight:1.2,
        color: highlight ? '#fff' : warning ? '#DC2626' : '#1A1A1A' }}>
        {value}
      </p>
      {growth !== undefined && (
        <GrowthBadge value={growth} light={highlight} />
      )}
      {sub && (
        <p style={{ margin:'4px 0 0', fontSize:10,
          color: highlight ? 'rgba(255,255,255,0.6)' : '#bbb' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  // ─── State ───────────────────────────────────────────────
  const [allData, setAllData]         = useState([])
  const [allLive, setAllLive]         = useState([])
  const [todaySales, setTodaySales]   = useState(null)
  const [trend, setTrend]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Filter states
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd]     = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [filterSource, setFilterSource] = useState('')

  // AI states
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiText, setAiText]           = useState('')
  const [aiError, setAiError]         = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg]         = useState('')

  // ─── Fetch semua data dari Supabase ──────────────────────
  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError('')
    const today = new Date().toISOString().split('T')[0]

    try {
      const [
        sales,
        salesTrend,
        salesRes,
        liveRes
      ] = await Promise.all([

        getTodaySales(),

        getSalesTrend(30),

        fetch('/api/report/sales')
          .then(res => res.json()),

        supabase
          .from('livestream')
          .select(
            'tanggal,gmv,pesanan,durasi_jam,nama_host,platform,jadwal_sesi'
          )
          .gte('tanggal','2026-01-01')
          .lte('tanggal',today)
          .order('tanggal',{ascending:false})

      ])

      console.log('REPORT SALES API:', salesRes)

      if (salesRes.error) throw new Error(salesRes.error)
      if (liveRes.error) throw new Error(liveRes.error.message)

      setTodaySales(sales)
      setTrend(salesTrend)
      setAllData(salesRes.detail || [])
      setAllLive(liveRes.data || [])
      console.log('Dashboard Loaded')
    } catch (err) {
      setError(err.message || 'Gagal memuat dashboard.')
      setTodaySales(null)
      setTrend([])
      setAllData([])
      setAllLive([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncShopee() {
    setSyncLoading(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/marketplace/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'shopee',
          dateStart: filterStart || undefined,
          dateEnd: filterEnd || undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const periode = json.date_start && json.date_end
        ? ` · ${json.date_start} s/d ${json.date_end}`
        : ''
      const brandLabel = json.brand ? ` · brand ${json.brand}` : ''
      setSyncMsg(`✅ Sync Shopee berhasil${periode}${brandLabel} · ${json.synced_days || 0} hari · ${json.total_orders || 0} pesanan · ${json.inserted_rows || 0} insert / ${json.updated_rows || 0} update`)
      await fetchAll()
    } catch (err) {
      setSyncMsg(`❌ Gagal sync: ${err.message}`)
    }
    setSyncLoading(false)
  }

  // ─── Daftar pilihan filter ────────────────────────────────
  const brandOptions = [...new Set(allData.map(r => r.brand).filter(Boolean))].sort()
  const channelOptions = [...new Set(allData.map(r => r.channel).filter(Boolean))].sort()
  const sourceOptions = [
    ...new Set(
      allData
        .map(r => r.source)
        .filter(Boolean)
    )
  ]

  // ─── Default periode: bulan ini ──────────────────────────
  const today = new Date()
  const bulanIni =
    allData.length > 0
      ? String(allData[0].tanggal).slice(0,7)
      : `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
  const bulanLalu = (() => {
    const m = today.getMonth()
    const y = today.getFullYear()
    return m === 0
      ? `${y-1}-12`
      : `${y}-${String(m).padStart(2,'0')}`
  })()

  // ─── Filter data utama ────────────────────────────────────
  function applyFilters(arr, start, end) {
    return arr.filter(r => {
      if (!r.tanggal) return false
      // Filter periode
      if (start && end) {
        if (r.tanggal < start || r.tanggal > end) return false
      } else {
        if (
          !filterStart &&
          !filterEnd &&
          bulanIni &&
          !r.tanggal.startsWith(bulanIni)
        ) {
          return false
        }
      }
      // Filter brand
      if (filterBrand && r.brand !== filterBrand) return false
      // Filter channel
      if (filterChannel && r.channel !== filterChannel) return false
      if (
        filterSource &&
        r.source !== filterSource
      ) return false
      return true
    })
  }

  function applyFiltersPrev(arr) {
    // Tentukan periode aktif
    let activeStart, activeEnd

    if (filterStart && filterEnd) {
      activeStart = new Date(filterStart)
      activeEnd = new Date(filterEnd)
    } else {
      // Default: dari tanggal 1 bulan ini sampai hari ini
      const today = new Date()
      activeStart = new Date(today.getFullYear(), today.getMonth(), 1)
      activeEnd = new Date(today)
    }

    // Hitung durasi periode aktif (dalam hari)
    const durasi = Math.round(
      (activeEnd - activeStart) / (1000*60*60*24)
    ) + 1

    // Periode pembanding = durasi hari yang sama,
    // mundur 1 hari dari awal periode aktif
    const prevEnd = new Date(activeStart)
    prevEnd.setDate(prevEnd.getDate() - 1)

    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - durasi + 1)

    const prevStartStr = prevStart.toISOString().split('T')[0]
    const prevEndStr = prevEnd.toISOString().split('T')[0]

    return arr.filter(r => {
      if (!r.tanggal) return false
      if (r.tanggal < prevStartStr || r.tanggal > prevEndStr) return false
      if (filterBrand && r.brand !== filterBrand) return false
      if (filterChannel && r.channel !== filterChannel) return false
      if (
        filterSource &&
        r.source !== filterSource
      ) return false
      return true
    })
  }

  function applyLiveFilters(arr, start, end) {
    return arr.filter(r => {
      if (!r.tanggal) return false
      if (start && end) {
        if (r.tanggal < start || r.tanggal > end) return false
      } else {
        if (!r.tanggal.startsWith(bulanIni)) return false
      }
      return true
    })
  }

  function applyLiveFiltersPrev(arr) {
    if (filterStart && filterEnd) {
      const start = new Date(filterStart)
      const end = new Date(filterEnd)
      const durasi = Math.round((end-start)/(1000*60*60*24))+1
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate()-1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate()-durasi+1)
      return arr.filter(r => r.tanggal &&
        r.tanggal >= prevStart.toISOString().split('T')[0] &&
        r.tanggal <= prevEnd.toISOString().split('T')[0])
    }
    return arr.filter(r => r.tanggal && r.tanggal.startsWith(bulanLalu))
  }

  const filtered     = applyFilters(allData, filterStart, filterEnd)
  const filteredPrev = applyFiltersPrev(allData)
  const liveFiltered = applyLiveFilters(allLive, filterStart, filterEnd)
  const livePrev     = applyLiveFiltersPrev(allLive)

  // ─── Kalkulasi metrik ─────────────────────────────────────
  // KPI sales dari getTodaySales() (Shopee · data terbaru)
  const totalGmv =
    Number(todaySales?.omzet) || 0

  const prevGmv =
    sum(filteredPrev,'omzet')


  const pesananMasuk =
    Number(todaySales?.pesanan_masuk) || 0

  const prevPesanan =
    sum(filteredPrev,'pesanan_masuk')


  const totalProduk =
    sum(filtered,'jumlah_produk_terjual')

  const prevProduk =
    sum(filteredPrev,'jumlah_produk_terjual')


  const customerBaru =
    sum(filtered,'customer_baru')

  const prevCustomerBaru =
    sum(filteredPrev,'customer_baru')


  const pesananBatal =
    Number(todaySales?.pesanan_batal) || 0


  const cancelRate =
    Number(todaySales?.cancel_rate) || 0


  const gagalPickup =
    sum(filtered,'jumlah_gagal_pickup')


  const failPickupRate =
    sum(filtered,'fail_to_pickup_rate')


  const aovOrder =
    Number(todaySales?.aov_order) || 0


  const prevAov =
    prevPesanan > 0
    ? prevGmv / prevPesanan
    : 0

  // Dari livestream
  const gmvLive        = sum(liveFiltered, 'gmv')
  const prevGmvLive    = sum(livePrev, 'gmv')

  // Kalkulasi turunan
  const totalVisitor   = sum(filtered, 'pengunjung_toko')
  const prevVisitor    = sum(filteredPrev, 'pengunjung_toko')
  const visitorCvr     = totalVisitor > 0 ? pesananMasuk/totalVisitor*100 : 0
  const prevCvr        = prevVisitor > 0
    ? prevPesanan/prevVisitor*100 : 0

  const omzetAds       = sum(filtered, 'omzet_ads')
  const prevOmzetAds   = sum(filteredPrev, 'omzet_ads')
  const gmvAffiliate   = sum(filtered, 'omzet_affiliate')
  const prevGmvAff     = sum(filteredPrev, 'omzet_affiliate')

  // Growth
  const gGmv =
    growthPct(totalGmv, prevGmv)

  const gPesanan =
    growthPct(pesananMasuk, prevPesanan)

  const gProduk =
    growthPct(totalProduk, prevProduk)

  const gCustomer =
    growthPct(customerBaru, prevCustomerBaru)

  const gAov =
    growthPct(aovOrder, prevAov)

  // ─── Grafik harian (dari getSalesTrend) ──────────────────
  const grafikData = trend.map(r => ({
    label: String(r.tanggal || '').slice(5),
    omzet: Number(r.omzet) || 0,
    pesanan_masuk: Number(r.pesanan_masuk) || 0,
  }))

  const hasSalesData = Boolean(
    todaySales && !todaySales._empty
  ) || trend.length > 0

  const fmtAxis = v => {
    if (v >= 1000000000) return (v/1000000000).toFixed(1)+'M'
    if (v >= 1000000) return (v/1000000).toFixed(0)+'jt'
    if (v >= 1000) return (v/1000).toFixed(0)+'rb'
    return v
  }

  // ─── Label periode ────────────────────────────────────────
  const periodeLabel = filterStart && filterEnd
    ? `${filterStart} s/d ${filterEnd}`
    : `Bulan ini (${bulanIni})`

  const compareLabel = (() => {
    let activeStart, activeEnd

    if (filterStart && filterEnd) {
      activeStart = new Date(filterStart)
      activeEnd = new Date(filterEnd)
    } else {
      const today = new Date()
      activeStart = new Date(today.getFullYear(), today.getMonth(), 1)
      activeEnd = new Date(today)
    }

    const durasi = Math.round(
      (activeEnd - activeStart) / (1000*60*60*24)
    ) + 1

    const prevEnd = new Date(activeStart)
    prevEnd.setDate(prevEnd.getDate() - 1)

    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - durasi + 1)

    return `${prevStart.toISOString().split('T')[0]} s/d ${prevEnd.toISOString().split('T')[0]} (${durasi} hari)`
  })()

  // ─── AI Analysis ─────────────────────────────────────────
  async function generateAI() {
    setAiLoading(true)
    setAiText('')
    setAiError('')
    const prompt = `Kamu adalah analis marketplace e-commerce. 
Analisis data berikut dalam Bahasa Indonesia, maksimal 3 paragraf. Gunakan **bold** untuk angka penting.

Periode: ${periodeLabel}
Filter Brand: ${filterBrand || 'Semua'}
Filter Channel: ${filterChannel || 'Semua'}

Data:
- GMV: ${fmtRp(totalGmv)} (${gGmv.toFixed(1)}% vs periode sebelumnya)
- Omzet Ads: ${fmtRp(omzetAds)}
- GMV Affiliate: ${fmtRp(gmvAffiliate)}
- GMV Livestream: ${fmtRp(gmvLive)}
- Visitor: ${fmt(totalVisitor)}
- Visitor CVR: ${fmtPct(visitorCvr.toFixed(2))}
- AOV Order: ${fmtRp(aovOrder.toFixed(0))}
- Cancel Rate: ${fmtPct(cancelRate.toFixed(2))}
- Fail to Pick Up Rate: ${fmtPct(failPickupRate.toFixed(2))}

Berikan: 1) Ringkasan performa 2) Temuan penting 3) Rekomendasi`

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.text)
    } catch (err) {
      setAiError('Gagal memuat analisis AI: ' + err.message)
    }
    setAiLoading(false)
  }

  // ─── Tanggal ──────────────────────────────────────────────
  const tglLabel = new Date().toLocaleDateString('id-ID', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', fontFamily:'sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <p style={{ margin:0, fontSize:20, fontWeight:700, color:'#1A1A1A' }}>
            Dashboard Utama
          </p>
          <p style={{ margin:0, fontSize:12, color:'#999' }}>📅 {tglLabel}</p>
        </div>
        <button onClick={handleSyncShopee} disabled={syncLoading}
          style={{
            padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
            cursor: syncLoading ? 'default' : 'pointer', border:'1.5px solid #EE4D2D',
            background: syncLoading ? '#FFD4B8' : '#FFF0E6', color:'#993C1D',
            display:'flex', alignItems:'center', gap:6,
          }}>
          {syncLoading ? 'Mensinkronkan Shopee...' : '🔄 Sync Shopee Sales'}
        </button>
      </div>

      {syncMsg && (
        <div style={{
          marginBottom:16, padding:'10px 14px', borderRadius:8, fontSize:13,
          background: syncMsg.startsWith('✅') ? '#DCFCE7' : '#FEE2E2',
          color: syncMsg.startsWith('✅') ? '#166534' : '#991B1B',
          border: syncMsg.startsWith('✅') ? '1px solid #BBF7D0' : '1px solid #FECACA',
        }}>
          {syncMsg}
        </div>
      )}

      {/* ── FILTER BAR ── */}
      <div style={{ background:'#fff', border:'1px solid #FFE0CC',
        borderRadius:12, padding:'14px 18px', marginBottom:20,
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
        boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>

        {/* Filter Periode */}
        <span style={{ fontSize:12, color:'#FF8C00', fontWeight:600,
          whiteSpace:'nowrap' }}>Periode:</span>
        <input type="date" value={filterStart}
          onChange={e => setFilterStart(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8,
            border:'1px solid #FFD4B8', fontSize:12, color:'#1A1A1A',
            background:'#fff', outline:'none' }} />
        <span style={{ fontSize:12, color:'#ccc' }}>—</span>
        <input type="date" value={filterEnd}
          onChange={e => setFilterEnd(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8,
            border:'1px solid #FFD4B8', fontSize:12, color:'#1A1A1A',
            background:'#fff', outline:'none' }} />

        {/* Filter Brand */}
        <span style={{ fontSize:12, color:'#FF8C00', fontWeight:600,
          whiteSpace:'nowrap', marginLeft:8 }}>Brand:</span>
        <select value={filterBrand}
          onChange={e => setFilterBrand(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8,
            border:'1px solid #FFD4B8', fontSize:12, color:'#1A1A1A',
            background:'#fff', outline:'none' }}>
          <option value="">Semua Brand</option>
          {brandOptions.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {/* Filter Channel */}
        <span style={{ fontSize:12, color:'#FF8C00', fontWeight:600,
          whiteSpace:'nowrap' }}>Channel:</span>
        <select value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8,
            border:'1px solid #FFD4B8', fontSize:12, color:'#1A1A1A',
            background:'#fff', outline:'none' }}>
          <option value="">Semua Channel</option>
          {channelOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <span style={{
          fontSize:12,
          color:'#FF8C00',
          fontWeight:600
        }}>
          Source:
        </span>

        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          style={{ padding:'6px 10px', borderRadius:8,
            border:'1px solid #FFD4B8', fontSize:12, color:'#1A1A1A',
            background:'#fff', outline:'none' }}
        >
          <option value="">Semua Source</option>
          {sourceOptions.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Reset */}
        {(filterStart || filterEnd || filterBrand || filterChannel || filterSource) && (
          <button onClick={() => {
            setFilterStart(''); setFilterEnd('')
            setFilterBrand(''); setFilterChannel('')
            setFilterSource('')
          }}
            style={{ padding:'6px 12px', borderRadius:8, fontSize:12,
              border:'1px solid #FFE0CC', background:'#FFF3ED',
              color:'#FF6B35', cursor:'pointer', whiteSpace:'nowrap' }}>
            ✕ Reset semua
          </button>
        )}

        {/* Label periode aktif */}
        <span style={{ fontSize:11, color:'#FFB899',
          whiteSpace:'nowrap', marginLeft:'auto' }}>
          {periodeLabel} · vs {compareLabel}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px 0' }}>
          <div style={{
            width:40, height:40, borderRadius:'50%',
            border:'3px solid #FFE0CC', borderTop:'3px solid #FF6B35',
            animation:'spin 1s linear infinite', margin:'0 auto 12px',
          }} />
          <p style={{ color:'#999' }}>Memuat data...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : error ? (
        <div style={{
          textAlign:'center', padding:'48px 20px',
          background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12,
        }}>
          <p style={{ margin:'0 0 8px', fontSize:16, fontWeight:600, color:'#991B1B' }}>
            Gagal memuat dashboard
          </p>
          <p style={{ margin:'0 0 16px', fontSize:13, color:'#B91C1C' }}>
            {error}
          </p>
          <button onClick={fetchAll}
            style={{
              padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600,
              cursor:'pointer', border:'none',
              background:'linear-gradient(135deg,#FF6B35,#FF8C00)', color:'#fff',
            }}>
            Coba lagi
          </button>
        </div>
      ) : !hasSalesData ? (
        <div style={{
          textAlign:'center', padding:'64px 20px',
          background:'#fff', border:'1px dashed #FFD4B8', borderRadius:12,
        }}>
          <p style={{ margin:'0 0 8px', fontSize:16, fontWeight:600, color:'#1A1A1A' }}>
            No sales data yet.
          </p>
          <p style={{ margin:'0 0 16px', fontSize:13, color:'#999' }}>
            Klik &quot;Sync Shopee Sales&quot; untuk menarik data penjualan dari Shopee API.
          </p>
          <button onClick={handleSyncShopee} disabled={syncLoading}
            style={{
              padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600,
              cursor: syncLoading ? 'default' : 'pointer', border:'none',
              background:'linear-gradient(135deg,#FF6B35,#FF8C00)', color:'#fff',
            }}>
            {syncLoading ? 'Mensinkronkan...' : '🔄 Sync Shopee Sales'}
          </button>
        </div>
      ) : (
        <>
          {/* ── INFO JUMLAH DATA ── */}
          <div style={{
            display:'flex',
            gap:12,
            flexWrap:'wrap',
            fontSize:12,
            color:'#999',
            marginBottom:16
          }}>

            <span>
              📊 {filtered.length} data penjualan
            </span>

            <span>
              🟢 API:
              {' '}
              {
                filtered.filter(
                  r=>r.source==='shopee_api'
                ).length
              }
              data
            </span>

            <span>
              📝 Manual:
              {' '}
              {
                filtered.filter(
                  r=>r.source!=='shopee_api'
                ).length
              }
              data
            </span>

          </div>

          {/* ── SUMMARY CARDS ── */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))',
            gap:14, marginBottom:24 }}>

            <MetricCard
              label="GMV"
              value={fmtRp(totalGmv)}
              growth={gGmv}
              sub="Shopee API · omzet"
              highlight
            />

            <MetricCard
              label="Pesanan"
              value={fmt(pesananMasuk)}
              growth={gPesanan}
              sub="Shopee API · pesanan masuk"
            />

            <MetricCard
              label="Produk Terjual"
              value={fmt(totalProduk)}
              growth={gProduk}
              sub="Jumlah produk terjual"
            />

            <MetricCard
              label="AOV Order"
              value={fmtRp(aovOrder)}
              growth={gAov}
              sub="Rata-rata nilai transaksi"
            />

            <MetricCard
              label="Cancel Rate"
              value={fmtPct(cancelRate)}
              warning={cancelRate > 5}
              sub={`${fmt(pesananBatal)} batal ÷ ${fmt(pesananMasuk)} pesanan`}
            />

            <MetricCard
              label="Fail Pickup Rate"
              value={fmtPct(
                failPickupRate
              )}
              warning={failPickupRate > 2}
              sub="Pesanan gagal pickup"
            />

            <MetricCard
              label="Customer Baru"
              value={fmt(customerBaru)}
              growth={gCustomer}
              sub="Customer pertama kali order"
            />

            <MetricCard
              label="Repeat Customer"
              value={
                filtered.length
                ? fmtPct(
                  filtered.reduce(
                    (a,b)=>a+Number(b.repeat_customer_rate||0),0
                  ) / filtered.length
                )
                : '0%'
              }
              sub="Repeat customer rate"
            />

          </div>

          {/* ── AI ANALYSIS ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20, marginBottom:24,
            boxShadow:'0 2px 8px rgba(255,100,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8,
                  background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                  display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:16 }}>✦</div>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14,
                    color:'#1A1A1A' }}>Ringkasan AI</p>
                  <p style={{ margin:0, fontSize:11, color:'#999' }}>
                    {periodeLabel}
                    {filterBrand ? ` · ${filterBrand}` : ''}
                    {filterChannel ? ` · ${filterChannel}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={generateAI} disabled={aiLoading}
                style={{ padding:'8px 18px', borderRadius:8, fontSize:13,
                  fontWeight:600, border:'none',
                  background: aiLoading ? '#FFE0CC'
                    : 'linear-gradient(135deg,#FF6B35,#FF8C00)',
                  color: aiLoading ? '#FFB899' : '#fff',
                  cursor: aiLoading ? 'default' : 'pointer' }}>
                {aiLoading ? '⏳ Menganalisis...' : '✦ Generate Analisis'}
              </button>
            </div>

            {aiError && (
              <p style={{ color:'#DC2626', fontSize:13 }}>{aiError}</p>
            )}

            {!aiText && !aiLoading && (
              <div style={{ textAlign:'center', padding:'28px 0',
                border:'1px dashed #FFD4B8', borderRadius:10,
                background:'#FFF8F5' }}>
                <p style={{ fontSize:13, color:'#999', margin:0 }}>
                  Klik "Generate Analisis" untuk mendapatkan ringkasan dari AI
                </p>
              </div>
            )}

            {aiText && (
              <div style={{ fontSize:14, lineHeight:1.7, color:'#374151',
                background:'#FFF8F5', borderRadius:10,
                padding:'16px 20px', border:'1px solid #FFE0CC' }}
                dangerouslySetInnerHTML={{
                  __html: aiText
                    .replace(/\*\*(.*?)\*\*/g,
                      '<strong style="color:#FF6B35">$1</strong>')
                    .replace(/\n\n/g,
                      '</p><p style="margin:0 0 10px">')
                    .replace(/\n/g, '<br/>')
                    .replace(/^/,
                      '<p style="margin:0 0 10px">')
                    .replace(/$/, '</p>')
                }}
              />
            )}
          </div>

          {/* ── GRAFIK HARIAN ── */}
          {grafikData.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #FFE0CC',
              borderRadius:12, padding:20, marginBottom:24,
              boxShadow:'0 2px 8px rgba(255,100,0,0.06)' }}>
              <p style={{ margin:'0 0 4px', fontWeight:700,
                fontSize:14, color:'#1A1A1A' }}>
                Tren GMV Harian
              </p>
              <p style={{ margin:'0 0 16px', fontSize:12, color:'#999' }}>
                Shopee · 30 hari terakhir · penjualan_harian
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={grafikData}
                  margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED" />
                  <XAxis dataKey="label"
                    tick={{ fontSize:11, fill:'#999' }}
                    tickLine={false}
                    axisLine={{ stroke:'#FFE0CC' }} />
                  <YAxis tickFormatter={fmtAxis}
                    tick={{ fontSize:11, fill:'#999' }}
                    tickLine={false} axisLine={false} width={65} />
                  <Tooltip
                    formatter={v => ['Rp '+Number(v).toLocaleString('id-ID'),'GMV']}
                    labelFormatter={l => 'Tanggal: '+l}
                    contentStyle={{ fontSize:12, borderRadius:8,
                      border:'1px solid #FFE0CC' }} />
                  <Line type="monotone" dataKey="omzet"
                    stroke="#FF6B35" strokeWidth={2.5}
                    dot={{ r:3, fill:'#FF6B35', strokeWidth:0 }}
                    activeDot={{ r:5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── TABEL DATA TERBARU ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20,
            boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
            <p style={{ margin:'0 0 16px', fontWeight:700,
              fontSize:14, color:'#1A1A1A' }}>
              Detail Data Penjualan ({filtered.length} baris)
            </p>
            {filtered.length === 0 ? (
              <p style={{ color:'#999', fontSize:13 }}>
                No sales data yet.
              </p>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse',
                  fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#FFF3ED' }}>
                      {[
                        'Tanggal',
                        'Channel',
                        'Brand',
                        'GMV',
                        'Pesanan',
                        'Produk',
                        'AOV',
                        'Cancel Rate',
                        'Customer Baru',
                        'Repeat Rate',
                        'Source'
                      ].map(h => (
                        <th key={h} style={{ padding:'8px 10px',
                          color:'#FF6B35', fontWeight:500, fontSize:11,
                          whiteSpace:'nowrap',
                          textAlign: h==='Tanggal'||h==='Brand'||h==='Channel'
                            ? 'left' : 'right',
                          borderBottom:'1px solid #FFE0CC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0,20).map(row => (
                      <tr key={row.id}
                        style={{ borderBottom:'0.5px solid #FFF3ED' }}>
                        <td style={{
                          padding:'7px 10px',
                          color:'#666',
                          whiteSpace:'nowrap'
                        }}>
                          {row.tanggal}
                        </td>

                        <td style={{
                          padding:'7px 10px'
                        }}>
                          <span style={{
                            fontSize:11,
                            padding:'2px 8px',
                            borderRadius:20,
                            background:'#FFF0E6',
                            color:'#993C1D'
                          }}>
                            {row.channel}
                          </span>
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          fontWeight:500
                        }}>
                          {row.brand || '-'}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right',
                          fontWeight:600
                        }}>
                          {fmtRp(row.omzet)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right'
                        }}>
                          {fmt(row.pesanan_masuk)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right'
                        }}>
                          {fmt(row.jumlah_produk_terjual)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right'
                        }}>
                          {fmtRp(row.aov_order)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right',
                          color:Number(row.cancel_rate)>5
                            ? '#DC2626'
                            : '#666'
                        }}>
                          {fmtPct(row.cancel_rate)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right'
                        }}>
                          {fmt(row.customer_baru)}
                        </td>

                        <td style={{
                          padding:'7px 10px',
                          textAlign:'right'
                        }}>
                          {fmtPct(row.repeat_customer_rate)}
                        </td>

                        <td style={{
                          padding:'7px 10px'
                        }}>
                          <span style={{
                            fontSize:11,
                            background:'#DCFCE7',
                            color:'#166534',
                            padding:'2px 8px',
                            borderRadius:20
                          }}>
                            {row.source || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > 20 && (
                  <p style={{ margin:'10px 0 0', fontSize:12,
                    color:'#999', textAlign:'center' }}>
                    Menampilkan 20 dari {filtered.length} baris
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}