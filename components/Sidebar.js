'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENU = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard Utama', href: '/penjualan', icon: '▦' },
    ]
  },
  {
    group: 'Marketing',
    items: [
      { label: 'Performance Marketing', href: '/ads', icon: '◈' },
      { label: 'Affiliate', href: '/affiliate', icon: '◉' },
      { label: 'Livestream', href: '/livestream', icon: '▶' },
    ]
  },
  {
    group: 'Lainnya',
    items: [
      { label: 'Input Data', href: '/input', icon: '✦' },
    ]
  },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname()

  return (
    <aside style={{
      width: collapsed ? 64 : 240,
      minHeight: '100vh',
      background: '#fff',
      borderRight: '1px solid #FFE0CC',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
      boxShadow: '2px 0 8px rgba(255,100,0,0.06)',
    }}>

      {/* Logo */}
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0 16px' : '0 20px',
        borderBottom: '1px solid #FFE0CC',
        gap: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#fff', fontWeight: 700, flexShrink: 0,
        }}>K</div>
        {!collapsed && (
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>KILAP</p>
            <p style={{ margin: 0, fontSize: 10, color: '#999' }}>Marketplace Reporting</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {MENU.map(group => (
          <div key={group.group} style={{ marginBottom: 4 }}>
            {!collapsed && (
              <p style={{
                margin: '8px 0 4px',
                padding: '0 20px',
                fontSize: 10,
                fontWeight: 600,
                color: '#FFAA80',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>{group.group}</p>
            )}
            {group.items.map(item => {
              const active = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: collapsed ? '10px 0' : '10px 20px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    margin: '2px 8px',
                    borderRadius: 8,
                    background: active
                      ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.background = '#FFF3ED'
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}>
                    <span style={{
                      fontSize: 16,
                      color: active ? '#fff' : '#FF6B35',
                      flexShrink: 0,
                    }}>{item.icon}</span>
                    {!collapsed && (
                      <span style={{
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        color: active ? '#fff' : '#444',
                        whiteSpace: 'nowrap',
                      }}>{item.label}</span>
                    )}
                    {active && !collapsed && (
                      <div style={{
                        marginLeft: 'auto',
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.7)',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid #FFE0CC',
      }}>
        <button onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 8,
            border: '1px solid #FFE0CC', background: '#FFF3ED',
            cursor: 'pointer', fontSize: 14, color: '#FF6B35',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
          {collapsed ? '▶' : '◀'}
          {!collapsed && <span style={{ fontSize: 12 }}>Ciutkan</span>}
        </button>
      </div>
    </aside>
  )
}