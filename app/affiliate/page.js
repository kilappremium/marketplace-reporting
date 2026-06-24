'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

// ─── Format helpers ───────────────────────────────────────
const fmt    = n => (!n && n !== 0) ? '-' : Number(n).toLocaleString('id-ID')
const fmtRp  = n => (!n && n !== 0) ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtPct = n => (!n && n !== 0) ? '-' : Number(n).toFixed(2) + '%'
const fmtX   = n => (!n && n !== 0) ? '-' : Number(n).toFixed(2) + 'x'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)
const avg    = (arr, f) => arr.length ? (sum(arr, f) / arr.length).toFixed(2) : 0

// ─── Konfigurasi platform ─────────────────────────────────
const PLATFORM_CONFIG = {
  monthly: {
    label: 'Monthly',
    table: 'affiliate_monthly',
    color: { bg: '#FFF0E6', text: '#993C1D' },
  },
  weekly: {
    label: 'Weekly',
    table: 'affiliate_weekly',
    color: { bg: '#F0F0FF', text: '#3C3489' },
  },
  paid: {
    label: 'Paid Partnership',
    table: 'affiliate_paid',
    color: { bg: '#E6F1FB', text: '#0C447C' },
  },
}

// ─── Field definitions ────────────────────────────────────
const COMMON_FIELDS = [
  { section: 'Revenue',
    fields: [
      { label: 'GMV (Rp)', name: 'gmv', type: 'number' },
      { label: 'Take Rate GMV % (auto)', name: 'take_rate_gmv', auto: true },
      { label: 'Growth Revenue % (auto)', name: 'growth_revenue', auto: true },
      { label: 'Average Revenue (Rp) (auto)', name: 'average_revenue', auto: true },
    ]
  },
  { section: 'Affiliate',
    fields: [
      { label: 'Affiliate Acquisition', name: 'affiliate_acquisition', type: 'number' },
      { label: 'Total Affiliate', name: 'total_affiliate', type: 'number' },
      { label: 'Jumlah Making Sales', name: 'jumlah_making_sales', type: 'number' },
      { label: 'Making Sales Rate % (auto)', name: 'making_sales_rate', auto: true },
      { label: 'Acquisition Cost Per Product (auto)', name: 'acquisition_cost_per_product', auto: true },
    ]
  },
  { section: 'Produk & Konten',
    fields: [
      { label: 'Items Sold TikTok', name: 'items_sold_tiktok', type: 'number' },
      { label: 'Items Sold Shopee', name: 'items_sold_shopee', type: 'number' },
      { label: 'Average Product Price (Rp)', name: 'average_product_price', type: 'number' },
      { label: 'Jumlah Video', name: 'jumlah_video', type: 'number' },
      { label: 'Jumlah Live Shopping', name: 'jumlah_live_shopping', type: 'number' },
      { label: 'Sample Produk TikTok (qty)', name: 'sample_tiktok', type: 'number' },
      { label: 'Sample Produk Shopee (qty)', name: 'sample_shopee', type: 'number' },
    ]
  },
  { section: 'Biaya',
    fields: [
      { label: 'Cost (Rp) (auto)', name: 'cost', auto: true },
      { label: 'Rate Cost ke GMV % (auto)', name: 'rate_cost_gmv', auto: true },
      { label: 'Komisi Affiliate TikTok (Rp)', name: 'komisi_tiktok', type: 'number' },
      { label: 'Komisi Affiliate Shopee (Rp)', name: 'komisi_shopee', type: 'number' },
      { label: 'Fee COGS Produk TikTok (Rp)', name: 'fee_cogs_tiktok', type: 'number' },
      { label: 'Fee COGS Produk Shopee (Rp)', name: 'fee_cogs_shopee', type: 'number' },
      { label: 'Ongkir (Rp)', name: 'ongkir', type: 'number' },
      { label: 'Fee Partnership (Rp)', name: 'fee_partnership', type: 'number' },
    ]
  },
]

const PAID_FIELDS = [
  { section: 'Info Affiliate',
    fields: [
      { label: 'Nama Affiliate *', name: 'nama_partner', type: 'text',
        placeholder: 'cth: @username_affiliate' },
      { label: 'Platform', name: 'platform', type: 'select',
        options: ['tiktok', 'shopee', 'instagram', 'youtube'] },
    ]
  },
  { section: 'Performa',
    fields: [
      { label: 'GMV (Rp)', name: 'gmv', type: 'number' },
      { label: 'Video Posted', name: 'jumlah_konten', type: 'number' },
      { label: 'Livestream', name: 'jumlah_live', type: 'number' },
      { label: 'Spending (Rp)', name: 'cost', type: 'number' },
      { label: 'ROI (auto)', name: 'roi', auto: true },
    ]
  },
]

