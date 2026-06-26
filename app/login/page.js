'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Email dan password wajib diisi!')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email, password
    })
    if (err) {
      setError('Email atau password salah. Coba lagi.')
      setLoading(false)
      return
    }
    window.location.href = '/penjualan'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FFF8F5 0%, #FFE0CC 100%)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 16,
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 28,
            color: '#fff', fontWeight: 700,
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(255,107,53,0.3)',
          }}>K</div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700,
            color: '#FF6B35' }}>KILAP</p>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            Marketplace Reporting
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 32,
          boxShadow: '0 8px 32px rgba(255,107,53,0.12)',
          border: '1px solid #FFE0CC',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: 20,
            fontWeight: 700, color: '#1A1A1A' }}>
            Masuk ke akun
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: '#999' }}>
            Gunakan email dan password yang sudah didaftarkan
          </p>

          {error && (
            <div style={{
              background: '#FEE2E2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '10px 14px',
              marginBottom: 16, fontSize: 13, color: '#DC2626',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600,
              color: '#374151', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contoh@email.com"
              style={{
                width: '100%', padding: '11px 14px',
                borderRadius: 10, fontSize: 14, color: '#1A1A1A',
                border: '1.5px solid #FFD4B8', background: '#fff',
                boxSizing: 'border-box', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#FF6B35'}
              onBlur={e => e.target.style.borderColor = '#FFD4B8'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600,
              color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
                placeholder="Masukkan password"
                style={{
                  width: '100%', padding: '11px 44px 11px 14px',
                  borderRadius: 10, fontSize: 14, color: '#1A1A1A',
                  border: '1.5px solid #FFD4B8', background: '#fff',
                  boxSizing: 'border-box', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#FF6B35'}
                onBlur={e => e.target.style.borderColor = '#FFD4B8'}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12,
                  top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 16, color: '#999',
                  padding: 0,
                }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0',
              borderRadius: 10, border: 'none',
              background: loading
                ? '#FFB899'
                : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              boxShadow: loading
                ? 'none'
                : '0 4px 12px rgba(255,107,53,0.3)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}>
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTop: '2px solid #fff',
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block',
                }} />
                Masuk...
              </>
            ) : 'Masuk →'}
          </button>

          <p style={{
            margin: '20px 0 0', textAlign: 'center',
            fontSize: 12, color: '#999',
          }}>
            Belum punya akun? Hubungi admin untuk didaftarkan.
          </p>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 11, color: '#FFB899',
        }}>
          © 2026 Kilap Marketplace Reporting
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}