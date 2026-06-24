'use client'
import { useState } from 'react'
import { Geist } from 'next/font/google'
import './globals.css'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const geist = Geist({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <html lang="id">
      <body className={geist.className} style={{ margin: 0, background: '#FFF8F5' }}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <div style={{
          marginLeft: collapsed ? 64 : 240,
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
      </body>
    </html>
  )
}