const ALL_FIELD_NAMES = {
  monthly: ['gmv','take_rate_gmv','growth_revenue','affiliate_acquisition','total_affiliate',
    'jumlah_making_sales','making_sales_rate','conv_rate','average_revenue','items_sold_tiktok','items_sold_shopee',
    'average_product_price','acquisition_cost_per_product','jumlah_video','jumlah_live_shopping',
    'cost','rate_cost_gmv','komisi_tiktok','komisi_shopee','fee_cogs_tiktok','fee_cogs_shopee',
    'ongkir','fee_partnership','sample_tiktok','sample_shopee','biaya_tambahan','periode'],
  weekly: ['gmv','take_rate_gmv','growth_revenue','affiliate_acquisition','total_affiliate',
    'jumlah_making_sales','making_sales_rate','conv_rate','average_revenue','items_sold_tiktok','items_sold_shopee',
    'average_product_price','acquisition_cost_per_product','jumlah_video','jumlah_live_shopping',
    'cost','rate_cost_gmv','komisi_tiktok','komisi_shopee','fee_cogs_tiktok','fee_cogs_shopee',
    'ongkir','fee_partnership','sample_tiktok','sample_shopee','biaya_tambahan','periode'],
  paid: ['nama_partner','platform','gmv','jumlah_konten',
    'jumlah_live','cost','roi','items_sold',
    'conv_rate','reach','impresi','engagement_rate',
    'fee_partnership','sample_tiktok','sample_shopee',
    'biaya_tambahan','komisi_tiktok','komisi_shopee',
    'take_rate_gmv','rate_cost_gmv'],
}

function buildEmpty(tab) {
  const base = {
    tanggal: new Date().toISOString().split('T')[0],
    nama_partner: '', platform: 'tiktok', periode: '',
    tanggal_week: '',
  }
  ALL_FIELD_NAMES[tab].forEach(f => { if (!(f in base)) base[f] = '' })
  return base
}

function autoCalc(form, tab, prevGmv) {
  const f = { ...form }
  const gmv    = Number(f.gmv) || 0
  const cost   = Number(f.cost) || 0
  const totalAff = Number(f.total_affiliate) || 0
  const jumlahMakingSales = Number(f.jumlah_making_sales) || 0
  const itemsTiktok = Number(f.items_sold_tiktok) || 0
  const itemsShopee = Number(f.items_sold_shopee) || 0
  const totalItems  = itemsTiktok + itemsShopee
  const reach  = Number(f.reach) || 0
  const impresi = Number(f.impresi) || 0

  if (gmv && cost)        f.take_rate_gmv   = (cost / gmv * 100).toFixed(2)
  if (gmv && cost)        f.rate_cost_gmv   = (cost / gmv * 100).toFixed(2)
  if (jumlahMakingSales && totalAff) {
    f.making_sales_rate = (jumlahMakingSales / totalAff * 100).toFixed(2)
  } else {
    f.making_sales_rate = 0
  }
  if (totalItems && totalAff)  f.conv_rate        = (totalItems / totalAff * 100).toFixed(2)
  if (gmv && totalItems)  f.average_revenue  = (gmv / totalItems).toFixed(0)
  if (cost && totalItems) f.acquisition_cost_per_product = (cost / totalItems).toFixed(0)
  if (prevGmv && gmv)     f.growth_revenue   = ((gmv - prevGmv) / prevGmv * 100).toFixed(2)
  if (reach && impresi)   f.engagement_rate  = (impresi / reach * 100).toFixed(2)
  if (tab === 'paid') {
    const gmvVal = Number(f.gmv) || 0
    const costVal = Number(f.cost) || 0
    if (gmvVal && costVal) f.roi = (gmvVal / costVal).toFixed(2)
  }

  return f
}

function hitungTotalCost(f, btList) {
  const fields = ['komisi_tiktok','komisi_shopee',
    'fee_cogs_tiktok','fee_cogs_shopee','ongkir','fee_partnership']
  const sumFields = fields.reduce((a, key) => a + (Number(f[key]) || 0), 0)
  const sumBiayaTambahan = (btList || []).reduce((a, b) => a + (Number(b.nominal) || 0), 0)
  return sumFields + sumBiayaTambahan
}

const BIAYA_TAMBAHAN_OPTIONS = [
  'Biaya Campaign',
  'Biaya Training/Webinar',
  'Biaya Kopdar',
  'Reward Kopaskap',
  'Pembelian Akun Kopaskap',
  'Pembelian Merchandise',
  'Entertain Affiliate',
]

const statusBadge = {
  aktif:   { bg: '#DCFCE7', text: '#166534', label: 'Aktif' },
  pause:   { bg: '#FEF9C3', text: '#854D0E', label: 'Pause' },
  selesai: { bg: '#FEE2E2', text: '#991B1B', label: 'Selesai' },
}

