/**
 * Meta provider — architecture placeholder.
 * Implementation pending (OAuth, token exchange, Supabase write).
 * Existing Meta sync route (app/api/meta-ads-sync) is untouched.
 */

export async function connect(params = {}) {
  // TODO: generate Meta OAuth URL and return it
  return { status: 'todo', message: 'Meta connect not implemented yet', params }
}

export async function callback(params = {}) {
  // TODO: exchange auth code for long-lived access_token
  return { status: 'todo', message: 'Meta callback not implemented yet', params }
}

export async function refreshToken(params = {}) {
  // TODO: exchange short-lived token for long-lived token via Meta Graph API
  return { status: 'todo', message: 'Meta refreshToken not implemented yet', params }
}

export async function disconnect(params = {}) {
  // TODO: delete app permissions and mark connection inactive in marketplace_connections
  return { status: 'todo', message: 'Meta disconnect not implemented yet', params }
}

export async function sync(params = {}) {
  // TODO: pull data from Meta Marketing API and upsert into ads_meta
  return { status: 'todo', message: 'Meta sync not implemented yet', params }
}
