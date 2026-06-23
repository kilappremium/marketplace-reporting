'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PLATFORMS = ['shopee', 'tiktok', 'meta']
const PLATFORM_LABEL = { shopee: 'Shopee Ads', tiktok: 'TikTok Ads', meta: 'Meta Ads' }
const PLATFORM_COLOR = {
  shopee: { bg: '#FFF0E6', text: '#993C1D', initial: 'S' },
  tiktok: { bg: '#F0F0FF', text: '#3C3489', initial: 'T' },
  meta:   { bg: '#E6F1FB', text: '#0C447C', initial: 'M' },
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#FFFFFF',
  color: '#111111',
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
}

const inputReadOnlyStyle = {
  background: '#F3F4F6',
  color: '#6B7280',
}

const labelStyle = {
  fontSize: 12,
  color: '#374151',
  fontWeight: 500,
  display: 'block',
  marginBottom: 4,
}

const cardStyle = {
  background: '#FFFFFF',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  borderRadius: 8,
  padding: 20,
}

const funnelHeaderStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const metricCardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 8,
  padding: '12px 14px',
}

const btnSaveStyle = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: '#16A34A',
  color: '#FFFFFF',
  cursor: 'pointer',
  fontSize: 13,
}

const btnCancelStyle = {
  padding: '8px 20px',
  borderRadius: 8,
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  color: '#374151',
  cursor: 'pointer',
  fontSize: 13,
}

const tableThStyle = {
  textAlign: 'left',
  padding: '6px 8px',
  color: '#6B7280',
  fontWeight: 400,
  background: '#F9FAFB',
  whiteSpace: 'nowrap',
}

const EMPTY_FORM = {
  tanggal: new Date().toISOString().split('T')[0],
  platform: 'shopee',
  nama_kampanye: '',
  tipe_kampanye: '',
  status: 'aktif',
  belanja_iklan: '',
  impresi: '',
  jangkauan: '',
  frekuensi: '',
  klik: '',
  ctr: '',
  cpc: '',
  tambah_keranjang: '',
  checkout: '',
  konversi: '',
  pendapatan: '',
  roas: '',
  cpa: '',
}

function fmt(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toLocaleString('id-ID')
}
function fmtRp(n) {
  if (!n && n !== 0) return '-'
  return 'Rp ' + Number(n).toLocaleString('id-ID')
}
function fmtX(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toFixed(2) + 'x'
}
function fmtPct(n) {
  if (!n && n !== 0) return '-'
  return Number(n).toFixed(2) + '%'
}

