'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadTemplate, parseExcel } from '../../lib/excelTemplate'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

function getWeekRange(weeksAgo = 0) {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 - weeksAgo * 7)
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  }
}

// ─── Format helpers ───────────────────────────────────────
const fmt    = n => (n == null || n === '') ? '-' : Number(n).toLocaleString('id-ID')
const fmtRp  = n => (n == null || n === '') ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtPct = n => (n == null || n === '') ? '-' : Number(n).toFixed(2) + '%'
const fmtX   = n => (n == null || n === '') ? '-' : Number(n).toFixed(2) + 'x'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)
const avg    = (arr, f) => arr.length ? (sum(arr, f) / arr.length).toFixed(2) : 0

// ─── Metrik per platform ──────────────────────────────────
const SHOPEE_FIELDS = [
  { section: 'Awareness',             fields: [
    { label: 'Impresi',        name: 'impresi',        type: 'number' },
    { label: 'CPM (Rp)',       name: 'cpm',            type: 'number', auto: true },
  ]},
  { section: 'Interest & Consideration', fields: [
    { label: 'Klik',           name: 'klik',           type: 'number' },
    { label: 'CTR % (auto)',   name: 'ctr',            type: 'number', auto: true },
    { label: 'CPC (auto)',     name: 'cpc',            type: 'number', auto: true },
  ]},
  { section: 'Intent',                fields: [
    { label: 'ATC',            name: 'atc',            type: 'number' },
    { label: 'Rasio ATC % (auto)', name: 'rasio_atc', type: 'number', auto: true },
  ]},
  { section: 'Konversi',              fields: [
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CVR % (auto)',   name: 'cvr',            type: 'number', auto: true },
    { label: 'Produk terjual', name: 'produk_terjual', type: 'number' },
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
    { label: 'AOV (auto)',     name: 'aov',            type: 'number', auto: true },
  ]},
]

const TIKTOK_FIELDS = [
  { section: 'Konversi & Biaya',      fields: [
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
  ]},
]

const META_FIELDS = [
  { section: 'Awareness',             fields: [
    { label: 'Impresi',        name: 'impresi',        type: 'number' },
    { label: 'CPM (Rp)',       name: 'cpm',            type: 'number', auto: true },
  ]},
  { section: 'Interest & Consideration', fields: [
    { label: 'Klik',           name: 'klik',           type: 'number' },
    { label: 'CTR % (auto)',   name: 'ctr',            type: 'number', auto: true },
    { label: 'CPC (auto)',     name: 'cpc',            type: 'number', auto: true },
    { label: 'View Page',      name: 'view_page',      type: 'number' },
    { label: 'View Page Rate % (auto)', name: 'view_page_rate', type: 'number', auto: true },
  ]},
  { section: 'Intent',                fields: [
    { label: 'ATC',            name: 'atc',            type: 'number' },
    { label: 'Rasio ATC % (auto)', name: 'rasio_atc', type: 'number', auto: true },
  ]},
  { section: 'Konversi',              fields: [
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CVR % (auto)',   name: 'cvr',            type: 'number', auto: true },
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
    { label: 'AOV (auto)',     name: 'aov',            type: 'number', auto: true },
  ]},
]

const PLATFORM_CONFIG = {
  shopee: { label: 'Shopee Ads', table: 'ads_shopee', fields: SHOPEE_FIELDS, color: { bg: '#FFF0E6', text: '#993C1D' } },
  tiktok: { label: 'TikTok GMV Max', table: 'ads_tiktok', fields: TIKTOK_FIELDS, color: { bg: '#F0F0FF', text: '#3C3489' } },
  meta:   { label: 'Meta Ads', table: 'ads_meta', fields: META_FIELDS, color: { bg: '#E6F1FB', text: '#0C447C' } },
}

const ALL_FIELDS = {
  shopee: ['impresi','cpm','klik','ctr','cpc','atc','rasio_atc','pesanan','cvr','produk_terjual','biaya_iklan','omzet','roi','cpa','aov'],
  tiktok: ['biaya_iklan','omzet','roi','pesanan','cpa'],
  meta:   ['impresi','cpm','klik','ctr','cpc','view_page','view_page_rate','atc','rasio_atc','pesanan','cvr','biaya_iklan','omzet','roi','cpa','aov'],
}

function buildEmpty(platform) {
  const base = { tanggal: new Date().toISOString().split('T')[0], nama_kampanye: '', tipe_kampanye: '', status: 'aktif' }
  ALL_FIELDS[platform].forEach(f => base[f] = '')
  return base
}

