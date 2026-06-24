'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function LayoutClient({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [activePlatform, setActivePlatform] = useState('shopee')

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
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Topbar />
        <main style={{ flex: 1, padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}