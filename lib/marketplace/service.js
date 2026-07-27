/**
 * Marketplace service.
 * Resolves a provider by name from the registry.
 */
import registry from './registry.js'

/**
 * Returns the provider object for the given name.
 * @param {string} name - Provider name (e.g. 'shopee', 'tiktok', 'meta')
 * @returns {{ connect, callback, refreshToken, disconnect, sync }}
 * @throws {Error} If the provider is not registered
 */
export function getProvider(name) {
  if (!name) {
    throw new Error('Provider name is required.')
  }

  const provider = registry[name.toLowerCase()]

  if (!provider) {
    const available = Object.keys(registry).join(', ')
    throw new Error(
      `Provider "${name}" not found. Available providers: ${available}`
    )
  }

  return provider
}
