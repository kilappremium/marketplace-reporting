'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ShopeeAuthPage() {
  const [step, setStep] = useState(1)
  const [authUrl, setAuthUrl] = useState('')
  const [code, setCode] = useState('')
  const [shopId, setShopId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Ambil dari URL params jika ada (setelah redirect dari Shopee)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codeParam = params.get('code')
    const shopIdParam = params.get('shop_id')
    if (codeParam && shopIdParam && !code) {
      setCode(codeParam)
      setShopId(shopIdParam)
      setStep(3)
    }
  }, [code])

  async function generateAuthUrl() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/shopee-auth?action=get_url')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAuthUrl(json.auth_url)
      setStep(2)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function exchangeToken() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/shopee-auth?action=exchange_token' +
        `&code=${code}&shop_id=${shopId}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResult(json)
      setStep(4)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth:600, margin:'40px auto', fontFamily:'sans-serif', padding:'0 16px' }}>
      <div style={{ background:'linear-gradient(135deg,#FF6B35,#FF8C00)', borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff' }}>
        <p style={{ margin:0, fontSize:20, fontWeight:700 }}>🛒 Shopee API Authorization</p>
        <p style={{ margin:0, fontSize:13, opacity:0.8 }}>Generate access token untuk sinkronisasi data Shopee Ads</p>
      </div>

      {error && (
        <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:8, padding:'12px 16px', marginBottom:16, color:'#991B1B', fontSize:13 }}>
          ❌ {error}
        </div>
      )}

      {/* Step 1 */}
      {step >= 1 && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, padding:20, marginBottom:16 }}>
          <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:14, color:'#1A1A1A' }}>
            Step 1 — Generate Auth URL
          </p>
          <p style={{ margin:'0 0 16px', fontSize:13, color:'#999' }}>
            Klik tombol di bawah untuk membuat URL otorisasi Shopee
          </p>
          <button onClick={generateAuthUrl} disabled={loading || step > 1}
            style={{ padding:'10px 24px', borderRadius:8, border:'none', background: step > 1 ? '#E5E7EB' : 'linear-gradient(135deg,#FF6B35,#FF8C00)', color: step > 1 ? '#999' : '#fff', cursor: step > 1 ? 'default' : 'pointer', fontSize:13, fontWeight:600 }}>
            {loading && step === 1 ? 'Generating...' : step > 1 ? '✓ Auth URL dibuat' : 'Generate Auth URL'}
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step >= 2 && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, padding:20, marginBottom:16 }}>
          <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:14, color:'#1A1A1A' }}>
            Step 2 — Login & Authorize di Shopee
          </p>
          <p style={{ margin:'0 0 16px', fontSize:13, color:'#999' }}>
            Klik tombol di bawah → login dengan akun seller Kilap → klik Authorize
          </p>
          <a href={authUrl} target="_blank" rel="noreferrer"
            style={{ display:'inline-block', padding:'10px 24px', borderRadius:8, background:'#EE4D2D', color:'#fff', textDecoration:'none', fontSize:13, fontWeight:600, marginBottom:12 }}>
            🛒 Buka Halaman Shopee Authorization
          </a>
          <p style={{ margin:'12px 0 0', fontSize:12, color:'#999' }}>
            Setelah authorize, Shopee akan redirect ke halaman ini secara otomatis dengan code dan shop_id
          </p>
        </div>
      )}

      {/* Step 3 */}
      {step >= 3 && (
        <div style={{ background:'#fff', border:'1px solid #FFE0CC', borderRadius:12, padding:20, marginBottom:16 }}>
          <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:14, color:'#1A1A1A' }}>
            Step 3 — Exchange Code jadi Access Token
          </p>
          <div style={{ background:'#FFF8F5', borderRadius:8, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
            <p style={{ margin:'0 0 6px', color:'#666' }}>Code: <strong style={{ color:'#FF6B35', wordBreak:'break-all' }}>{code}</strong></p>
            <p style={{ margin:0, color:'#666' }}>Shop ID: <strong style={{ color:'#FF6B35' }}>{shopId}</strong></p>
          </div>
          <button onClick={exchangeToken} disabled={loading}
            style={{ padding:'10px 24px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#FF6B35,#FF8C00)', color:'#fff', cursor: loading ? 'default' : 'pointer', fontSize:13, fontWeight:600 }}>
            {loading ? 'Menukar token...' : '🔑 Exchange Token'}
          </button>
        </div>
      )}

      {/* Step 4 — Hasil */}
      {step >= 4 && result && (
        <div style={{ background:'#F0FDF4', border:'2px solid #86EFAC', borderRadius:12, padding:20 }}>
          <p style={{ margin:'0 0 16px', fontWeight:700, fontSize:14, color:'#166534' }}>
            ✅ Access Token Berhasil Didapat!
          </p>
          <p style={{ margin:'0 0 12px', fontSize:13, color:'#166534' }}>
            Simpan nilai berikut ke <strong>Vercel → Settings → Environment Variables</strong>:
          </p>
          {[
            { key:'SHOPEE_ACCESS_TOKEN',  val: result.access_token },
            { key:'SHOPEE_REFRESH_TOKEN', val: result.refresh_token },
            { key:'SHOPEE_SHOP_ID',       val: shopId },
          ].map(item => (
            <div key={item.key} style={{ marginBottom:10 }}>
              <p style={{ margin:'0 0 4px', fontSize:11, fontWeight:600, color:'#166534' }}>{item.key}</p>
              <div style={{ background:'#fff', border:'1px solid #86EFAC', borderRadius:6, padding:'8px 12px', fontSize:12, fontFamily:'monospace', wordBreak:'break-all', color:'#1A1A1A', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <span>{item.val}</span>
                <button onClick={() => navigator.clipboard.writeText(item.val)}
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:4, border:'1px solid #86EFAC', background:'#F0FDF4', color:'#166534', cursor:'pointer', flexShrink:0 }}>
                  Copy
                </button>
              </div>
            </div>
          ))}
          <div style={{ marginTop:16, padding:'12px 14px', background:'#FFF8F5', borderRadius:8, fontSize:12, color:'#FF6B35', border:'1px solid #FFE0CC' }}>
            ⚠️ Token berlaku sekitar <strong>30 hari</strong>. Setelah expire, ulangi proses ini.
          </div>
        </div>
      )}
    </div>
  )
}
