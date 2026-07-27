/**
 * TikTok provider — architecture placeholder.
 * Implementation pending (OAuth, token exchange, Supabase write).
 */

export async function connect(params = {}) {
  // TODO: generate TikTok OAuth URL and return it
  return { status: 'todo', message: 'TikTok connect not implemented yet', params }
}

export async function callback(params = {}) {
  // TODO: exchange auth code for access_token
  return { status: 'todo', message: 'TikTok callback not implemented yet', params }
}

export async function refreshToken(params = {}) {
  // TODO: call TikTok token refresh endpoint
  return { status: 'todo', message: 'TikTok refreshToken not implemented yet', params }
}

export async function disconnect(params = {}) {
  // TODO: revoke token and mark connection inactive in marketplace_connections
  return { status: 'todo', message: 'TikTok disconnect not implemented yet', params }
}

export async function sync(params = {}) {
  // TODO: pull data from TikTok API and upsert into production tables
  return { status: 'todo', message: 'TikTok sync not implemented yet', params }
}
