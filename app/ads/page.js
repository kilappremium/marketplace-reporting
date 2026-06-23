'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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

  useEffect(() => { fetchAll() }, [bulan])

  async function fetchAll() {
    setLoading(true)
    const from = bulan + '-01'
    const to = bulan + '-31'
    
    const [r1, r2, r3] = await Promise.all([
      supabase
        .from('ads_shopee')
        .select('*')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('tanggal', { ascending: false }),
      supabase
        .from('ads_tiktok')
        .select('*')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('tanggal', { ascending: false }),
      supabase
        .from('ads_meta')
        .select('*')
        .gte('tanggal', from)
        .lte('tanggal', to)
        .order('tanggal', { ascending: false }),
    ])
    
    setData({
      shopee: r1.data || [],
      tiktok: r2.data || [],
      meta: r3.data || [],
    })
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

  const rows = data[activeTab] || []
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
              { label: 'Nama kampanye *', name: 'nama_kampanye', type: 'text', placeholder: 'cth: Flash Sale Juni' },
              { label: 'Tipe kampanye', name: 'tipe_kampanye', type: 'text', placeholder: 'cth: Brand, Performance' },
            ].map(f => (
              <div key={f.name}>
                <label style={{ fontSize: 12, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input type={f.type} name={f.name} value={form[f.name] || ''} onChange={handleChange} placeholder={f.placeholder || ''}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff', boxSizing: 'border-box' }} />
              </div>
            ))}
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
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111', background: '#fff' }} />
          <button onClick={() => { setShowForm(true); setFormPlatform(activeTab); setForm(buildEmpty(activeTab)); setEditId(null) }}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            + Input data
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(PLATFORM_CONFIG).map(([key, pc]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '2px solid', borderColor: activeTab === key ? pc.color.text : '#E5E7EB', background: activeTab === key ? pc.color.bg : '#fff', color: activeTab === key ? pc.color.text : '#6B7280' }}>
            {pc.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#9CA3AF', fontSize: 14 }}>Memuat data...</p>
      ) : (
        <>
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
                    {rows.map(row => {
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
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}