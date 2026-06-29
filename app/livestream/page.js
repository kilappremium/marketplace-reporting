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
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText]       = useState('')
  const [aiError, setAiError]     = useState('')
  const [chatOpen, setChatOpen]         = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput]       = useState('')
  const [chatLoading, setChatLoading]   = useState(false)
  const chatEndRef = useRef(null)
  const BARIS = 10

  const fileRef = useRef()

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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

  async function generateAI() {
    setAiLoading(true)
    setAiText('')
    setAiError('')

    const topHost = [...perHost].slice(0, 3)
      .map(h => `${h.nama_host} (GMV: ${fmtRp(h.gmv)}, ${h.sesi} sesi, GPJ: ${fmtRp(h.gmv_per_jam.toFixed(0))})`)
      .join(', ')

    const topSesi = [...perSesi].slice(0, 3)
      .map(s => `${s.jadwal_sesi.split('|')[0].trim()} ${s.jadwal_sesi.split('|')[1]?.trim()} (GMV: ${fmtRp(s.gmv)})`)
      .join(', ')

    const filterInfo = [
      filterHost ? `Host: ${filterHost}` : '',
      filterPlatform ? `Platform: ${filterPlatform}` : '',
      filterSesi ? `Sesi: ${filterSesi}` : '',
      filterStart && filterEnd ? `Periode: ${filterStart} s/d ${filterEnd}` : '',
    ].filter(Boolean).join(', ') || 'Semua data'

    const konteks = `Kamu adalah analis livestream e-commerce Indonesia.
Analisis performa livestream berikut dalam Bahasa Indonesia, maksimal 3 paragraf singkat.
Gunakan **bold** untuk angka atau insight penting.

Filter aktif: ${filterInfo}
Total sesi: ${totalSesi} sesi
Total durasi: ${totalDurasi.toFixed(1)} jam

Summary metrik:
- Omzet GMV: ${fmtRp(totalGmv)}
- GMV per Jam: ${fmtRp(avgGmvPerJam.toFixed(0))}
- Total Pesanan: ${fmt(totalPesanan)}
- Total Penonton: ${fmt(sum(filtered,'penonton'))}
- Conversion Rate: ${fmtPct(avgCvr.toFixed(2))}
- Avg CTR TikTok: ${fmtPct(avgCtr.toFixed(2))}
- Avg ERR TikTok: ${fmtPct(avgErr.toFixed(2))}
- Avg GPM: ${fmtRp(avgGpm.toFixed(0))}

Top 3 host: ${topHost || 'Belum ada data'}
Top 3 sesi: ${topSesi || 'Belum ada data'}

Berikan: ringkasan performa livestream, temuan penting (host terbaik, sesi terbaik, efisiensi GMV per jam, engagement), dan 2 rekomendasi konkret yang bisa langsung dieksekusi tim livestream.`

    try {
      const res  = await fetch('/api/ai-analysis', {
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

  function buildKonteksLivestream() {
    const topHost = [...perHost].slice(0,3)
      .map(h => `${h.nama_host} (GMV: ${fmtRp(h.gmv)}, ${h.sesi} sesi, GPJ: ${fmtRp(h.gmv_per_jam.toFixed(0))})`)
      .join(', ')

    const topSesi = [...perSesi].slice(0,3)
      .map(s => `${s.jadwal_sesi.split('|')[0].trim()} ${s.jadwal_sesi.split('|')[1]?.trim()} (GMV: ${fmtRp(s.gmv)})`)
      .join(', ')

    const filterInfo = [
      filterHost ? `Host: ${filterHost}` : '',
      filterPlatform ? `Platform: ${filterPlatform}` : '',
      filterSesi ? `Sesi: ${filterSesi}` : '',
      filterStart && filterEnd ? `Periode: ${filterStart} s/d ${filterEnd}` : '',
    ].filter(Boolean).join(', ') || 'Semua data'

    return `Kamu adalah AI analyst livestream e-commerce untuk platform marketplace Kilap.
Kamu memiliki data performa livestream berikut dan harus menjawab berdasarkan data ini.

Filter aktif: ${filterInfo}
Total sesi: ${totalSesi} sesi | Total durasi: ${totalDurasi.toFixed(1)} jam

DATA METRIK:
- Omzet GMV: ${fmtRp(totalGmv)}
- GMV per Jam: ${fmtRp(avgGmvPerJam.toFixed(0))}
- Total Pesanan: ${fmt(totalPesanan)}
- Total Penonton: ${fmt(sum(filtered,'penonton'))}
- Conversion Rate: ${fmtPct(avgCvr.toFixed(2))}
- Avg CTR TikTok: ${fmtPct(avgCtr.toFixed(2))}
- Avg ERR TikTok: ${fmtPct(avgErr.toFixed(2))}
- Avg GPM: ${fmtRp(avgGpm.toFixed(0))}

TOP 3 HOST: ${topHost || 'Belum ada data'}
TOP 3 SESI: ${topSesi || 'Belum ada data'}

Jawab dalam Bahasa Indonesia yang natural. Gunakan angka dari data di atas saat menjawab. Jika ditanya di luar data yang tersedia, katakan data tersebut tidak tersedia.`
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
      const konteks = buildKonteksLivestream()
      const historyText = [
        `System: ${konteks}`,
        ...newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      ].join('\n\n')

      const res  = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: historyText }),
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

  // ─── Filter data ───────────────────────────────────────
  const filtered = data.filter(r => {
    if (filterHost && r.nama_host !== filterHost) return false
    if (filterPlatform && r.platform !== filterPlatform) return false
    if (filterSesi && r.jadwal_sesi !== filterSesi) return false
    if (filterStart && r.tanggal < filterStart) return false
    if (filterEnd && r.tanggal > filterEnd) return false
    return true
  })

  // ─── Data periode sebelumnya ──────────────────────────
  const filteredPrev = (() => {
    if (filterStart && filterEnd) {
      const start  = new Date(filterStart)
      const end    = new Date(filterEnd)
      const durasi = Math.round((end - start) / (1000*60*60*24)) + 1
      const prevEnd   = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - durasi + 1)
      const ps = prevStart.toISOString().split('T')[0]
      const pe = prevEnd.toISOString().split('T')[0]
      return data.filter(r => {
        if (filterHost     && r.nama_host !== filterHost)     return false
        if (filterPlatform && r.platform  !== filterPlatform) return false
        if (filterSesi     && r.jadwal_sesi !== filterSesi)   return false
        return r.tanggal >= ps && r.tanggal <= pe
      })
    }
    // Default: bandingkan dengan periode sama panjang sebelumnya
    // Jika tidak ada filter tanggal, ambil data 30 hari sebelum data tertua di filtered
    if (filtered.length === 0) return []
    const dates   = filtered.map(r => r.tanggal).sort()
    const oldest  = dates[0]
    const newest  = dates[dates.length - 1]
    const durasi  = Math.round((new Date(newest) - new Date(oldest)) / (1000*60*60*24)) + 1
    const prevEnd   = new Date(oldest); prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - durasi + 1)
    const ps = prevStart.toISOString().split('T')[0]
    const pe = prevEnd.toISOString().split('T')[0]
    return data.filter(r => {
      if (filterHost     && r.nama_host !== filterHost)     return false
      if (filterPlatform && r.platform  !== filterPlatform) return false
      if (filterSesi     && r.jadwal_sesi !== filterSesi)   return false
      return r.tanggal >= ps && r.tanggal <= pe
    })
  })()

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

  // ─── Metrik periode sebelumnya ────────────────────────
  const prevTotalGmv     = sum(filteredPrev, 'gmv')
  const prevTotalDurasi  = sum(filteredPrev, 'durasi_jam')
  const prevTotalPesanan = sum(filteredPrev, 'pesanan')
  const prevTotalSesi    = filteredPrev.length
  const prevTotalPenonton = sum(filteredPrev, 'penonton')
  const prevAvgGmvPerJam = prevTotalDurasi > 0 ? prevTotalGmv / prevTotalDurasi : 0
  const prevAvgCvr       = prevTotalPesanan && prevTotalPenonton
    ? (prevTotalPesanan / prevTotalPenonton * 100) : 0
  const prevAvgErr       = filteredPrev.length
    ? sum(filteredPrev, 'err_tiktok') / filteredPrev.length : 0
  const prevAvgCtr       = filteredPrev.length
    ? sum(filteredPrev, 'ctr_tiktok') / filteredPrev.length : 0
  const prevAvgGpm       = filteredPrev.length
    ? sum(filteredPrev, 'gpm_tayangan') / filteredPrev.length : 0

  const growthPct = (curr, prev) => prev > 0
    ? ((curr - prev) / prev * 100).toFixed(1) : null

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

  function GrowthBadge({ curr, prev }) {
    const g = growthPct(curr, prev)
    if (g === null) return null
    const up = Number(g) >= 0
    return (
      <span style={{
        fontSize: 11, fontWeight: 600,
        padding: '2px 7px', borderRadius: 20,
        display: 'inline-flex', alignItems: 'center', gap: 3,
        marginTop: 6,
        background: up ? '#DCFCE7' : '#FEE2E2',
        color:      up ? '#166534' : '#991B1B',
      }}>
        {up ? '▲' : '▼'} {Math.abs(Number(g))}%
        <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 10 }}>vs sebelumnya</span>
      </span>
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
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:20 }}>
            {[
              { label:'Omzet GMV',        value: fmtRp(totalGmv),                    curr: totalGmv,        prev: prevTotalGmv,        big: true },
              { label:'Total Sesi',       value: fmt(totalSesi),                      curr: totalSesi,       prev: prevTotalSesi },
              { label:'Total Durasi (Jam)', value: fmt(totalDurasi.toFixed(1)),       curr: totalDurasi,     prev: prevTotalDurasi },
              { label:'GMV per Jam',      value: fmtRp(avgGmvPerJam.toFixed(0)),     curr: avgGmvPerJam,    prev: prevAvgGmvPerJam },
              { label:'Total Pesanan',    value: fmt(totalPesanan),                   curr: totalPesanan,    prev: prevTotalPesanan },
              { label:'Total Penonton',   value: fmt(sum(filtered,'penonton')),       curr: sum(filtered,'penonton'), prev: prevTotalPenonton },
              { label:'Conv Rate',        value: fmtPct(avgCvr.toFixed(2)),           curr: avgCvr,          prev: prevAvgCvr },
              { label:'Avg ERR TikTok',   value: fmtPct(avgErr.toFixed(2)),           curr: avgErr,          prev: prevAvgErr },
              { label:'Avg CTR TikTok',   value: fmtPct(avgCtr.toFixed(2)),           curr: avgCtr,          prev: prevAvgCtr },
              { label:'Avg GPM',          value: fmtRp(avgGpm.toFixed(0)),            curr: avgGpm,          prev: prevAvgGpm },
            ].map(m => (
              <div key={m.label} style={{
                background: m.big ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : '#fff',
                border: m.big ? 'none' : '1px solid #FFE0CC',
                borderRadius: 10, padding: '14px 16px',
                boxShadow: '0 1px 4px rgba(255,100,0,0.06)',
                display: 'flex', flexDirection: 'column',
              }}>
                <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:500,
                  color: m.big ? 'rgba(255,255,255,0.8)' : '#999' }}>
                  {m.label}
                </p>
                <p style={{ margin:0, fontSize: m.big ? 22 : 18, fontWeight:700,
                  color: m.big ? '#fff' : '#1A1A1A' }}>
                  {m.value}
                </p>
                {!m.big && <GrowthBadge curr={m.curr} prev={m.prev} />}
                {m.big && <GrowthBadge curr={m.curr} prev={m.prev} />}
              </div>
            ))}
          </div>

          {/* ── RINGKASAN AI ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(255,100,0,0.06)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✦</div>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#1A1A1A' }}>
                    Ringkasan AI — Livestream
                  </p>
                  <p style={{ margin:0, fontSize:11, color:'#999' }}>
                    Analisis otomatis · {filtered.length} sesi
                    {filterHost ? ` · Host: ${filterHost}` : ''}
                    {filterPlatform ? ` · ${filterPlatform}` : ''}
                    {filterStart && filterEnd ? ` · ${filterStart} s/d ${filterEnd}` : ''}
                  </p>
                </div>
              </div>
              <button onClick={generateAI} disabled={aiLoading}
                style={{
                  padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:600,
                  cursor: aiLoading ? 'default' : 'pointer', border:'none',
                  background: aiLoading ? '#FFE0CC' : 'linear-gradient(135deg,#FF6B35,#FF8C00)',
                  color: aiLoading ? '#FFB899' : '#fff',
                  display:'flex', alignItems:'center', gap:6,
                }}>
                {aiLoading ? (
                  <>
                    <span style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #FFB899', borderTop:'2px solid #FF6B35', animation:'spin 1s linear infinite', display:'inline-block' }}/>
                    Menganalisis...
                  </>
                ) : (
                  <>✦ {aiText ? 'Perbarui' : 'Generate'} Analisis</>
                )}
              </button>
            </div>

            {aiError && <p style={{ color:'#DC2626', fontSize:13, margin:0 }}>{aiError}</p>}

            {!aiText && !aiLoading && (
              <div style={{ textAlign:'center', padding:'28px 0', border:'1px dashed #FFD4B8', borderRadius:10, background:'#FFF8F5' }}>
                <p style={{ fontSize:28, margin:'0 0 8px' }}>✦</p>
                <p style={{ fontSize:14, color:'#999', margin:'0 0 4px' }}>Klik "Generate Analisis" untuk mendapatkan</p>
                <p style={{ fontSize:13, color:'#FFB899', margin:0 }}>ringkasan performa livestream, insight host & sesi terbaik dari AI</p>
              </div>
            )}

            {aiText && (
              <div style={{ fontSize:14, lineHeight:1.7, color:'#374151', background:'#FFF8F5', borderRadius:10, padding:'16px 20px', border:'1px solid #FFE0CC' }}
                dangerouslySetInnerHTML={{ __html: aiText
                  .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B35">$1</strong>')
                  .replace(/\n\n/g, '</p><p style="margin:0 0 10px">')
                  .replace(/\n/g, '<br/>')
                  .replace(/^/, '<p style="margin:0 0 10px">')
                  .replace(/$/, '</p>')
                }}
              />
            )}
          </div>

          {/* ── AI CHAT ── */}
          <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, marginBottom:20, boxShadow:'0 2px 8px rgba(255,100,0,0.06)', overflow:'hidden' }}>

            {/* Header */}
            <div onClick={() => setChatOpen(o => !o)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', cursor:'pointer', userSelect:'none', background: chatOpen ? '#FFF8F5' : '#fff', borderBottom: chatOpen ? '1px solid #FFE0CC' : 'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💬</div>
                <div>
                  <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#1A1A1A' }}>Tanya AI tentang data Livestream</p>
                  <p style={{ margin:0, fontSize:11, color:'#999' }}>
                    {chatMessages.length > 0 ? `${Math.floor(chatMessages.length/2)} pertanyaan dijawab` : 'Klik untuk mulai tanya jawab'}
                  </p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {chatMessages.length > 0 && (
                  <button onClick={e => { e.stopPropagation(); setChatMessages([]); setChatInput('') }}
                    style={{ fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #FFD4B8', background:'#fff', color:'#FF6B35', cursor:'pointer' }}>
                    Reset chat
                  </button>
                )}
                <span style={{ fontSize:18, color:'#FF6B35', display:'inline-block', transition:'transform 0.2s', transform: chatOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
              </div>
            </div>

            {/* Body */}
            {chatOpen && (
              <div>
                <div style={{ maxHeight:360, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>

                  {/* Contoh pertanyaan */}
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign:'center', padding:'16px 0' }}>
                      <p style={{ fontSize:13, color:'#999', margin:'0 0 12px' }}>Contoh pertanyaan:</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                        {[
                          'Host mana yang paling efisien per jam?',
                          'Sesi shift mana yang paling menghasilkan?',
                          'Kenapa GMV livestream turun?',
                          'Bagaimana cara meningkatkan GPM?',
                          'Bandingkan performa Shopee vs TikTok',
                          'Rekomendasi jadwal livestream terbaik',
                        ].map(q => (
                          <button key={q} onClick={() => setChatInput(q)}
                            style={{ fontSize:12, padding:'6px 14px', borderRadius:20, border:'1px solid #FFD4B8', background:'#FFF8F5', color:'#FF6B35', cursor:'pointer' }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pesan */}
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, marginRight:8, flexShrink:0, alignSelf:'flex-end' }}>✦</div>
                      )}
                      <div style={{
                        maxWidth:'75%', padding:'10px 14px',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
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

                  {/* Loading */}
                  {chatLoading && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#FF8C00)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✦</div>
                      <div style={{ padding:'10px 14px', borderRadius:'12px 12px 12px 2px', background:'#FFF8F5', border:'1px solid #FFE0CC', display:'flex', gap:4, alignItems:'center' }}>
                        {[0,1,2].map(i => (
                          <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#FF6B35', animation:'pulse 1.2s ease-in-out infinite', animationDelay:`${i*0.2}s` }}/>
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding:'12px 20px', borderTop:'1px solid #FFE0CC', background:'#FAFAFA', display:'flex', gap:10, alignItems:'flex-end' }}>
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                    placeholder="Tanya tentang performa livestream... (Enter untuk kirim)"
                    rows={2}
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1px solid #FFD4B8', fontSize:13, color:'#1A1A1A', background:'#fff', outline:'none', resize:'none', fontFamily:'inherit', lineHeight:1.5 }}
                  />
                  <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                    style={{ padding:'10px 18px', borderRadius:10, border:'none', fontSize:13, fontWeight:600, height:42, cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer', background: chatLoading || !chatInput.trim() ? '#FFE0CC' : 'linear-gradient(135deg,#FF6B35,#FF8C00)', color: chatLoading || !chatInput.trim() ? '#FFB899' : '#fff', whiteSpace:'nowrap' }}>
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