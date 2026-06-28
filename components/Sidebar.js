'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

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
      { 
        label: 'Performance Marketing', 
        href: '/ads', 
        icon: '◈',
        submenu: [
          { label: 'Shopee Ads', key: 'shopee' },
          { label: 'TikTok GMV Max', key: 'tiktok' },
          { label: 'Meta Ads', key: 'meta' },
        ]
      },
      { label: 'Affiliate', href: '/affiliate', icon: '◉' },
      { label: 'Livestream', href: '/livestream', icon: '▶' },
    ]
  },
  {
    group: 'Lainnya',
    items: [
      { label: 'Pengaturan', href: '/pengaturan', icon: '⚙' },
    ]
  },
]

const PLATFORM_COLORS = {
  shopee: { bg: '#FFF0E6', text: '#993C1D', dot: '#FF6B35' },
  tiktok: { bg: '#F0F0FF', text: '#3C3489', dot: '#6C63FF' },
  meta:   { bg: '#E6F1FB', text: '#0C447C', dot: '#1877F2' },
}

export default function Sidebar({ collapsed, setCollapsed, activePlatform, setActivePlatform }) {
  const pathname = usePathname()
  const [openSubmenu, setOpenSubmenu] = useState(
    pathname.startsWith('/ads') ? 'Performance Marketing' : null
  )
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user || null)
    )
    return () => listener?.subscription?.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleMenuClick(item) {
    if (item.submenu) {
      setOpenSubmenu(prev => 
        prev === item.label ? null : item.label
      )
    }
  }

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
              const isOpen = openSubmenu === item.label

              return (
                <div key={item.href}>
                  {/* Menu utama */}
                  {item.submenu ? (
                    <div
                      onClick={() => handleMenuClick(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: collapsed ? '10px 0' : '10px 20px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        margin: '2px 8px',
                        borderRadius: 8,
                        background: active
                          ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
                          : isOpen ? '#FFF3ED' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!active && !isOpen) e.currentTarget.style.background = '#FFF3ED'
                      }}
                      onMouseLeave={e => {
                        if (!active && !isOpen) e.currentTarget.style.background = 'transparent'
                        else if (isOpen && !active) e.currentTarget.style.background = '#FFF3ED'
                      }}>
                      <span style={{
                        fontSize: 16,
                        color: active ? '#fff' : '#FF6B35',
                        flexShrink: 0,
                      }}>{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span style={{
                            fontSize: 13,
                            fontWeight: active || isOpen ? 600 : 400,
                            color: active ? '#fff' : '#444',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}>{item.label}</span>
                          <span style={{
                            fontSize: 10,
                            color: active ? '#fff' : '#FF6B35',
                            transition: 'transform 0.2s',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            display: 'inline-block',
                          }}>▼</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <Link href={item.href} style={{ textDecoration: 'none' }}>
                      <div
                        style={{
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
                      </div>
                    </Link>
                  )}

                  {/* Submenu Platform */}
                  {item.submenu && isOpen && !collapsed && (
                    <div style={{
                      margin: '2px 8px 4px 8px',
                      borderRadius: 8,
                      background: '#FFF8F5',
                      border: '1px solid #FFE0CC',
                      overflow: 'hidden',
                    }}>
                      {item.submenu.map((sub, idx) => {
                        const pc = PLATFORM_COLORS[sub.key]
                        const isActive = activePlatform === sub.key && pathname.startsWith('/ads')
                        return (
                          <Link
                            key={sub.key}
                            href={`/ads?platform=${sub.key}`}
                            style={{ textDecoration: 'none' }}
                            onClick={() => setActivePlatform && setActivePlatform(sub.key)}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '9px 16px',
                              cursor: 'pointer',
                              background: isActive ? pc.bg : 'transparent',
                              borderBottom: idx < item.submenu.length - 1 
                                ? '1px solid #FFE0CC' : 'none',
                              transition: 'background 0.15s',
                            }}
                              onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.background = pc.bg
                              }}
                              onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.background = 'transparent'
                              }}>
                              <div style={{
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: isActive ? pc.dot : '#ccc',
                                flexShrink: 0,
                              }} />
                              <span style={{
                                fontSize: 12,
                                color: isActive ? pc.text : '#666',
                                fontWeight: isActive ? 600 : 400,
                              }}>{sub.label}</span>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {user && (
        <div style={{
          padding: collapsed ? '12px 8px' : '12px 16px',
          borderTop: '1px solid #FFE0CC',
        }}>
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', 
              gap: 10, marginBottom: 10,
              padding: '10px 12px',
              background: '#FFF8F5',
              borderRadius: 10,
              border: '1px solid #FFE0CC',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 14,
                color: '#fff', fontWeight: 700, flexShrink: 0,
              }}>
                {(user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600,
                  color: '#1A1A1A', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email?.split('@')[0]}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: '#999',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis' }}>
                  {user.email}
                </p>
              </div>
            </div>
          )}
          
          {collapsed && (
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 14,
              color: '#fff', fontWeight: 700, margin: '0 auto 8px',
              cursor: 'pointer',
            }}>
              {(user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}

          <button onClick={handleLogout}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 8,
              border: '1px solid #FFE0CC',
              background: '#fff', cursor: 'pointer',
              fontSize: 12, color: '#FF6B35',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#FFF3ED'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            {collapsed ? '↩' : '↩ Keluar'}
          </button>
        </div>
      )}

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