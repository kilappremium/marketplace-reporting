'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

// ─── Format helpers ───────────────────────────────────────
const fmtRp  = n => (!n && n !== 0) ? 'Rp 0' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtX   = n => (!n && n !== 0) ? '0x' : Number(n).toFixed(2) + 'x'
const fmt    = n => (!n && n !== 0) ? '0' : Number(n).toLocaleString('id-ID')
const fmtPct = n => (Number(n) >= 0 ? '+' : '') + Number(n).toFixed(1) + '%'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)

// ─── Minggu helper ────────────────────────────────────────
function getWeekRange(weeksAgo = 0) {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 - weeksAgo * 7)
  monday.setHours(0,0,0,0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23,59,59,999)
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
  }
}

export default function DashboardPage() {
  const [loading, setLoading]       = useState(true)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiText, setAiText]         = useState('')
  const [aiError, setAiError]       = useState('')
  const [periode, setPeriode]       = useState('minggu')

  // Data states
  const [weeklyAffiliate, setWeeklyAffiliate]   = useState([])
  const [prevWeekAffiliate, setPrevWeekAffiliate] = useState([])
  const [weeklyAds, setWeeklyAds]               = useState({ shopee:[], tiktok:[], meta:[] })
  const [prevAds, setPrevAds]                   = useState({ shopee:[], tiktok:[], meta:[] })
  const [weeklyLive, setWeeklyLive]             = useState([])
  const [prevLive, setPrevLive]                 = useState([])
  const [grafikData, setGrafikData]             = useState([])

  const thisWeek = getWeekRange(0)
  const lastWeek = getWeekRange(1)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const tahun = new Date().getFullYear()

    // Fetch affiliate weekly
    const { data: affAll } = await supabase
      .from('affiliate_weekly')
      .select('*')
      .gte('tanggal', `${tahun}-01-01`)
      .order('tanggal', { ascending: false })

    // Fetch ads semua platform
    const [shopeeRes, tiktokRes, metaRes] = await Promise.all([
      supabase.from('ads_shopee').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_tiktok').select('*').gte('tanggal',`${tahun}-01-01`),
      supabase.from('ads_meta').select('*').gte('tanggal',`${tahun}-01-01`),
    ])

    // Fetch livestream
    const { data: liveAll } = await supabase
      .from('livestream')
      .select('*')
      .gte('tanggal',`${tahun}-01-01`)
      .order('tanggal', { ascending: false })

    const allAff  = affAll || []
    const allLive = liveAll || []
    const allAds  = {
      shopee: shopeeRes.data || [],
      tiktok: tiktokRes.data || [],
      meta:   metaRes.data   || [],
    }

    // Filter minggu ini & minggu lalu
    const filterWeek = (arr, range) =>
      arr.filter(r => r.tanggal >= range.from && r.tanggal <= range.to)

    setWeeklyAffiliate(filterWeek(allAff, thisWeek))
    setPrevWeekAffiliate(filterWeek(allAff, lastWeek))
    setWeeklyLive(filterWeek(allLive, thisWeek))
    setPrevLive(filterWeek(allLive, lastWeek))

    const filterAdsWeek = (ads, range) => ({
      shopee: filterWeek(ads.shopee, range),
      tiktok: filterWeek(ads.tiktok, range),
      meta:   filterWeek(ads.meta, range),
    })
    setWeeklyAds(filterAdsWeek(allAds, thisWeek))
    setPrevAds(filterAdsWeek(allAds, lastWeek))

    // Grafik tren 8 minggu terakhir
    const grafikWeeks = Array.from({length:8}, (_,i) => {
      const range = getWeekRange(7 - i)
      const d = new Date(range.from)
      const startOfYear = new Date(d.getFullYear(), 0, 1)
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      const affData = filterWeek(allAff, range)
      const liveData = filterWeek(allLive, range)
      const adsShopee = filterWeek(allAds.shopee, range)
      const adsTiktok = filterWeek(allAds.tiktok, range)
      const adsMeta = filterWeek(allAds.meta, range)
      return {
        label: `W${weekNum}`,
        gmv_affiliate: sum(affData, 'gmv'),
        gmv_live: sum(liveData, 'gmv'),
        biaya_ads: sum(adsShopee,'biaya_iklan') + sum(adsTiktok,'biaya_iklan') + sum(adsMeta,'biaya_iklan'),
        omzet_ads: sum(adsShopee,'omzet') + sum(adsTiktok,'omzet') + sum(adsMeta,'omzet'),
      }
    })
    setGrafikData(grafikWeeks)
    setLoading(false)
  }

  // ─── Kalkulasi metrics ────────────────────────────────
  // GMV total minggu ini
  const gmvAff  = sum(weeklyAffiliate, 'gmv')
  const gmvLive = sum(weeklyLive, 'gmv')
  const gmvAdsShopee = sum(weeklyAds.shopee, 'omzet')
  const gmvAdsTiktok = sum(weeklyAds.tiktok, 'omzet')
  const gmvAdsMeta   = sum(weeklyAds.meta, 'omzet')
  const totalGmv = gmvAff + gmvLive

  // GMV minggu lalu
  const prevGmvAff  = sum(prevWeekAffiliate, 'gmv')
  const prevGmvLive = sum(prevLive, 'gmv')
  const prevTotalGmv = prevGmvAff + prevGmvLive

  // Total pesanan
  const totalPesanan = sum(weeklyAffiliate,'pesanan') + sum(weeklyLive,'pesanan')
  const prevPesanan  = sum(prevWeekAffiliate,'pesanan') + sum(prevLive,'pesanan')

  // Total biaya iklan
  const totalBiayaAds = sum(weeklyAds.shopee,'biaya_iklan') +
    sum(weeklyAds.tiktok,'biaya_iklan') + sum(weeklyAds.meta,'biaya_iklan')
  const prevBiayaAds  = sum(prevAds.shopee,'biaya_iklan') +
    sum(prevAds.tiktok,'biaya_iklan') + sum(prevAds.meta,'biaya_iklan')

  // Total omzet dari ads
  const totalOmzetAds = gmvAdsShopee + gmvAdsTiktok + gmvAdsMeta
  const roas = totalBiayaAds > 0 ? totalOmzetAds / totalBiayaAds : 0
  const prevOmzetAds = sum(prevAds.shopee,'omzet') + sum(prevAds.tiktok,'omzet') + sum(prevAds.meta,'omzet')
  const prevRoas = prevBiayaAds > 0 ? prevOmzetAds / prevBiayaAds : 0

  // Sesi livestream
  const totalSesiLive = weeklyLive.length
  const prevSesiLive  = prevLive.length

  // Growth helper
  const growth = (curr, prev) => prev > 0 ? ((curr - prev) / prev * 100) : 0

  const growthGmv     = growth(totalGmv, prevTotalGmv)
  const growthPesanan = growth(totalPesanan, prevPesanan)
  const growthBiaya   = growth(totalBiayaAds, prevBiayaAds)
  const growthRoas    = growth(roas, prevRoas)
  const growthLive    = growth(totalSesiLive, prevSesiLive)

  // ─── Anomali detection ────────────────────────────────
  const anomali = []
  if (growthGmv < -10) anomali.push(`GMV turun ${Math.abs(growthGmv).toFixed(1)}% vs minggu lalu`)
  if (growthPesanan < -10) anomali.push(`Pesanan turun ${Math.abs(growthPesanan).toFixed(1)}% vs minggu lalu`)
  if (growthRoas < -15) anomali.push(`ROAS ads turun ${Math.abs(growthRoas).toFixed(1)}% — review kampanye iklan`)
  if (roas < 2 && totalBiayaAds > 0) anomali.push(`ROAS di bawah 2x — efisiensi iklan perlu dievaluasi`)
  if (totalSesiLive === 0) anomali.push(`Tidak ada sesi livestream minggu ini`)

  // ─── Revenue per channel ──────────────────────────────
  const channelData = [
    { channel: 'Affiliate', gmv: gmvAff, color: '#FF6B35' },
    { channel: 'Livestream', gmv: gmvLive, color: '#FF8C00' },
    { channel: 'Ads', gmv: totalOmzetAds, color: '#FFB347' },
  ].filter(c => c.gmv > 0).sort((a,b) => b.gmv - a.gmv)

  const totalChannel = channelData.reduce((a,b) => a + b.gmv, 0)

  // ─── Tanggal ──────────────────────────────────────────
  const today = new Date().toLocaleDateString('id-ID', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  // ─── AI Analysis ─────────────────────────────────────
  async function generateAI() {
    setAiLoading(true)
    setAiText('')
    setAiError('')

    const konteks = `
Kamu adalah analis performa marketplace e-commerce yang berpengalaman.
Berikan analisis singkat dan actionable dalam Bahasa Indonesia.
Format: paragraf pendek, gunakan bold untuk angka penting.
Maksimal 4 paragraf.

Data performa minggu ini (${thisWeek.from} s/d ${thisWeek.to}):

RINGKASAN METRIK:
- Total GMV: Rp ${totalGmv.toLocaleString('id-ID')} (${growthGmv >= 0 ? '+' : ''}${growthGmv.toFixed(1)}% vs minggu lalu)
- Total Pesanan: ${totalPesanan.toLocaleString('id-ID')} (${growthPesanan >= 0 ? '+' : ''}${growthPesanan.toFixed(1)}% vs minggu lalu)
- Total Biaya Iklan: Rp ${totalBiayaAds.toLocaleString('id-ID')} (${growthBiaya >= 0 ? '+' : ''}${growthBiaya.toFixed(1)}% vs minggu lalu)
- ROAS: ${roas.toFixed(2)}x (${growthRoas >= 0 ? '+' : ''}${growthRoas.toFixed(1)}% vs minggu lalu)
- Sesi Livestream: ${totalSesiLive} sesi (${growthLive >= 0 ? '+' : ''}${growthLive.toFixed(1)}% vs minggu lalu)

GMV PER CHANNEL:
- Affiliate: Rp ${gmvAff.toLocaleString('id-ID')}
- Livestream: Rp ${gmvLive.toLocaleString('id-ID')}
- Omzet dari Ads: Rp ${totalOmzetAds.toLocaleString('id-ID')}

BIAYA ADS PER PLATFORM:
- Shopee Ads: Rp ${sum(weeklyAds.shopee,'biaya_iklan').toLocaleString('id-ID')} → Omzet Rp ${gmvAdsShopee.toLocaleString('id-ID')}
- TikTok GMV Max: Rp ${sum(weeklyAds.tiktok,'biaya_iklan').toLocaleString('id-ID')} → Omzet Rp ${gmvAdsTiktok.toLocaleString('id-ID')}
- Meta Ads: Rp ${sum(weeklyAds.meta,'biaya_iklan').toLocaleString('id-ID')} → Omzet Rp ${gmvAdsMeta.toLocaleString('id-ID')}

${anomali.length > 0 ? 'ANOMALI TERDETEKSI:\n' + anomali.map(a => '- ' + a).join('\n') : 'Tidak ada anomali signifikan.'}

Berikan:
1. Ringkasan performa minggu ini (1 paragraf)
2. Temuan penting / anomali yang perlu diperhatikan (1 paragraf)  
3. Rekomendasi actionable untuk minggu depan (1-2 paragraf)
    `

    try {
      const res = await fetch('/api/ai-analysis', {
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

  // ─── Komponen GrowthBadge ─────────────────────────────
  function GrowthBadge({ value }) {
    const up = value >= 0
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px',
        borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 3,
        background: up ? '#DCFCE7' : '#FEE2E2',
        color: up ? '#166534' : '#991B1B',
      }}>
        {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}% vs minggu lalu
      </span>
    )
  }

  // ─── Komponen MetricCard ──────────────────────────────
  function MetricCard({ label, value, growth, prefix, highlight }) {
    return (
      <div style={{
        background: highlight
          ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
          : '#fff',
        border: highlight ? 'none' : '1px solid #FFE0CC',
        borderRadius: 12, padding: '18px 20px',
        boxShadow: '0 2px 8px rgba(255,100,0,0.08)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,100,0,0.15)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(255,100,0,0.08)'
        }}>
        <p style={{
          margin: '0 0 6px', fontSize: 12, fontWeight: 500,
          color: highlight ? 'rgba(255,255,255,0.8)' : '#999'
        }}>{label}</p>
        <p style={{
          margin: '0 0 10px', fontSize: 24, fontWeight: 700,
          color: highlight ? '#fff' : '#1A1A1A', lineHeight: 1.2,
        }}>{value}</p>
        {growth !== undefined && (
          <GrowthBadge value={growth} />
        )}
      </div>
    )
  }

  const fmtAxis = v => {
    if (v >= 1000000000) return (v/1000000000).toFixed(1) + 'M'
    if (v >= 1000000) return (v/1000000).toFixed(0) + 'jt'
    if (v >= 1000) return (v/1000).toFixed(0) + 'rb'
    return v
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
            Dashboard Utama
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#999' }}>
            📅 {today} · Minggu {thisWeek.from} s/d {thisWeek.to}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            background: '#FFF3ED', border: '1px solid #FFE0CC',
            borderRadius: 8, padding: '6px 12px', fontSize: 12,
            color: '#FF6B35', fontWeight: 500,
          }}>
            🔄 Auto-refresh setiap buka halaman
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid #FFE0CC',
            borderTop: '3px solid #FF6B35',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#999', fontSize: 14 }}>Memuat data dashboard...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <>
          {/* ── ANOMALI ALERT ── */}
          {anomali.length > 0 && (
            <div style={{
              background: '#FFF8F0', border: '1px solid #FFD4B8',
              borderLeft: '4px solid #FF6B35',
              borderRadius: 10, padding: '14px 18px', marginBottom: 20,
            }}>
              <p style={{ margin: '0 0 8px', fontWeight: 700,
                fontSize: 13, color: '#FF6B35' }}>
                ⚠️ Perhatian — {anomali.length} anomali terdeteksi
              </p>
              {anomali.map((a, i) => (
                <p key={i} style={{ margin: '2px 0', fontSize: 13, color: '#664400' }}>
                  • {a}
                </p>
              ))}
            </div>
          )}

          {/* ── SUMMARY CARDS ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14, marginBottom: 24,
          }}>
            <MetricCard
              label="Total GMV Minggu Ini"
              value={fmtRp(totalGmv)}
              growth={growthGmv}
              highlight={true}
            />
            <MetricCard
              label="Total Pesanan"
              value={fmt(totalPesanan)}
              growth={growthPesanan}
            />
            <MetricCard
              label="Total Biaya Iklan"
              value={fmtRp(totalBiayaAds)}
              growth={growthBiaya}
            />
            <MetricCard
              label="ROAS Keseluruhan"
              value={fmtX(roas)}
              growth={growthRoas}
            />
            <MetricCard
              label="Sesi Livestream"
              value={fmt(totalSesiLive) + ' sesi'}
              growth={growthLive}
            />
          </div>

          {/* ── AI ANALYSIS ── */}
          <div style={{
            background: '#fff', border: '1px solid #FFE0CC',
            borderRadius: 12, padding: 20, marginBottom: 24,
            boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16,
                }}>✦</div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>
                    Ringkasan AI — Minggu ini
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                    Analisis otomatis berdasarkan data aktual
                  </p>
                </div>
              </div>
              <button onClick={generateAI} disabled={aiLoading}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13,
                  fontWeight: 600, cursor: aiLoading ? 'default' : 'pointer',
                  border: 'none',
                  background: aiLoading
                    ? '#FFE0CC'
                    : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
                  color: aiLoading ? '#FFB899' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {aiLoading ? (
                  <>
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid #FFB899',
                      borderTop: '2px solid #FF6B35',
                      animation: 'spin 1s linear infinite',
                      display: 'inline-block',
                    }} />
                    Menganalisis...
                  </>
                ) : (
                  <>✦ {aiText ? 'Perbarui' : 'Generate'} Analisis</>
                )}
              </button>
            </div>

            {aiError && (
              <p style={{ color: '#DC2626', fontSize: 13 }}>{aiError}</p>
            )}

            {!aiText && !aiLoading && (
              <div style={{
                textAlign: 'center', padding: '32px 0',
                border: '1px dashed #FFD4B8', borderRadius: 10,
                background: '#FFF8F5',
              }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>✦</p>
                <p style={{ fontSize: 14, color: '#999', margin: '0 0 4px' }}>
                  Klik "Generate Analisis" untuk mendapatkan
                </p>
                <p style={{ fontSize: 13, color: '#FFB899', margin: 0 }}>
                  ringkasan performa, deteksi anomali & rekomendasi dari AI
                </p>
              </div>
            )}

            {aiText && (
              <div style={{
                fontSize: 14, lineHeight: 1.7, color: '#374151',
                background: '#FFF8F5', borderRadius: 10,
                padding: '16px 20px', border: '1px solid #FFE0CC',
              }}
                dangerouslySetInnerHTML={{
                  __html: aiText
                    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FF6B35">$1</strong>')
                    .replace(/\n\n/g, '</p><p style="margin:0 0 10px">')
                    .replace(/\n/g, '<br/>')
                    .replace(/^/, '<p style="margin:0 0 10px">')
                    .replace(/$/, '</p>')
                }}
              />
            )}
          </div>

          {/* ── GRAFIK TREN 8 MINGGU ── */}
          <div style={{
            background: '#fff', border: '1px solid #FFE0CC',
            borderRadius: 12, padding: 20, marginBottom: 24,
            boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
          }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700,
              fontSize: 14, color: '#1A1A1A' }}>
              Tren GMV — 8 Minggu Terakhir
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#999' }}>
              Affiliate · Livestream · Biaya Ads
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={grafikData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFF3ED" />
                <XAxis dataKey="label"
                  tick={{ fontSize: 11, fill: '#999' }}
                  tickLine={false}
                  axisLine={{ stroke: '#FFE0CC' }} />
                <YAxis tickFormatter={fmtAxis}
                  tick={{ fontSize: 11, fill: '#999' }}
                  tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  formatter={(v, name) => [
                    'Rp ' + Number(v).toLocaleString('id-ID'),
                    name === 'gmv_affiliate' ? 'GMV Affiliate'
                      : name === 'gmv_live' ? 'GMV Livestream'
                      : name === 'biaya_ads' ? 'Biaya Ads'
                      : 'Omzet Ads'
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8,
                    border: '1px solid #FFE0CC' }}
                />
                <Legend formatter={v =>
                  v === 'gmv_affiliate' ? 'GMV Affiliate'
                    : v === 'gmv_live' ? 'GMV Livestream'
                    : v === 'biaya_ads' ? 'Biaya Ads' : 'Omzet Ads'
                } />
                <Line type="monotone" dataKey="gmv_affiliate"
                  stroke="#FF6B35" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FF6B35', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="gmv_live"
                  stroke="#FF8C00" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#FF8C00', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="biaya_ads"
                  stroke="#DC2626" strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: '#DC2626', strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── REVENUE PER CHANNEL ── */}
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))',
            gap: 16, marginBottom: 24 }}>

            {/* Revenue per channel */}
            <div style={{
              background: '#fff', border: '1px solid #FFE0CC',
              borderRadius: 12, padding: 20,
              boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
            }}>
              <p style={{ margin: '0 0 16px', fontWeight: 700,
                fontSize: 14, color: '#1A1A1A' }}>
                Revenue per Channel
              </p>
              {totalChannel === 0 ? (
                <p style={{ color: '#999', fontSize: 13 }}>Belum ada data minggu ini</p>
              ) : (
                channelData.map(ch => {
                  const pct = totalChannel > 0 ? ch.gmv / totalChannel * 100 : 0
                  return (
                    <div key={ch.channel} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex',
                        justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#374151',
                          fontWeight: 500 }}>{ch.channel}</span>
                        <span style={{ fontSize: 13, fontWeight: 700,
                          color: '#1A1A1A' }}>{fmtRp(ch.gmv)}</span>
                      </div>
                      <div style={{ height: 8, background: '#FFF3ED',
                        borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: pct + '%',
                          background: ch.color,
                          borderRadius: 10,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 11,
                        color: '#999' }}>{pct.toFixed(1)}% dari total</p>
                    </div>
                  )
                })
              )}
            </div>

            {/* Biaya ads per platform */}
            <div style={{
              background: '#fff', border: '1px solid #FFE0CC',
              borderRadius: 12, padding: 20,
              boxShadow: '0 2px 8px rgba(255,100,0,0.06)',
            }}>
              <p style={{ margin: '0 0 16px', fontWeight: 700,
                fontSize: 14, color: '#1A1A1A' }}>
                Biaya & ROAS per Platform Ads
              </p>
              {[
                { label: 'Shopee Ads',
                  biaya: sum(weeklyAds.shopee,'biaya_iklan'),
                  omzet: gmvAdsShopee,
                  color: '#FF6B35' },
                { label: 'TikTok GMV Max',
                  biaya: sum(weeklyAds.tiktok,'biaya_iklan'),
                  omzet: gmvAdsTiktok,
                  color: '#6C63FF' },
                { label: 'Meta Ads',
                  biaya: sum(weeklyAds.meta,'biaya_iklan'),
                  omzet: gmvAdsMeta,
                  color: '#1877F2' },
              ].map(p => {
                const roasP = p.biaya > 0 ? p.omzet / p.biaya : 0
                return (
                  <div key={p.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', padding: '10px 0',
                    borderBottom: '1px solid #FFF3ED',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: p.color, flexShrink: 0,
                      }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13,
                          fontWeight: 500, color: '#1A1A1A' }}>
                          {p.label}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: '#999' }}>
                          Biaya: {fmtRp(p.biaya)}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700,
                        color: roasP >= 3 ? '#166534'
                          : roasP >= 2 ? '#854D0E' : '#991B1B' }}>
                        {roasP > 0 ? roasP.toFixed(2) + 'x' : '-'}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#999' }}>ROAS</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}