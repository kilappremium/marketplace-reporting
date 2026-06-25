'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

// ─── Constants ────────────────────────────────────────────
const HOSTS = ['Safa','Mery','Ira','Fidella','Huni','Ilma','Afi','Niken','Dyna','Bita','Davina']
const PLATFORMS = ['Shopee','Tiktok']
const JADWAL_SESI = [
  'SHOPEE | Shift 1 (06.00 - 12.00)',
  'SHOPEE | Shift 2 (12.00 - 18.00)',
  'SHOPEE | Shift 3 (18.00 - 00.00)',
  'SHOPEE | Shift 4 (00.00 - 06.00)',
  'TIKTOK | Shift 1 (06.00 - 12.00)',
  'TIKTOK | Shift 2 (12.00 - 18.00)',
  'TIKTOK | Shift 3 (18.00 - 00.00)',
  'TIKTOK | Shift 4 (00.00 - 06.00)',
]

const EMPTY_FORM = {
  tanggal: new Date().toISOString().split('T')[0],
  nama_host: '',
  platform: '',
  jadwal_sesi: '',
  durasi_jam: '',
  gmv: '',
  pesanan: '',
  penonton: '',
  ctr_tiktok: '',
  durasi_ditonton: '',
  gpm_tayangan: '',
  err_tiktok: '',
  klik_produk_tiktok: '',
  bukti_screenshot: '',
}

// ─── Format helpers ───────────────────────────────────────
const fmt    = n => (!n && n !== 0) ? '-' : Number(n).toLocaleString('id-ID')
const fmtRp  = n => (!n && n !== 0) ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtPct = n => (!n && n !== 0) ? '-' : Number(n).toFixed(2) + '%'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)