export default function AffiliatePage() {
  const [activeTab, setActiveTab]     = useState('monthly')
  const [data, setData]               = useState({ monthly: [], weekly: [], paid: [] })
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(buildEmpty('monthly'))
  const [saving, setSaving]           = useState(false)
  const [notif, setNotif]             = useState('')
  const [editId, setEditId]           = useState(null)
  const [bulan, setBulan]             = useState(new Date().toISOString().slice(0, 7))
  const [prevGmv, setPrevGmv]         = useState(0)
  const [filterMinggu, setFilterMinggu] = useState('semua')
  const [filterBulanPaid, setFilterBulanPaid] = useState('')
  const [halamanTabel, setHalamanTabel] = useState(1)
  const BARIS_PER_HALAMAN = 5
  const [biayaTambahanList, setBiayaTambahanList] = useState([
    { jenis: 'Biaya Campaign', nominal: '', keterangan: '' }
  ])
  const [grafikTahunan, setGrafikTahunan] = useState([])

  useEffect(() => { fetchAll() }, [bulan])

  async function fetchAll() {
    setLoading(true)
    // Ambil semua data weekly tahun ini
    const tahunIni = new Date().getFullYear()
    const weeklyFrom = tahunIni + '-01-01'
    const paidFrom = tahunIni + '-01-01'

    const [r1, r2, r3] = await Promise.all([
      supabase.from('affiliate_monthly').select('*').order('tanggal', { ascending: false }),
      supabase
        .from('affiliate_weekly')
        .select('*')
        .gte('tanggal', weeklyFrom)
        .order('tanggal', { ascending: false }),
      supabase
        .from('affiliate_paid')
        .select('*')
        .gte('tanggal', paidFrom)
        .order('tanggal', { ascending: false }),
    ])

    // Cek apakah ada data di bulan yang dipilih (hanya tab monthly)
    if (activeTab === 'monthly') {
      const monthlyFiltered = (r1.data || []).filter(r =>
        r.tanggal && r.tanggal.startsWith(bulan)
      )
      if (monthlyFiltered.length === 0 && r1.data && r1.data.length > 0) {
        const latestDate = r1.data
          .map(r => r.tanggal)
          .filter(Boolean)
          .sort()
          .reverse()[0]
        if (latestDate) {
          setBulan(latestDate.slice(0, 7))
          return // fetchAll akan dipanggil ulang otomatis karena bulan berubah
        }
      }
    }

    const filterBulan = (arr, skipFilter = false) => {
      if (skipFilter) return arr || []
      return (arr || []).filter(r => r.tanggal && r.tanggal.startsWith(bulan))
    }
    const monthly = filterBulan(r1.data)
    const weekly  = filterBulan(r2.data, true)
    setData({ monthly, weekly, paid: filterBulan(r3.data, true) })

    console.log('Total weekly data:', (r2.data || []).length)
    console.log('Weekly dates:', (r2.data || []).map(r => r.tanggal).sort())

    // Ambil GMV periode sebelumnya untuk Growth Revenue
    const allWeekly = r2.data || []
    const sorted = [...allWeekly].sort((a, b) =>
      b.tanggal.localeCompare(a.tanggal))

    // GMV minggu terbaru = index 0, minggu sebelumnya = index 1
    if (activeTab === 'weekly') {
      if (sorted.length >= 2) {
        setPrevGmv(Number(sorted[1].gmv) || 0)
      } else {
        setPrevGmv(0)
      }
    } else if (activeTab === 'monthly') {
      const allMonthly = r1.data || []
      const sortedMonthly = [...allMonthly].sort((a, b) =>
        b.tanggal.localeCompare(a.tanggal))
      if (sortedMonthly.length >= 2) {
        setPrevGmv(Number(sortedMonthly[1].gmv) || 0)
      } else {
        setPrevGmv(0)
      }
    } else {
      setPrevGmv(0)
    }

    // Ambil semua data monthly tahun ini
    const dataTahunIni = (r1.data || [])
      .filter(r => r.tanggal && r.tanggal.startsWith(tahunIni))
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

    // Buat data per bulan
    const NAMA_BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun',
      'Jul','Agu','Sep','Okt','Nov','Des']

    const bulanAktual = new Date().getMonth() // 0-11

    const grafikData = Array.from({ length: bulanAktual + 1 }, (_, i) => {
      const bulanStr = tahunIni + '-' + String(i + 1).padStart(2, '0')
      const dataRow = dataTahunIni.find(r => r.tanggal && r.tanggal.startsWith(bulanStr))
      return {
        bulan: NAMA_BULAN[i],
        gmv: dataRow ? Number(dataRow.gmv) || 0 : 0,
        cost: dataRow ? Number(dataRow.cost) || 0 : 0,
      }
    })

    setGrafikTahunan(grafikData)
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => {
      const updated = autoCalc({ ...f, [name]: value }, activeTab, prevGmv)
      updated.cost = hitungTotalCost(updated, biayaTambahanList)
      return updated
    })
  }

  async function handleSubmit() {
    if (!form.tanggal) {
      setNotif('error:Tanggal wajib diisi!')
      return
    }
    if (activeTab === 'paid' && !form.nama_partner) {
      setNotif('error:Nama partner wajib diisi!')
      return
    }
    setSaving(true)
    const payload = { tanggal: activeTab === 'monthly' ? form.tanggal.slice(0, 7) + '-01' : form.tanggal }
    ALL_FIELD_NAMES[activeTab].forEach(f => {
      payload[f] = (f === 'keterangan_biaya' || f === 'nama_partner' || f === 'platform' || f === 'periode')
        ? (form[f] || '')
        : (Number(form[f]) || 0)
    })
    if (payload.keterangan_biaya !== undefined) payload.keterangan_biaya = form.keterangan_biaya || ''
    if (payload.nama_partner !== undefined) payload.nama_partner = form.nama_partner || ''
    if (payload.platform !== undefined) payload.platform = form.platform || 'tiktok'
    if (payload.periode !== undefined) payload.periode = form.periode || ''
    if (activeTab !== 'paid') {
      payload.biaya_tambahan = JSON.stringify(
        biayaTambahanList.filter(b => b.nominal || b.keterangan)
      )
      payload.cost = hitungTotalCost(form, biayaTambahanList)
    }

    const tbl = PLATFORM_CONFIG[activeTab].table
    if (editId) {
      await supabase.from(tbl).update(payload).eq('id', editId)
      setNotif('ok:Data berhasil diperbarui!')
      setEditId(null)
    } else {
      await supabase.from(tbl).insert([payload])
      setNotif('ok:Data berhasil disimpan!')
    }
    setSaving(false)
    setForm(buildEmpty(activeTab))
    setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }])
    setShowForm(false)
    fetchAll()
    setTimeout(() => setNotif(''), 3000)
  }

  function handleEdit(row) {
    setForm({ ...buildEmpty(activeTab), ...row })
    setEditId(row.id)
    setShowForm(true)
    window.scrollTo(0, 0)

    // Parse biaya tambahan dari JSON yang tersimpan
    try {
      const savedBiaya = row.biaya_tambahan
      if (savedBiaya && typeof savedBiaya === 'string' && savedBiaya.startsWith('[')) {
        const parsed = JSON.parse(savedBiaya)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBiayaTambahanList(parsed)
        } else {
          setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }])
        }
      } else {
        setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }])
      }
    } catch (e) {
      setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }])
    }
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus data ini?')) return
    await supabase.from(PLATFORM_CONFIG[activeTab].table).delete().eq('id', id)
    fetchAll()
  }

  const rows = (() => {
    const all = data[activeTab] || []
    if (activeTab === 'weekly' && filterMinggu !== 'semua') {
      return all.filter(r => {
        if (!r.tanggal) return false
        const rDate = new Date(r.tanggal)
        const fDate = new Date(filterMinggu)
        // Bandingkan tahun, bulan, hari secara terpisah
        // untuk hindari masalah timezone
        return rDate.getFullYear() === fDate.getFullYear() &&
               rDate.getMonth() === fDate.getMonth() &&
               rDate.getDate() === fDate.getDate()
      })
    }
    if (activeTab === 'paid' && filterBulanPaid) {
      return all.filter(r => r.tanggal && r.tanggal.startsWith(filterBulanPaid))
    }
    return all
  })()
  const totalHalaman = Math.ceil(rows.length / BARIS_PER_HALAMAN)
  const rowsPaginated = rows.slice(
    (halamanTabel - 1) * BARIS_PER_HALAMAN,
    halamanTabel * BARIS_PER_HALAMAN
  )
  const cfg  = PLATFORM_CONFIG[activeTab]
  const fields = activeTab === 'paid' ? PAID_FIELDS : COMMON_FIELDS

  // Summary cards
  const summaryCommon = [
    { label: 'Total GMV', value: fmtRp(sum(rows, 'gmv')) },
    { label: 'Growth Revenue', value: (() => {
      const sorted = [...rows].sort((a, b) =>
        a.tanggal.localeCompare(b.tanggal))
      if (sorted.length < 2) return '-'
      const latest = Number(sorted[sorted.length - 1].gmv) || 0
      const prev = Number(sorted[sorted.length - 2].gmv) || 0
      if (!prev) return '-'
      const growth = ((latest - prev) / prev * 100).toFixed(2)
      return (
        <span style={{ color: Number(growth) >= 0 ? '#166534' : '#991B1B', fontWeight: 600 }}>
          {growth}%
        </span>
      )
    })() },
    { label: 'Total Affiliate', value: fmt(sum(rows, 'total_affiliate')) },
    { label: 'Making Sales Rate', value: (() => {
      const totalJml = sum(rows, 'jumlah_making_sales')
      const totalAff = sum(rows, 'total_affiliate')
      return totalAff > 0 ? fmtPct(totalJml / totalAff * 100) : '-'
    })() },
    { label: 'Acquisition Cost Per Product', value: fmtRp(avg(rows, 'acquisition_cost_per_product')) },
    { label: 'Jumlah Video', value: fmt(sum(rows, 'jumlah_video')) },
    { label: 'Cost', value: fmtRp(sum(rows, 'cost')) },
    {
      label: 'ROI',
      value: (() => {
        const totalGmv = sum(rows, 'gmv')
        const totalCost = sum(rows, 'cost')
        if (!totalCost) return '-'
        return fmtX(totalGmv / totalCost)
      })()
    },
  ]

  const summaryPaid = [
    {
      label: 'Total GMV',
      value: fmtRp(sum(rows, 'gmv')),
      highlight: true
    },
    {
      label: 'GMV Growth',
      value: (() => {
        const sorted = [...rows].sort((a, b) =>
          a.tanggal.localeCompare(b.tanggal))
        if (sorted.length < 2) return '-'
        const latest = Number(sorted[sorted.length - 1].gmv) || 0
        const prev = Number(sorted[sorted.length - 2].gmv) || 0
        if (!prev) return '-'
        const growth = ((latest - prev) / prev * 100).toFixed(2)
        const color = Number(growth) >= 0 ? '#166534' : '#991B1B'
        return { value: growth + '%', color }
      })()
    },
    {
      label: 'Making Sales Rate',
      value: (() => {
        const akunGmv = rows.filter(r => (Number(r.gmv) || 0) > 0).length
        const totalAff = rows.length
        return totalAff > 0 ? fmtPct(akunGmv / totalAff * 100) : '-'
      })()
    },
    {
      label: 'Average GMV',
      value: (() => {
        const totalGmv = sum(rows, 'gmv')
        return rows.length > 0 ? fmtRp(totalGmv / rows.length) : '-'
      })()
    },
    {
      label: 'Total Video Posted',
      value: fmt(sum(rows, 'jumlah_konten'))
    },
    {
      label: 'Total Livestream',
      value: fmt(sum(rows, 'jumlah_live'))
    },
    {
      label: 'Total Spending',
      value: fmtRp(sum(rows, 'cost'))
    },
    {
      label: 'ROI',
      value: (() => {
        const totalGmv = sum(rows, 'gmv')
        const totalCost = sum(rows, 'cost')
        return totalCost > 0 ? fmtX(totalGmv / totalCost) : '-'
      })()
    },
  ]

  const summaryCards = activeTab === 'paid' ? summaryPaid : summaryCommon

  // Grafik tren GMV
  const grafik = (() => {
    if (activeTab !== 'weekly') {
      // Untuk monthly dan paid: pakai rows yang sudah difilter
      return [...rows]
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        .map(r => ({
          tgl: r.tanggal.slice(8),
          gmv: Number(r.gmv) || 0,
          cost: Number(r.cost) || 0,
        }))
    }

    // Untuk weekly:
    // Jika ada filter minggu aktif → tampilkan hanya minggu itu
    // Jika semua minggu → tampilkan semua
    const source = filterMinggu !== 'semua'
      ? (data.weekly || []).filter(r => r.tanggal === filterMinggu)
      : (data.weekly || [])

    return [...source]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map(r => {
        const d = new Date(r.tanggal)
        const startOfYear = new Date(d.getFullYear(), 0, 1)
        const weekNum = Math.ceil(
          ((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
        )
        return {
          tgl: `W${weekNum}`,
          gmv: Number(r.gmv) || 0,
          cost: Number(r.cost) || 0,
        }
      })
  })()

  const fmtRpAxis = v => {
    if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'jt'
    if (v >= 1000)    return 'Rp ' + (v / 1000).toFixed(0) + 'rb'
    return 'Rp ' + v
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {notif && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: notif.startsWith('ok:') ? '#DCFCE7' : '#FEE2E2', color: notif.startsWith('ok:') ? '#166534' : '#991B1B' }}>
          {notif.replace(/^(ok|error):/, '')}
        </div>
      )}

      {/* ── FORM INPUT ── */}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#111' }}>{editId ? 'Edit data' : 'Input data baru'} — {cfg.label}</p>
            <button onClick={() => { setShowForm(false); setEditId(null); setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }]) }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
          </div>

          {/* Info dasar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
            {activeTab === 'weekly' ? (
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>Minggu *</label>
                <input
                  type="week"
                  name="tanggal"
                  value={form.tanggal_week || ''}
                  onChange={(e) => {
                    const weekVal = e.target.value
                    if (!weekVal) return

                    const [yearStr, weekStr] = weekVal.split('-W')
                    const year = parseInt(yearStr)
                    const week = parseInt(weekStr)

                    // ISO 8601: W01 adalah minggu yang mengandung Kamis pertama
                    // Senin W01 = 4 Jan dikurangi harinya + 1
                    const simple = new Date(year, 0, 1 + (week - 1) * 7)
                    const dow = simple.getDay() // 0=Min, 1=Sen
                    const monday = new Date(simple)

                    if (dow === 0) {
                      // Minggu → maju 1 hari ke Senin
                      monday.setDate(simple.getDate() + 1)
                    } else if (dow !== 1) {
                      // Bukan Senin → mundur ke Senin
                      monday.setDate(simple.getDate() - (dow - 1))
                    }

                    // Format YYYY-MM-DD manual (hindari timezone)
                    const y = monday.getFullYear()
                    const m = String(monday.getMonth() + 1).padStart(2, '0')
                    const d = String(monday.getDate()).padStart(2, '0')
                    const dateStr = `${y}-${m}-${d}`

                    setForm(f => ({
                      ...f,
                      tanggal: dateStr,
                      tanggal_week: weekVal
                    }))
                  }}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }}
                />
                {form.tanggal && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7280' }}>
                    Senin: {form.tanggal}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>Tanggal *</label>
                <input
                  type={activeTab === 'monthly' ? 'month' : 'date'}
                  name="tanggal"
                  value={activeTab === 'monthly' ? (form.tanggal || '').slice(0, 7) : (form.tanggal || '')}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          {/* Field per section */}
          {fields.map(section => (
            <div key={section.section} style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F3F4F6', padding: '4px 10px', borderRadius: 4, display: 'inline-block' }}>{section.section}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
                {section.fields.map(f => (
                  <div key={f.name}>
                    <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>{f.label}</label>
                    {f.type === 'select' ? (
                      <select name={f.name} value={form[f.name] || ''} onChange={handleChange}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff' }}>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={f.type || 'number'} name={f.name} value={form[f.name] || ''}
                        onChange={handleChange} readOnly={f.auto} placeholder={f.placeholder || (f.auto ? 'otomatis' : '0')}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: f.auto ? '#6B7280' : '#111', background: f.auto ? '#F3F4F6' : '#fff', boxSizing: 'border-box' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {activeTab !== 'paid' && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600,
                color: '#9CA3AF', textTransform: 'uppercase',
                letterSpacing: '0.06em', background: '#F3F4F6',
                padding: '4px 10px', borderRadius: 4, display: 'inline-block' }}>
                Biaya Tambahan
              </p>
              {biayaTambahanList.map((item, idx) => (
                <div key={idx} style={{ display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#374151',
                      fontWeight: 500, display: 'block', marginBottom: 5 }}>
                      Jenis Biaya
                    </label>
                    <select
                      value={item.jenis}
                      onChange={(e) => {
                        const updated = [...biayaTambahanList]
                        updated[idx].jenis = e.target.value
                        setBiayaTambahanList(updated)
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid #D1D5DB', fontSize: 13, color: '#111',
                        background: '#fff' }}>
                      {BIAYA_TAMBAHAN_OPTIONS.map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#374151',
                      fontWeight: 500, display: 'block', marginBottom: 5 }}>
                      Nominal (Rp)
                    </label>
                    <input
                      type="number"
                      value={item.nominal}
                      onChange={(e) => {
                        const updated = [...biayaTambahanList]
                        updated[idx].nominal = e.target.value
                        setBiayaTambahanList(updated)
                        setForm(f => ({
                          ...f,
                          cost: hitungTotalCost(f, updated)
                        }))
                      }}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid #D1D5DB', fontSize: 13, color: '#111',
                        background: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#374151',
                      fontWeight: 500, display: 'block', marginBottom: 5 }}>
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={item.keterangan || ''}
                      onChange={(e) => {
                        const updated = [...biayaTambahanList]
                        updated[idx].keterangan = e.target.value
                        setBiayaTambahanList(updated)
                      }}
                      placeholder="cth: Campaign Juni, THR lebaran..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid #D1D5DB', fontSize: 13, color: '#111',
                        background: '#fff', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    {biayaTambahanList.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = biayaTambahanList.filter((_, i) => i !== idx)
                          setBiayaTambahanList(updated)
                          setForm(f => ({ ...f, cost: hitungTotalCost(f, updated) }))
                        }}
                        style={{ padding: '8px 12px', borderRadius: 8,
                          border: '1px solid #FECACA', background: '#FEF2F2',
                          color: '#DC2626', cursor: 'pointer', fontSize: 13 }}>
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setBiayaTambahanList([
                  ...biayaTambahanList,
                  { jenis: 'Biaya Campaign', nominal: '', keterangan: '' }
                ])}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13,
                  border: '1px dashed #D1D5DB', background: '#F9FAFB',
                  color: '#374151', cursor: 'pointer', marginTop: 4 }}>
                + Tambah biaya
              </button>
              <div style={{ marginTop: 12, padding: '10px 14px',
                background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#166534' }}>
                  <strong>Total Cost (otomatis):</strong> Rp {Number(form.cost || 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setShowForm(false); setForm(buildEmpty(activeTab)); setEditId(null); setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }]) }}
              style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Batal</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              {saving ? 'Menyimpan...' : editId ? 'Perbarui data' : 'Simpan data'}
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Affiliate Reporting</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Monthly · Weekly · Paid Partnership · {bulan}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff' }} />
          <button onClick={() => { setShowForm(true); setForm(buildEmpty(activeTab)); setEditId(null); setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }]) }}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            + Input data
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(PLATFORM_CONFIG).map(([key, pc]) => (
          <button key={key} onClick={() => { setActiveTab(key); setForm(buildEmpty(key)); setFilterMinggu('semua'); setFilterBulanPaid(''); setHalamanTabel(1); setBiayaTambahanList([{ jenis: 'Biaya Campaign', nominal: '', keterangan: '' }]) }}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '2px solid', borderColor: activeTab === key ? pc.color.text : '#E5E7EB', background: activeTab === key ? pc.color.bg : '#fff', color: activeTab === key ? pc.color.text : '#6B7280' }}>
            {pc.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#9CA3AF', fontSize: 14 }}>Memuat data...</p>
      ) : (
        <>
          {activeTab === 'weekly' && (() => {
            const mingguList = (() => {
              const seen = new Set()
              const result = []

              ;(data.weekly || [])
                .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
                .forEach(r => {
                  if (!r.tanggal) return
                  if (seen.has(r.tanggal)) return
                  seen.add(r.tanggal)

                  const d = new Date(r.tanggal)
                  const startOfYear = new Date(d.getFullYear(), 0, 1)
                  const weekNum = Math.ceil(
                    ((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
                  )
                  const endDate = new Date(d)
                  endDate.setDate(d.getDate() + 6)
                  const label = `W${weekNum} · ${d.getDate()}/${d.getMonth()+1} - ${endDate.getDate()}/${endDate.getMonth()+1}/${d.getFullYear()}`
                  result.push({ key: r.tanggal, label })
                })

              return result
            })()

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 16, background: '#fff', border: '1px solid #E5E7EB',
                borderRadius: 10, padding: '12px 16px' }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Filter minggu:
                </span>
                <select
                  value={filterMinggu}
                  onChange={(e) => { setFilterMinggu(e.target.value); setHalamanTabel(1) }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB',
                    fontSize: 13, color: '#111', background: '#fff', cursor: 'pointer',
                    minWidth: 220 }}>
                  <option value="semua">Semua minggu ({mingguList.length} minggu)</option>
                  {mingguList.map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                {filterMinggu !== 'semua' && (
                  <button
                    onClick={() => { setFilterMinggu('semua'); setHalamanTabel(1) }}
                    style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12,
                      border: '1px solid #E5E7EB', background: '#F9FAFB',
                      color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Reset filter
                  </button>
                )}
              </div>
            )
          })()}

          {activeTab === 'paid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 16, background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
                Filter bulan:
              </span>
              <select
                value={filterBulanPaid}
                onChange={(e) => setFilterBulanPaid(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8,
                  border: '1px solid #D1D5DB', fontSize: 13,
                  color: '#111', background: '#fff', minWidth: 160 }}>
                <option value="">Semua bulan</option>
                {[...new Set(
                  (data.paid || []).map(r => r.tanggal && r.tanggal.slice(0, 7))
                  .filter(Boolean)
                )].sort().reverse().map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              {filterBulanPaid && (
                <button onClick={() => setFilterBulanPaid('')}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #E5E7EB', background: '#F9FAFB',
                    color: '#6B7280', cursor: 'pointer' }}>
                  Reset filter
                </button>
              )}
            </div>
          )}

          {/* ── GRAFIK TREN ── */}
          {grafik.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111' }}>{activeTab === 'monthly' ? 'Tren GMV vs Cost — Sepanjang ' + new Date().getFullYear() : 'Tren GMV vs Cost — ' + cfg.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Perbandingan GMV dan biaya per periode</p>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 20, height: 2, background: '#16A34A', display: 'inline-block', borderRadius: 2 }}></span>
                    <span style={{ color: '#6B7280' }}>GMV</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 20, height: 2, background: '#DC2626', display: 'inline-block', borderRadius: 2 }}></span>
                    <span style={{ color: '#6B7280' }}>Cost</span>
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={activeTab === 'monthly' ? grafikTahunan : grafik} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey={activeTab === 'monthly' ? 'bulan' : 'tgl'} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                  <YAxis tickFormatter={fmtRpAxis} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip
                    formatter={(v, name) => ['Rp ' + Number(v).toLocaleString('id-ID'), name === 'gmv' ? 'GMV' : 'Cost']}
                    labelFormatter={l => 'Tgl: ' + l}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                  />
                  <Line type="monotone" dataKey="gmv" stroke="#16A34A" strokeWidth={2} dot={{ r: 3, fill: '#16A34A', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="cost" stroke="#DC2626" strokeWidth={2} dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── SUMMARY CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
            {summaryCards.map(m => (
              <div key={m.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{m.label}</p>
                <p style={{
                  margin: 0, fontSize: 20, fontWeight: 700,
                  color: m.value && typeof m.value === 'object'
                    ? m.value.color : '#111'
                }}>
                  {m.value && typeof m.value === 'object'
                    ? m.value.value : m.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── TABEL DATA ── */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111' }}>
                Detail data — <span style={{ color: cfg.color.text }}>{cfg.label}</span>
              </p>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} entri</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <p style={{ fontSize: 14, margin: '0 0 8px' }}>Belum ada data untuk bulan ini</p>
                <p style={{ fontSize: 12, margin: 0 }}>Klik "Input data" untuk menambahkan</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                {activeTab === 'paid' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Nama Affiliate</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Platform</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>GMV</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Video Posted</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Livestream</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Spending</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>ROI</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsPaginated.map(row => {
                      const gmvVal = Number(row.gmv) || 0
                      const costVal = Number(row.cost) || 0
                      const roiVal = gmvVal && costVal ? gmvVal / costVal : null
                      const platformColors = {
                        tiktok: { bg: '#F3F4F6', color: '#111' },
                        shopee: { bg: '#FFF0E6', color: '#993C1D' },
                        instagram: { bg: '#FDF2F8', color: '#BE185D' },
                        youtube: { bg: '#FEE2E2', color: '#991B1B' },
                      }
                      const pStyle = platformColors[row.platform] || { bg: '#F3F4F6', color: '#374151' }
                      return (
                        <tr key={row.id} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                          <td style={{ padding: '7px 10px', color: '#374151', fontWeight: 500 }}>{row.nama_partner}</td>
                          <td style={{ padding: '7px 10px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: pStyle.bg, color: pStyle.color, textTransform: 'capitalize' }}>{row.platform}</span>
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#111', fontWeight: 500 }}>{fmtRp(row.gmv)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.jumlah_konten)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.jumlah_live)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#374151' }}>{fmtRp(row.cost)}</td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, color: roiVal !== null ? (roiVal >= 2 ? '#166534' : '#991B1B') : '#374151' }}>
                            {roiVal !== null ? fmtX(roiVal) : '-'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(row)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', marginRight: 6, color: '#374151' }}>Edit</button>
                            <button onClick={() => handleDelete(row.id)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>Hapus</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Tanggal</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>GMV</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Cost</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Rate Cost</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Growth</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Total Aff</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Jml Making Sales</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Making Sales Rate</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Items TikTok</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Items Shopee</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsPaginated.map(row => (
                      <tr key={row.id} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#374151' }}>
                          {activeTab === 'weekly' ? (() => {
                            if (!row.tanggal) return '-'
                            const d = new Date(row.tanggal)
                            const startOfYear = new Date(d.getFullYear(), 0, 1)
                            const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
                            const endDate = new Date(d)
                            endDate.setDate(d.getDate() + 6)
                            return `W${weekNum} · ${d.getDate()}/${d.getMonth()+1} - ${endDate.getDate()}/${endDate.getMonth()+1}`
                          })() : row.tanggal}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#111', fontWeight: 500 }}>{fmtRp(row.gmv)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#374151' }}>{fmtRp(row.cost)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: Number(row.rate_cost_gmv) <= 20 ? '#166534' : '#991B1B', fontWeight: 500 }}>{fmtPct(row.rate_cost_gmv)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{(() => {
                          const sorted = [...rows].sort((a, b) =>
                            a.tanggal.localeCompare(b.tanggal))
                          const idx = sorted.findIndex(r => r.id === row.id)
                          if (idx <= 0) return '-'
                          const prevGmvRow = Number(sorted[idx - 1].gmv) || 0
                          const currGmv = Number(row.gmv) || 0
                          if (!prevGmvRow) return '-'
                          const growth = ((currGmv - prevGmvRow) / prevGmvRow * 100).toFixed(2)
                          return (
                            <span style={{ color: Number(growth) >= 0 ? '#166534' : '#991B1B', fontWeight: 500 }}>
                              {growth}%
                            </span>
                          )
                        })()}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.total_affiliate)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.jumlah_making_sales)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{(() => {
                          const jml = Number(row.jumlah_making_sales) || 0
                          const aff = Number(row.total_affiliate) || 0
                          return aff > 0 ? fmtPct(jml / aff * 100) : '-'
                        })()}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.items_sold_tiktok)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{fmt(row.items_sold_shopee)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => handleEdit(row)}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', marginRight: 6, color: '#374151' }}>Edit</button>
                          <button onClick={() => handleDelete(row.id)}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>Hapus</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
                {totalHalaman > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginTop: 14, paddingTop: 12,
                    borderTop: '1px solid #F3F4F6' }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                      Menampilkan {((halamanTabel-1)*BARIS_PER_HALAMAN)+1}–{Math.min(halamanTabel*BARIS_PER_HALAMAN, rows.length)} dari {rows.length} data
                    </p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => setHalamanTabel(p => Math.max(1, p-1))}
                        disabled={halamanTabel === 1}
                        style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12,
                          border: '1px solid #E5E7EB', background: halamanTabel === 1 ? '#F9FAFB' : '#fff',
                          color: halamanTabel === 1 ? '#D1D5DB' : '#374151', cursor: halamanTabel === 1 ? 'default' : 'pointer' }}>
                        ← Prev
                      </button>
                      {Array.from({ length: totalHalaman }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setHalamanTabel(p)}
                          style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12,
                            border: '1px solid',
                            borderColor: halamanTabel === p ? '#3C3489' : '#E5E7EB',
                            background: halamanTabel === p ? '#F0F0FF' : '#fff',
                            color: halamanTabel === p ? '#3C3489' : '#374151',
                            fontWeight: halamanTabel === p ? 600 : 400,
                            cursor: 'pointer' }}>
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setHalamanTabel(p => Math.min(totalHalaman, p+1))}
                        disabled={halamanTabel === totalHalaman}
                        style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12,
                          border: '1px solid #E5E7EB', background: halamanTabel === totalHalaman ? '#F9FAFB' : '#fff',
                          color: halamanTabel === totalHalaman ? '#D1D5DB' : '#374151', cursor: halamanTabel === totalHalaman ? 'default' : 'pointer' }}>
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}