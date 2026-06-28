'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const SECTION_STYLE = {
  background: '#fff',
  border: '1px solid #FFE0CC',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 20,
  boxShadow: '0 1px 4px rgba(255,100,0,0.06)',
}

const LABEL_STYLE = {
  fontSize: 12, fontWeight: 600, color: '#374151',
  display: 'block', marginBottom: 6,
}

const INPUT_STYLE = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #FFD4B8', fontSize: 13,
  color: '#1A1A1A', background: '#fff',
  boxSizing: 'border-box', outline: 'none',
}

const SECTION_TITLE = ({ children }) => (
  <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#1A1A1A', borderBottom: '1px solid #FFF3ED', paddingBottom: 10 }}>{children}</p>
)

export default function PengaturanPage() {
  const [user, setUser] = useState(null)
  const [notif, setNotif] = useState('')
  const [saving, setSaving] = useState(false)

  // ─── State pengaturan profil ───────────────────────────
  const [namaToko, setNamaToko]       = useState('Kilap')
  const [namaPIC, setNamaPIC]         = useState('')
  const [emailPIC, setEmailPIC]       = useState('')

  // ─── State target KPI ─────────────────────────────────
  const [targetGmv, setTargetGmv]           = useState('')
  const [targetRoas, setTargetRoas]         = useState('')
  const [targetRoi, setTargetRoi]           = useState('')
  const [targetCancelRate, setTargetCancelRate] = useState('')
  const [targetFailPickup, setTargetFailPickup] = useState('')
  const [targetMakingSales, setTargetMakingSales] = useState('')
  const [targetCvr, setTargetCvr]           = useState('')

  // ─── State threshold anomali ───────────────────────────
  const [thresholdGmvDrop, setThresholdGmvDrop]   = useState('10')
  const [thresholdRoasDrop, setThresholdRoasDrop] = useState('15')
  const [thresholdRoasMin, setThresholdRoasMin]   = useState('2')
  const [thresholdCancel, setThresholdCancel]     = useState('5')
  const [thresholdFailPickup, setThresholdFailPickup] = useState('3')

  // ─── State platform aktif ──────────────────────────────
  const [platformShopee, setPlatformShopee] = useState(true)
  const [platformTiktok, setPlatformTiktok] = useState(true)
  const [platformMeta, setPlatformMeta]     = useState(true)
  const [platformTokopedia, setPlatformTokopedia] = useState(false)
  const [platformLazada, setPlatformLazada] = useState(false)

  // ─── State password ────────────────────────────────────
  const [pwLama, setPwLama]   = useState('')
  const [pwBaru, setPwBaru]   = useState('')
  const [pwUlang, setPwUlang] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user
      setUser(u || null)
      if (u?.email) setEmailPIC(u.email)
    })

    // Load settings dari localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('kilap_settings') || '{}')
      if (saved.namaToko)          setNamaToko(saved.namaToko)
      if (saved.namaPIC)           setNamaPIC(saved.namaPIC)
      if (saved.targetGmv)         setTargetGmv(saved.targetGmv)
      if (saved.targetRoas)        setTargetRoas(saved.targetRoas)
      if (saved.targetRoi)         setTargetRoi(saved.targetRoi)
      if (saved.targetCancelRate)  setTargetCancelRate(saved.targetCancelRate)
      if (saved.targetFailPickup)  setTargetFailPickup(saved.targetFailPickup)
      if (saved.targetMakingSales) setTargetMakingSales(saved.targetMakingSales)
      if (saved.targetCvr)         setTargetCvr(saved.targetCvr)
      if (saved.thresholdGmvDrop !== undefined)   setThresholdGmvDrop(saved.thresholdGmvDrop)
      if (saved.thresholdRoasDrop !== undefined)  setThresholdRoasDrop(saved.thresholdRoasDrop)
      if (saved.thresholdRoasMin !== undefined)   setThresholdRoasMin(saved.thresholdRoasMin)
      if (saved.thresholdCancel !== undefined)    setThresholdCancel(saved.thresholdCancel)
      if (saved.thresholdFailPickup !== undefined) setThresholdFailPickup(saved.thresholdFailPickup)
      if (saved.platformShopee !== undefined)     setPlatformShopee(saved.platformShopee)
      if (saved.platformTiktok !== undefined)     setPlatformTiktok(saved.platformTiktok)
      if (saved.platformMeta !== undefined)       setPlatformMeta(saved.platformMeta)
      if (saved.platformTokopedia !== undefined)  setPlatformTokopedia(saved.platformTokopedia)
      if (saved.platformLazada !== undefined)     setPlatformLazada(saved.platformLazada)
    } catch (e) {}
  }, [])

  function showNotif(msg, type = 'ok') {
    setNotif(`${type}:${msg}`)
    setTimeout(() => setNotif(''), 3000)
  }

  async function handleSimpanPengaturan() {
    setSaving(true)
    const settings = {
      namaToko, namaPIC,
      targetGmv, targetRoas, targetRoi,
      targetCancelRate, targetFailPickup, targetMakingSales, targetCvr,
      thresholdGmvDrop, thresholdRoasDrop, thresholdRoasMin,
      thresholdCancel, thresholdFailPickup,
      platformShopee, platformTiktok, platformMeta, platformTokopedia, platformLazada,
    }
    localStorage.setItem('kilap_settings', JSON.stringify(settings))
    setSaving(false)
    showNotif('Pengaturan berhasil disimpan!')
  }

  async function handleGantiPassword() {
    if (!pwBaru || !pwUlang) { showNotif('Password baru wajib diisi!', 'error'); return }
    if (pwBaru !== pwUlang) { showNotif('Konfirmasi password tidak cocok!', 'error'); return }
    if (pwBaru.length < 6) { showNotif('Password minimal 6 karakter!', 'error'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwBaru })
    setSaving(false)
    if (error) { showNotif('Gagal ganti password: ' + error.message, 'error'); return }
    setPwLama(''); setPwBaru(''); setPwUlang('')
    showNotif('Password berhasil diperbarui!')
  }

  const Toggle = ({ value, onChange, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #FFF3ED' }}>
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
      <div onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, background: value ? 'linear-gradient(135deg,#FF6B35,#FF8C00)' : '#E5E7EB', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>Pengaturan</p>
        <p style={{ margin: 0, fontSize: 13, color: '#999' }}>Kelola profil, target KPI, dan preferensi aplikasi</p>
      </div>

      {/* Notifikasi */}
      {notif && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: notif.startsWith('ok:') ? '#DCFCE7' : '#FEE2E2',
          color: notif.startsWith('ok:') ? '#166534' : '#991B1B',
          border: `1px solid ${notif.startsWith('ok:') ? '#BBF7D0' : '#FECACA'}` }}>
          {notif.replace(/^(ok|error):/, '')}
        </div>
      )}

      {/* ── 1. PROFIL TOKO ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>👤 Profil Toko</SECTION_TITLE>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
          <div>
            <label style={LABEL_STYLE}>Nama Toko / Brand</label>
            <input value={namaToko} onChange={e => setNamaToko(e.target.value)} style={INPUT_STYLE} placeholder="cth: Kilap Premium" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Nama PIC</label>
            <input value={namaPIC} onChange={e => setNamaPIC(e.target.value)} style={INPUT_STYLE} placeholder="cth: Budi Santoso" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Email Akun</label>
            <input value={emailPIC} readOnly style={{ ...INPUT_STYLE, background: '#FFF8F5', color: '#999' }} />
          </div>
        </div>
      </div>

      {/* ── 2. TARGET KPI ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>🎯 Target KPI Bulanan</SECTION_TITLE>
        <p style={{ margin: '-8px 0 14px', fontSize: 12, color: '#999' }}>Digunakan sebagai acuan performa di dashboard</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
          <div>
            <label style={LABEL_STYLE}>Target GMV (Rp)</label>
            <input type="number" value={targetGmv} onChange={e => setTargetGmv(e.target.value)} style={INPUT_STYLE} placeholder="cth: 500000000" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Target ROAS Ads (x)</label>
            <input type="number" value={targetRoas} onChange={e => setTargetRoas(e.target.value)} style={INPUT_STYLE} placeholder="cth: 5" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Target ROI Affiliate (x)</label>
            <input type="number" value={targetRoi} onChange={e => setTargetRoi(e.target.value)} style={INPUT_STYLE} placeholder="cth: 3" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Target CVR (%)</label>
            <input type="number" value={targetCvr} onChange={e => setTargetCvr(e.target.value)} style={INPUT_STYLE} placeholder="cth: 3.5" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Target Making Sales Rate (%)</label>
            <input type="number" value={targetMakingSales} onChange={e => setTargetMakingSales(e.target.value)} style={INPUT_STYLE} placeholder="cth: 30" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Maks. Cancel Rate (%)</label>
            <input type="number" value={targetCancelRate} onChange={e => setTargetCancelRate(e.target.value)} style={INPUT_STYLE} placeholder="cth: 5" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Maks. Fail to Pickup Rate (%)</label>
            <input type="number" value={targetFailPickup} onChange={e => setTargetFailPickup(e.target.value)} style={INPUT_STYLE} placeholder="cth: 3" />
          </div>
        </div>
      </div>

      {/* ── 3. THRESHOLD ANOMALI ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>⚠️ Threshold Deteksi Anomali</SECTION_TITLE>
        <p style={{ margin: '-8px 0 14px', fontSize: 12, color: '#999' }}>Sistem akan memunculkan peringatan jika melewati batas ini</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
          <div>
            <label style={LABEL_STYLE}>GMV turun lebih dari (%)</label>
            <input type="number" value={thresholdGmvDrop} onChange={e => setThresholdGmvDrop(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>ROAS turun lebih dari (%)</label>
            <input type="number" value={thresholdRoasDrop} onChange={e => setThresholdRoasDrop(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>ROAS minimum (x)</label>
            <input type="number" value={thresholdRoasMin} onChange={e => setThresholdRoasMin(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Cancel Rate maksimal (%)</label>
            <input type="number" value={thresholdCancel} onChange={e => setThresholdCancel(e.target.value)} style={INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>Fail to Pickup Rate maksimal (%)</label>
            <input type="number" value={thresholdFailPickup} onChange={e => setThresholdFailPickup(e.target.value)} style={INPUT_STYLE} />
          </div>
        </div>
      </div>

      {/* ── 4. PLATFORM AKTIF ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>🛒 Platform Marketplace Aktif</SECTION_TITLE>
        <p style={{ margin: '-8px 0 14px', fontSize: 12, color: '#999' }}>Pilih platform yang digunakan untuk berjualan</p>
        <Toggle value={platformShopee}   onChange={setPlatformShopee}   label="Shopee" />
        <Toggle value={platformTiktok}   onChange={setPlatformTiktok}   label="TikTok Shop" />
        <Toggle value={platformMeta}     onChange={setPlatformMeta}     label="Meta (Facebook/Instagram)" />
        <Toggle value={platformTokopedia} onChange={setPlatformTokopedia} label="Tokopedia" />
        <Toggle value={platformLazada}   onChange={setPlatformLazada}   label="Lazada" />
      </div>

      {/* ── 5. GANTI PASSWORD ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>🔒 Keamanan Akun</SECTION_TITLE>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <label style={LABEL_STYLE}>Password Baru</label>
            <input type="password" value={pwBaru} onChange={e => setPwBaru(e.target.value)} style={INPUT_STYLE} placeholder="Min. 6 karakter" />
          </div>
          <div>
            <label style={LABEL_STYLE}>Konfirmasi Password Baru</label>
            <input type="password" value={pwUlang} onChange={e => setPwUlang(e.target.value)} style={INPUT_STYLE} placeholder="Ulangi password baru" />
          </div>
        </div>
        <button onClick={handleGantiPassword} disabled={saving}
          style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid #FF8C00', background: '#FFF3ED', color: '#FF6B35', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Perbarui Password
        </button>
      </div>

      {/* ── 6. INFO APLIKASI ── */}
      <div style={SECTION_STYLE}>
        <SECTION_TITLE>ℹ️ Informasi Aplikasi</SECTION_TITLE>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 10 }}>
          {[
            { label: 'Nama Aplikasi', value: 'Kilap Marketplace Reporting' },
            { label: 'Versi', value: '1.0.0' },
            { label: 'Database', value: 'Supabase PostgreSQL' },
            { label: 'Hosting', value: 'Vercel' },
            { label: 'Tabel Data', value: 'ads_shopee, ads_tiktok, ads_meta, affiliate_monthly, affiliate_weekly, affiliate_paid, livestream, penjualan_harian' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 14px', background: '#FFF8F5', borderRadius: 8, border: '1px solid #FFE0CC' }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, color: '#999', fontWeight: 500 }}>{item.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#1A1A1A', fontWeight: 600 }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tombol Simpan */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button onClick={handleSimpanPengaturan} disabled={saving}
          style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#FF6B35,#FF8C00)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          {saving ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
        </button>
      </div>
    </div>
  )
}
