'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import * as XLSX from 'xlsx'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// ─── Format helpers ───────────────────────────────────────
const fmtRp  = n => (!n && n !== 0) ? 'Rp 0' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtX   = n => (!n && n !== 0) ? '0x' : Number(n).toFixed(2) + 'x'
const fmt    = n => (!n && n !== 0) ? '0' : Number(n).toLocaleString('id-ID')
const fmtPct = n => Number(n).toFixed(2) + '%'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)
const avg    = (arr, f) => arr.length ? sum(arr, f) / arr.length : 0

const CHANNELS = ['Semua Channel', 'Shopee', 'TikTok', 'Tokopedia', 'Lazada']
const BRANDS = ['Semua Brand', 'Beenteles', 'Kilap Premium', 'Purfress']

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
    to:   sunday.toISOString().split('T')[0],
  }
}

export default function DashboardPage() {
  const [loading, setLoading]     = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText]       = useState('')
  const [aiError, setAiError]     = useState('')
  const [chatOpen, setChatOpen]       = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput]     = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  // ─── Filter channel ───────────────────────────────────
  const [filterChannel, setFilterChannel] = useState('Semua Channel')
  const [filterBrand, setFilterBrand] = useState('Semua Brand')

  // ─── Upload Excel state ───────────────────────────────
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadMsg, setUploadMsg]         = useState('')
  const uploadRef = useRef(null)

  // Data states
  const [weeklyAffiliate, setWeeklyAffiliate]     = useState([])
  const [prevWeekAffiliate, setPrevWeekAffiliate] = useState([])
  const [weeklyAds, setWeeklyAds]                 = useState({ shopee:[], tiktok:[], meta:[] })
  const [prevAds, setPrevAds]                     = useState({ shopee:[], tiktok:[], meta:[] })
  const [weeklyLive, setWeeklyLive]               = useState([])
  const [prevLive, setPrevLive]                   = useState([])

  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd]     = useState('')
  const [allRawAffiliate, setAllRawAffiliate] = useState([])
  const [allRawAds, setAllRawAds]             = useState({ shopee:[], tiktok:[], meta:[] })
  const [allRawLive, setAllRawLive]           = useState([])

  const [showFormPenjualan, setShowFormPenjualan] = useState(false)
  const [formPenjualan, setFormPenjualan]         = useState(EMPTY_PENJUALAN)
  const [savingPenjualan, setSavingPenjualan]     = useState(false)
  const [dataPenjualan, setDataPenjualan]         = useState([])
  const [editPenjualanId, setEditPenjualanId]     = useState(null)

  const thisWeek = getWeekRange(0)
  const lastWeek = getWeekRange(1)

  // ─── Filter by periode ────────────────────────────────
  function filterByPeriod(arr) {
    let filtered = filterStart && filterEnd
      ? arr.filter(r => r.tanggal >= filterStart && r.tanggal <= filterEnd)
      : arr.filter(r => r.tanggal >= thisWeek.from && r.tanggal <= thisWeek.to)
    if (filterChannel && filterChannel !== 'Semua Channel') {
      filtered = filtered.filter(r => (r.channel || r.platform || '').toLowerCase() === filterChannel.toLowerCase())
    }
    if (filterBrand && filterBrand !== 'Semua Brand') {
      filtered = filtered.filter(r => (r.brand || '').toLowerCase() === filterBrand.toLowerCase())
    }
    return filtered
  }

  function filterComparePeriod(arr) {
    let base
    if (filterStart && filterEnd) {
      const start   = new Date(filterStart)
      const end     = new Date(filterEnd)
      const durasi  = Math.round((end - start) / (1000*60*60*24)) + 1
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - durasi + 1)
      base = arr.filter(r =>
        r.tanggal >= prevStart.toISOString().split('T')[0] &&
        r.tanggal <= prevEnd.toISOString().split('T')[0]
      )
    } else {
      base = arr.filter(r => r.tanggal >= lastWeek.from && r.tanggal <= lastWeek.to)
    }
    if (filterChannel && filterChannel !== 'Semua Channel') {
      base = base.filter(r => (r.channel || r.platform || '').toLowerCase() === filterChannel.toLowerCase())
    }
    if (filterBrand && filterBrand !== 'Semua Brand') {
      base = base.filter(r => (r.brand || '').toLowerCase() === filterBrand.toLowerCase())
    }
    return base
  }

  const periodeLabel = filterStart && filterEnd
    ? `${filterStart} s/d ${filterEnd}`
    : `Minggu ini (${thisWeek.from} s/d ${thisWeek.to})`

  const compareLabel = (() => {
    if (filterStart && filterEnd) {
      const start   = new Date(filterStart)
      const end     = new Date(filterEnd)
      const durasi  = Math.round((end - start)/(1000*60*60*24)) + 1
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - durasi + 1)
      return `${prevStart.toISOString().split('T')[0]} s/d ${prevEnd.toISOString().split('T')[0]}`
    }
    return `Minggu lalu (${lastWeek.from} s/d ${lastWeek.to})`
  })()

  useEffect(() => { fetchAll(); fetchDataPenjualan() }, [])

  useEffect(() => {
    if (!allRawAffiliate.length && !allRawLive.length) return
    setWeeklyAffiliate(filterByPeriod(allRawAffiliate))
    setPrevWeekAffiliate(filterComparePeriod(allRawAffiliate))
    setWeeklyLive(filterByPeriod(allRawLive))
    setPrevLive(filterComparePeriod(allRawLive))
    setWeeklyAds({
      shopee: filterByPeriod(allRawAds.shopee),
      tiktok: filterByPeriod(allRawAds.tiktok),
      meta:   filterByPeriod(allRawAds.meta),
    })
    setPrevAds({
      shopee: filterComparePeriod(allRawAds.shopee),
      tiktok: filterComparePeriod(allRawAds.tiktok),
      meta:   filterComparePeriod(allRawAds.meta),
    })
  }, [filterStart, filterEnd, filterChannel, filterBrand, allRawAffiliate, allRawLive, allRawAds])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function fetchAll() {
    setLoading(true)
    const tahun = new Date().getFullYear()
    const { data: affAll }  = await supabase.from('affiliate_weekly').select('*').gte('tanggal',`${tahun}-01-01`).order('tanggal',{ascending:false})
    const [shopeeRes, tiktokRes, metaRes] = await Promise.all([
      supabase.from('ads_shopee').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_tiktok').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_meta').select('*').gte('tanggal',`${tahun}-01-01`),
    ])
    const { data: liveAll } = await supabase.from('livestream').select('*').gte('tanggal',`${tahun}-01-01`).order('tanggal',{ascending:false})

    const allAff  = affAll  || []
    const allLive = liveAll || []
    const allAds  = { shopee: shopeeRes.data||[], tiktok: tiktokRes.data||[], meta: metaRes.data||[] }

    setAllRawAffiliate(allAff)
    setAllRawAds(allAds)
    setAllRawLive(allLive)

    setLoading(false)
  }

  // ─── Upload Excel handler ─────────────────────────────
  async function handleUploadExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    setUploadMsg('')
    try {
      const buffer = await file.arrayBuffer()
      const wb     = XLSX.read(buffer)
      const ws     = wb.Sheets[wb.SheetNames[0]]
      const rows   = XLSX.utils.sheet_to_json(ws)

      if (!rows.length) throw new Error('File kosong atau format tidak dikenali')

      // Normalisasi kolom — sesuaikan dengan header Excel Anda
      const payload = rows.map(r => ({
        tanggal:              r['Tanggal']            || r['tanggal']            || '',
        channel:              r['Channel']            || r['channel']            || '',
        gmv:                  Number(r['GMV']          || r['gmv'])              || 0,
        visitor:              Number(r['Visitor']      || r['visitor'])          || 0,
        pesanan_masuk:        Number(r['Pesanan Masuk']|| r['pesanan_masuk'])    || 0,
        produk_terjual:       Number(r['Produk Terjual']||r['produk_terjual'])   || 0,
        pesanan_batal:        Number(r['Pesanan Batal']|| r['pesanan_batal'])    || 0,
        cancel_rate:          Number(r['Cancel Rate']  || r['cancel_rate'])      || 0,
        aov_order:            Number(r['AOV Order']    || r['aov_order'])        || 0,
        visitor_cvr:          Number(r['CVR']          || r['visitor_cvr'])      || 0,
        gagal_pickup:         Number(r['Gagal Pickup'] || r['gagal_pickup'])     || 0,
        fail_to_pickup_rate:  Number(r['Fail to Pickup Rate']||r['fail_to_pickup_rate'])||0,
        gmv_affiliate:        Number(r['GMV Affiliate']|| r['gmv_affiliate'])    || 0,
        cost_affiliate:       Number(r['Cost Affiliate']||r['cost_affiliate'])   || 0,
        pesanan_affiliate:    Number(r['Pesanan Affiliate']||r['pesanan_affiliate'])||0,
        roi_affiliate:        Number(r['ROI Affiliate']|| r['roi_affiliate'])    || 0,
      })).filter(r => r.tanggal && r.channel)

      if (!payload.length) throw new Error('Tidak ada baris valid (pastikan kolom Tanggal & Channel terisi)')

      const { error } = await supabase.from('penjualan_harian').insert(payload)
      if (error) throw error

      setUploadMsg(`✅ ${payload.length} baris berhasil diimpor`)
      fetchDataPenjualan()
    } catch (err) {
      setUploadMsg(`❌ Gagal: ${err.message}`)
    }
    setUploadLoading(false)
    e.target.value = ''
  }

  // ─── Auto calc form ───────────────────────────────────
  function autoCalcPenjualan(f) {
    const updated = { ...f }
    const gmv          = Number(f.gmv)||0
    const pesananMasuk = Number(f.pesanan_masuk)||0
    const produkTerjual= Number(f.produk_terjual)||0
    const pesananBatal = Number(f.pesanan_batal)||0
    const visitor      = Number(f.visitor)||0
    const custBaru     = Number(f.customer_baru)||0
    const custRepeat   = Number(f.customer_repeat)||0
    const gagalPickup  = Number(f.gagal_pickup)||0
    const gmvAffiliate = Number(f.gmv_affiliate)||0
    const costAffiliate= Number(f.cost_affiliate)||0
    if (pesananMasuk && pesananBatal) updated.cancel_rate   = (pesananBatal/pesananMasuk*100).toFixed(2)
    if (gmv && pesananMasuk)          updated.aov_order     = (gmv/pesananMasuk).toFixed(0)
    if (gmv && produkTerjual)         updated.apv_produk    = (gmv/produkTerjual).toFixed(0)
    if (produkTerjual && pesananMasuk)updated.basket_size   = (produkTerjual/pesananMasuk).toFixed(2)
    if (pesananMasuk && visitor)      updated.visitor_cvr   = (pesananMasuk/visitor*100).toFixed(2)
    updated.total_customer = custBaru + custRepeat
    if (updated.total_customer > 0)   updated.repeat_customer_rate = (custRepeat/updated.total_customer*100).toFixed(2)
    if (gagalPickup && pesananMasuk)  updated.fail_to_pickup_rate  = (gagalPickup/pesananMasuk*100).toFixed(2)
    if (gmvAffiliate && costAffiliate)updated.roi_affiliate = (gmvAffiliate/costAffiliate).toFixed(2)
    return updated
  }

  async function fetchDataPenjualan() {
    const tahun = new Date().getFullYear()
    const { data: rows } = await supabase.from('penjualan_harian').select('*').gte('tanggal',`${tahun}-01-01`).order('tanggal',{ascending:false})
    setDataPenjualan(rows || [])
  }

  async function handleSubmitPenjualan() {
    if (!formPenjualan.channel || !formPenjualan.tanggal) { alert('Channel dan tanggal wajib diisi!'); return }
    setSavingPenjualan(true)
    const calc = autoCalcPenjualan(formPenjualan)
    const payload = Object.fromEntries(
      Object.entries(calc).map(([k,v]) => [k, k==='tanggal'||k==='channel' ? v : Number(v)||0])
    )
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
  const gmvAff       = sum(weeklyAffiliate,'gmv')
  const gmvLive      = sum(weeklyLive,'gmv')
  const gmvAdsShopee = sum(weeklyAds.shopee,'omzet')
  const gmvAdsTiktok = sum(weeklyAds.tiktok,'omzet')
  const gmvAdsMeta   = sum(weeklyAds.meta,'omzet')
  const gmvAdsTotal  = gmvAdsShopee + gmvAdsTiktok + gmvAdsMeta
  const totalGmv     = gmvAff + gmvLive + gmvAdsTotal

  const prevGmvAff   = sum(prevWeekAffiliate,'gmv')
  const prevGmvLive  = sum(prevLive,'gmv')
  const prevGmvAds   = sum(prevAds.shopee,'omzet') + sum(prevAds.tiktok,'omzet') + sum(prevAds.meta,'omzet')
  const prevTotalGmv = prevGmvAff + prevGmvLive + prevGmvAds

  const totalPesanan = sum(weeklyAffiliate,'pesanan') + sum(weeklyLive,'pesanan')
  const prevPesanan  = sum(prevWeekAffiliate,'pesanan') + sum(prevLive,'pesanan')

  const totalBiayaAds = sum(weeklyAds.shopee,'biaya_iklan') + sum(weeklyAds.tiktok,'biaya_iklan') + sum(weeklyAds.meta,'biaya_iklan')
  const prevBiayaAds  = sum(prevAds.shopee,'biaya_iklan')   + sum(prevAds.tiktok,'biaya_iklan')   + sum(prevAds.meta,'biaya_iklan')
  const prevOmzetAds  = sum(prevAds.shopee,'omzet')         + sum(prevAds.tiktok,'omzet')         + sum(prevAds.meta,'omzet')

  const roas     = totalBiayaAds > 0 ? gmvAdsTotal / totalBiayaAds : 0
  const prevRoas = prevBiayaAds  > 0 ? prevOmzetAds / prevBiayaAds  : 0

  const totalSesiLive = weeklyLive.length
  const prevSesiLive  = prevLive.length

  // ─── Metrik Summary Performa (dari penjualan_harian) ─
  const penjualanFiltered = dataPenjualan.filter(r => {
    const inPeriod = filterStart && filterEnd
      ? r.tanggal >= filterStart && r.tanggal <= filterEnd
      : r.tanggal >= thisWeek.from && r.tanggal <= thisWeek.to
    const inChannel = !filterChannel || filterChannel === 'Semua Channel'
      ? true : r.channel?.toLowerCase() === filterChannel.toLowerCase()
    const inBrand = !filterBrand || filterBrand === 'Semua Brand'
      ? true : (r.brand || '').toLowerCase() === filterBrand.toLowerCase()
    return inPeriod && inChannel && inBrand
  })

  const spVisitor        = sum(penjualanFiltered,'visitor')
  const spPesanan        = sum(penjualanFiltered,'pesanan_masuk')
  const spGmv            = sum(penjualanFiltered,'gmv')
  const spBatal          = sum(penjualanFiltered,'pesanan_batal')
  const spGagalPickup    = sum(penjualanFiltered,'gagal_pickup')
  const spGmvAffiliate   = sum(penjualanFiltered,'gmv_affiliate')
  const spCostAffiliate  = sum(penjualanFiltered,'cost_affiliate')
  const spCancelRate     = spPesanan      > 0 ? spBatal       / spPesanan      * 100 : 0
  const spCvr            = spVisitor      > 0 ? spPesanan     / spVisitor      * 100 : 0
  const spAov            = spPesanan      > 0 ? spGmv         / spPesanan             : 0
  const spFailRate       = spPesanan      > 0 ? spGagalPickup / spPesanan      * 100 : 0
  const spRoi            = spCostAffiliate > 0 ? spGmvAffiliate / spCostAffiliate     : 0
  // CTR: dari ads (klik/impresi) — ambil rata-rata jika ada kolom ctr
  const allAdsRows       = [...weeklyAds.shopee, ...weeklyAds.tiktok, ...weeklyAds.meta]
  const spCtr            = allAdsRows.length > 0 ? avg(allAdsRows,'ctr') : 0

  // Periode sebelumnya untuk Summary Performa
  const penjualanPrevFiltered = dataPenjualan.filter(r => {
    const inPeriod = filterStart && filterEnd
      ? (() => {
          const start = new Date(filterStart)
          const end = new Date(filterEnd)
          const durasi = Math.round((end - start)/(1000*60*60*24)) + 1
          const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
          const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - durasi + 1)
          return r.tanggal >= prevStart.toISOString().split('T')[0] && r.tanggal <= prevEnd.toISOString().split('T')[0]
        })()
      : r.tanggal >= lastWeek.from && r.tanggal <= lastWeek.to
    const inChannel = !filterChannel || filterChannel === 'Semua Channel'
      ? true : r.channel?.toLowerCase() === filterChannel.toLowerCase()
    const inBrand = !filterBrand || filterBrand === 'Semua Brand'
      ? true : (r.brand || '').toLowerCase() === filterBrand.toLowerCase()
    return inPeriod && inChannel && inBrand
  })

  const prevSpVisitor   = sum(penjualanPrevFiltered, 'visitor')
  const prevSpPesanan   = sum(penjualanPrevFiltered, 'pesanan_masuk')
  const prevSpGmv       = sum(penjualanPrevFiltered, 'gmv')
  const prevSpBatal     = sum(penjualanPrevFiltered, 'pesanan_batal')
  const prevSpGagal     = sum(penjualanPrevFiltered, 'gagal_pickup')
  const prevSpGmvAff    = sum(penjualanPrevFiltered, 'gmv_affiliate')
  const prevSpCostAff   = sum(penjualanPrevFiltered, 'cost_affiliate')
  const prevSpCancelRate  = prevSpPesanan > 0 ? prevSpBatal / prevSpPesanan * 100 : 0
  const prevSpCvr         = prevSpVisitor  > 0 ? prevSpPesanan / prevSpVisitor * 100 : 0
  const prevSpAov         = prevSpPesanan  > 0 ? prevSpGmv / prevSpPesanan : 0
  const prevSpFailRate    = prevSpPesanan  > 0 ? prevSpGagal / prevSpPesanan * 100 : 0
  const prevSpRoi         = prevSpCostAff  > 0 ? prevSpGmvAff / prevSpCostAff : 0
  const prevAllAdsRows    = [...prevAds.shopee, ...prevAds.tiktok, ...prevAds.meta]
  const prevSpCtr         = prevAllAdsRows.length > 0 ? avg(prevAllAdsRows, 'ctr') : 0

  const growth = (curr, prev) => prev > 0 ? ((curr - prev)/prev*100) : 0
  const growthGmv     = growth(totalGmv,     prevTotalGmv)
  const growthPesanan = growth(totalPesanan, prevPesanan)
  const growthBiaya   = growth(totalBiayaAds,prevBiayaAds)
  const growthRoas    = growth(roas,          prevRoas)
  const growthLive    = growth(totalSesiLive, prevSesiLive)

  const growthGmvAds      = growth(gmvAdsTotal,    prevGmvAds)
  const growthGmvAff      = growth(gmvAff,          prevGmvAff)
  const growthGmvLive     = growth(gmvLive,         prevGmvLive)
  const growthVisitor     = growth(spVisitor,       prevSpVisitor)
  const growthCtr         = growth(spCtr,           prevSpCtr)
  const growthCvr         = growth(spCvr,           prevSpCvr)
  const growthAov         = growth(spAov,           prevSpAov)
  const growthCancelRate  = growth(spCancelRate,    prevSpCancelRate)
  const growthFailRate    = growth(spFailRate,      prevSpFailRate)
  const growthRoi         = growth(spRoi,           prevSpRoi)

  // ─── Anomali ──────────────────────────────────────────
  const anomali = []
  if (growthGmv     < -10) anomali.push(`GMV turun ${Math.abs(growthGmv).toFixed(1)}% vs periode sebelumnya`)
  if (growthPesanan < -10) anomali.push(`Pesanan turun ${Math.abs(growthPesanan).toFixed(1)}% vs periode sebelumnya`)
  if (growthRoas    < -15) anomali.push(`ROAS ads turun ${Math.abs(growthRoas).toFixed(1)}% — review kampanye iklan`)
  if (roas < 2 && totalBiayaAds > 0) anomali.push(`ROAS di bawah 2x — efisiensi iklan perlu dievaluasi`)
  if (totalSesiLive === 0) anomali.push(`Tidak ada sesi livestream periode ini`)
  if (spCancelRate  > 5)  anomali.push(`Cancel rate ${spCancelRate.toFixed(1)}% — di atas threshold 5%`)
  if (spFailRate    > 3)  anomali.push(`Fail to pickup rate ${spFailRate.toFixed(1)}% — perlu ditangani`)

  // ─── Channel data ─────────────────────────────────────
  const channelData = [
    { channel:'Affiliate',  gmv: gmvAff,      color:'#FF6B35' },
    { channel:'Livestream', gmv: gmvLive,     color:'#FF8C00' },
    { channel:'Ads',        gmv: gmvAdsTotal, color:'#FFB347' },
  ].filter(c => c.gmv > 0).sort((a,b) => b.gmv - a.gmv)
  const totalChannel = channelData.reduce((a,b) => a + b.gmv, 0)

  const today = new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

  // ─── AI ──────────────────────────────────────────────
  async function generateAI() {
    setAiLoading(true); setAiText(''); setAiError('')
    const konteks = `Kamu adalah analis marketplace e-commerce.
Analisis data berikut dalam Bahasa Indonesia, maksimal 3 paragraf singkat.
Gunakan **bold** untuk angka penting.

Data ${periodeLabel}:
- GMV Total: Rp ${totalGmv.toLocaleString('id-ID')} (${growthGmv.toFixed(1)}%)
- GMV Ads: Rp ${gmvAdsTotal.toLocaleString('id-ID')}
- GMV Affiliate: Rp ${gmvAff.toLocaleString('id-ID')}
- GMV Livestream: Rp ${gmvLive.toLocaleString('id-ID')}
- Visitor: ${spVisitor.toLocaleString('id-ID')}
- CVR: ${spCvr.toFixed(2)}%
- CTR Ads: ${spCtr.toFixed(2)}%
- AOV: Rp ${spAov.toLocaleString('id-ID')}
- Cancel Rate: ${spCancelRate.toFixed(2)}%
- Fail to Pickup Rate: ${spFailRate.toFixed(2)}%
- ROI Affiliate: ${spRoi.toFixed(2)}x
- ROAS Ads: ${roas.toFixed(2)}x
- Sesi Live: ${totalSesiLive}
${anomali.length > 0 ? 'Anomali: ' + anomali.join(', ') : ''}

Berikan: ringkasan performa, temuan penting, rekomendasi.`
    try {
      const res  = await fetch('/api/ai-analysis',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({prompt:konteks}) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.text)
    } catch { setAiError('Gagal memuat analisis AI. Coba lagi.') }
    setAiLoading(false)
  }

  function buildKonteksData() {
    return `Kamu adalah AI analyst untuk platform marketplace Kilap.
Kamu memiliki akses ke data dashboard berikut dan harus menjawab pertanyaan berdasarkan data ini.

DATA DASHBOARD (${periodeLabel}):
- Total GMV: ${fmtRp(totalGmv)} (growth: ${growthGmv.toFixed(1)}%)
- GMV Ads: ${fmtRp(gmvAdsTotal)}
- GMV Affiliate: ${fmtRp(gmvAff)}
- GMV Livestream: ${fmtRp(gmvLive)}
- Total Pesanan: ${fmt(totalPesanan)} (growth: ${growthPesanan.toFixed(1)}%)
- Total Biaya Iklan: ${fmtRp(totalBiayaAds)}
- ROAS Keseluruhan: ${fmtX(roas)}
- Sesi Livestream: ${totalSesiLive} sesi
- Visitor: ${fmt(spVisitor)}
- CVR: ${fmtPct(spCvr)}
- AOV: ${spAov > 0 ? fmtRp(spAov) : '-'}
- Cancel Rate: ${fmtPct(spCancelRate)}
- Fail to Pickup Rate: ${fmtPct(spFailRate)}
- ROI Affiliate: ${spRoi > 0 ? fmtX(spRoi) : '-'}
${anomali.length > 0 ? `\nANOMALI TERDETEKSI:\n${anomali.map(a => '- ' + a).join('\n')}` : ''}
${filterChannel && filterChannel !== 'Semua Channel' ? `\nFilter channel aktif: ${filterChannel}` : ''}

Jawab dalam Bahasa Indonesia yang natural dan profesional. Gunakan angka dari data di atas saat menjawab. Jika ditanya sesuatu di luar data yang tersedia, katakan bahwa data tersebut tidak tersedia di dashboard ini.`
  }

  async function sendChat() {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return

    const userMsg = { role: 'user', content: msg }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const systemKonteks = buildKonteksData()
      const historyForAPI = [
        { role: 'user', content: systemKonteks + '\n\nSiap membantu analisis data dashboard Kilap.' },
        { role: 'assistant', content: 'Siap! Saya sudah membaca data dashboard Kilap. Silakan tanyakan apa saja tentang performa penjualan, affiliate, ads, atau livestream.' },
        ...newMessages,
      ]

      const res  = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: historyForAPI.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setChatMessages(prev => [...prev, { role: 'assistant', content: json.text }])
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        error: true,
      }])
    }
    setChatLoading(false)
  }

  // ─── Komponen ─────────────────────────────────────────
  function GrowthBadge({ value }) {
    const up = Number(value) >= 0
    return (
      <span title={`vs ${compareLabel}`} style={{
        fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
        background: up ? '#DCFCE7' : '#FEE2E2', color: up ? '#166534' : '#991B1B',
        display:'inline-flex', alignItems:'center', gap:3, cursor:'help',
      }}>
        {up ? '▲' : '▼'} {Math.abs(Number(value)).toFixed(1)}%
        <span style={{fontSize:10,opacity:0.8}}>vs periode sebelumnya</span>
      </span>
    )
  }

  function MetricCard({ label, value, growth, highlight }) {
    return (
      <div style={{
        background: highlight ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : '#fff',
        border: highlight ? 'none' : '1px solid #FFE0CC',
        borderRadius:12, padding:'18px 20px',
        boxShadow:'0 2px 8px rgba(255,100,0,0.08)',
        transition:'transform 0.15s,box-shadow 0.15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 16px rgba(255,100,0,0.15)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(255,100,0,0.08)'}}>
        <p style={{margin:'0 0 6px',fontSize:12,fontWeight:500,color:highlight?'rgba(255,255,255,0.8)':'#999'}}>{label}</p>
        <p style={{margin:'0 0 10px',fontSize:24,fontWeight:700,color:highlight?'#fff':'#1A1A1A',lineHeight:1.2}}>{value}</p>
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
    )
  }

  // ─── Summary Performa Card kecil ──────────────────────
  function PerfCard({ label, value, sub, warn, growth }) {
    return (
      <div style={{
        background:'#fff', border:`1px solid ${warn ? '#FECACA' : '#FFE0CC'}`,
        borderLeft: warn ? '3px solid #DC2626' : '3px solid #FF8C00',
        borderRadius:10, padding:'14px 16px',
        boxShadow:'0 1px 4px rgba(255,100,0,0.06)',
      }}>
        <p style={{margin:'0 0 4px',fontSize:11,color:'#999',fontWeight:500}}>{label}</p>
        <p style={{margin:'0 0 6px',fontSize:20,fontWeight:700,color: warn ? '#DC2626' : '#1A1A1A'}}>{value}</p>
        {growth !== undefined && <GrowthBadge value={growth} />}
        {sub && <p style={{margin:'4px 0 0',fontSize:11,color:'#bbb'}}>{sub}</p>}
      </div>
    )
  }

  const fmtAxis = v => {
    if (v >= 1e9) return (v/1e9).toFixed(1)+'M'
    if (v >= 1e6) return (v/1e6).toFixed(0)+'jt'
    if (v >= 1e3) return (v/1e3).toFixed(0)+'rb'
    return v
  }

  const grafikDataHarian = (() => {
    if (!filterStart || !filterEnd) return []

    const allCombined = [
      ...allRawAffiliate.map(r => ({...r, source:'affiliate'})),
      ...allRawLive.map(r => ({...r, source:'live'})),
    ]

    const filtered = allCombined.filter(r =>
      r.tanggal >= filterStart && r.tanggal <= filterEnd)

    const grouped = {}
    filtered.forEach(r => {
      const tgl = r.tanggal
      if (!grouped[tgl]) grouped[tgl] = { tgl, gmv_affiliate:0, gmv_live:0, biaya_ads:0 }
      if (r.source === 'affiliate') grouped[tgl].gmv_affiliate += Number(r.gmv)||0
      if (r.source === 'live') grouped[tgl].gmv_live += Number(r.gmv)||0
    })

    const allAdsFlat = [
      ...allRawAds.shopee, ...allRawAds.tiktok, ...allRawAds.meta
    ].filter(r => r.tanggal >= filterStart && r.tanggal <= filterEnd)

    allAdsFlat.forEach(r => {
      const tgl = r.tanggal
      if (!grouped[tgl]) grouped[tgl] = { tgl, gmv_affiliate:0, gmv_live:0, biaya_ads:0 }
      grouped[tgl].biaya_ads += Number(r.biaya_iklan)||0
    })

    return Object.values(grouped)
      .sort((a,b) => a.tgl.localeCompare(b.tgl))
      .map(g => ({ ...g, label: g.tgl.slice(5) }))
  })()

  const grafikDataQuartal = (() => {
    const tahun = new Date().getFullYear()
    const quartals = [
      { label: 'Q1', bulan: [0,1,2] },
      { label: 'Q2', bulan: [3,4,5] },
      { label: 'Q3', bulan: [6,7,8] },
      { label: 'Q4', bulan: [9,10,11] },
    ]

    return quartals.map(q => {
      const filterQuartal = (arr) => arr.filter(r => {
        if (!r.tanggal) return false
        const d = new Date(r.tanggal)
        return d.getFullYear() === tahun && q.bulan.includes(d.getMonth())
      })

      const affQ = filterQuartal(allRawAffiliate)
      const liveQ = filterQuartal(allRawLive)
      const shopeeQ = filterQuartal(allRawAds.shopee)
      const tiktokQ = filterQuartal(allRawAds.tiktok)
      const metaQ = filterQuartal(allRawAds.meta)

      return {
        label: q.label,
        gmv_affiliate: affQ.reduce((a,b)=>a+(Number(b.gmv)||0),0),
        gmv_live: liveQ.reduce((a,b)=>a+(Number(b.gmv)||0),0),
        biaya_ads: [...shopeeQ,...tiktokQ,...metaQ]
          .reduce((a,b)=>a+(Number(b.biaya_iklan)||0),0),
      }
    })
  })()

  const grafikDataFinal = (filterStart && filterEnd)
    ? grafikDataHarian
    : grafikDataQuartal

  const grafikTitle = (filterStart && filterEnd)
    ? `Tren GMV Harian — ${filterStart} s/d ${filterEnd}`
    : `Tren GMV — Per Quartal ${new Date().getFullYear()}`

  return (
    <div style={{maxWidth:1200,margin:'0 auto',fontFamily:'sans-serif'}}>

      {/* ── HEADER ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <p style={{margin:0,fontSize:22,fontWeight:700,color:'#1A1A1A'}}>Dashboard Utama</p>
          <p style={{margin:0,fontSize:13,color:'#999'}}>📅 {today} · {periodeLabel}</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>

          {/* ── Tombol Input Data ── */}
          <button onClick={()=>{setShowFormPenjualan(true);setFormPenjualan(EMPTY_PENJUALAN);setEditPenjualanId(null)}}
            style={{padding:'8px 18px',borderRadius:8,background:'linear-gradient(135deg,#FF6B35,#FF8C00)',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
            + Input Data
          </button>

          {/* ── Tombol Upload Excel ── */}
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleUploadExcel} />
          <button onClick={()=>uploadRef.current?.click()} disabled={uploadLoading}
            style={{
              padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
              border:'1.5px solid #FF8C00', background:'#FFF3ED', color:'#FF6B35',
              display:'flex', alignItems:'center', gap:6,
              opacity: uploadLoading ? 0.6 : 1,
            }}>
            {uploadLoading
              ? <><span style={{width:13,height:13,borderRadius:'50%',border:'2px solid #FFB899',borderTop:'2px solid #FF6B35',animation:'spin 1s linear infinite',display:'inline-block'}}/>Mengimpor...</>
              : <>📥 Upload Excel</>
            }
          </button>

          <div style={{background:'#FFF3ED',border:'1px solid #FFE0CC',borderRadius:8,padding:'6px 12px',fontSize:12,color:'#FF6B35',fontWeight:500}}>
            🔄 Auto-refresh setiap buka halaman
          </div>
        </div>
      </div>

      {/* ── Upload feedback ── */}
      {uploadMsg && (
        <div style={{
          marginBottom:16, padding:'10px 16px', borderRadius:8, fontSize:13,
          background: uploadMsg.startsWith('✅') ? '#DCFCE7' : '#FEE2E2',
          color:      uploadMsg.startsWith('✅') ? '#166534'  : '#991B1B',
          border:     uploadMsg.startsWith('✅') ? '1px solid #BBF7D0' : '1px solid #FECACA',
        }}>
          {uploadMsg}
          <button onClick={()=>setUploadMsg('')} style={{float:'right',background:'none',border:'none',cursor:'pointer',fontSize:14,color:'inherit'}}>×</button>
        </div>
      )}

      {/* ── FILTER CARD ── */}
      <div style={{
        background: '#fff', border: '1px solid #FFE0CC',
        borderRadius: 12, padding: 20, marginBottom: 20,
        boxShadow: '0 1px 4px rgba(255,100,0,0.06)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12 }}>

          {/* Brand */}
          <div>
            <label style={{ fontSize:11, color:'#FF8C00', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Brand</label>
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
              style={{
                width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A',
                background:'#fff', cursor:'pointer', outline:'none',
                appearance:'none',
                backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23FF6B35' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
              }}>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Channel */}
          <div>
            <label style={{ fontSize:11, color:'#FF8C00', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Channel</label>
            <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
              style={{
                width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A',
                background:'#fff', cursor:'pointer', outline:'none',
                appearance:'none',
                backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23FF6B35' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
              }}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Periode Start */}
          <div>
            <label style={{ fontSize:11, color:'#FF8C00', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Dari Tanggal</label>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
              style={{
                width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A',
                background:'#fff', outline:'none', boxSizing:'border-box',
              }} />
          </div>

          {/* Periode End */}
          <div>
            <label style={{ fontSize:11, color:'#FF8C00', fontWeight:600, display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Sampai Tanggal</label>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
              style={{
                width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A',
                background:'#fff', outline:'none', boxSizing:'border-box',
              }} />
          </div>

          {/* Tombol Reset */}
          <div style={{ display:'flex', alignItems:'flex-end' }}>
            <button onClick={() => {
              setFilterStart(''); setFilterEnd('')
              setFilterChannel('Semua Channel')
              setFilterBrand('Semua Brand')
            }}
              style={{
                width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', background:'#fff',
                color:'#FF6B35', cursor:'pointer', fontSize:12,
                fontWeight:500,
              }}>
              Reset Filter
            </button>
          </div>
        </div>

        {/* Info periode aktif */}
        {(filterStart && filterEnd) && (
          <div style={{ marginTop:12, padding:'8px 12px', background:'#FFF8F5', borderRadius:8, border:'1px solid #FFE0CC', fontSize:12, color:'#FF6B35', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span>📅 Periode aktif: <strong>{filterStart} s/d {filterEnd}</strong></span>
            <span style={{ color:'#FFB899' }}>vs {compareLabel}</span>
            {filterBrand !== 'Semua Brand' && <span style={{ background:'#FFF3ED', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>Brand: {filterBrand}</span>}
            {filterChannel !== 'Semua Channel' && <span style={{ background:'#FFF3ED', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>Channel: {filterChannel}</span>}
          </div>
        )}
      </div>

      {/* ── FORM INPUT ── */}
      {showFormPenjualan && (
        <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:24,marginBottom:24,boxShadow:'0 2px 8px rgba(255,100,0,0.08)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <div>
              <p style={{margin:0,fontWeight:700,fontSize:16,color:'#1A1A1A'}}>{editPenjualanId?'Edit data penjualan':'Input data penjualan harian'}</p>
              <p style={{margin:0,fontSize:12,color:'#FF6B35'}}>Semua field otomatis dihitung saat diisi</p>
            </div>
            <button onClick={()=>{setShowFormPenjualan(false);setFormPenjualan(EMPTY_PENJUALAN);setEditPenjualanId(null)}}
              style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999'}}>×</button>
          </div>
          {[
            {title:'Informasi Dasar',fields:[{label:'Tanggal *',name:'tanggal',type:'date'},{label:'Channel *',name:'channel',type:'select',options:CHANNELS.slice(1)}]},
            {title:'Penjualan',fields:[
              {label:'GMV (Rp)',name:'gmv'},{label:'Visitor',name:'visitor'},{label:'Pesanan Masuk',name:'pesanan_masuk'},
              {label:'Produk Terjual',name:'produk_terjual'},{label:'Pesanan Batal',name:'pesanan_batal'},
              {label:'Cancel Rate % (auto)',name:'cancel_rate',auto:true},{label:'AOV Order (auto)',name:'aov_order',auto:true},
              {label:'APV Produk (auto)',name:'apv_produk',auto:true},{label:'Basket Size (auto)',name:'basket_size',auto:true},
              {label:'Visitor CVR % (auto)',name:'visitor_cvr',auto:true},
            ]},
            {title:'Customer',fields:[
              {label:'Customer Baru',name:'customer_baru'},{label:'Customer Repeat Order',name:'customer_repeat'},
              {label:'Total Customer (auto)',name:'total_customer',auto:true},{label:'Repeat Customer Rate % (auto)',name:'repeat_customer_rate',auto:true},
            ]},
            {title:'Pengiriman & Campaign',fields:[
              {label:'Gagal Pickup',name:'gagal_pickup'},{label:'Fail to Pickup Rate % (auto)',name:'fail_to_pickup_rate',auto:true},
              {label:'Submission Campaign',name:'submission_campaign'},
            ]},
            {title:'Affiliate',fields:[
              {label:'GMV Affiliate (Rp)',name:'gmv_affiliate'},{label:'Cost Affiliate (Rp)',name:'cost_affiliate'},
              {label:'Pesanan Affiliate',name:'pesanan_affiliate'},{label:'ROI Affiliate (auto)',name:'roi_affiliate',auto:true},
            ]},
          ].map(section=>(
            <div key={section.title} style={{marginBottom:16}}>
              <p style={{margin:'0 0 10px',fontSize:11,fontWeight:600,color:'#FF8C00',textTransform:'uppercase',letterSpacing:'0.08em',background:'#FFF3ED',padding:'4px 10px',borderRadius:4,display:'inline-block'}}>{section.title}</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
                {section.fields.map(f=>(
                  <div key={f.name}>
                    <label style={{fontSize:12,color:'#374151',fontWeight:500,display:'block',marginBottom:5}}>{f.label}</label>
                    {f.type==='select' ? (
                      <select name={f.name} value={formPenjualan[f.name]||''} onChange={e=>setFormPenjualan(autoCalcPenjualan({...formPenjualan,[e.target.name]:e.target.value}))}
                        style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid #FFD4B8',fontSize:13,color:'#1A1A1A',background:'#fff'}}>
                        <option value="">-- Pilih --</option>
                        {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                    ):(
                      <input type={f.type||'number'} name={f.name} value={formPenjualan[f.name]||''} readOnly={f.auto} placeholder={f.auto?'otomatis':'0'}
                        onChange={e=>!f.auto&&setFormPenjualan(autoCalcPenjualan({...formPenjualan,[e.target.name]:e.target.value}))}
                        style={{width:'100%',padding:'8px 12px',borderRadius:8,fontSize:13,border:'1px solid #FFD4B8',color:f.auto?'#999':'#1A1A1A',background:f.auto?'#FFF8F5':'#fff',boxSizing:'border-box'}}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:8}}>
            <button onClick={()=>{setShowFormPenjualan(false);setFormPenjualan(EMPTY_PENJUALAN);setEditPenjualanId(null)}}
              style={{padding:'9px 20px',borderRadius:8,border:'1px solid #FFD4B8',background:'#fff',cursor:'pointer',fontSize:13,color:'#374151'}}>Batal</button>
            <button onClick={handleSubmitPenjualan} disabled={savingPenjualan}
              style={{padding:'9px 24px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#FF6B35,#FF8C00)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
              {savingPenjualan?'Menyimpan...':editPenjualanId?'Perbarui':'Simpan data'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid #FFE0CC',borderTop:'3px solid #FF6B35',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
          <p style={{color:'#999',fontSize:14}}>Memuat data dashboard...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <>
          {/* ── ANOMALI ── */}
          {anomali.length > 0 && (
            <div style={{background:'#FFF8F0',border:'1px solid #FFD4B8',borderLeft:'4px solid #FF6B35',borderRadius:10,padding:'14px 18px',marginBottom:20}}>
              <p style={{margin:'0 0 8px',fontWeight:700,fontSize:13,color:'#FF6B35'}}>⚠️ Perhatian — {anomali.length} anomali terdeteksi</p>
              {anomali.map((a,i)=><p key={i} style={{margin:'2px 0',fontSize:13,color:'#664400'}}>• {a}</p>)}
            </div>
          )}

          {/* ══ SUMMARY PERFORMA (gabungan) ══ */}
          <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,marginBottom:24,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap',justifyContent:'space-between'}}>
              <div>
                <p style={{margin:0,fontWeight:700,fontSize:14,color:'#1A1A1A'}}>Summary Performa</p>
                <p style={{margin:0,fontSize:12,color:'#999'}}>
                  {periodeLabel}{filterChannel && filterChannel!=='Semua Channel' ? ` · ${filterChannel}` : ''}
                </p>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {filterChannel && filterChannel !== 'Semua Channel' && (
                  <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'#FFF3ED',color:'#FF6B35',fontWeight:600,border:'1px solid #FFE0CC'}}>
                    Channel: {filterChannel}
                  </span>
                )}
                {filterBrand && filterBrand !== 'Semua Brand' && (
                  <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'#FFF3ED',color:'#FF6B35',fontWeight:600,border:'1px solid #FFE0CC'}}>
                    Brand: {filterBrand}
                  </span>
                )}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
              <div style={{
                background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                borderRadius:12, padding:'18px 20px',
                boxShadow:'0 2px 8px rgba(255,100,0,0.08)',
                transition:'transform 0.15s,box-shadow 0.15s',
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 6px 16px rgba(255,100,0,0.15)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 8px rgba(255,100,0,0.08)'}}>
                <p style={{margin:'0 0 6px',fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.8)'}}>Total GMV Keseluruhan</p>
                <p style={{margin:'0 0 10px',fontSize:24,fontWeight:700,color:'#fff',lineHeight:1.2}}>{fmtRp(totalGmv)}</p>
                <GrowthBadge value={growthGmv} />
              </div>

              <PerfCard label="GMV Ads"          value={fmtRp(gmvAdsTotal)}               growth={growthGmvAds}     sub="Shopee+TikTok+Meta"/>
              <PerfCard label="GMV Affiliate"    value={fmtRp(gmvAff)}                    growth={growthGmvAff}     sub="dari affiliate_weekly"/>
              <PerfCard label="GMV Livestream"   value={fmtRp(gmvLive)}                   growth={growthGmvLive}    sub={`${totalSesiLive} sesi`}/>
              <PerfCard label="Visitor"          value={fmt(spVisitor)}                    growth={growthVisitor}    sub="dari penjualan harian"/>
              <PerfCard label="CTR Ads"          value={spCtr > 0 ? fmtPct(spCtr) : '—'} growth={growthCtr}        sub="avg dari ads"/>
              <PerfCard label="CVR"              value={fmtPct(spCvr)}                    growth={growthCvr}        sub={`${fmt(spPesanan)} pesanan / ${fmt(spVisitor)} visitor`}/>
              <PerfCard label="AOV Order"        value={spAov > 0 ? fmtRp(spAov) : '—'}  growth={growthAov}        sub="avg nilai per pesanan"/>
              <PerfCard label="Cancel Rate"      value={fmtPct(spCancelRate)}             growth={growthCancelRate} sub={`${fmt(spBatal)} batal / ${fmt(spPesanan)} pesanan`}    warn={spCancelRate > 5}/>
              <PerfCard label="Fail to Pick Up"  value={fmtPct(spFailRate)}               growth={growthFailRate}   sub={`${fmt(spGagalPickup)} gagal pickup`}                   warn={spFailRate > 3}/>
              <PerfCard label="ROI Affiliate"    value={spRoi > 0 ? fmtX(spRoi) : '—'}   growth={growthRoi}        sub={`GMV ${fmtRp(spGmvAffiliate)} / Cost ${fmtRp(spCostAffiliate)}`}/>
              <PerfCard label="Total Biaya Iklan" value={fmtRp(totalBiayaAds)}           growth={growthBiaya}      sub={`Growth ${growthBiaya.toFixed(1)}%`}/>
              <PerfCard label="ROAS Keseluruhan" value={fmtX(roas)}                       growth={growthRoas}       sub={`Growth ${growthRoas.toFixed(1)}%`}/>
            </div>
          </div>

          {/* ── AI ANALYSIS ── */}
          <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,marginBottom:24,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#FF6B35,#FF8C00)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>✦</div>
                <div>
                  <p style={{margin:0,fontWeight:700,fontSize:14,color:'#1A1A1A'}}>Ringkasan AI — Minggu ini</p>
                  <p style={{margin:0,fontSize:11,color:'#999'}}>Analisis otomatis berdasarkan data aktual</p>
                </div>
              </div>
              <button onClick={generateAI} disabled={aiLoading}
                style={{padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:600,cursor:aiLoading?'default':'pointer',border:'none',background:aiLoading?'#FFE0CC':'linear-gradient(135deg,#FF6B35,#FF8C00)',color:aiLoading?'#FFB899':'#fff',display:'flex',alignItems:'center',gap:6}}>
                {aiLoading
                  ? <><span style={{width:14,height:14,borderRadius:'50%',border:'2px solid #FFB899',borderTop:'2px solid #FF6B35',animation:'spin 1s linear infinite',display:'inline-block'}}/>Menganalisis...</>
                  : <>✦ {aiText?'Perbarui':'Generate'} Analisis</>}
              </button>
            </div>
            {aiError && <p style={{color:'#DC2626',fontSize:13}}>{aiError}</p>}
            {!aiText && !aiLoading && (
              <div style={{textAlign:'center',padding:'32px 0',border:'1px dashed #FFD4B8',borderRadius:10,background:'#FFF8F5'}}>
                <p style={{fontSize:32,margin:'0 0 8px'}}>✦</p>
                <p style={{fontSize:14,color:'#999',margin:'0 0 4px'}}>Klik "Generate Analisis" untuk mendapatkan</p>
                <p style={{fontSize:13,color:'#FFB899',margin:0}}>ringkasan performa, deteksi anomali & rekomendasi dari AI</p>
              </div>
            )}
            {aiText && (
              <div style={{fontSize:14,lineHeight:1.7,color:'#374151',background:'#FFF8F5',borderRadius:10,padding:'16px 20px',border:'1px solid #FFE0CC'}}
                dangerouslySetInnerHTML={{__html:aiText
                  .replace(/\*\*(.*?)\*\*/g,'<strong style="color:#FF6B35">$1</strong>')
                  .replace(/\n\n/g,'</p><p style="margin:0 0 10px">')
                  .replace(/\n/g,'<br/>')
                  .replace(/^/,'<p style="margin:0 0 10px">')
                  .replace(/$/,'</p>')
                }}/>
            )}
          </div>

          {/* ── AI CHAT ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, marginBottom:24, boxShadow:'0 2px 8px rgba(255,100,0,0.06)', overflow:'hidden' }}>

            {/* Header chat — selalu tampil, bisa diklik untuk buka/tutup */}
            <div
              onClick={() => setChatOpen(o => !o)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', cursor:'pointer', userSelect:'none', background: chatOpen ? '#FFF8F5' : '#fff', borderBottom: chatOpen ? '1px solid #FFE0CC' : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💬</div>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#1A1A1A' }}>Tanya AI tentang data ini</p>
                  <p style={{ margin:0, fontSize:11, color:'#999' }}>
                    {chatMessages.length > 0 ? `${Math.floor(chatMessages.length/2)} pertanyaan dijawab` : 'Klik untuk mulai tanya jawab'}
                  </p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {chatMessages.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); setChatMessages([]); setChatInput('') }}
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #FFD4B8', background:'#fff', color:'#FF6B35', cursor:'pointer' }}>
                    Reset chat
                  </button>
                )}
                <span style={{ fontSize:18, color:'#FF6B35', fontWeight:300, transform: chatOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}>⌄</span>
              </div>
            </div>

            {/* Body chat */}
            {chatOpen && (
              <div>
                {/* Riwayat pesan */}
                <div style={{ maxHeight:360, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Pesan awal jika belum ada chat */}
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign:'center', padding:'20px 0' }}>
                      <p style={{ fontSize:13, color:'#999', margin:'0 0 12px' }}>Contoh pertanyaan yang bisa kamu tanyakan:</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                        {[
                          'Kenapa GMV turun minggu ini?',
                          'Channel mana yang paling efisien?',
                          'Bagaimana cara meningkatkan CVR?',
                          'Analisis cancel rate yang tinggi',
                          'Rekomendasi strategi minggu depan',
                        ].map(q => (
                          <button key={q} onClick={() => { setChatInput(q) }}
                            style={{ fontSize:12, padding:'6px 14px', borderRadius:20, border:'1px solid #FFD4B8', background:'#FFF8F5', color:'#FF6B35', cursor:'pointer' }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pesan-pesan */}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginRight:8, flexShrink:0, alignSelf:'flex-end' }}>✦</div>
                      )}
                      <div style={{
                        maxWidth:'75%', padding:'10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: msg.role === 'user' ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : msg.error ? '#FEF2F2' : '#FFF8F5',
                        color: msg.role === 'user' ? '#fff' : msg.error ? '#991B1B' : '#374151',
                        fontSize:13, lineHeight:1.6,
                        border: msg.role === 'user' ? 'none' : '1px solid #FFE0CC',
                      }}
                        dangerouslySetInnerHTML={{ __html: msg.role === 'assistant'
                          ? msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B35">$1</strong>')
                              .replace(/\n/g, '<br/>')
                          : msg.content
                        }}
                      />
                      {msg.role === 'user' && (
                        <div style={{ width:28, height:28, borderRadius:6, background:'#FFE0CC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, marginLeft:8, flexShrink:0, alignSelf:'flex-end', color:'#FF6B35', fontWeight:700 }}>K</div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {chatLoading && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✦</div>
                      <div style={{ padding:'10px 14px', borderRadius:'12px 12px 12px 2px', background:'#FFF8F5', border:'1px solid #FFE0CC', display:'flex', gap:4, alignItems:'center' }}>
                        {[0,1,2].map(i => (
                          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#FF6B35', animation:'pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }}/>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input area */}
                <div style={{ padding:'12px 20px', borderTop:'1px solid #FFE0CC', background:'#FAFAFA', display:'flex', gap:10, alignItems:'flex-end' }}>
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                    placeholder="Tanya sesuatu tentang data dashboard... (Enter untuk kirim)"
                    rows={2}
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A', background:'#fff', outline:'none', resize:'none', fontFamily:'inherit', lineHeight:1.5 }}
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    style={{ padding:'10px 18px', borderRadius:10, border:'none', fontSize:13, fontWeight:600, cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer', background: chatLoading || !chatInput.trim() ? '#FFE0CC' : 'linear-gradient(135deg,#FF6B35,#FF8C00)', color: chatLoading || !chatInput.trim() ? '#FFB899' : '#fff', whiteSpace:'nowrap', height:42 }}>
                    Kirim ↑
                  </button>
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes spin { to { transform: rotate(360deg) } }
            @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
          `}</style>

          {/* ── GRAFIK TREN GMV ── */}
          <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,marginBottom:24,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
            <p style={{margin:'0 0 4px',fontWeight:700,fontSize:14,color:'#1A1A1A'}}>{grafikTitle}</p>
            <p style={{margin:'0 0 16px',fontSize:12,color:'#999'}}>
              {(filterStart && filterEnd)
                ? `Data harian dalam periode terpilih`
                : `Affiliate · Livestream · Biaya Ads per quartal`}
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={grafikDataFinal} margin={{top:5,right:10,left:10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED"/>
                <XAxis dataKey="label" tick={{fontSize:11,fill:'#999'}} tickLine={false} axisLine={{stroke:'#FFE0CC'}}/>
                <YAxis tickFormatter={fmtAxis} tick={{fontSize:11,fill:'#999'}} tickLine={false} axisLine={false} width={60}/>
                <Tooltip formatter={(v,name)=>['Rp '+Number(v).toLocaleString('id-ID'),name==='gmv_affiliate'?'GMV Affiliate':name==='gmv_live'?'GMV Livestream':name==='biaya_ads'?'Biaya Ads':'Omzet Ads']}
                  contentStyle={{fontSize:12,borderRadius:8,border:'1px solid #FFE0CC'}}/>
                <Legend formatter={v=>v==='gmv_affiliate'?'GMV Affiliate':v==='gmv_live'?'GMV Livestream':v==='biaya_ads'?'Biaya Ads':'Omzet Ads'}/>
                <Line type="monotone" dataKey="gmv_affiliate" stroke="#FF6B35" strokeWidth={2.5} dot={{r:4,fill:'#FF6B35',strokeWidth:0}} activeDot={{r:6}}/>
                <Line type="monotone" dataKey="gmv_live"      stroke="#FF8C00" strokeWidth={2.5} dot={{r:4,fill:'#FF8C00',strokeWidth:0}} activeDot={{r:6}}/>
                <Line type="monotone" dataKey="biaya_ads"     stroke="#DC2626" strokeWidth={2}   strokeDasharray="5 5" dot={{r:3,fill:'#DC2626',strokeWidth:0}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── REVENUE PER CHANNEL & ADS ── */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16,marginBottom:24}}>
            <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
              <p style={{margin:'0 0 16px',fontWeight:700,fontSize:14,color:'#1A1A1A'}}>Revenue per Channel</p>
              {totalChannel===0 ? <p style={{color:'#999',fontSize:13}}>Belum ada data periode ini</p>
                : channelData.map(ch=>{
                  const pct = totalChannel>0 ? ch.gmv/totalChannel*100 : 0
                  return (
                    <div key={ch.channel} style={{marginBottom:14}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{fontSize:13,color:'#374151',fontWeight:500}}>{ch.channel}</span>
                        <span style={{fontSize:13,fontWeight:700,color:'#1A1A1A'}}>{fmtRp(ch.gmv)}</span>
                      </div>
                      <div style={{height:8,background:'#FFF3ED',borderRadius:10,overflow:'hidden'}}>
                        <div style={{height:'100%',width:pct+'%',background:ch.color,borderRadius:10,transition:'width 0.5s ease'}}/>
                      </div>
                      <p style={{margin:'4px 0 0',fontSize:11,color:'#999'}}>{pct.toFixed(1)}% dari total</p>
                    </div>
                  )
                })}
            </div>
            <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
              <p style={{margin:'0 0 16px',fontWeight:700,fontSize:14,color:'#1A1A1A'}}>Biaya & ROAS per Platform Ads</p>
              {[
                {label:'Shopee Ads',  biaya:sum(weeklyAds.shopee,'biaya_iklan'), omzet:gmvAdsShopee, color:'#FF6B35'},
                {label:'TikTok GMV Max', biaya:sum(weeklyAds.tiktok,'biaya_iklan'), omzet:gmvAdsTiktok, color:'#6C63FF'},
                {label:'Meta Ads',    biaya:sum(weeklyAds.meta,'biaya_iklan'),   omzet:gmvAdsMeta,   color:'#1877F2'},
              ].map(p=>{
                const roasP = p.biaya>0 ? p.omzet/p.biaya : 0
                return (
                  <div key={p.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #FFF3ED'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:10,height:10,borderRadius:'50%',background:p.color,flexShrink:0}}/>
                      <div>
                        <p style={{margin:0,fontSize:13,fontWeight:500,color:'#1A1A1A'}}>{p.label}</p>
                        <p style={{margin:0,fontSize:11,color:'#999'}}>Biaya: {fmtRp(p.biaya)}</p>
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <p style={{margin:0,fontSize:14,fontWeight:700,color:roasP>=3?'#166534':roasP>=2?'#854D0E':'#991B1B'}}>{roasP>0?roasP.toFixed(2)+'x':'-'}</p>
                      <p style={{margin:0,fontSize:11,color:'#999'}}>ROAS</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── TABEL DATA PENJUALAN ── */}
          <div style={{background:'#fff',border:'1px solid #FFE0CC',borderRadius:12,padding:20,marginTop:16,boxShadow:'0 2px 8px rgba(255,100,0,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <p style={{margin:0,fontWeight:700,fontSize:14,color:'#1A1A1A'}}>Data Penjualan Harian</p>
              <span style={{fontSize:12,color:'#999'}}>{dataPenjualan.length} entri</span>
            </div>
            {dataPenjualan.length===0 ? (
              <p style={{color:'#999',fontSize:13}}>Belum ada data. Klik "+ Input Data" atau "Upload Excel" untuk menambahkan.</p>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:'#FFF3ED'}}>
                      {['Tanggal','Channel','GMV','Visitor','Pesanan','Produk Terjual','Cancel Rate','AOV','CVR','Total Customer','ROI Affiliate','Aksi'].map(h=>(
                        <th key={h} style={{padding:'10px 12px',color:'#FF6B35',fontWeight:500,fontSize:11,whiteSpace:'nowrap',textAlign:h==='Tanggal'||h==='Channel'?'left':'right',borderBottom:'1px solid #FFE0CC'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataPenjualan.slice(0,10).map(row=>(
                      <tr key={row.id} style={{borderBottom:'0.5px solid #FFF3ED'}}>
                        <td style={{padding:'8px 12px',color:'#666',whiteSpace:'nowrap'}}>{row.tanggal}</td>
                        <td style={{padding:'8px 12px'}}>
                          <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:500,
                            background:row.channel==='Shopee'?'#FFF0E6':row.channel==='TikTok'?'#F0F0FF':row.channel==='Tokopedia'?'#E6FBF0':'#E6F1FB',
                            color:row.channel==='Shopee'?'#993C1D':row.channel==='TikTok'?'#3C3489':row.channel==='Tokopedia'?'#0C5C2E':'#0C447C'}}>
                            {row.channel}
                          </span>
                        </td>
                        <td style={{padding:'8px 12px',textAlign:'right',fontWeight:600,color:'#1A1A1A',whiteSpace:'nowrap'}}>Rp {Number(row.gmv).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666'}}>{Number(row.visitor).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666'}}>{Number(row.pesanan_masuk).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666'}}>{Number(row.produk_terjual).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:Number(row.cancel_rate)>5?'#DC2626':'#166534',fontWeight:500}}>{Number(row.cancel_rate).toFixed(2)}%</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666',whiteSpace:'nowrap'}}>Rp {Number(row.aov_order).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666'}}>{Number(row.visitor_cvr).toFixed(2)}%</td>
                        <td style={{padding:'8px 12px',textAlign:'right',color:'#666'}}>{Number(row.total_customer).toLocaleString('id-ID')}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',fontWeight:600,color:Number(row.roi_affiliate)>=2?'#166534':'#DC2626'}}>{row.roi_affiliate>0?Number(row.roi_affiliate).toFixed(2)+'x':'-'}</td>
                        <td style={{padding:'8px 12px',textAlign:'right',whiteSpace:'nowrap'}}>
                          <button onClick={()=>{setFormPenjualan({...EMPTY_PENJUALAN,...row});setEditPenjualanId(row.id);setShowFormPenjualan(true);window.scrollTo(0,0)}}
                            style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #FFD4B8',background:'#fff',cursor:'pointer',marginRight:4,color:'#FF6B35'}}>Edit</button>
                          <button onClick={async()=>{if(!confirm('Yakin hapus?'))return;await supabase.from('penjualan_harian').delete().eq('id',row.id);fetchDataPenjualan()}}
                            style={{fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',cursor:'pointer'}}>Hapus</button>
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}