'use client'
import { usePathname } from 'next/navigation'

const PAGE_TITLES = {
  '/penjualan': { title: 'Dashboard Utama', sub: 'Ringkasan performa marketplace' },
  '/ads': { title: 'Performance Marketing', sub: 'Reporting Shopee Ads · TikTok Ads · Meta Ads' },
  '/affiliate': { title: 'Affiliate Reporting', sub: 'Monthly · Weekly · Paid Partnership' },
  '/livestream': { title: 'Livestream Reporting', sub: 'Performa sesi live per platform' },
  '/input': { title: 'Input Data', sub: 'Tambah data baru ke sistem' },
}

export default function Topbar() {
  const pathname = usePathname()
  const page = PAGE_TITLES[pathname] || { title: 'Kilap Reporting', sub: '' }
  const now = new Date()
  const tgl = now.toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', 
    month: 'long', day: 'numeric' 
  })

  return (
    <header style={{
      height: 60,
      background: '#fff',
      borderBottom: '1px solid #FFE0CC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 99,
      boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
          {page.title}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: '#999' }}>{page.sub}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#FFF3ED', padding: '6px 12px',
          borderRadius: 20, border: '1px solid #FFE0CC',
        }}>
          <span style={{ fontSize: 11, color: '#FF6B35' }}>📅</span>
          <span style={{ fontSize: 11, color: '#FF6B35', fontWeight: 500 }}>{tgl}</span>
        </div>

        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}>K</div>
      </div>
    </header>
  )
}