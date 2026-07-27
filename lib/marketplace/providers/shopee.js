/**
 * Shopee provider.
 * Existing Shopee routes (app/api/shopee-auth, app/api/shopee-callback) are untouched.
 */
import crypto from 'crypto'

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
  // TODO: exchange auth code for access_token and refresh_token
  return { status: 'todo', message: 'Shopee callback not implemented yet', params }
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