// ─── Komponen Input Field ─────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div>
      <label style={{
        fontSize: 12, fontWeight: 500, color: '#374151',
        display: 'block', marginBottom: 5
      }}>
        {label} {required && <span style={{ color: '#FF6B35' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #FFD4B8', fontSize: 13, color: '#1A1A1A',
  background: '#fff', boxSizing: 'border-box',
  outline: 'none',
}

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
}

// ─── Komponen Utama ───────────────────────────────────────
export default function LivestreamPage() {
  const [data, setData]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [notif, setNotif]         = useState('')
  const [editId, setEditId]       = useState(null)
  const [uploading, setUploading] = useState(false)

  // Filter states
  const [filterHost, setFilterHost]         = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterSesi, setFilterSesi]         = useState('')
  const [filterStart, setFilterStart]       = useState('')
  const [filterEnd, setFilterEnd]           = useState('')

  // Pagination
  const [halamanHost, setHalamanHost] = useState(1)
  const [halamanSesi, setHalamanSesi] = useState(1)
  const BARIS = 10

  const fileRef = useRef()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const tahun = new Date().getFullYear()
    const { data: rows } = await supabase
      .from('livestream')
      .select('*')
      .gte('tanggal', `${tahun}-01-01`)
      .order('tanggal', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setNotif('error:Ukuran file maksimal 10MB!')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `livestream/${Date.now()}.${ext}`
    const { data: uploaded, error } = await supabase.storage
      .from('screenshots')
      .upload(fileName, file)
    if (error) {
      // Jika bucket belum ada, simpan sebagai base64
      const reader = new FileReader()
      reader.onload = (ev) => {
        setForm(f => ({ ...f, bukti_screenshot: ev.target.result }))
        setUploading(false)
      }
      reader.readAsDataURL(file)
      return
    }
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName)
    setForm(f => ({ ...f, bukti_screenshot: urlData.publicUrl }))
    setUploading(false)
  }

  async function handleSubmit() {
    const required = ['tanggal','nama_host','platform','jadwal_sesi',
      'durasi_jam','gmv','pesanan','penonton']
    for (const f of required) {
      if (!form[f]) {
        setNotif(`error:Field "${f.replace(/_/g,' ')}" wajib diisi!`)
        return
      }
    }
    setSaving(true)
    const payload = {
      tanggal: form.tanggal,
      nama_host: form.nama_host,
      platform: form.platform,
      jadwal_sesi: form.jadwal_sesi,
      durasi_jam: Number(form.durasi_jam) || 0,
      gmv: Number(form.gmv) || 0,
      pesanan: Number(form.pesanan) || 0,
      penonton: Number(form.penonton) || 0,
      ctr_tiktok: Number(form.ctr_tiktok) || 0,
      durasi_ditonton: Number(form.durasi_ditonton) || 0,
      gpm_tayangan: Number(form.gpm_tayangan) || 0,
      err_tiktok: Number(form.err_tiktok) || 0,
      klik_produk_tiktok: Number(form.klik_produk_tiktok) || 0,
      bukti_screenshot: form.bukti_screenshot || '',
    }
    if (editId) {
      await supabase.from('livestream').update(payload).eq('id', editId)
      setNotif('ok:Data berhasil diperbarui!')
      setEditId(null)
    } else {
      await supabase.from('livestream').insert([payload])
      setNotif('ok:Data berhasil disimpan!')
    }
    setSaving(false)
    setForm(EMPTY_FORM)
    setShowForm(false)
    fetchData()
    setTimeout(() => setNotif(''), 3000)
  }

  function handleEdit(row) {
    setForm({ ...EMPTY_FORM, ...row })
    setEditId(row.id)
    setShowForm(true)
    window.scrollTo(0, 0)
  }

  async function handleDelete(id) {
    if (!confirm('Yakin hapus data ini?')) return
    await supabase.from('livestream').delete().eq('id', id)
    fetchData()
  }

  // ─── Filter data ───────────────────────────────────────
  const filtered = data.filter(r => {
    if (filterHost && r.nama_host !== filterHost) return false
    if (filterPlatform && r.platform !== filterPlatform) return false
    if (filterSesi && r.jadwal_sesi !== filterSesi) return false
    if (filterStart && r.tanggal < filterStart) return false
    if (filterEnd && r.tanggal > filterEnd) return false
    return true
  })

  // ─── Summary metrics ──────────────────────────────────
  const totalGmv     = sum(filtered, 'gmv')
  const totalDurasi  = sum(filtered, 'durasi_jam')
  const totalPesanan = sum(filtered, 'pesanan')
  const totalSesi    = filtered.length
  const avgGmvPerJam = totalDurasi > 0 ? totalGmv / totalDurasi : 0
  const avgCvr       = totalPesanan && sum(filtered,'penonton') 
    ? (totalPesanan / sum(filtered,'penonton') * 100) : 0
  const avgErr       = filtered.length 
    ? sum(filtered,'err_tiktok') / filtered.length : 0
  const avgCtr       = filtered.length 
    ? sum(filtered,'ctr_tiktok') / filtered.length : 0
  const avgGpm       = filtered.length 
    ? sum(filtered,'gpm_tayangan') / filtered.length : 0

  // ─── Sales per Host ────────────────────────────────────
  const perHost = HOSTS.map(host => {
    const rows = filtered.filter(r => r.nama_host === host)
    if (rows.length === 0) return null
    const gmv = sum(rows, 'gmv')
    const durasi = sum(rows, 'durasi_jam')
    return {
      nama_host: host,
      durasi_jam: durasi,
      gmv,
      gmv_per_jam: durasi > 0 ? gmv / durasi : 0,
      produk_terjual: sum(rows, 'pesanan'),
      sesi: rows.length,
    }
  }).filter(Boolean).sort((a,b) => b.gmv - a.gmv)

  // ─── Sales per Sesi ────────────────────────────────────
  const perSesi = JADWAL_SESI.map(sesi => {
    const rows = filtered.filter(r => r.jadwal_sesi === sesi)
    if (rows.length === 0) return null
    const gmv = sum(rows, 'gmv')
    const durasi = sum(rows, 'durasi_jam')
    return {
      jadwal_sesi: sesi,
      durasi_jam: durasi,
      gmv,
      gmv_per_jam: durasi > 0 ? gmv / durasi : 0,
      produk_terjual: sum(rows, 'pesanan'),
      sesi: rows.length,
    }
  }).filter(Boolean).sort((a,b) => b.gmv - a.gmv)

  // ─── Grafik tren ──────────────────────────────────────
  const grafikTren = Object.entries(
    filtered.reduce((acc, r) => {
      const tgl = r.tanggal
      if (!acc[tgl]) acc[tgl] = { tgl, gmv: 0, durasi: 0 }
      acc[tgl].gmv += Number(r.gmv) || 0
      acc[tgl].durasi += Number(r.durasi_jam) || 0
      return acc
    }, {})
  ).map(([_, v]) => v).sort((a,b) => a.tgl.localeCompare(b.tgl))

  const fmtAxis = v => {
    if (v >= 1000000) return 'Rp' + (v/1000000).toFixed(0) + 'jt'
    if (v >= 1000) return 'Rp' + (v/1000).toFixed(0) + 'rb'
    return 'Rp' + v
  }

  // ─── Pagination helpers ───────────────────────────────
  function Pagination({ data, halaman, setHalaman }) {
    const total = Math.ceil(data.length / BARIS)
    if (total <= 1) return null
    return (
      <div style={{ display:'flex', justifyContent:'space-between', 
        alignItems:'center', marginTop:14, paddingTop:12,
        borderTop:'1px solid #FFF3ED' }}>
        <p style={{ margin:0, fontSize:12, color:'#999' }}>
          {((halaman-1)*BARIS)+1}–{Math.min(halaman*BARIS, data.length)} dari {data.length}
        </p>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setHalaman(p => Math.max(1,p-1))}
            disabled={halaman===1}
            style={{ padding:'6px 12px', borderRadius:8, fontSize:12,
              border:'1px solid #FFE0CC', background: halaman===1?'#FFF8F5':'#fff',
              color: halaman===1?'#FFB899':'#FF6B35', cursor: halaman===1?'default':'pointer' }}>
            ← Prev
          </button>
          {Array.from({length:total},(_,i)=>i+1).map(p => (
            <button key={p} onClick={() => setHalaman(p)}
              style={{ padding:'6px 10px', borderRadius:8, fontSize:12,
                border:'1px solid', minWidth:32,
                borderColor: halaman===p?'#FF6B35':'#FFE0CC',
                background: halaman===p?'linear-gradient(135deg,#FF6B35,#FF8C00)':'#fff',
                color: halaman===p?'#fff':'#FF6B35',
                fontWeight: halaman===p?600:400, cursor:'pointer' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setHalaman(p => Math.min(total,p+1))}
            disabled={halaman===total}
            style={{ padding:'6px 12px', borderRadius:8, fontSize:12,
              border:'1px solid #FFE0CC', background: halaman===total?'#FFF8F5':'#fff',
              color: halaman===total?'#FFB899':'#FF6B35', cursor: halaman===total?'default':'pointer' }}>
            Next →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth:1200, margin:'0 auto', fontFamily:'sans-serif' }}>

      {/* Notifikasi */}
      {notif && (
        <div style={{ padding:'12px 16px', borderRadius:8, marginBottom:16,
          fontSize:14, background: notif.startsWith('ok:') ? '#DCFCE7':'#FEE2E2',
          color: notif.startsWith('ok:') ? '#166534':'#991B1B' }}>
          {notif.replace(/^(ok|error):/,'')}
        </div>
      )}

      {/* ── FORM INPUT ── */}
      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC',
          borderRadius:12, padding:24, marginBottom:24,
          boxShadow:'0 2px 8px rgba(255,100,0,0.08)' }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:20 }}>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:16, color:'#1A1A1A' }}>
                {editId ? 'Edit data livestream' : 'Input data livestream baru'}
              </p>
              <p style={{ margin:0, fontSize:12, color:'#FF6B35' }}>
                Field bertanda * wajib diisi
              </p>
            </div>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }}
              style={{ background:'none', border:'none', fontSize:22,
                cursor:'pointer', color:'#999' }}>×</button>
          </div>

          {/* Info dasar */}
          <div style={{ background:'#FFF8F5', borderRadius:10,
            padding:16, marginBottom:16,
            border:'1px solid #FFE0CC' }}>
            <p style={{ margin:'0 0 12px', fontSize:11, fontWeight:600,
              color:'#FF8C00', textTransform:'uppercase',
              letterSpacing:'0.08em' }}>Informasi Sesi</p>
            <div style={{ display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))',
              gap:12 }}>
              <Field label="Tanggal Livestream" required>
                <input type="date" name="tanggal" value={form.tanggal}
                  onChange={handleChange} style={inputStyle} />
              </Field>
              <Field label="Nama Host" required>
                <select name="nama_host" value={form.nama_host}
                  onChange={handleChange} style={selectStyle}>
                  <option value="">-- Pilih Host --</option>
                  {HOSTS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Platform" required>
                <select name="platform" value={form.platform}
                  onChange={handleChange} style={selectStyle}>
                  <option value="">-- Pilih Platform --</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Jadwal Sesi" required>
                <select name="jadwal_sesi" value={form.jadwal_sesi}
                  onChange={handleChange} style={selectStyle}>
                  <option value="">-- Pilih Sesi --</option>
                  {JADWAL_SESI.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Metrik performa */}
          <div style={{ background:'#FFF8F5', borderRadius:10,
            padding:16, marginBottom:16, border:'1px solid #FFE0CC' }}>
            <p style={{ margin:'0 0 12px', fontSize:11, fontWeight:600,
              color:'#FF8C00', textTransform:'uppercase',
              letterSpacing:'0.08em' }}>Performa Sesi</p>
            <div style={{ display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))',
              gap:12 }}>
              {[
                { label:'Durasi (Jam)', name:'durasi_jam', placeholder:'cth: 6' },
                { label:'GMV (Rp)', name:'gmv', placeholder:'cth: 5000000' },
                { label:'Pesanan', name:'pesanan', placeholder:'cth: 120' },
                { label:'Penonton', name:'penonton', placeholder:'cth: 5000' },
                { label:'Durasi Ditonton', name:'durasi_ditonton', placeholder:'cth: 300' },
                { label:'GPM Tayangan (Rp)', name:'gpm_tayangan', placeholder:'cth: 49000' },
                { label:'Klik Produk TikTok', name:'klik_produk_tiktok', placeholder:'cth: 800' },
              ].map(f => (
                <Field key={f.name} label={f.label} required={
                  ['durasi_jam','gmv','pesanan','penonton'].includes(f.name)}>
                  <input type="number" name={f.name} value={form[f.name]}
                    onChange={handleChange} placeholder={f.placeholder}
                    style={inputStyle} />
                </Field>
              ))}
            </div>
          </div>

          {/* Metrik TikTok */}
          <div style={{ background:'#FFF8F5', borderRadius:10,
            padding:16, marginBottom:16, border:'1px solid #FFE0CC' }}>
            <p style={{ margin:'0 0 12px', fontSize:11, fontWeight:600,
              color:'#FF8C00', textTransform:'uppercase',
              letterSpacing:'0.08em' }}>Metrik TikTok (opsional)</p>
            <div style={{ display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))',
              gap:12 }}>
              <Field label="CTR TikTok (%)">
                <input type="number" name="ctr_tiktok" value={form.ctr_tiktok}
                  onChange={handleChange} placeholder="cth: 14.73"
                  style={inputStyle} />
              </Field>
              <Field label="ERR TikTok (%)">
                <input type="number" name="err_tiktok" value={form.err_tiktok}
                  onChange={handleChange} placeholder="cth: 1.36"
                  style={inputStyle} />
              </Field>
            </div>
          </div>

          {/* Upload screenshot */}
          <div style={{ background:'#FFF8F5', borderRadius:10,
            padding:16, marginBottom:20, border:'1px solid #FFE0CC' }}>
            <p style={{ margin:'0 0 12px', fontSize:11, fontWeight:600,
              color:'#FF8C00', textTransform:'uppercase',
              letterSpacing:'0.08em' }}>Bukti Screenshot</p>
            <input type="file" accept="image/*" ref={fileRef}
              onChange={handleFileUpload} style={{ display:'none' }} />
            <button onClick={() => fileRef.current.click()}
              disabled={uploading}
              style={{ padding:'8px 18px', borderRadius:8,
                border:'1px dashed #FFD4B8', background:'#fff',
                color:'#FF6B35', cursor:'pointer', fontSize:13 }}>
              {uploading ? 'Mengupload...' : '📷 Pilih gambar (maks 10MB)'}
            </button>
            {form.bukti_screenshot && (
              <div style={{ marginTop:12 }}>
                <img src={form.bukti_screenshot}
                  alt="preview"
                  style={{ maxWidth:200, maxHeight:150,
                    borderRadius:8, border:'1px solid #FFE0CC',
                    objectFit:'cover' }} />
                <button onClick={() => setForm(f => ({...f, bukti_screenshot:''}))}
                  style={{ display:'block', marginTop:6, fontSize:11,
                    color:'#DC2626', background:'none',
                    border:'none', cursor:'pointer' }}>
                  Hapus gambar
                </button>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setEditId(null) }}
              style={{ padding:'9px 20px', borderRadius:8,
                border:'1px solid #FFD4B8', background:'#fff',
                cursor:'pointer', fontSize:13, color:'#374151' }}>
              Batal
            </button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding:'9px 24px', borderRadius:8, border:'none',
                background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              {saving ? 'Menyimpan...' : editId ? 'Perbarui data' : 'Simpan data'}
            </button>
          </div>
        </div>
      )}

      {/* ── HEADER & FILTER ── */}
      <div style={{ background:'#fff', border:'1px solid #FFE0CC',
        borderRadius:12, padding:20, marginBottom:20,
        boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <p style={{ margin:0, fontSize:20, fontWeight:700, color:'#1A1A1A' }}>
              Livestream Reporting
            </p>
            <p style={{ margin:0, fontSize:13, color:'#999' }}>
              {filtered.length} sesi · Shopee & TikTok
            </p>
          </div>
          <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEditId(null) }}
            style={{ padding:'9px 20px', borderRadius:8,
              background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
              color:'#fff', border:'none', cursor:'pointer',
              fontSize:13, fontWeight:600 }}>
            + Input data
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display:'grid',
          gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))',
          gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:'#FF8C00',
              fontWeight:600, display:'block', marginBottom:4 }}>Host</label>
            <select value={filterHost} onChange={e => setFilterHost(e.target.value)}
              style={selectStyle}>
              <option value="">Semua host</option>
              {HOSTS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#FF8C00',
              fontWeight:600, display:'block', marginBottom:4 }}>Platform</label>
            <select value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value)}
              style={selectStyle}>
              <option value="">Semua platform</option>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#FF8C00',
              fontWeight:600, display:'block', marginBottom:4 }}>Sesi</label>
            <select value={filterSesi} onChange={e => setFilterSesi(e.target.value)}
              style={selectStyle}>
              <option value="">Semua sesi</option>
              {JADWAL_SESI.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#FF8C00',
              fontWeight:600, display:'block', marginBottom:4 }}>Dari tanggal</label>
            <input type="date" value={filterStart}
              onChange={e => setFilterStart(e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#FF8C00',
              fontWeight:600, display:'block', marginBottom:4 }}>Sampai tanggal</label>
            <input type="date" value={filterEnd}
              onChange={e => setFilterEnd(e.target.value)}
              style={inputStyle} />
          </div>
          <div style={{ display:'flex', alignItems:'flex-end' }}>
            <button onClick={() => {
              setFilterHost(''); setFilterPlatform('');
              setFilterSesi(''); setFilterStart(''); setFilterEnd('')
            }}
              style={{ width:'100%', padding:'8px 12px', borderRadius:8,
                border:'1px solid #FFD4B8', background:'#fff',
                color:'#FF6B35', cursor:'pointer', fontSize:12 }}>
              Reset filter
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color:'#999', fontSize:14 }}>Memuat data...</p>
      ) : (
        <>
          {/* ── SUMMARY CARDS ── */}
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))',
            gap:12, marginBottom:20 }}>
            {[
              { label:'Omzet GMV', value: fmtRp(totalGmv), big: true },
              { label:'Total Sesi', value: fmt(totalSesi) },
              { label:'Total Durasi (Jam)', value: fmt(totalDurasi.toFixed(1)) },
              { label:'GMV per Jam', value: fmtRp(avgGmvPerJam.toFixed(0)) },
              { label:'Total Pesanan', value: fmt(totalPesanan) },
              { label:'Total Penonton', value: fmt(sum(filtered,'penonton')) },
              { label:'Conv Rate', value: fmtPct(avgCvr.toFixed(2)) },
              { label:'Avg ERR TikTok', value: fmtPct(avgErr.toFixed(2)) },
              { label:'Avg CTR TikTok', value: fmtPct(avgCtr.toFixed(2)) },
              { label:'Avg GPM', value: fmtRp(avgGpm.toFixed(0)) },
            ].map(m => (
              <div key={m.label} style={{
                background: m.big
                  ? 'linear-gradient(135deg,#FF6B35,#FF8C00)'
                  : '#fff',
                border: m.big ? 'none' : '1px solid #FFE0CC',
                borderRadius:10, padding:'14px 16px',
                boxShadow:'0 1px 4px rgba(255,100,0,0.06)',
              }}>
                <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:500,
                  color: m.big ? 'rgba(255,255,255,0.8)' : '#999' }}>
                  {m.label}
                </p>
                <p style={{ margin:0, fontSize: m.big ? 22 : 18,
                  fontWeight:700,
                  color: m.big ? '#fff' : '#1A1A1A' }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── GRAFIK TREN GMV ── */}
          {grafikTren.length > 0 && (
            <div style={{ background:'#fff', border:'1px solid #FFE0CC',
              borderRadius:12, padding:20, marginBottom:20,
              boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
              <p style={{ margin:'0 0 4px', fontWeight:700,
                fontSize:14, color:'#1A1A1A' }}>
                Livestream GMV Trend
              </p>
              <p style={{ margin:'0 0 16px', fontSize:12, color:'#999' }}>
                Omzet (GMV) & Durasi harian
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={grafikTren}
                  margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED" />
                  <XAxis dataKey="tgl"
                    tick={{ fontSize:10, fill:'#999' }}
                    tickLine={false}
                    axisLine={{ stroke:'#FFE0CC' }} />
                  <YAxis yAxisId="gmv" tickFormatter={fmtAxis}
                    tick={{ fontSize:10, fill:'#999' }}
                    tickLine={false} axisLine={false} width={70} />
                  <YAxis yAxisId="durasi" orientation="right"
                    tick={{ fontSize:10, fill:'#999' }}
                    tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    formatter={(v, name) => [
                      name === 'gmv'
                        ? 'Rp ' + Number(v).toLocaleString('id-ID')
                        : v + ' jam',
                      name === 'gmv' ? 'Omzet GMV' : 'Durasi'
                    ]}
                    contentStyle={{ fontSize:12, borderRadius:8,
                      border:'1px solid #FFE0CC' }} />
                  <Legend formatter={v => v === 'gmv' ? 'Omzet (GMV)' : 'Durasi (JAM)'} />
                  <Line yAxisId="gmv" type="monotone" dataKey="gmv"
                    stroke="#FF6B35" strokeWidth={2}
                    dot={{ r:3, fill:'#FF6B35', strokeWidth:0 }}
                    activeDot={{ r:5 }} />
                  <Line yAxisId="durasi" type="monotone" dataKey="durasi"
                    stroke="#60A5FA" strokeWidth={2}
                    dot={{ r:3, fill:'#60A5FA', strokeWidth:0 }}
                    activeDot={{ r:5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── SALES PER HOST ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20, marginBottom:20,
            boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
            <p style={{ margin:'0 0 16px', fontWeight:700,
              fontSize:14, color:'#1A1A1A' }}>
              Sales per Host
            </p>
            {perHost.length === 0 ? (
              <p style={{ color:'#999', fontSize:13 }}>Belum ada data</p>
            ) : (
              <>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#FFF3ED' }}>
                        {['Nama Host','Sesi','Durasi (Jam)','GMV','GMV per Jam','Produk Terjual','Aksi']
                          .map(h => (
                          <th key={h} style={{ textAlign: h==='Nama Host'?'left':'right',
                            padding:'10px 12px', color:'#FF6B35',
                            fontWeight:500, fontSize:12,
                            borderBottom:'1px solid #FFE0CC',
                            whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perHost
                        .slice((halamanHost-1)*BARIS, halamanHost*BARIS)
                        .map((row, idx) => (
                        <tr key={row.nama_host}
                          style={{ borderBottom:'0.5px solid #FFF3ED' }}>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{
                                width:32, height:32, borderRadius:'50%',
                                background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                                display:'flex', alignItems:'center',
                                justifyContent:'center', fontSize:13,
                                color:'#fff', fontWeight:700, flexShrink:0,
                              }}>
                                {row.nama_host.charAt(0)}
                              </div>
                              <div>
                                <p style={{ margin:0, fontWeight:600,
                                  fontSize:13, color:'#1A1A1A' }}>
                                  {row.nama_host}
                                </p>
                                {idx === 0 && (
                                  <span style={{ fontSize:10,
                                    background:'#FFF3ED', color:'#FF6B35',
                                    padding:'1px 6px', borderRadius:10,
                                    fontWeight:600 }}>
                                    Top Performer
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.sesi)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>
                            {Number(row.durasi_jam).toFixed(1)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            fontWeight:600, color:'#1A1A1A' }}>
                            {fmtRp(row.gmv)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#FF6B35', fontWeight:500 }}>
                            {fmtRp(row.gmv_per_jam.toFixed(0))}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.produk_terjual)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right' }}>
                            <button
                              onClick={() => setFilterHost(
                                filterHost === row.nama_host ? '' : row.nama_host
                              )}
                              style={{ fontSize:11, padding:'3px 10px',
                                borderRadius:6, border:'1px solid #FFD4B8',
                                background: filterHost===row.nama_host
                                  ? '#FFF3ED' : '#fff',
                                color:'#FF6B35', cursor:'pointer' }}>
                              {filterHost===row.nama_host ? 'Reset':'Filter'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination data={perHost}
                  halaman={halamanHost} setHalaman={setHalamanHost} />
              </>
            )}
          </div>

          {/* ── SALES PER SESI ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20, marginBottom:20,
            boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
            <p style={{ margin:'0 0 16px', fontWeight:700,
              fontSize:14, color:'#1A1A1A' }}>
              Sales per Sesi
            </p>
            {perSesi.length === 0 ? (
              <p style={{ color:'#999', fontSize:13 }}>Belum ada data</p>
            ) : (
              <>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#FFF3ED' }}>
                        {['Jadwal Sesi','Jumlah Sesi','Durasi (Jam)',
                          'GMV','GMV per Jam','Produk Terjual','Aksi']
                          .map(h => (
                          <th key={h} style={{ textAlign: h==='Jadwal Sesi'?'left':'right',
                            padding:'10px 12px', color:'#FF6B35',
                            fontWeight:500, fontSize:12,
                            borderBottom:'1px solid #FFE0CC',
                            whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perSesi
                        .slice((halamanSesi-1)*BARIS, halamanSesi*BARIS)
                        .map(row => (
                        <tr key={row.jadwal_sesi}
                          style={{ borderBottom:'0.5px solid #FFF3ED' }}>
                          <td style={{ padding:'10px 12px' }}>
                            <div>
                              <p style={{ margin:0, fontWeight:600,
                                fontSize:13, color:'#1A1A1A' }}>
                                {row.jadwal_sesi.split('|')[0].trim()}
                              </p>
                              <p style={{ margin:0, fontSize:11, color:'#999' }}>
                                {row.jadwal_sesi.split('|')[1]?.trim()}
                              </p>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.sesi)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>
                            {Number(row.durasi_jam).toFixed(1)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            fontWeight:600, color:'#1A1A1A' }}>
                            {fmtRp(row.gmv)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#FF6B35', fontWeight:500 }}>
                            {fmtRp(row.gmv_per_jam.toFixed(0))}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.produk_terjual)}</td>
                          <td style={{ padding:'10px 12px', textAlign:'right' }}>
                            <button
                              onClick={() => setFilterSesi(
                                filterSesi === row.jadwal_sesi ? '' : row.jadwal_sesi
                              )}
                              style={{ fontSize:11, padding:'3px 10px',
                                borderRadius:6, border:'1px solid #FFD4B8',
                                background: filterSesi===row.jadwal_sesi
                                  ? '#FFF3ED' : '#fff',
                                color:'#FF6B35', cursor:'pointer' }}>
                              {filterSesi===row.jadwal_sesi ? 'Reset':'Filter'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination data={perSesi}
                  halaman={halamanSesi} setHalaman={setHalamanSesi} />
              </>
            )}
          </div>

          {/* ── DETAIL DATA LENGKAP ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC',
            borderRadius:12, padding:20,
            boxShadow:'0 1px 4px rgba(255,100,0,0.06)' }}>
            <p style={{ margin:'0 0 16px', fontWeight:700,
              fontSize:14, color:'#1A1A1A' }}>
              Detail Data Sesi ({filtered.length} sesi)
            </p>
            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#999' }}>
                <p style={{ fontSize:14, margin:'0 0 8px' }}>
                  Belum ada data sesi livestream
                </p>
                <p style={{ fontSize:12, margin:0 }}>
                  Klik "+ Input data" untuk menambahkan
                </p>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#FFF3ED' }}>
                      {['Tanggal','Host','Platform','Sesi',
                        'Durasi (Jam)','GMV','GMV/Jam',
                        'Pesanan','Penonton','CTR','ERR',
                        'GPM','Screenshot','Aksi'].map(h => (
                        <th key={h} style={{
                          textAlign: ['Tanggal','Host','Platform','Sesi'].includes(h)
                            ? 'left' : 'right',
                          padding:'10px 12px', color:'#FF6B35',
                          fontWeight:500, fontSize:11,
                          borderBottom:'1px solid #FFE0CC',
                          whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 10).map(row => {
                      const gmvPerJam = row.durasi_jam > 0
                        ? row.gmv / row.durasi_jam : 0
                      return (
                        <tr key={row.id}
                          style={{ borderBottom:'0.5px solid #FFF3ED' }}>
                          <td style={{ padding:'8px 12px', color:'#666',
                            whiteSpace:'nowrap' }}>{row.tanggal}</td>
                          <td style={{ padding:'8px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <div style={{
                                width:24, height:24, borderRadius:'50%',
                                background:'linear-gradient(135deg,#FF6B35,#FF8C00)',
                                display:'flex', alignItems:'center',
                                justifyContent:'center', fontSize:10,
                                color:'#fff', fontWeight:700,
                              }}>
                                {row.nama_host.charAt(0)}
                              </div>
                              <span style={{ fontSize:12, fontWeight:500,
                                color:'#1A1A1A' }}>
                                {row.nama_host}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{
                              fontSize:11, padding:'2px 8px', borderRadius:20,
                              background: row.platform==='Shopee'
                                ? '#FFF0E6' : '#F0F0FF',
                              color: row.platform==='Shopee'
                                ? '#993C1D' : '#3C3489',
                              fontWeight:500,
                            }}>{row.platform}</span>
                          </td>
                          <td style={{ padding:'8px 12px', color:'#666',
                            fontSize:11, maxWidth:160,
                            overflow:'hidden', textOverflow:'ellipsis',
                            whiteSpace:'nowrap' }}>
                            {row.jadwal_sesi}
                          </td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666' }}>
                            {Number(row.durasi_jam).toFixed(1)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            fontWeight:600, color:'#1A1A1A',
                            whiteSpace:'nowrap' }}>
                            {fmtRp(row.gmv)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#FF6B35', fontWeight:500,
                            whiteSpace:'nowrap' }}>
                            {fmtRp(gmvPerJam.toFixed(0))}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.pesanan)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666' }}>{fmt(row.penonton)}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666' }}>
                            {row.ctr_tiktok ? fmtPct(row.ctr_tiktok) : '-'}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666' }}>
                            {row.err_tiktok ? fmtPct(row.err_tiktok) : '-'}</td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            color:'#666', whiteSpace:'nowrap' }}>
                            {row.gpm_tayangan ? fmtRp(row.gpm_tayangan) : '-'}</td>
                          <td style={{ padding:'8px 12px', textAlign:'center' }}>
                            {row.bukti_screenshot ? (
                              <a href={row.bukti_screenshot}
                                target="_blank" rel="noreferrer"
                                style={{ fontSize:11, color:'#FF6B35',
                                  textDecoration:'none',
                                  background:'#FFF3ED',
                                  padding:'2px 8px', borderRadius:6 }}>
                                Lihat
                              </a>
                            ) : (
                              <span style={{ fontSize:11, color:'#ccc' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding:'8px 12px', textAlign:'right',
                            whiteSpace:'nowrap' }}>
                            <button onClick={() => handleEdit(row)}
                              style={{ fontSize:11, padding:'3px 10px',
                                borderRadius:6, border:'1px solid #FFD4B8',
                                background:'#fff', cursor:'pointer',
                                marginRight:6, color:'#FF6B35' }}>
                              Edit
                            </button>
                            <button onClick={() => handleDelete(row.id)}
                              style={{ fontSize:11, padding:'3px 10px',
                                borderRadius:6, border:'1px solid #FECACA',
                                background:'#FEF2F2', color:'#DC2626',
                                cursor:'pointer' }}>
                              Hapus
                            </button>
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