function autoCalc(form, platform) {
  const f = { ...form }
  const bi = Number(f.biaya_iklan) || 0
  const imp = Number(f.impresi) || 0
  const klik = Number(f.klik) || 0
  const pesanan = Number(f.pesanan) || 0
  const omzet = Number(f.omzet) || 0
  const atc = Number(f.atc) || 0
  const vp = Number(f.view_page) || 0

  if (imp && bi)    f.cpm          = (bi / imp * 1000).toFixed(0)
  if (imp && klik)  f.ctr          = (klik / imp * 100).toFixed(2)
  if (bi && klik)   f.cpc          = (bi / klik).toFixed(0)
  if (klik && atc)  f.rasio_atc    = (atc / klik * 100).toFixed(2)
  if (klik && pesanan) f.cvr       = (pesanan / klik * 100).toFixed(2)
  if (bi && omzet)  f.roi          = (omzet / bi).toFixed(2)
  if (bi && pesanan) f.cpa         = (bi / pesanan).toFixed(0)
  if (omzet && pesanan) f.aov      = (omzet / pesanan).toFixed(0)
  if (platform === 'meta' && klik && vp) f.view_page_rate = (vp / klik * 100).toFixed(2)

  return f
}

const statusBadge = {
  aktif:   { bg: '#DCFCE7', text: '#166534', label: 'Aktif' },
  pause:   { bg: '#FEF9C3', text: '#854D0E', label: 'Pause' },
  selesai: { bg: '#FEE2E2', text: '#991B1B', label: 'Selesai' },
}

// ─── Tabel kolom per platform ─────────────────────────────
const TABLE_COLS = {
  shopee: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: (v) => v },
    { label: 'Impresi', key: 'impresi', fmt: fmt },
    { label: 'CPM', key: 'cpm', fmt: fmtRp },
    { label: 'Klik', key: 'klik', fmt: fmt },
    { label: 'CTR', key: 'ctr', fmt: fmtPct },
    { label: 'CPC', key: 'cpc', fmt: fmtRp },
    { label: 'ATC', key: 'atc', fmt: fmt },
    { label: 'Rasio ATC', key: 'rasio_atc', fmt: fmtPct },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CVR', key: 'cvr', fmt: fmtPct },
    { label: 'Produk Terjual', key: 'produk_terjual', fmt: fmt },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
    { label: 'AOV', key: 'aov', fmt: fmtRp },
  ],
  tiktok: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: v => v },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
  ],
  meta: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: v => v },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'Impresi', key: 'impresi', fmt: fmt },
    { label: 'CPM', key: 'cpm', fmt: fmtRp },
    { label: 'Klik', key: 'klik', fmt: fmt },
    { label: 'CTR', key: 'ctr', fmt: fmtPct },
    { label: 'CPC', key: 'cpc', fmt: fmtRp },
    { label: 'View Page', key: 'view_page', fmt: fmt },
    { label: 'View Page Rate', key: 'view_page_rate', fmt: fmtPct },
    { label: 'ATC', key: 'atc', fmt: fmt },
    { label: 'Rasio ATC', key: 'rasio_atc', fmt: fmtPct },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CVR', key: 'cvr', fmt: fmtPct },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
    { label: 'AOV', key: 'aov', fmt: fmtRp },
  ],
}

