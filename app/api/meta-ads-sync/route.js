import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const META_AD_ACCOUNT_ID = process.env.act_3652029991679722 // act_3652029991679722
const META_ACCESS_TOKEN  = process.env.EAAd4Sxlgbu0BRxgZAp5lYDR6atqcR4ZC5Nny6VqQh8KGjjjIZAZBiBuzZCDDsPLCuYmbwI1qr8ON3HC4RbNFMh15Hf5MUotmZAhsZANYNCRYNzjtM4uSGZCy9MWQZAgQjTJ0mOtXjiElNS3qwZBqNqFz5dGMLO4bJZCbMX3OryaEtNtvXGGf8ZCun1vzZCZCM5IfiFenFB9IMnyXuTZALlWPcV8cW0gk7UIiJY3il5ilQjcRLMGZCZAJ7mh7diSK4xVoaHLoCzsgcewJuB0si3ukZD

// Metrik yang di-fetch dari Meta Ads API
const FIELDS = [
  'campaign_name',
  'adset_name',
  'impressions',
  'clicks',
  'ctr',
  'cpc',
  'spend',
  'reach',
  'actions',
  'action_values',
  'cost_per_action_type',
].join(',')

function extractAction(actions, actionType) {
  if (!actions) return 0
  const found = actions.find(a => a.action_type === actionType)
  return found ? Number(found.value) || 0 : 0
}

export async function POST(request) {
  try {
    const { tanggal_start, tanggal_end } = await request.json()

    if (!META_ACCESS_TOKEN) {
      return Response.json({ error: 'META_ACCESS_TOKEN tidak ditemukan' }, { status: 500 })
    }
    if (!META_AD_ACCOUNT_ID) {
      return Response.json({ error: 'META_AD_ACCOUNT_ID tidak ditemukan' }, { status: 500 })
    }

    const dateStart = tanggal_start || new Date().toISOString().split('T')[0]
    const dateEnd   = tanggal_end   || new Date().toISOString().split('T')[0]

    // Fetch dari Meta Ads API
    const url = `https://graph.facebook.com/v21.0/${META_AD_ACCOUNT_ID}/insights?` +
      `fields=${FIELDS}` +
      `&time_range={"since":"${dateStart}","until":"${dateEnd}"}` +
      `&time_increment=1` +
      `&level=campaign` +
      `&limit=100` +
      `&access_token=${META_ACCESS_TOKEN}`

    const res  = await fetch(url)
    const json = await res.json()

    if (json.error) {
      return Response.json({
        error: json.error.message,
        full_response: json,
      }, { status: 400 })
    }

    const rows = json.data || []

    if (rows.length === 0) {
      return Response.json({ message: 'Tidak ada data pada periode ini', count: 0 })
    }

    // Mapping ke schema tabel ads_meta
    const payload = rows.map(row => {
      const biaya     = Number(row.spend)       || 0
      const impresi   = Number(row.impressions) || 0
      const klik      = Number(row.clicks)      || 0
      const pesanan   = extractAction(row.actions, 'purchase')
      const atc       = extractAction(row.actions, 'add_to_cart')
      const viewPage  = extractAction(row.actions, 'view_content')
      const omzet     = extractAction(row.action_values, 'purchase')

      const ctr          = impresi > 0 ? (klik / impresi * 100)     : 0
      const cpc          = klik    > 0 ? (biaya / klik)              : 0
      const cpm          = impresi > 0 ? (biaya / impresi * 1000)    : 0
      const cvr          = klik    > 0 ? (pesanan / klik * 100)      : 0
      const roi          = biaya   > 0 ? (omzet / biaya)             : 0
      const cpa          = pesanan > 0 ? (biaya / pesanan)           : 0
      const aov          = pesanan > 0 ? (omzet / pesanan)           : 0
      const rasio_atc    = klik    > 0 ? (atc / klik * 100)          : 0
      const view_page_rate = klik  > 0 ? (viewPage / klik * 100)     : 0

      return {
        tanggal:        row.date_start,
        nama_kampanye:  row.campaign_name || '',
        status:         'aktif',
        impresi:        Math.round(impresi),
        klik:           Math.round(klik),
        ctr:            Number(ctr.toFixed(2)),
        cpc:            Number(cpc.toFixed(0)),
        cpm:            Number(cpm.toFixed(0)),
        view_page:      Math.round(viewPage),
        view_page_rate: Number(view_page_rate.toFixed(2)),
        atc:            Math.round(atc),
        rasio_atc:      Number(rasio_atc.toFixed(2)),
        pesanan:        Math.round(pesanan),
        cvr:            Number(cvr.toFixed(2)),
        biaya_iklan:    Number(biaya.toFixed(0)),
        omzet:          Number(omzet.toFixed(0)),
        roi:            Number(roi.toFixed(2)),
        cpa:            Number(cpa.toFixed(0)),
        aov:            Number(aov.toFixed(0)),
      }
    })

    // Upsert ke Supabase — kalau tanggal + nama_kampanye sama, update bukan insert baru
    const { error, count } = await supabase
      .from('ads_meta')
      .upsert(payload, {
        onConflict: 'tanggal,nama_kampanye',
        ignoreDuplicates: false,
      })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({
      success: true,
      message: `${payload.length} kampanye berhasil disinkronkan`,
      periode: `${dateStart} s/d ${dateEnd}`,
      count: payload.length,
    })

  } catch (err) {
    return Response.json({ error: 'Server error: ' + err.message }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    status: 'Meta Ads Sync API aktif',
    meta_token_exists:      !!process.env.META_ACCESS_TOKEN,
    meta_account_id_exists: !!process.env.META_AD_ACCOUNT_ID,
  })
}