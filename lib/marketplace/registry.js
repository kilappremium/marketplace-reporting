/**
 * Provider registry.
 * Add new providers here as they are built.
 */
import * as shopee from './providers/shopee.js'
import * as tiktok from './providers/tiktok.js'
import * as meta   from './providers/meta.js'

const registry = {
  shopee,
  tiktok,
  meta,
}

export default registry