export default function AdsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [notif, setNotif] = useState('')
  const [editId, setEditId] = useState(null)
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { fetchData() }, [bulan])

  async function fetchData() {
    setLoading(true)
    const from = bulan + '-01'
    const to = bulan + '-31'
    const { data: rows } = await supabase
      .from('ads')
      .select('*')
      .gte('tanggal', from)
      .lte('tanggal', to)
      .order('tanggal', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function autoHitung(f) {
    const updated = { ...f }
    if (f.impresi && f.klik)
      updated.ctr = ((f.klik / f.impresi) * 100).toFixed(2)
    if (f.belanja_iklan && f.klik)
      updated.cpc = (f.belanja_iklan / f.klik).toFixed(0)
    if (f.belanja_iklan && f.pendapatan)
      updated.roas = (f.pendapatan / f.belanja_iklan).toFixed(2)
    if (f.belanja_iklan && f.konversi)
      updated.cpa = (f.belanja_iklan / f.konversi).toFixed(0)
    if (f.jangkauan && f.impresi)
      updated.frekuensi = (f.impresi / f.jangkauan).toFixed(2)
    return updated
  }

  function handleBlur() {
    setForm(f => autoHitung(f))
  }

  async function handleSubmit() {
    if (!form.nama_kampanye || !form.tanggal || !form.platform) {
      setNotif('error:Nama kampanye, tanggal, dan platform wajib diisi!')
      return
    }
    setSaving(true)
    const payload = {
      tanggal: form.tanggal,
      platform: form.platform,
      nama_kampanye: form.nama_kampanye,
      tipe_kampanye: form.tipe_kampanye,
      status: form.status,
      belanja_iklan: Number(form.belanja_iklan) || 0,
      impresi: Number(form.impresi) || 0,
      jangkauan: Number(form.jangkauan) || 0,
      frekuensi: Number(form.frekuensi) || 0,
      klik: Number(form.klik) || 0,
      ctr: Number(form.ctr) || 0,
      cpc: Number(form.cpc) || 0,
      tambah_keranjang: Number(form.tambah_keranjang) || 0,
      checkout: Number(form.checkout) || 0,
      konversi: Number(form.konversi) || 0,
      pendapatan: Number(form.pendapatan) || 0,
      roas: Number(form.roas) || 0,
      cpa: Number(form.cpa) || 0,
    }
    if (editId) {
      await supabase.from('ads').update(payload).eq('id', editId)
      setNotif('ok:Data berhasil diperbarui!')
      setEditId(null)
    } else {
      await supabase.from('ads').insert([payload])
      setNotif('ok:Data berhasil disimpan!')
    }
    setSaving(false)
    setForm(EMPTY_FORM)
    setShowForm(false)
    fetchData()
    setTimeout(() => setNotif(''), 3000)
  }

  function handleEdit(row) {
    setForm({ ...row, tanggal: row.tanggal })
    setEditId(row.id)
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus data ini?')) return
    await supabase.from('ads').delete().eq('id', id)
    fetchData()
  }

  const filtered = activeTab === 'all' ? data : data.filter(d => d.platform === activeTab)

  function sumField(arr, field) {
    return arr.reduce((a, b) => a + (Number(b[field]) || 0), 0)
  }
  function avgRoas(arr) {
    const totalBelanja = sumField(arr, 'belanja_iklan')
    const totalPendapatan = sumField(arr, 'pendapatan')
    return totalBelanja ? (totalPendapatan / totalBelanja).toFixed(2) : 0
  }
  function avgCpa(arr) {
    const totalBelanja = sumField(arr, 'belanja_iklan')
    const totalKonversi = sumField(arr, 'konversi')
    return totalKonversi ? (totalBelanja / totalKonversi).toFixed(0) : 0
  }
  function avgCtr(arr) {
    const totalImpresi = sumField(arr, 'impresi')
    const totalKlik = sumField(arr, 'klik')
    return totalImpresi ? ((totalKlik / totalImpresi) * 100).toFixed(2) : 0
  }
  function avgFrekuensi(arr) {
    const totalImpresi = sumField(arr, 'impresi')
    const totalJangkauan = sumField(arr, 'jangkauan')
    return totalJangkauan ? (totalImpresi / totalJangkauan).toFixed(2) : 0
  }
  function avgCpc(arr) {
    const totalBelanja = sumField(arr, 'belanja_iklan')
    const totalKlik = sumField(arr, 'klik')
    return totalKlik ? (totalBelanja / totalKlik).toFixed(0) : 0
  }

  const statusBadge = {
    aktif:   { bg: '#EAF3DE', text: '#27500A', label: 'Aktif' },
    pause:   { bg: '#FAEEDA', text: '#633806', label: 'Pause' },
    selesai: { bg: '#FCEBEB', text: '#791F1F', label: 'Selesai' },
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif', background: '#F9FAFB', minHeight: '100%' }}>

      {notif && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14,
          background: notif.startsWith('ok:') ? '#EAF3DE' : '#FCEBEB',
          color: notif.startsWith('ok:') ? '#27500A' : '#791F1F',
        }}>
          {notif.replace(/^(ok|error):/, '')}
        </div>
      )}

      {showForm && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 15 }}>{editId ? 'Edit data kampanye' : 'Input data kampanye baru'}</p>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditId(null) }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Tanggal *', name: 'tanggal', type: 'date' },
              { label: 'Nama kampanye *', name: 'nama_kampanye', type: 'text' },
              { label: 'Tipe kampanye', name: 'tipe_kampanye', type: 'text', placeholder: 'cth: Brand, Performance' },
            ].map(f => (
              <div key={f.name}>
                <label style={labelStyle}>{f.label}</label>
                <input type={f.type} name={f.name} value={form[f.name]} onChange={handleChange}
                  placeholder={f.placeholder || ''} onBlur={handleBlur}
                  style={inputStyle} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Platform *</label>
              <select name="platform" value={form.platform} onChange={handleChange}
                style={inputStyle}>
                <option value="shopee">Shopee Ads</option>
                <option value="tiktok">TikTok Ads</option>
                <option value="meta">Meta Ads</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select name="status" value={form.status} onChange={handleChange}
                style={inputStyle}>
                <option value="aktif">Aktif</option>
                <option value="pause">Pause</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          </div>

          <div style={{ ...funnelHeaderStyle, margin: '16px 0 8px' }}>Awareness</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Impresi', name: 'impresi' },
              { label: 'Jangkauan', name: 'jangkauan' },
              { label: 'Frekuensi (auto)', name: 'frekuensi', readOnly: true },
            ].map(f => (
              <div key={f.name}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" name={f.name} value={form[f.name]} onChange={handleChange} onBlur={handleBlur}
                  readOnly={f.readOnly}
                  style={{ ...inputStyle, ...(f.readOnly ? inputReadOnlyStyle : {}) }} />
              </div>
            ))}
          </div>

          <div style={{ ...funnelHeaderStyle, margin: '8px 0' }}>Interest & consideration</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Klik', name: 'klik' },
              { label: 'CTR % (auto)', name: 'ctr', readOnly: true },
              { label: 'Belanja iklan (Rp)', name: 'belanja_iklan' },
              { label: 'CPC (auto)', name: 'cpc', readOnly: true },
            ].map(f => (
              <div key={f.name}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" name={f.name} value={form[f.name]} onChange={handleChange} onBlur={handleBlur}
                  readOnly={f.readOnly}
                  style={{ ...inputStyle, ...(f.readOnly ? inputReadOnlyStyle : {}) }} />
              </div>
            ))}
          </div>

          <div style={{ ...funnelHeaderStyle, margin: '8px 0' }}>Intent</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Tambah keranjang', name: 'tambah_keranjang' },
              { label: 'Checkout', name: 'checkout' },
            ].map(f => (
              <div key={f.name}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" name={f.name} value={form[f.name]} onChange={handleChange} onBlur={handleBlur}
                  style={inputStyle} />
              </div>
            ))}
          </div>

          <div style={{ ...funnelHeaderStyle, margin: '8px 0' }}>Konversi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Konversi / pesanan', name: 'konversi' },
              { label: 'Pendapatan (Rp)', name: 'pendapatan' },
              { label: 'ROAS (auto)', name: 'roas', readOnly: true },
              { label: 'CPA (auto)', name: 'cpa', readOnly: true },
            ].map(f => (
              <div key={f.name}>
                <label style={labelStyle}>{f.label}</label>
                <input type="number" name={f.name} value={form[f.name]} onChange={handleChange} onBlur={handleBlur}
                  readOnly={f.readOnly}
                  style={{ ...inputStyle, ...(f.readOnly ? inputReadOnlyStyle : {}) }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditId(null) }}
              style={btnCancelStyle}>Batal</button>
            <button onClick={handleSubmit} disabled={saving}
              style={btnSaveStyle}>
              {saving ? 'Menyimpan...' : editId ? 'Perbarui data' : 'Simpan data'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Ads reporting — full funnel</p>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>Input harian per kampanye</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="month" value={bulan} onChange={e => setBulan(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }} />
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEditId(null) }}
            style={{ padding: '7px 16px', borderRadius: 6, background: '#111', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}>
            + Input data
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'shopee', 'tiktok', 'meta'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              border: '0.5px solid #ccc',
              background: activeTab === t ? '#111' : 'transparent',
              color: activeTab === t ? '#fff' : '#555',
            }}>
            {t === 'all' ? 'Semua platform' : PLATFORM_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#888', fontSize: 14 }}>Memuat data...</p>
      ) : (
        <>
          <div style={{ ...funnelHeaderStyle, marginBottom: 8 }}>Awareness</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Total impresi', value: fmt(sumField(filtered, 'impresi')) },
              { label: 'Total jangkauan', value: fmt(sumField(filtered, 'jangkauan')) },
              { label: 'Frekuensi rata-rata', value: avgFrekuensi(filtered) + 'x' },
            ].map(m => (
              <div key={m.label} style={metricCardStyle}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '0.5px dashed #e0e0e0', margin: '10px 0' }} />
          <div style={{ ...funnelHeaderStyle, marginBottom: 8 }}>Interest & consideration</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Total klik', value: fmt(sumField(filtered, 'klik')) },
              { label: 'CTR rata-rata', value: avgCtr(filtered) + '%' },
              { label: 'CPC rata-rata', value: fmtRp(avgCpc(filtered)) },
              { label: 'Total belanja iklan', value: fmtRp(sumField(filtered, 'belanja_iklan')) },
            ].map(m => (
              <div key={m.label} style={metricCardStyle}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '0.5px dashed #e0e0e0', margin: '10px 0' }} />
          <div style={{ ...funnelHeaderStyle, marginBottom: 8 }}>Intent</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Tambah keranjang', value: fmt(sumField(filtered, 'tambah_keranjang')) },
              { label: 'Checkout', value: fmt(sumField(filtered, 'checkout')) },
            ].map(m => (
              <div key={m.label} style={metricCardStyle}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '0.5px dashed #e0e0e0', margin: '10px 0' }} />
          <div style={{ ...funnelHeaderStyle, marginBottom: 8 }}>Konversi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total konversi', value: fmt(sumField(filtered, 'konversi')) },
              { label: 'Total pendapatan', value: fmtRp(sumField(filtered, 'pendapatan')) },
              { label: 'ROAS', value: avgRoas(filtered) + 'x' },
              { label: 'CPA rata-rata', value: fmtRp(avgCpa(filtered)) },
            ].map(m => (
              <div key={m.label} style={metricCardStyle}>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: '#888' }}>{m.label}</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{m.value}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, padding: 16 }}>
            <p style={{ margin: '0 0 12px', fontWeight: 500, fontSize: 14 }}>
              Detail kampanye {activeTab !== 'all' ? '— ' + PLATFORM_LABEL[activeTab] : '— semua platform'}
            </p>
            {filtered.length === 0 ? (
              <p style={{ color: '#aaa', fontSize: 13 }}>Belum ada data. Klik "Input data" untuk menambahkan.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={tableThStyle}>Tanggal</th>
                      {activeTab === 'all' && <th style={{ ...tableThStyle, whiteSpace: 'normal' }}>Platform</th>}
                      <th style={tableThStyle}>Kampanye</th>
                      <th style={{ ...tableThStyle, whiteSpace: 'normal' }}>Status</th>
                      <th style={{ ...tableThStyle, textAlign: 'right' }}>Impresi</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>Klik</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>CTR</th>
                      <th style={{ ...tableThStyle, textAlign: 'right' }}>Krnjng</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>Checkout</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>Konversi</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>Pendapatan</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>ROAS</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>CPA</th>
                      <th style={{ ...tableThStyle, textAlign: 'right', whiteSpace: 'normal' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => {
                      const pc = PLATFORM_COLOR[row.platform] || PLATFORM_COLOR.shopee
                      const sb = statusBadge[row.status] || statusBadge.aktif
                      return (
                        <tr key={row.id} style={{ borderBottom: '0.5px solid #f0f0f0' }}>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{row.tanggal}</td>
                          {activeTab === 'all' && (
                            <td style={{ padding: '6px 8px' }}>
                              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: pc.bg, color: pc.text }}>
                                {PLATFORM_LABEL[row.platform]}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: '6px 8px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nama_kampanye}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: sb.bg, color: sb.text }}>{sb.label}</span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.impresi)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.klik)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmtPct(row.ctr)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.tambah_keranjang)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.checkout)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(row.konversi)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRp(row.pendapatan)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500, color: row.roas >= 4 ? '#3B6D11' : '#A32D2D' }}>{fmtX(row.roas)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtRp(row.cpa)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button onClick={() => handleEdit(row)}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '0.5px solid #ccc', background: 'none', cursor: 'pointer', marginRight: 4 }}>Edit</button>
                            <button onClick={() => handleDelete(row.id)}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '0.5px solid #ffcccc', background: 'none', color: '#c00', cursor: 'pointer' }}>Hapus</button>
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