// ─── Komponen utama ───────────────────────────────────────
export default function AdsPage() {
  const [activeTab, setActiveTab] = useState('shopee')
  const [data, setData] = useState({ shopee: [], tiktok: [], meta: [] })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formPlatform, setFormPlatform] = useState('shopee')
  const [form, setForm] = useState(buildEmpty('shopee'))
  const [saving, setSaving] = useState(false)
  const [notif, setNotif] = useState('')
  const [editId, setEditId] = useState(null)
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7))
  const [filterJenis, setFilterJenis] = useState('semua')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPreview, setUploadPreview] = useState([])
  const [uploadPlatform, setUploadPlatform] = useState('shopee')
  const [uploadNotif, setUploadNotif] = useState('')
  const [halamanTabel, setHalamanTabel] = useState(1)
  const [grafikMingguan, setGrafikMingguan] = useState([])
  const [anomaliAds, setAnomaliAds] = useState([])
  const BARIS_PER_HALAMAN = 10

  useEffect(() => {
    function handleUrlChange() {
      const params = new URLSearchParams(window.location.search)
      const platform = params.get('platform')
      if (platform && ['shopee','tiktok','meta'].includes(platform)) {
        setActiveTab(platform)
        setHalamanTabel(1)
      }
    }

    // Jalankan saat pertama kali
    handleUrlChange()

    // Listen perubahan URL (popstate = back/forward)
    window.addEventListener('popstate', handleUrlChange)

    // Next.js pakai pushState saat navigasi Link
    // Override pushState agar bisa dideteksi
    const originalPushState = window.history.pushState
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args)
      handleUrlChange()
    }

    return () => {
      window.removeEventListener('popstate', handleUrlChange)
      window.history.pushState = originalPushState
    }
  }, [])

  useEffect(() => { fetchAll() }, [bulan, activeTab])

  async function fetchAll() {
    setLoading(true)

    const [r1, r2, r3] = await Promise.all([
      supabase.from('ads_shopee').select('*').order('tanggal', { ascending: false }),
      supabase.from('ads_tiktok').select('*').order('tanggal', { ascending: false }),
      supabase.from('ads_meta').select('*').order('tanggal', { ascending: false }),
    ])

    const filterBulan = (arr) => (arr || []).filter(row => {
      return row.tanggal && row.tanggal.startsWith(bulan)
    })

    setData({
      shopee: filterBulan(r1.data),
      tiktok: filterBulan(r2.data),
      meta:   filterBulan(r3.data),
    })

    const tabelNama = PLATFORM_CONFIG[activeTab]?.table
    const allData = [...(r1.data||[]), ...(r2.data||[]), ...(r3.data||[])]

    const grafikData = Array.from({length:8}, (_,i) => {
      const range = getWeekRange(7-i)
      const d = new Date(range.from)
      const startOfYear = new Date(d.getFullYear(),0,1)
      const weekNum = Math.ceil(((d-startOfYear)/86400000+startOfYear.getDay()+1)/7)

      const filterPlatform = (arr) => arr.filter(r =>
        r.tanggal >= range.from && r.tanggal <= range.to)

      const shopeeW = filterPlatform(r1.data||[])
      const tiktokW = filterPlatform(r2.data||[])
      const metaW = filterPlatform(r3.data||[])

      return {
        label: `W${weekNum}`,
        shopee_omzet: shopeeW.reduce((a,b)=>a+(Number(b.omzet)||0),0),
        tiktok_omzet: tiktokW.reduce((a,b)=>a+(Number(b.omzet)||0),0),
        meta_omzet: metaW.reduce((a,b)=>a+(Number(b.omzet)||0),0),
        total_biaya: [...shopeeW,...tiktokW,...metaW]
          .reduce((a,b)=>a+(Number(b.biaya_iklan)||0),0),
      }
    })
    setGrafikMingguan(grafikData)

    const thisWeek = getWeekRange(0)
    const lastWeek = getWeekRange(1)
    const tbl = PLATFORM_CONFIG[activeTab]?.table
    const activeData = activeTab === 'shopee' ? (r1.data||[])
      : activeTab === 'tiktok' ? (r2.data||[])
      : (r3.data||[])

    const thisData = activeData.filter(r =>
      r.tanggal >= thisWeek.from && r.tanggal <= thisWeek.to)
    const prevData = activeData.filter(r =>
      r.tanggal >= lastWeek.from && r.tanggal <= lastWeek.to)

    const thisOmzet = thisData.reduce((a,b)=>a+(Number(b.omzet)||0),0)
    const prevOmzet = prevData.reduce((a,b)=>a+(Number(b.omzet)||0),0)
    const thisBiaya = thisData.reduce((a,b)=>a+(Number(b.biaya_iklan)||0),0)
    const prevBiaya = prevData.reduce((a,b)=>a+(Number(b.biaya_iklan)||0),0)
    const thisRoas = thisBiaya > 0 ? thisOmzet/thisBiaya : 0
    const prevRoas = prevBiaya > 0 ? prevOmzet/prevBiaya : 0

    const anomali = []
    if (prevOmzet > 0 && (thisOmzet-prevOmzet)/prevOmzet < -0.1)
      anomali.push(`Omzet turun ${Math.abs(((thisOmzet-prevOmzet)/prevOmzet)*100).toFixed(1)}% vs minggu lalu`)
    if (thisBiaya > 0 && thisRoas < 2)
      anomali.push(`ROAS di bawah 2x (${thisRoas.toFixed(2)}x) — efisiensi iklan perlu dievaluasi`)
    if (prevRoas > 0 && (thisRoas-prevRoas)/prevRoas < -0.15)
      anomali.push(`ROAS turun ${Math.abs(((thisRoas-prevRoas)/prevRoas)*100).toFixed(1)}% vs minggu lalu`)
    setAnomaliAds(anomali)

    setLoading(false)
  }

  function handlePlatformChange(p) {
    setFormPlatform(p)
    setForm(buildEmpty(p))
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleBlur() {
    setForm(f => autoCalc(f, formPlatform))
  }

  async function handleSubmit() {
    if (!form.nama_kampanye || !form.tanggal) {
      setNotif('error:Nama kampanye dan tanggal wajib diisi!')
      return
    }
    setSaving(true)
    const payload = { tanggal: form.tanggal, nama_kampanye: form.nama_kampanye, tipe_kampanye: form.tipe_kampanye, status: form.status }
    ALL_FIELDS[formPlatform].forEach(f => payload[f] = Number(form[f]) || 0)

    const tbl = PLATFORM_CONFIG[formPlatform].table
    if (editId) {
      await supabase.from(tbl).update(payload).eq('id', editId)
      setNotif('ok:Data berhasil diperbarui!')
      setEditId(null)
    } else {
      await supabase.from(tbl).insert([payload])
      setNotif('ok:Data berhasil disimpan!')
    }
    setSaving(false)
    setForm(buildEmpty(formPlatform))
    setShowForm(false)
    fetchAll()
    setTimeout(() => setNotif(''), 3000)
  }

  function handleEdit(row, platform) {
    setFormPlatform(platform)
    setForm({ ...buildEmpty(platform), ...row })
    setEditId(row.id)
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  async function handleDelete(id, platform) {
    if (!confirm('Yakin hapus data ini?')) return
    await supabase.from(PLATFORM_CONFIG[platform].table).delete().eq('id', id)
    fetchAll()
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadNotif('')
    try {
      const rows = await parseExcel(file, uploadPlatform)
      if (rows.length === 0) {
        setUploadNotif('error:Tidak ada data valid di file. Cek panduan di sheet Panduan.')
        return
      }
      setUploadPreview(rows)
      setUploadNotif('ok:' + rows.length + ' baris data siap diupload. Periksa preview lalu klik Simpan.')
    } catch (err) {
      setUploadNotif('error:' + err)
    }
  }

  async function handleUploadSimpan() {
    if (uploadPreview.length === 0) return
    setUploading(true)
    const tbl = PLATFORM_CONFIG[uploadPlatform].table
    const { error } = await supabase.from(tbl).insert(uploadPreview)
    if (error) {
      setUploadNotif('error:Gagal menyimpan: ' + error.message)
    } else {
      setUploadNotif('ok:' + uploadPreview.length + ' data berhasil disimpan!')
      setUploadPreview([])
      fetchAll()
      setTimeout(() => { setShowUpload(false); setUploadNotif('') }, 2000)
    }
    setUploading(false)
  }

  const rows = data[activeTab] || []
  const filtered = rows
  const totalHalaman = Math.ceil(filtered.length / BARIS_PER_HALAMAN)
  const rowsPaginated = filtered.slice(
    (halamanTabel - 1) * BARIS_PER_HALAMAN,
    halamanTabel * BARIS_PER_HALAMAN
  )
  const cfg  = PLATFORM_CONFIG[activeTab]

  // summary cards per active tab
  const summaryCards = {
    shopee: [
      { label: 'Total biaya iklan', value: fmtRp(sum(rows, 'biaya_iklan')) },
      { label: 'Total omzet', value: fmtRp(sum(rows, 'omzet')) },
      { label: 'ROI rata-rata', value: fmtX(avg(rows, 'roi')) },
      { label: 'Total pesanan', value: fmt(sum(rows, 'pesanan')) },
      { label: 'Total impresi', value: fmt(sum(rows, 'impresi')) },
      { label: 'Total klik', value: fmt(sum(rows, 'klik')) },
      { label: 'Total ATC', value: fmt(sum(rows, 'atc')) },
      { label: 'AOV rata-rata', value: fmtRp(avg(rows, 'aov')) },
    ],
    tiktok: [
      { label: 'Total biaya iklan', value: fmtRp(sum(rows, 'biaya_iklan')) },
      { label: 'Total omzet', value: fmtRp(sum(rows, 'omzet')) },
      { label: 'ROI rata-rata', value: fmtX(avg(rows, 'roi')) },
      { label: 'Total pesanan', value: fmt(sum(rows, 'pesanan')) },
      { label: 'CPA rata-rata', value: fmtRp(avg(rows, 'cpa')) },
    ],
    meta: [
      { label: 'Total biaya iklan', value: fmtRp(sum(rows, 'biaya_iklan')) },
      { label: 'Total omzet', value: fmtRp(sum(rows, 'omzet')) },
      { label: 'ROI rata-rata', value: fmtX(avg(rows, 'roi')) },
      { label: 'Total pesanan', value: fmt(sum(rows, 'pesanan')) },
      { label: 'Total impresi', value: fmt(sum(rows, 'impresi')) },
      { label: 'Total klik', value: fmt(sum(rows, 'klik')) },
      { label: 'Total ATC', value: fmt(sum(rows, 'atc')) },
      { label: 'AOV rata-rata', value: fmtRp(avg(rows, 'aov')) },
    ],
  }

  function GrowthBadge({ value }) {
    const up = Number(value) >= 0
    return (
      <span style={{ fontSize:11, fontWeight:600,
        padding:'2px 8px', borderRadius:20,
        background: up ? '#DCFCE7' : '#FEE2E2',
        color: up ? '#166534' : '#991B1B',
        display:'inline-flex', alignItems:'center', gap:3 }}>
        {up ? '▲' : '▼'} {Math.abs(Number(value)).toFixed(1)}%
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif', background: '#F9FAFB', minHeight: '100vh' }}>

      {notif && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: notif.startsWith('ok:') ? '#DCFCE7' : '#FEE2E2', color: notif.startsWith('ok:') ? '#166534' : '#991B1B' }}>
          {notif.replace(/^(ok|error):/, '')}
        </div>
      )}

      {/* ── FORM INPUT ── */}
      {showUpload && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#111' }}>Upload data dari Excel</p>
            <button onClick={() => { setShowUpload(false); setUploadPreview([]); setUploadNotif('') }}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
          </div>

          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Pilih platform</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {Object.entries(PLATFORM_CONFIG).map(([key, pc]) => (
                <button key={key} onClick={() => { setUploadPlatform(key); setUploadPreview([]); setUploadNotif('') }}
                  style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '2px solid', borderColor: uploadPlatform === key ? pc.color.text : '#E5E7EB', background: uploadPlatform === key ? pc.color.bg : '#fff', color: uploadPlatform === key ? pc.color.text : '#6B7280' }}>
                  {pc.label}
                </button>
              ))}
            </div>

            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Download template</p>
            <button onClick={() => downloadTemplate(uploadPlatform)}
              style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', color: '#374151', marginBottom: 16 }}>
              ⬇ Download template {PLATFORM_CONFIG[uploadPlatform].label}
            </button>

            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Upload file yang sudah diisi</p>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload}
              style={{ fontSize: 13, color: '#374151' }} />
          </div>

          {uploadNotif && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: uploadNotif.startsWith('ok:') ? '#DCFCE7' : '#FEE2E2', color: uploadNotif.startsWith('ok:') ? '#166534' : '#991B1B' }}>
              {uploadNotif.replace(/^(ok|error):/, '')}
            </div>
          )}

          {uploadPreview.length > 0 && (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#111' }}>Preview data ({uploadPreview.length} baris):</p>
              <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                      {Object.keys(uploadPreview[0]).map(k => (
                        <th key={k} style={{ padding: '6px 10px', textAlign: 'left', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} style={{ padding: '5px 10px', whiteSpace: 'nowrap', color: '#111' }}>{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={() => { setUploadPreview([]); setUploadNotif('') }}
                  style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Batal</button>
                <button onClick={handleUploadSimpan} disabled={uploading}
                  style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                  {uploading ? 'Menyimpan...' : 'Simpan ' + uploadPreview.length + ' data'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#111' }}>{editId ? 'Edit data kampanye' : 'Input data kampanye baru'}</p>
            <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>×</button>
          </div>

          {/* Pilih platform PERTAMA */}
          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Pilih platform terlebih dahulu</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(PLATFORM_CONFIG).map(([key, pc]) => (
                <button key={key} onClick={() => handlePlatformChange(key)}
                  style={{ padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '2px solid', borderColor: formPlatform === key ? pc.color.text : '#E5E7EB', background: formPlatform === key ? pc.color.bg : '#fff', color: formPlatform === key ? pc.color.text : '#6B7280' }}>
                  {pc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info dasar */}
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Informasi kampanye</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Tanggal *', name: 'tanggal', type: 'date' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} name={f.name} value={form[f.name] || ''} onChange={handleChange} placeholder={f.placeholder || ''}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }} />
              </div>
            ))}
            {formPlatform === 'shopee' ? (
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>Jenis Kampanye *</label>
                <select name="nama_kampanye" value={form.nama_kampanye || ''} onChange={handleChange}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }}>
                  <option value="">-- Pilih jenis kampanye --</option>
                  <option value="Iklan Toko">Iklan Toko</option>
                  <option value="Iklan Produk">Iklan Produk</option>
                </select>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>Jenis Kampanye *</label>
                <input type="text" name="nama_kampanye" value={form.nama_kampanye || ''} onChange={handleChange}
                  placeholder="cth: Flash Sale Juni"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>Status</label>
              <select name="status" value={form.status || 'aktif'} onChange={handleChange}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff' }}>
                <option value="aktif">Aktif</option>
                <option value="pause">Pause</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          </div>

          {/* Metrik per platform */}
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            3. Metrik {PLATFORM_CONFIG[formPlatform].label}
          </p>
          {PLATFORM_CONFIG[formPlatform].fields.map(section => (
            <div key={section.section} style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#F3F4F6', padding: '4px 10px', borderRadius: 4, display: 'inline-block' }}>{section.section}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {section.fields.map(f => (
                  <div key={f.name}>
                    <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input type="number" name={f.name} value={form[f.name] || ''} onChange={handleChange} onBlur={handleBlur}
                      readOnly={f.auto} placeholder={f.auto ? 'otomatis' : '0'}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: f.auto ? '#6B7280' : '#111', background: f.auto ? '#F3F4F6' : '#fff', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => { setShowForm(false); setForm(buildEmpty(formPlatform)); setEditId(null) }}
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
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>Ads Reporting</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Full funnel per platform · {bulan}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={bulan} onChange={e => { setBulan(e.target.value); setHalamanTabel(1) }}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff' }} />
          <button onClick={() => { setShowUpload(true); setUploadPlatform(activeTab) }}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#fff', color: '#374151', border: '1px solid #D1D5DB', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ⬆ Upload Excel
          </button>
          <button onClick={() => { setShowForm(true); setFormPlatform(activeTab); setForm(buildEmpty(activeTab)); setEditId(null) }}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            + Input data
          </button>
        </div>
      </div>

      {/* ANOMALI ALERT */}
      {anomaliAds.length > 0 && (
        <div style={{ background:'#FFF8F0',
          border:'1px solid #FFD4B8',
          borderLeft:'4px solid #FF6B35',
          borderRadius:10, padding:'14px 18px', marginBottom:20 }}>
          <p style={{ margin:'0 0 8px', fontWeight:700,
            fontSize:13, color:'#FF6B35' }}>
            ⚠️ {anomaliAds.length} anomali terdeteksi minggu ini
          </p>
          {anomaliAds.map((a,i) => (
            <p key={i} style={{ margin:'2px 0',
              fontSize:13, color:'#664400' }}>• {a}</p>
          ))}
        </div>
      )}

      {/* SUMMARY CARDS MINGGU INI */}
      {(() => {
        const thisWeek = getWeekRange(0)
        const lastWeek = getWeekRange(1)
        const activeRows = filtered
        const thisRows = activeRows.filter(r =>
          r.tanggal >= thisWeek.from && r.tanggal <= thisWeek.to)
        const prevRows = activeRows.filter(r =>
          r.tanggal >= lastWeek.from && r.tanggal <= lastWeek.to)

        const sumF = (arr, f) => arr.reduce((a,b)=>a+(Number(b[f])||0),0)
        const growth = (curr, prev) => prev > 0
          ? ((curr-prev)/prev*100).toFixed(1) : '0'

        const thisOmzet = sumF(thisRows,'omzet')
        const prevOmzet = sumF(prevRows,'omzet')
        const thisBiaya = sumF(thisRows,'biaya_iklan')
        const prevBiaya = sumF(prevRows,'biaya_iklan')
        const thisRoas = thisBiaya > 0 ? thisOmzet/thisBiaya : 0
        const prevRoas = prevBiaya > 0 ? prevOmzet/prevBiaya : 0
        const thisPesanan = sumF(thisRows,'konversi')
        const prevPesanan = sumF(prevRows,'konversi')

        const cards = activeTab === 'shopee' ? [
          { label:'Omzet Minggu Ini', value:'Rp '+thisOmzet.toLocaleString('id-ID'), growth:growth(thisOmzet,prevOmzet), highlight:true },
          { label:'Biaya Iklan', value:'Rp '+thisBiaya.toLocaleString('id-ID'), growth:growth(thisBiaya,prevBiaya) },
          { label:'ROAS', value:thisRoas.toFixed(2)+'x', growth:growth(thisRoas,prevRoas) },
          { label:'Total Pesanan', value:thisPesanan.toLocaleString('id-ID'), growth:growth(thisPesanan,prevPesanan) },
          { label:'Total Klik', value:sumF(thisRows,'klik').toLocaleString('id-ID'), growth:growth(sumF(thisRows,'klik'),sumF(prevRows,'klik')) },
          { label:'Total Impresi', value:sumF(thisRows,'impresi').toLocaleString('id-ID'), growth:growth(sumF(thisRows,'impresi'),sumF(prevRows,'impresi')) },
        ] : activeTab === 'tiktok' ? [
          { label:'Omzet Minggu Ini', value:'Rp '+thisOmzet.toLocaleString('id-ID'), growth:growth(thisOmzet,prevOmzet), highlight:true },
          { label:'Biaya Iklan', value:'Rp '+thisBiaya.toLocaleString('id-ID'), growth:growth(thisBiaya,prevBiaya) },
          { label:'ROAS', value:thisRoas.toFixed(2)+'x', growth:growth(thisRoas,prevRoas) },
          { label:'Total Pesanan', value:thisPesanan.toLocaleString('id-ID'), growth:growth(thisPesanan,prevPesanan) },
        ] : [
          { label:'Omzet Minggu Ini', value:'Rp '+thisOmzet.toLocaleString('id-ID'), growth:growth(thisOmzet,prevOmzet), highlight:true },
          { label:'Biaya Iklan', value:'Rp '+thisBiaya.toLocaleString('id-ID'), growth:growth(thisBiaya,prevBiaya) },
          { label:'ROAS', value:thisRoas.toFixed(2)+'x', growth:growth(thisRoas,prevRoas) },
          { label:'Total Pesanan', value:thisPesanan.toLocaleString('id-ID'), growth:growth(thisPesanan,prevPesanan) },
          { label:'Total Klik', value:sumF(thisRows,'klik').toLocaleString('id-ID'), growth:growth(sumF(thisRows,'klik'),sumF(prevRows,'klik')) },
          { label:'Total Impresi', value:sumF(thisRows,'impresi').toLocaleString('id-ID'), growth:growth(sumF(thisRows,'impresi'),sumF(prevRows,'impresi')) },
        ]

        return (
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))',
            gap:12, marginBottom:20 }}>
            {cards.map(m => (
              <div key={m.label} style={{
                background: m.highlight
                  ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : '#fff',
                border: m.highlight ? 'none' : '1px solid #FFE0CC',
                borderRadius:12, padding:'16px 18px',
                boxShadow:'0 2px 8px rgba(255,100,0,0.08)',
              }}>
                <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:500,
                  color: m.highlight ? 'rgba(255,255,255,0.8)' : '#999' }}>
                  {m.label}
                </p>
                <p style={{ margin:'0 0 8px', fontSize:22, fontWeight:700,
                  color: m.highlight ? '#fff' : '#1A1A1A',
                  lineHeight:1.2 }}>
                  {m.value}
                </p>
                <GrowthBadge value={m.growth} />
              </div>
            ))}
          </div>
        )
      })()}

      {/* GRAFIK TREN 8 MINGGU */}
      {grafikMingguan.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC',
          borderRadius:12, padding:20, marginBottom:20,
          boxShadow:'0 2px 8px rgba(255,100,0,0.06)' }}>
          <p style={{ margin:'0 0 4px', fontWeight:700,
            fontSize:14, color:'#1A1A1A' }}>
            Tren Omzet Ads — 8 Minggu Terakhir
          </p>
          <p style={{ margin:'0 0 16px', fontSize:12, color:'#999' }}>
            Shopee · TikTok · Meta · Biaya Iklan
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={grafikMingguan}
              margin={{ top:5, right:10, left:10, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED" />
              <XAxis dataKey="label"
                tick={{ fontSize:11, fill:'#999' }}
                tickLine={false}
                axisLine={{ stroke:'#FFE0CC' }} />
              <YAxis tickFormatter={v => {
                if(v>=1000000) return (v/1000000).toFixed(0)+'jt'
                if(v>=1000) return (v/1000).toFixed(0)+'rb'
                return v
              }}
                tick={{ fontSize:11, fill:'#999' }}
                tickLine={false} axisLine={false} width={60} />
              <Tooltip
                formatter={(v,name) => ['Rp '+Number(v).toLocaleString('id-ID'),
                  name==='shopee_omzet'?'Shopee'
                  :name==='tiktok_omzet'?'TikTok'
                  :name==='meta_omzet'?'Meta':'Biaya Iklan']}
                contentStyle={{ fontSize:12, borderRadius:8,
                  border:'1px solid #FFE0CC' }} />
              <Legend formatter={v =>
                v==='shopee_omzet'?'Shopee'
                :v==='tiktok_omzet'?'TikTok'
                :v==='meta_omzet'?'Meta':'Biaya Iklan'} />
              <Line type="monotone" dataKey="shopee_omzet"
                stroke="#FF6B35" strokeWidth={2}
                dot={{ r:3, fill:'#FF6B35', strokeWidth:0 }}
                activeDot={{ r:5 }} />
              <Line type="monotone" dataKey="tiktok_omzet"
                stroke="#6C63FF" strokeWidth={2}
                dot={{ r:3, fill:'#6C63FF', strokeWidth:0 }}
                activeDot={{ r:5 }} />
              <Line type="monotone" dataKey="meta_omzet"
                stroke="#1877F2" strokeWidth={2}
                dot={{ r:3, fill:'#1877F2', strokeWidth:0 }}
                activeDot={{ r:5 }} />
              <Line type="monotone" dataKey="total_biaya"
                stroke="#DC2626" strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r:3, fill:'#DC2626', strokeWidth:0 }}
                activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9CA3AF', fontSize: 14 }}>Memuat data...</p>
      ) : (
        <>
          {/* ── GRAFIK TREN HARIAN ── */}
          {(() => {
            const rowsFiltered = activeTab === 'shopee' && filterJenis !== 'semua'
              ? rows.filter(r => r.nama_kampanye === filterJenis)
              : rows

            const grafik = [...rowsFiltered]
              .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
              .map(row => ({
                tgl: row.tanggal.slice(8),
                omzet: Number(row.omzet) || 0,
                biaya: Number(row.biaya_iklan) || 0,
              }))

            if (grafik.length === 0) return null

            const fmtRpAxis = (v) => {
              if (v >= 1000000) return 'Rp ' + (v/1000000).toFixed(1) + 'jt'
              if (v >= 1000) return 'Rp ' + (v/1000).toFixed(0) + 'rb'
              return 'Rp ' + v
            }

            return (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111' }}>Tren harian — {cfg.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Omzet vs Biaya Iklan per hari</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {activeTab === 'shopee' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>Filter:</span>
                        {['semua', 'Iklan Toko', 'Iklan Produk'].map(j => (
                          <button key={j} onClick={() => setFilterJenis(j)}
                            style={{
                              padding: '5px 12px', borderRadius: 6, fontSize: 12,
                              cursor: 'pointer', border: '1px solid',
                              borderColor: filterJenis === j ? '#16A34A' : '#E5E7EB',
                              background: filterJenis === j ? '#DCFCE7' : '#fff',
                              color: filterJenis === j ? '#166534' : '#6B7280',
                              fontWeight: filterJenis === j ? 500 : 400
                            }}>
                            {j === 'semua' ? 'Semua' : j}
                          </button>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 20, height: 2, background: '#16A34A', display: 'inline-block', borderRadius: 2 }}></span>
                      <span style={{ color: '#6B7280' }}>Omzet</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 20, height: 2, background: '#DC2626', display: 'inline-block', borderRadius: 2 }}></span>
                      <span style={{ color: '#6B7280' }}>Biaya Iklan</span>
                    </span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={grafik} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="tgl"
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={{ stroke: '#E5E7EB' }}
                      label={{ value: 'Tanggal', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#9CA3AF' }}
                    />
                    <YAxis
                      tickFormatter={fmtRpAxis}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        'Rp ' + Number(value).toLocaleString('id-ID'),
                        name === 'omzet' ? 'Omzet' : 'Biaya Iklan'
                      ]}
                      labelFormatter={(label) => 'Tanggal: ' + label}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="omzet"
                      stroke="#16A34A"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#16A34A', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="biaya"
                      stroke="#DC2626"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })()}

          {/* ── SUMMARY CARDS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
            {(summaryCards[activeTab] || []).map(m => (
              <div key={m.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111' }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* ── TABEL DATA ── */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#111' }}>
                Detail kampanye — <span style={{ color: cfg.color.text }}>{cfg.label}</span>
              </p>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{rows.length} kampanye</span>
            </div>
            {rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <p style={{ fontSize: 14, margin: '0 0 8px' }}>Belum ada data untuk bulan ini</p>
                <p style={{ fontSize: 12, margin: 0 }}>Klik "Input data" untuk menambahkan kampanye {cfg.label}</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>Tgl</th>
                      {TABLE_COLS[activeTab].map(col => (
                        <th key={col.key} style={{ textAlign: col.key === 'nama_kampanye' ? 'left' : 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #E5E7EB' }}>{col.label}</th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid #E5E7EB' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsPaginated.map(row => {
                      const sb = statusBadge[row.status] || statusBadge.aktif
                      return (
                        <tr key={row.id} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#374151' }}>{row.tanggal}</td>
                          {TABLE_COLS[activeTab].map(col => (
                            <td key={col.key} style={{ padding: '7px 10px', textAlign: col.key === 'nama_kampanye' ? 'left' : 'right', whiteSpace: 'nowrap', color: '#111',
                              fontWeight: col.key === 'roi' ? 600 : 400,
                              color: col.key === 'roi' ? (Number(row[col.key]) >= 2 ? '#166534' : '#991B1B') : '#111' }}>
                              {col.key === 'status'
                                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sb.bg, color: sb.text, fontWeight: 500 }}>{sb.label}</span>
                                : col.fmt(row[col.key])}
                            </td>
                          ))}
                          <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(row, activeTab)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', marginRight: 6, color: '#374151' }}>Edit</button>
                            <button onClick={() => handleDelete(row.id, activeTab)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>Hapus</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {totalHalaman > 1 && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginTop: 16, paddingTop: 14,
                    borderTop: '1px solid #FFF3ED'
                  }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                      Menampilkan {((halamanTabel-1)*BARIS_PER_HALAMAN)+1}–
                      {Math.min(halamanTabel*BARIS_PER_HALAMAN, filtered.length)}
                      {' '}dari {filtered.length} kampanye
                    </p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => setHalamanTabel(p => Math.max(1, p-1))}
                        disabled={halamanTabel === 1}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12,
                          border: '1px solid #FFE0CC',
                          background: halamanTabel === 1 ? '#FFF8F5' : '#fff',
                          color: halamanTabel === 1 ? '#FFB899' : '#FF6B35',
                          cursor: halamanTabel === 1 ? 'default' : 'pointer',
                          fontWeight: 500,
                        }}>
                        ← Prev
                      </button>
                      {Array.from({ length: totalHalaman }, (_, i) => i + 1)
                        .filter(p => {
                          if (totalHalaman <= 5) return true
                          if (p === 1 || p === totalHalaman) return true
                          if (Math.abs(p - halamanTabel) <= 1) return true
                          return false
                        })
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx-1] > 1) {
                            acc.push('...')
                          }
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, idx) => p === '...' ? (
                          <span key={'e'+idx} style={{
                            fontSize: 12, color: '#FFB899', padding: '0 4px'
                          }}>...</span>
                        ) : (
                          <button key={p} onClick={() => setHalamanTabel(p)}
                            style={{
                              padding: '6px 10px', borderRadius: 8, fontSize: 12,
                              border: '1px solid',
                              borderColor: halamanTabel === p ? '#FF6B35' : '#FFE0CC',
                              background: halamanTabel === p
                                ? 'linear-gradient(135deg, #FF6B35, #FF8C00)' : '#fff',
                              color: halamanTabel === p ? '#fff' : '#FF6B35',
                              fontWeight: halamanTabel === p ? 600 : 400,
                              cursor: 'pointer',
                              minWidth: 32,
                            }}>
                            {p}
                          </button>
                        ))
                      }
                      <button
                        onClick={() => setHalamanTabel(p => Math.min(totalHalaman, p+1))}
                        disabled={halamanTabel === totalHalaman}
                        style={{
                          padding: '6px 14px', borderRadius: 8, fontSize: 12,
                          border: '1px solid #FFE0CC',
                          background: halamanTabel === totalHalaman ? '#FFF8F5' : '#fff',
                          color: halamanTabel === totalHalaman ? '#FFB899' : '#FF6B35',
                          cursor: halamanTabel === totalHalaman ? 'default' : 'pointer',
                          fontWeight: 500,
                        }}>
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