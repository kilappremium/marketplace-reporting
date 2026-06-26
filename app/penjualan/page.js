'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

// ─── Format helpers ───────────────────────────────────────
const fmtRp  = n => (!n && n !== 0) ? 'Rp 0' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtX   = n => (!n && n !== 0) ? '0x' : Number(n).toFixed(2) + 'x'
const fmt    = n => (!n && n !== 0) ? '0' : Number(n).toLocaleString('id-ID')
const fmtPct = n => (Number(n) >= 0 ? '+' : '') + Number(n).toFixed(1) + '%'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)

const CHANNELS = ['Shopee', 'TikTok', 'Tokopedia', 'Lazada']

const EMPTY_PENJUALAN = {
  tanggal: new Date().toISOString().split('T')[0],
  channel: '',
  gmv: '', visitor: '', pesanan_masuk: '',
  produk_terjual: '', pesanan_batal: '',
  cancel_rate: '', aov_order: '', apv_produk: '',
  basket_size: '', visitor_cvr: '',
  customer_baru: '', customer_repeat: '',
  total_customer: '', repeat_customer_rate: '',
  gagal_pickup: '', fail_to_pickup_rate: '',
  submission_campaign: '',
  gmv_affiliate: '', cost_affiliate: '',
  pesanan_affiliate: '', roi_affiliate: '',
}

// ─── Minggu helper ────────────────────────────────────────
function getWeekRange(weeksAgo = 0) {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 - weeksAgo * 7)
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23,59,59,999)
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  }
}

