'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function LayoutClient({ children }) {
  const [collapsed, setCollapsed]         = useState(false)
  const [activePlatform, setActivePlatform] = useState('shopee')
  const [authChecked, setAuthChecked]     = useState(false)
  const [user, setUser]                   = useState(null)
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null)
      setAuthChecked(true)
      if (!data?.user && pathname !== '/login') {
        window.location.href = '/login'
      }
    })
  }, [pathname])

  // Halaman login — tanpa sidebar
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Belum cek auth
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#FFF8F5',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #FFE0CC',
          borderTop: '3px solid #FF6B35',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Belum login
  if (!user) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FFF8F5' }}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activePlatform={activePlatform}
        setActivePlatform={setActivePlatform}
      />
      <div style={{
        marginLeft: collapsed ? 64 : 240,
        flex: 1, minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        <Topbar />
        <main style={{ flex: 1, padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}