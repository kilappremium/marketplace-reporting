/**
 * Shopee provider.
 * Existing Shopee routes (app/api/shopee-auth, app/api/shopee-callback) are untouched.
 */
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function connect(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY
  const APP_URL     = process.env.NEXT_PUBLIC_APP_URL

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }
  if (!APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set.')
  }

  const redirectUri = `${APP_URL}/api/marketplace/callback?provider=shopee`
  const path        = '/api/v2/shop/auth_partner'
  const timestamp   = Math.floor(Date.now() / 1000)
  const baseStr     = `${PARTNER_ID}${path}${timestamp}`
  const sign        = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const authUrl = (
    `https://partner.shopeemobile.com${path}` +
    `?partner_id=${PARTNER_ID}` +
    `&timestamp=${timestamp}` +
    `&sign=${sign}` +
    `&redirect=${encodeURIComponent(redirectUri)}`
  )

  return { success: true, authUrl }
}

export async function callback(params = {}) {
  const PARTNER_ID  = process.env.SHOPEE_PARTNER_ID
  const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY

  if (!PARTNER_ID || !PARTNER_KEY) {
    throw new Error('SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY is not set.')
  }

  const searchParams = params.searchParams
  const code    = searchParams?.get?.('code')    ?? searchParams?.code
  const shop_id = String(searchParams?.get?.('shop_id') ?? searchParams?.shop_id ?? '')

  if (!code || !shop_id) {
    throw new Error('code and shop_id are required.')
  }

  const path      = '/api/v2/auth/token/get'
  const timestamp = Math.floor(Date.now() / 1000)
  const baseStr   = `${PARTNER_ID}${path}${timestamp}`
  const sign      = crypto.createHmac('sha256', PARTNER_KEY).update(baseStr).digest('hex')

  const res = await fetch(
    `https://partner.shopeemobile.com${path}?partner_id=${PARTNER_ID}&timestamp=${timestamp}&sign=${sign}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        shop_id: Number(shop_id),
        partner_id: Number(PARTNER_ID),
      }),
    }
  )

  const data = await res.json()

  if (data.error && data.error !== '') {
    throw new Error(data.message || data.error || 'Shopee token exchange failed.')
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error('Shopee response missing access_token or refresh_token.')
  }

  const expireIn = Number(data.expire_in) || 0
  const tokenExpiredAt = expireIn > 0
    ? new Date(Date.now() + expireIn * 1000).toISOString()
    : null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.')
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: savedData, error } = await supabase
    .from('marketplace_connections')
    .upsert(
      {
        marketplace: 'shopee',
        shop_id,
        shop_name: shop_id,
        partner_id: String(PARTNER_ID),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_expired_at: tokenExpiredAt,
        status: 'active',
        last_error: null,
      },
      { onConflict: 'marketplace,shop_id' }
    )

    if (error) {
      console.error('SUPABASE INSERT ERROR:', error)
      throw new Error(`Failed to save marketplace connection: ${error.message}`)
  }
  
  console.log('SUPABASE SAVE SUCCESS:', {
      marketplace: 'shopee',
      shop_id,
  })
    
    return {
      success: true,
      connected: true,
      shop_id,
      savedData,
    }
}

export async function refreshToken(params = {}) {
  // TODO: call Shopee /api/v2/auth/access_token/get to refresh tokens
  return { status: 'todo', message: 'Shopee refreshToken not implemented yet', params }
}

export async function disconnect(params = {}) {
  // TODO: revoke token and mark connection inactive in marketplace_connections
  return { status: 'todo', message: 'Shopee disconnect not implemented yet', params }
}

export async function sync(params = {}) {
  // TODO: pull data from Shopee API and upsert into production tables
  return { status: 'todo', message: 'Shopee sync not implemented yet', params }
}