export default function DashboardPage() {
  const [loading, setLoading]       = useState(true)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiText, setAiText]         = useState('')
  const [aiError, setAiError]       = useState('')
  const [periode, setPeriode]       = useState('minggu')

  // Data states
  const [weeklyAffiliate, setWeeklyAffiliate]   = useState([])
  const [prevWeekAffiliate, setPrevWeekAffiliate] = useState([])
  const [weeklyAds, setWeeklyAds]               = useState({ shopee:[], tiktok:[], meta:[] })
  const [prevAds, setPrevAds]                   = useState({ shopee:[], tiktok:[], meta:[] })
  const [weeklyLive, setWeeklyLive]             = useState([])
  const [prevLive, setPrevLive]                 = useState([])
  const [grafikData, setGrafikData]             = useState([])

  const [showFormPenjualan, setShowFormPenjualan] = useState(false)
  const [formPenjualan, setFormPenjualan]         = useState(EMPTY_PENJUALAN)
  const [savingPenjualan, setSavingPenjualan]     = useState(false)
  const [dataPenjualan, setDataPenjualan]         = useState([])
  const [editPenjualanId, setEditPenjualanId]     = useState(null)

  const thisWeek = getWeekRange(0)
  const lastWeek = getWeekRange(1)

  useEffect(() => { fetchAll(); fetchDataPenjualan() }, [])

  async function fetchAll() {
    setLoading(true)
    const tahun = new Date().getFullYear()

    // Fetch affiliate weekly
    const { data: affAll } = await supabase
      .from('affiliate_weekly')
      .select('*')
      .gte('tanggal', `${tahun}-01-01`)
      .order('tanggal', { ascending: false })

    // Fetch ads semua platform
    const [shopeeRes, tiktokRes, metaRes] = await Promise.all([
      supabase.from('ads_shopee').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_tiktok').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_meta').select('*').gte('tanggal',`${tahun}-01-01`),
    ])

    // Fetch livestream
    const { data: liveAll } = await supabase
      .from('livestream')
      .select('*')
      .gte('tanggal',`${tahun}-01-01`)
      .order('tanggal', { ascending: false })

    const allAff  = affAll || []
    const allLive = liveAll || []
    const allAds  = {
      shopee: shopeeRes.data || [],
      tiktok: tiktokRes.data || [],
      meta:   metaRes.data   || [],
    }

    // Filter minggu ini & minggu lalu
    const filterWeek = (arr, range) =>
      arr.filter(r => r.tanggal >= range.from && r.tanggal <= range.to)

    setWeeklyAffiliate(filterWeek(allAff, thisWeek))
    setPrevWeekAffiliate(filterWeek(allAff, lastWeek))
    setWeeklyLive(filterWeek(allLive, thisWeek))
    setPrevLive(filterWeek(allLive, lastWeek))

    const filterAdsWeek = (ads, range) => ({
      shopee: filterWeek(ads.shopee, range),
      tiktok: filterWeek(ads.tiktok, range),
      meta:   filterWeek(ads.meta, range),
    })
    setWeeklyAds(filterAdsWeek(allAds, thisWeek))
    setPrevAds(filterAdsWeek(allAds, lastWeek))

    // Grafik tren 8 minggu terakhir
    const grafikWeeks = Array.from({length:8}, (_,i) => {
      const range = getWeekRange(7 - i)
      const d = new Date(range.from)
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      const affData = filterWeek(allAff, range)
      const liveData = filterWeek(allLive, range)
      const adsShopee = filterWeek(allAds.shopee, range)
      const adsTiktok = filterWeek(allAds.tiktok, range)
      const adsMeta = filterWeek(allAds.meta, range)
      return {
        label: `W${weekNum}`,
        gmv_affiliate: sum(affData, 'gmv'),
        gmv_live: sum(liveData, 'gmv'),
        biaya_ads: sum(adsShopee,'biaya_iklan') + sum(adsTiktok,'biaya_iklan') + sum(adsMeta,'biaya_iklan'),
        omzet_ads: sum(adsShopee,'omzet') + sum(adsTiktok,'omzet') + sum(adsMeta,'omzet'),
      }
    })
    setGrafikData(grafikWeeks)
    setLoading(false)
  }

  function autoCalcPenjualan(f) {
    const updated = { ...f }
    const gmv = Number(f.gmv) || 0
    const pesananMasuk = Number(f.pesanan_masuk) || 0
    const produkTerjual = Number(f.produk_terjual) || 0
    const pesananBatal = Number(f.pesanan_batal) || 0
    const visitor = Number(f.visitor) || 0
    const custBaru = Number(f.customer_baru) || 0
    const custRepeat = Number(f.customer_repeat) || 0
    const gagalPickup = Number(f.gagal_pickup) || 0
    const gmvAffiliate = Number(f.gmv_affiliate) || 0
    const costAffiliate = Number(f.cost_affiliate) || 0

    if (pesananMasuk && pesananBatal)
      updated.cancel_rate = (pesananBatal / pesananMasuk * 100).toFixed(2)
    if (gmv && pesananMasuk)
      updated.aov_order = (gmv / pesananMasuk).toFixed(0)
    if (gmv && produkTerjual)
      updated.apv_produk = (gmv / produkTerjual).toFixed(0)
    if (produkTerjual && pesananMasuk)
      updated.basket_size = (produkTerjual / pesananMasuk).toFixed(2)
    if (pesananMasuk && visitor)
      updated.visitor_cvr = (pesananMasuk / visitor * 100).toFixed(2)
    updated.total_customer = custBaru + custRepeat
    if (updated.total_customer > 0)
      updated.repeat_customer_rate = (custRepeat / updated.total_customer * 100).toFixed(2)
    if (gagalPickup && pesananMasuk)
      updated.fail_to_pickup_rate = (gagalPickup / pesananMasuk * 100).toFixed(2)
    if (gmvAffiliate && costAffiliate)
      updated.roi_affiliate = (gmvAffiliate / costAffiliate).toFixed(2)

    return updated
  }

  async function fetchDataPenjualan() {
    const tahun = new Date().getFullYear()
    const { data: rows } = await supabase
      .from('penjualan_harian')
      .select('*')
      .gte('tanggal', `${tahun}-01-01`)
      .order('tanggal', { ascending: false })
    setDataPenjualan(rows || [])
  }

  async function handleSubmitPenjualan() {
    if (!formPenjualan.channel || !formPenjualan.tanggal) {
      alert('Channel dan tanggal wajib diisi!')
      return
    }
    setSavingPenjualan(true)
    const calc = autoCalcPenjualan(formPenjualan)
    const payload = {
      tanggal: calc.tanggal,
      channel: calc.channel,
      gmv: Number(calc.gmv) || 0,
      visitor: Number(calc.visitor) || 0,
      pesanan_masuk: Number(calc.pesanan_masuk) || 0,
      produk_terjual: Number(calc.produk_terjual) || 0,
      pesanan_batal: Number(calc.pesanan_batal) || 0,
      cancel_rate: Number(calc.cancel_rate) || 0,
      aov_order: Number(calc.aov_order) || 0,
      apv_produk: Number(calc.apv_produk) || 0,
      basket_size: Number(calc.basket_size) || 0,
      visitor_cvr: Number(calc.visitor_cvr) || 0,
      customer_baru: Number(calc.customer_baru) || 0,
      customer_repeat: Number(calc.customer_repeat) || 0,
      total_customer: Number(calc.total_customer) || 0,
      repeat_customer_rate: Number(calc.repeat_customer_rate) || 0,
      gagal_pickup: Number(calc.gagal_pickup) || 0,
      fail_to_pickup_rate: Number(calc.fail_to_pickup_rate) || 0,
      submission_campaign: Number(calc.submission_campaign) || 0,
      gmv_affiliate: Number(calc.gmv_affiliate) || 0,
      cost_affiliate: Number(calc.cost_affiliate) || 0,
      pesanan_affiliate: Number(calc.pesanan_affiliate) || 0,
      roi_affiliate: Number(calc.roi_affiliate) || 0,
    }
    if (editPenjualanId) {
      await supabase.from('penjualan_harian').update(payload).eq('id', editPenjualanId)
      setEditPenjualanId(null)
    } else {
      await supabase.from('penjualan_harian').insert([payload])
    }
    setSavingPenjualan(false)
    setFormPenjualan(EMPTY_PENJUALAN)
    setShowFormPenjualan(false)
    fetchDataPenjualan()
  }

  // ─── Kalkulasi metrics ────────────────────────────────
  // GMV total minggu ini
  const gmvAff  = sum(weeklyAffiliate, 'gmv')
  const gmvLive = sum(weeklyLive, 'gmv')
  const gmvAdsShopee = sum(weeklyAds.shopee, 'omzet')
  const gmvAdsTiktok = sum(weeklyAds.tiktok, 'omzet')
  const gmvAdsMeta   = sum(weeklyAds.meta, 'omzet')
  const totalGmv = gmvAff + gmvLive

  // GMV minggu lalu
  const prevGmvAff  = sum(prevWeekAffiliate, 'gmv')
  const prevGmvLive = sum(prevLive, 'gmv')
  const prevTotalGmv = prevGmvAff + prevGmvLive

  // Total pesanan
  const totalPesanan = sum(weeklyAffiliate,'pesanan') + sum(weeklyLive,'pesanan')
  const prevPesanan  = sum(prevWeekAffiliate,'pesanan') + sum(prevLive,'pesanan')

  // Total biaya iklan
  const totalBiayaAds = sum(weeklyAds.shopee,'biaya_iklan') +
    sum(weeklyAds.tiktok,'biaya_iklan') + sum(weeklyAds.meta,'biaya_iklan')
  const prevBiayaAds  = sum(prevAds.shopee,'biaya_iklan') +
    sum(prevAds.tiktok,'biaya_iklan') + sum(prevAds.meta,'biaya_iklan')

  // Total omzet dari ads
  const totalOmzetAds = gmvAdsShopee + gmvAdsTiktok + gmvAdsMeta
  const roas = totalBiayaAds > 0 ? totalOmzetAds / totalBiayaAds : 0
  const prevOmzetAds = sum(prevAds.shopee,'omzet') + sum(prevAds.tiktok,'omzet') + sum(prevAds.meta,'omzet')
  const prevRoas = prevBiayaAds > 0 ? prevOmzetAds / prevBiayaAds : 0

  // Sesi livestream
  const totalSesiLive = weeklyLive.length
  const prevSesiLive  = prevLive.length

  // Growth helper
  const growth = (curr, prev) => prev > 0 ? ((curr - prev) / prev * 100) : 0

  const growthGmv     = growth(totalGmv, prevTotalGmv)
  const growthPesanan = growth(totalPesanan, prevPesanan)
  const growthBiaya   = growth(totalBiayaAds, prevBiayaAds)
  const growthRoas    = growth(roas, prevRoas)
  const growthLive    = growth(totalSesiLive, prevSesiLive)

  // ─── Anomali detection ────────────────────────────────
  const anomali = []
  if (growthGmv < -10) anomali.push(`GMV turun ${Math.abs(growthGmv).toFixed(1)}% vs minggu lalu`)
  if (growthPesanan < -10) anomali.push(`Pesanan turun ${Math.abs(growthPesanan).toFixed(1)}% vs minggu lalu`)
  if (growthRoas < -15) anomali.push(`ROAS ads turun ${Math.abs(growthRoas).toFixed(1)}% — review kampanye iklan`)
  if (roas < 2 && totalBiayaAds > 0) anomali.push(`ROAS di bawah 2x — efisiensi iklan perlu dievaluasi`)
  if (totalSesiLive === 0) anomali.push(`Tidak ada sesi livestream minggu ini`)

  // ─── Revenue per channel ──────────────────────────────
  const channelData = [
    { channel: 'Affiliate', gmv: gmvAff, color: '#FF6B35' },
    { channel: 'Livestream', gmv: gmvLive, color: '#FF8C00' },
    { channel: 'Ads', gmv: totalOmzetAds, color: '#FFB347' },
  ].filter(c => c.gmv > 0).sort((a,b) => b.gmv - a.gmv)

  const totalChannel = channelData.reduce((a,b) => a + b.gmv, 0)

  // ─── Tanggal ──────────────────────────────────────────
  const today = new Date().toLocaleDateString('id-ID', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  // ─── AI Analysis ─────────────────────────────────────
  async function generateAI() {
    setAiLoading(true)
    setAiText('')
    setAiError('')

    const konteks = `Kamu adalah analis marketplace e-commerce. 
Analisis data berikut dalam Bahasa Indonesia, maksimal 3 paragraf singkat.
Gunakan **bold** untuk angka penting.

Data minggu ini vs minggu lalu:
- GMV: Rp ${totalGmv.toLocaleString('id-ID')} (${growthGmv.toFixed(1)}% vs minggu lalu)
- Pesanan: ${totalPesanan} (${growthPesanan.toFixed(1)}% vs minggu lalu)  
- Biaya Iklan: Rp ${totalBiayaAds.toLocaleString('id-ID')}
- ROAS: ${roas.toFixed(2)}x
- Sesi Live: ${totalSesiLive}
- GMV Affiliate: Rp ${gmvAff.toLocaleString('id-ID')}
- GMV Livestream: Rp ${gmvLive.toLocaleString('id-ID')}
${anomali.length > 0 ? 'Anomali: ' + anomali.join(', ') : ''}

Berikan: ringkasan performa, temuan penting, rekomendasi.`

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: konteks }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.text)
    } catch (err) {
      setAiError('Gagal memuat analisis AI. Coba lagi.')
    }
    setAiLoading(false)
  }

  // ─── Komponen GrowthBadge ─────────────────────────────
  function GrowthBadge({ value }) {
    const up = value >= 0
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px',
        borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3,
        background: up ? '#DCFCE7' : '#FEE2E2',
        color: up ? '#166534' : '#991B1B',
      }}>
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% vs minggu lalu
      </span>
    )
  }

  // ─── Komponen MetricCard ──────────────────────────────
  function MetricCard({ label, value, growth, prefix, highlight }) {
    return (
      <div style={{
        background: highlight
          ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
          : '#fff',
        border: highlight ? 'none' : '1px solid #FFE0CC',
        borderRadius: 12, padding: '18px 20px',
        boxShadow: '0 2px 8px rgba(255,100,0,0.08)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,100,0,0.15)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,100,0,0.08)'
        }}>
        <p style={{
          margin: '0 0 6px', fontSize: 12, fontWeight: 500,
          color: highlight ? 'rgba(255,255,255,0.8)' : '#999'
        }}>{label}</p>
        <p style={{
          margin: '0 0 10px', fontSize: 24, fontWeight: 700,
          color: highlight ? '#fff' : '#1A1A1A', lineHeight: 1.2,
        }}>{value}</p>
        {growth !== undefined && (
          <GrowthBadge value={growth} />
        )}
      </div>
    )
  }

  const fmtAxis = v => {
    if (v >= 1000000000) return (v/1000000000).toFixed(1) + 'M'
    if (v >= 1000000) return (v/1000000).toFixed(0) + 'jt'
    if (v >= 1000) return (v/1000).toFixed(0) + 'rb'
    return v
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
            Dashboard Utama
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            📅 {today} · Minggu {thisWeek.from} s/d {thisWeek.to}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { setShowFormPenjualan(true); setFormPenjualan(EMPTY_PENJUALAN); setEditPenjualanId(null) }}
            style={{ padding:'8px 18px', borderRadius:8,
              background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
              color:'#fff', border:'none', cursor:'pointer',
              fontSize:13, fontWeight:600 }}>
            + Input Data
          </button>
          <div style={{
            background: '#FFF3ED', border: '1px solid #FFE0CC',
            borderRadius: 8, padding: '6px 12px', fontSize: 12,
            color: '#FF6B35', fontWeight: 500,
          }}>
            🔄 Auto-refresh setiap buka halaman
          </div>
        </div>
      </div>

      {showFormPenjualan && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC',
          borderRadius:12, padding:24, marginBottom:24,
          boxShadow:'0 2px 8px rgba(255,100,0,0.08)' }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:20 }}>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:'#1A1A1A' }}>
                {editPenjualanId ? 'Edit data penjualan' : 'Input data penjualan harian'}
              </p>
              <p style={{ margin:0, fontSize:12, color:'#FF6B35' }}>
                Semua field otomatis dihitung saat diisi
              </p>
            </div>
            <button onClick={() => { setShowFormPenjualan(false); setFormPenjualan(EMPTY_PENJUALAN); setEditPenjualanId(null) }}
              style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999' }}>×</button>
          </div>

          {[
            { title: 'Informasi Dasar', fields: [
              { label:'Tanggal *', name:'tanggal', type:'date' },
              { label:'Channel *', name:'channel', type:'select', options: CHANNELS },
            ]},
            { title: 'Penjualan', fields: [
              { label:'GMV (Rp)', name:'gmv' },
              { label:'Visitor', name:'visitor' },
              { label:'Pesanan Masuk', name:'pesanan_masuk' },
              { label:'Produk Terjual', name:'produk_terjual' },
              { label:'Pesanan Batal', name:'pesanan_batal' },
              { label:'Cancel Rate % (auto)', name:'cancel_rate', auto:true },
              { label:'AOV Order (auto)', name:'aov_order', auto:true },
              { label:'APV Produk (auto)', name:'apv_produk', auto:true },
              { label:'Basket Size (auto)', name:'basket_size', auto:true },
              { label:'Visitor CVR % (auto)', name:'visitor_cvr', auto:true },
            ]},
            { title: 'Customer', fields: [
              { label:'Customer Baru', name:'customer_baru' },
              { label:'Customer Repeat Order', name:'customer_repeat' },
              { label:'Total Customer (auto)', name:'total_customer', auto:true },
              { label:'Repeat Customer Rate % (auto)', name:'repeat_customer_rate', auto:true },
            ]},
            { title: 'Pengiriman & Campaign', fields: [
              { label:'Gagal Pickup', name:'gagal_pickup' },
              { label:'Fail to Pickup Rate % (auto)', name:'fail_to_pickup_rate', auto:true },
              { label:'Submission Campaign', name:'submission_campaign' },
            ]},
            { title: 'Affiliate', fields: [
              { label:'GMV Affiliate (Rp)', name:'gmv_affiliate' },
              { label:'Cost Affiliate (Rp)', name:'cost_affiliate' },
              { label:'Pesanan Affiliate', name:'pesanan_affiliate' },
              { label:'ROI Affiliate (auto)', name:'roi_affiliate', auto:true },
            ]},
          ].map(section => (
            <div key={section.title} style={{ marginBottom:16 }}>
              <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:600,
                color:'#FF8C00', textTransform:'uppercase',
                letterSpacing:'0.08em', background:'#FFF3ED',
                padding:'4px 10px', borderRadius:4, display:'inline-block' }}>
                {section.title}
              </p>
              <div style={{ display:'grid',
                gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))',
                gap:10 }}>
                {section.fields.map(f => (
                  <div key={f.name}>
                    <label style={{ fontSize:12, color:'#374151',
                      fontWeight:500, display:'block', marginBottom:5 }}>
                      {f.label}
                    </label>
                    {f.type === 'select' ? (
                      <select name={f.name}
                        value={formPenjualan[f.name] || ''}
                        onChange={e => setFormPenjualan(
                          autoCalcPenjualan({...formPenjualan, [e.target.name]: e.target.value})
                        )}
                        style={{ width:'100%', padding:'8px 12px',
                          borderRadius:8, border:'1px solid #FFD4B8',
                          fontSize:13, color:'#1A1A1A', background:'#fff' }}>
                        <option value="">-- Pilih --</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type || 'number'}
                        name={f.name}
                        value={formPenjualan[f.name] || ''}
                        readOnly={f.auto}
                        placeholder={f.auto ? 'otomatis' : '0'}
                        onChange={e => !f.auto && setFormPenjualan(
                          autoCalcPenjualan({...formPenjualan, [e.target.name]: e.target.value})
                        )}
                        style={{ width:'100%', padding:'8px 12px',
                          borderRadius:8, fontSize:13,
                          border:'1px solid #FFD4B8',
                          color: f.auto ? '#999' : '#1A1A1A',
                          background: f.auto ? '#FFF8F5' : '#fff',
                          boxSizing:'border-box' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
            <button onClick={() => { setShowFormPenjualan(false); setFormPenjualan(EMPTY_PENJUALAN); setEditPenjualanId(null) }}
              style={{ padding:'9px 20px', borderRadius:8,
                border:'1px solid #FFD4B8', background:'#fff',
                cursor:'pointer', fontSize:13, color:'#374151' }}>
              Batal
            </button>
            <button onClick={handleSubmitPenjualan} disabled={savingPenjualan}
              style={{ padding:'9px 24px', borderRadius:8, border:'none',
                background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {savingPenjualan ? 'Menyimpan...' : editPenjualanId ? 'Perbarui' : 'Simpan data'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid #FFE0CC',
            borderTop: '3px solid #FF6B35',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#999', fontSize: 14 }}>Memuat data dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          {/* ── ANOMALI ALERT ── */}
          {anomali.length > 0 && (
            <div style={{
              background: '#FFF8F0', border: '1px solid #FFD4B8',
              borderLeft: '4px solid #FF6B35',
              borderRadius: 10, padding: '14px 18px', marginBottom: 20,
            }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700,
                fontSize: 13, color: '#FF6B35' }}>
                ⚠️ Perhatian — {anomali.length} anomali terdeteksi
              </p>
              {anomali.map((a, i) => (
                <p key={i} style={{ margin: '2px 0', fontSize: 13, color: '#664400' }}>
                  • {a}
                </p>
              ))}
            </div>
          )}

          {/* ── SUMMARY CARDS ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14, marginBottom: 24,
          }}>
            <MetricCard
              label="Total GMV Minggu Ini"
              value={fmtRp(totalGmv)}
              growth={growthGmv}
              highlight={true}
            />
            <MetricCard
              label="Total Pesanan"
              value={fmt(totalPesanan)}
              growth={growthPesanan}
            />
            <MetricCard
              label="Total Biaya Iklan"
              value={fmtRp(totalBiayaAds)}
              growth={growthBiaya}
            />
            <MetricCard
              label="ROAS Keseluruhan"
              value={fmtX(roas)}
              growth={growthRoas}
            />
            <MetricCard
              label="Sesi Livestream"
              value={fmt(totalSesiLive) + ' sesi'}
              growth={growthLive}
            />
          </div>

          {/* ── AI ANALYSIS ── */}
          <div style={{
            background: '#fff', border: '1px solid #FFE0CC',
            borderRadius: 12, padding: 20, marginBottom: 24,
            boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16,
                }}>✦</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>
                    Ringkasan AI — Minggu ini
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                    Analisis otomatis berdasarkan data aktual
                  </p>
                </div>
              </div>
              <button onClick={generateAI} disabled={aiLoading}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13,
                  fontWeight: 600, cursor: aiLoading ? 'default' : 'pointer',
                  border: 'none',
                  background: aiLoading
                    ? '#FFE0CC'
                    : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                  color: aiLoading ? '#FFB899' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {aiLoading ? (
                  <>
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #FFB899',
                      borderTop: '2px solid #FF6B35',
                      animation: 'spin 1s linear infinite',
                      display: 'inline-block',
                    }} />
                    Menganalisis...
                  </>
                ) : (
                  <>✦ {aiText ? 'Perbarui' : 'Generate'} Analisis</>
                )}
              </button>
            </div>

            {aiError && (
              <p style={{ color: '#DC2626', fontSize: 13 }}>{aiError}</p>
            )}

            {!aiText && !aiLoading && (
              <div style={{
                textAlign: 'center', padding: '32px 0',
                border: '1px dashed #FFD4B8', borderRadius: 10,
                background: '#FFF8F5',
              }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>✦</p>
                <p style={{ fontSize: 14, color: '#999', margin: '0 0 4px' }}>
                  Klik "Generate Analisis" untuk mendapatkan
                </p>
                <p style={{ fontSize: 13, color: '#FFB899', margin: 0 }}>
                  ringkasan performa, deteksi anomali & rekomendasi dari AI
                </p>
              </div>
            )}

            {aiText && (
              <div style={{
                fontSize: 14, lineHeight: 1.7, color: '#374151',
                background: '#FFF8F5', borderRadius: 10,
                padding: '16px 20px', border: '1px solid #FFE0CC',
              }}
                dangerouslySetInnerHTML={{
                  __html: aiText
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B35">$1</strong>')
                    .replace(/\n\n/g, '</p><p style="margin:0 0 10px">')
                    .replace(/\n/g, '<br/>')
                    .replace(/^/, '<p style="margin:0 0 10px">')
                    .replace(/$/, '</p>')
                }}
              />
            )}
          </div>

          {/* ── GRAFIK TREN 8 MINGGU ── */}
          <div style={{
            background: '#fff', border: '1px solid #FFE0CC',
            borderRadius: 12, padding: 20, marginBottom: 24,
            boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700,
              fontSize: 14, color: '#1A1A1A' }}>
              Tren GMV — 8 Minggu Terakhir
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
              Affiliate · Livestream · Biaya Ads
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={grafikData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED" />
                <XAxis dataKey="label"
                  tick={{ fontSize: 11, fill: '#999' }}
                  tickLine={false}
                  axisLine={{ stroke: '#FFE0CC' }} />
                <YAxis tickFormatter={fmtAxis}
                  tick={{ fontSize: 11, fill: '#999' }}
                  tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  formatter={(v, name) => [
                    'Rp ' + Number(v).toLocaleString('id-ID'),
                    name === 'gmv_affiliate' ? 'GMV Affiliate'
                      : name === 'gmv_live' ? 'GMV Livestream'
                      : name === 'biaya_ads' ? 'Biaya Ads'
                      : 'Omzet Ads'
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8,
                    border: '1px solid #FFE0CC' }}
                />
                <Legend formatter={v =>
                  v === 'gmv_affiliate' ? 'GMV Affiliate'
                    : v === 'gmv_live' ? 'GMV Livestream'
                    : v === 'biaya_ads' ? 'Biaya Ads' : 'Omzet Ads'
                } />
                <Line type="monotone" dataKey="gmv_affiliate"
                  stroke="#FF6B35" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FF6B35', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="gmv_live"
                  stroke="#FF8C00" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FF8C00', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="biaya_ads"
                  stroke="#DC2626" strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── REVENUE PER CHANNEL ── */}
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))',
            gap: 16, marginBottom: 24 }}>

            {/* Revenue per channel */}
            <div style={{
              background: '#fff', border: '1px solid #FFE0CC',
              borderRadius: 12, padding: 20,
              boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
            }}>
              <p style={{ margin: '0 0 16px', fontWeight: 700,
                fontSize: 14, color: '#1A1A1A' }}>
                Revenue per Channel
              </p>
              {totalChannel === 0 ? (
                <p style={{ color: '#999', fontSize: 13 }}>Belum ada data minggu ini</p>
              ) : (
                channelData.map(ch => {
                  const pct = totalChannel > 0 ? ch.gmv / totalChannel * 100 : 0
                  return (
                    <div key={ch.channel} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex',
                        justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#374151',
                          fontWeight: 500 }}>{ch.channel}</span>
                        <span style={{ fontSize: 13, fontWeight: 700,
                          color: '#1A1A1A' }}>{fmtRp(ch.gmv)}</span>
                      </div>
                      <div style={{ height: 8, background: '#FFF3ED',
                        borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: pct + '%',
                          background: ch.color,
                          borderRadius: 10,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 11,
                        color: '#999' }}>{pct.toFixed(1)}% dari total</p>
                    </div>
                  )
                })
              )}
            </div>

            {/* Biaya ads per platform */}
            <div style={{
              background: '#fff', border: '1px solid #FFE0CC',
              borderRadius: 12, padding: 20,
              boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
            }}>
              <p style={{ margin: '0 0 16px', fontWeight: 700,
                fontSize: 14, color: '#1A1A1A' }}>
                Biaya & ROAS per Platform Ads
              </p>
              {[
                { label: 'Shopee Ads',
                  biaya: sum(weeklyAds.shopee,'biaya_iklan'),
                  omzet: gmvAdsShopee,
                  color: '#FF6B35' },
                { label: 'TikTok GMV Max',
                  biaya: sum(weeklyAds.tiktok,'biaya_iklan'),
                  omzet: gmvAdsTiktok,
                  color: '#6C63FF' },
                { label: 'Meta Ads',
                  biaya: sum(weeklyAds.meta,'biaya_iklan'),
                  omzet: gmvAdsMeta,
                  color: '#1877F2' },
              ].map(p => {
                const roasP = p.biaya > 0 ? p.omzet / p.biaya : 0
                return (
                  <div key={p.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 0',
                    borderBottom: '1px solid #FFF3ED',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: p.color, flexShrink: 0,
                      }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13,
                          fontWeight: 500, color: '#1A1A1A' }}>
                          {p.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                          Biaya: {fmtRp(p.biaya)}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700,
                        color: roasP >= 3 ? '#166534'
                          : roasP >= 2 ? '#854D0E' : '#991B1B' }}>
                        {roasP > 0 ? roasP.toFixed(2) + 'x' : '-'}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#999' }}>ROAS</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20, marginTop:16,
            boxShadow:'0 2px 8px rgba(255,100,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:16 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#1A1A1A' }}>
                Data Penjualan Harian
              </p>
              <span style={{ fontSize:12, color:'#999' }}>
                {dataPenjualan.length} entri
              </span>
            </div>
            {dataPenjualan.length === 0 ? (
              <p style={{ color:'#999', fontSize:13 }}>
                Belum ada data. Klik "+ Input Data" untuk menambahkan.
              </p>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#FFF3ED' }}>
                      {['Tanggal','Channel','GMV','Visitor','Pesanan','Produk Terjual',
                        'Cancel Rate','AOV','CVR','Total Customer','ROI Affiliate','Aksi']
                        .map(h => (
                        <th key={h} style={{ padding:'10px 12px', color:'#FF6B35',
                          fontWeight:500, fontSize:11, whiteSpace:'nowrap',
                          textAlign: h==='Tanggal'||h==='Channel' ? 'left' : 'right',
                          borderBottom:'1px solid #FFE0CC' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataPenjualan.slice(0,10).map(row => (
                      <tr key={row.id} style={{ borderBottom:'0.5px solid #FFF3ED' }}>
                        <td style={{ padding:'8px 12px', color:'#666', whiteSpace:'nowrap' }}>{row.tanggal}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:500,
                            background: row.channel==='Shopee' ? '#FFF0E6'
                              : row.channel==='TikTok' ? '#F0F0FF'
                              : row.channel==='Tokopedia' ? '#E6FBF0'
                              : '#E6F1FB',
                            color: row.channel==='Shopee' ? '#993C1D'
                              : row.channel==='TikTok' ? '#3C3489'
                              : row.channel==='Tokopedia' ? '#0C5C2E'
                              : '#0C447C',
                          }}>{row.channel}</span>
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:600, color:'#1A1A1A', whiteSpace:'nowrap' }}>
                          Rp {Number(row.gmv).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>
                          {Number(row.visitor).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>
                          {Number(row.pesanan_masuk).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>
                          {Number(row.produk_terjual).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right',
                          color: Number(row.cancel_rate) > 5 ? '#DC2626' : '#166534',
                          fontWeight:500 }}>
                          {Number(row.cancel_rate).toFixed(2)}%</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666', whiteSpace:'nowrap' }}>
                          Rp {Number(row.aov_order).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>
                          {Number(row.visitor_cvr).toFixed(2)}%</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'#666' }}>
                          {Number(row.total_customer).toLocaleString('id-ID')}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right',
                          fontWeight:600,
                          color: Number(row.roi_affiliate) >= 2 ? '#166534' : '#DC2626' }}>
                          {row.roi_affiliate > 0 ? Number(row.roi_affiliate).toFixed(2)+'x' : '-'}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', whiteSpace:'nowrap' }}>
                          <button onClick={() => {
                            setFormPenjualan({...EMPTY_PENJUALAN, ...row})
                            setEditPenjualanId(row.id)
                            setShowFormPenjualan(true)
                            window.scrollTo(0,0)
                          }}
                            style={{ fontSize:11, padding:'3px 10px', borderRadius:6,
                              border:'1px solid #FFD4B8', background:'#fff',
                              cursor:'pointer', marginRight:4, color:'#FF6B35' }}>Edit</button>
                          <button onClick={async () => {
                            if (!confirm('Yakin hapus?')) return
                            await supabase.from('penjualan_harian').delete().eq('id', row.id)
                            fetchDataPenjualan()
                          }}
                            style={{ fontSize:11, padding:'3px 10px', borderRadius:6,
                              border:'1px solid #FECACA', background:'#FEF2F2',
                              color:'#DC2626', cursor:'pointer' }}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}