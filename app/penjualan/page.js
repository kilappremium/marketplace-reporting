'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
  const [loading, setLoading]         = useState(true)

  // Filter states
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd]     = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterChannel, setFilterChannel] = useState('')

  // AI states
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiText, setAiText]           = useState('')
  const [aiError, setAiError]         = useState('')

  // ─── Fetch semua data dari Supabase ──────────────────────
  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [penjualanRes, liveRes] = await Promise.all([
      supabase
        .from('penjualan_harian')
        .select('*')
        .gte('tanggal', '2026-01-01')
        .lte('tanggal', today)
        .order('tanggal', { ascending: false }),
      supabase
        .from('livestream')
        .select('tanggal,gmv,pesanan,durasi_jam,nama_host,platform,jadwal_sesi')
        .gte('tanggal', '2026-01-01')
        .lte('tanggal', today)
        .order('tanggal', { ascending: false }),
    ])

    setAllData(penjualanRes.data || [])
    setAllLive(liveRes.data || [])
    setLoading(false)
  }

  // ─── Daftar pilihan filter ────────────────────────────────
  const brandOptions = [...new Set(allData.map(r => r.brand).filter(Boolean))].sort()
  const channelOptions = [...new Set(allData.map(r => r.channel).filter(Boolean))].sort()

  // ─── Default periode: bulan ini ──────────────────────────
  const today = new Date()
  const bulanIni = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
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
        if (!r.tanggal.startsWith(bulanIni)) return false
      }
      // Filter brand
      if (filterBrand && r.brand !== filterBrand) return false
      // Filter channel
      if (filterChannel && r.channel !== filterChannel) return false
      return true
    })
  }

  function applyFiltersPrev(arr) {
    if (filterStart && filterEnd) {
      const start = new Date(filterStart)
      const end = new Date(filterEnd)
      const durasi = Math.round((end-start)/(1000*60*60*24))+1
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate()-1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate()-durasi+1)
      const ps = prevStart.toISOString().split('T')[0]
      const pe = prevEnd.toISOString().split('T')[0]
      return arr.filter(r => {
        if (!r.tanggal) return false
        if (r.tanggal < ps || r.tanggal > pe) return false
        if (filterBrand && r.brand !== filterBrand) return false
        if (filterChannel && r.channel !== filterChannel) return false
        return true
      })
    }
    return arr.filter(r => {
      if (!r.tanggal) return false
      if (!r.tanggal.startsWith(bulanLalu)) return false
      if (filterBrand && r.brand !== filterBrand) return false
      if (filterChannel && r.channel !== filterChannel) return false
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
  // Dari penjualan_harian
  const totalGmv       = sum(filtered, 'gmv')
  const prevGmv        = sum(filteredPrev, 'gmv')
  const omzetAds       = sum(filtered, 'omzet_ads')
  const prevOmzetAds   = sum(filteredPrev, 'omzet_ads')
  const gmvAffiliate   = sum(filtered, 'gmv_affiliate')
  const prevGmvAff     = sum(filteredPrev, 'gmv_affiliate')
  const totalVisitor   = sum(filtered, 'visitor')
  const prevVisitor    = sum(filteredPrev, 'visitor')
  const pesananMasuk   = sum(filtered, 'pesanan_masuk')
  const prevPesanan    = sum(filteredPrev, 'pesanan_masuk')
  const pesananBatal   = sum(filtered, 'pesanan_batal')
  const gagalPickup    = sum(filtered, 'gagal_pickup')

  // Dari livestream
  const gmvLive        = sum(liveFiltered, 'gmv')
  const prevGmvLive    = sum(livePrev, 'gmv')

  // Kalkulasi turunan
  const visitorCvr     = totalVisitor > 0 ? pesananMasuk/totalVisitor*100 : 0
  const prevCvr        = sum(filteredPrev,'visitor') > 0
    ? prevPesanan/sum(filteredPrev,'visitor')*100 : 0
  const aovOrder       = pesananMasuk > 0 ? totalGmv/pesananMasuk : 0
  const prevAov        = prevPesanan > 0 ? prevGmv/prevPesanan : 0
  const cancelRate     = pesananMasuk > 0 ? pesananBatal/pesananMasuk*100 : 0
  const failPickupRate = pesananMasuk > 0 ? gagalPickup/pesananMasuk*100 : 0

  // Growth
  const gGmv     = growthPct(totalGmv, prevGmv)
  const gOmzetAds = growthPct(omzetAds, prevOmzetAds)
  const gGmvAff  = growthPct(gmvAffiliate, prevGmvAff)
  const gGmvLive = growthPct(gmvLive, prevGmvLive)
  const gVisitor = growthPct(totalVisitor, prevVisitor)
  const gCvr     = growthPct(visitorCvr, prevCvr)
  const gAov     = growthPct(aovOrder, prevAov)

  // ─── Grafik harian (dari penjualan_harian) ───────────────
  const grafikData = (() => {
    const grouped = {}
    filtered.forEach(r => {
      const tgl = r.tanggal
      if (!grouped[tgl]) grouped[tgl] = { label: tgl.slice(5), gmv: 0 }
      grouped[tgl].gmv += Number(r.gmv) || 0
    })
    return Object.values(grouped).sort((a,b) => a.label.localeCompare(b.label))
  })()

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
    if (filterStart && filterEnd) {
      const start = new Date(filterStart)
      const end = new Date(filterEnd)
      const durasi = Math.round((end-start)/(1000*60*60*24))+1
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate()-1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate()-durasi+1)
      return `${prevStart.toISOString().split('T')[0]} s/d ${prevEnd.toISOString().split('T')[0]}`
    }
    return `Bulan lalu (${bulanLalu})`
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
      </div>

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

        {/* Reset */}
        {(filterStart || filterEnd || filterBrand || filterChannel) && (
          <button onClick={() => {
            setFilterStart(''); setFilterEnd('')
            setFilterBrand(''); setFilterChannel('')
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
      ) : (
        <>
          {/* ── INFO JUMLAH DATA ── */}
          <div style={{ display:'flex', gap:12, marginBottom:16,
            fontSize:12, color:'#999', flexWrap:'wrap' }}>
            <span>📊 {filtered.length} baris dari penjualan_harian</span>
            {filterBrand && <span>· Brand: <b style={{color:'#FF6B35'}}>{filterBrand}</b></span>}
            {filterChannel && <span>· Channel: <b style={{color:'#FF6B35'}}>{filterChannel}</b></span>}
          </div>

          {/* ── SUMMARY CARDS ── */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))',
            gap:14, marginBottom:24 }}>

            <MetricCard label="GMV"
              value={fmtRp(totalGmv)} growth={gGmv}
              sub="penjualan_harian · kolom gmv"
              highlight />

            <MetricCard label="Omzet Ads"
              value={fmtRp(omzetAds)} growth={gOmzetAds}
              sub="penjualan_harian · kolom omzet_ads" />

            <MetricCard label="GMV Affiliate"
              value={fmtRp(gmvAffiliate)} growth={gGmvAff}
              sub="penjualan_harian · kolom gmv_affiliate" />

            <MetricCard label="GMV Livestream"
              value={fmtRp(gmvLive)} growth={gGmvLive}
              sub={`tabel livestream · ${liveFiltered.length} sesi`} />

            <MetricCard label="Visitor"
              value={fmt(totalVisitor)} growth={gVisitor}
              sub="penjualan_harian · kolom visitor" />

            <MetricCard label="Visitor CVR"
              value={fmtPct(visitorCvr.toFixed(2))} growth={gCvr}
              sub={`${fmt(pesananMasuk)} pesanan ÷ ${fmt(totalVisitor)} visitor`} />

            <MetricCard label="AOV Order"
              value={fmtRp(aovOrder.toFixed(0))} growth={gAov}
              sub={`GMV ÷ ${fmt(pesananMasuk)} pesanan masuk`} />

            <MetricCard label="Cancel Rate"
              value={fmtPct(cancelRate.toFixed(2))}
              warning={cancelRate > 5}
              sub={`${fmt(pesananBatal)} batal ÷ ${fmt(pesananMasuk)} pesanan`} />

            <MetricCard label="Fail to Pick Up Rate"
              value={fmtPct(failPickupRate.toFixed(2))}
              warning={failPickupRate > 2}
              sub={`${fmt(gagalPickup)} gagal ÷ ${fmt(pesananMasuk)} pesanan`} />

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
                {periodeLabel}
                {filterBrand ? ` · ${filterBrand}` : ''}
                {filterChannel ? ` · ${filterChannel}` : ''}
                {' · dari penjualan_harian'}
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
                  <Line type="monotone" dataKey="gmv"
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
                Tidak ada data untuk filter yang dipilih.
              </p>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse',
                  fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#FFF3ED' }}>
                      {['Tanggal','Brand','Channel','GMV','Visitor',
                        'Pesanan','Cancel Rate','AOV','CVR',
                        'GMV Affiliate','Omzet Ads'].map(h => (
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
                        <td style={{ padding:'7px 10px', color:'#666',
                          whiteSpace:'nowrap' }}>{row.tanggal}</td>
                        <td style={{ padding:'7px 10px', color:'#1A1A1A',
                          fontWeight:500 }}>{row.brand || '-'}</td>
                        <td style={{ padding:'7px 10px' }}>
                          <span style={{ fontSize:11, padding:'2px 8px',
                            borderRadius:20, fontWeight:500,
                            background: row.channel==='Shopee' ? '#FFF0E6'
                              : row.channel==='Tiktok'||row.channel==='TikTok'
                                ? '#F0F0FF'
                              : row.channel==='Tokopedia' ? '#E6FBF0'
                              : '#F3F4F6',
                            color: row.channel==='Shopee' ? '#993C1D'
                              : row.channel==='Tiktok'||row.channel==='TikTok'
                                ? '#3C3489'
                              : row.channel==='Tokopedia' ? '#0C5C2E'
                              : '#374151',
                          }}>{row.channel}</span>
                        </td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          fontWeight:600, color:'#1A1A1A', whiteSpace:'nowrap' }}>
                          {fmtRp(row.gmv)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#666' }}>{fmt(row.visitor)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#666' }}>{fmt(row.pesanan_masuk)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color: Number(row.cancel_rate)>5 ? '#DC2626':'#666' }}>
                          {fmtPct(Number(row.cancel_rate||0).toFixed(2))}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#666', whiteSpace:'nowrap' }}>
                          {fmtRp(row.aov_order)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#666' }}>
                          {fmtPct(Number(row.visitor_cvr||0).toFixed(2))}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#166534', whiteSpace:'nowrap' }}>
                          {fmtRp(row.gmv_affiliate)}</td>
                        <td style={{ padding:'7px 10px', textAlign:'right',
                          color:'#666', whiteSpace:'nowrap' }}>
                          {fmtRp(row.omzet_ads)}</td>
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