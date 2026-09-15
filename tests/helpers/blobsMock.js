/**
 * In-memory stand-in for @netlify/blobs, with the same surface the app uses.
 * Lets the function handlers run for real in tests without a Netlify context.
 */

const stores = new Map()

function storeFor(name) {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)
}

export function resetBlobs() {
  stores.clear()
}

/** Everything currently held, for assertions that reach past the HTTP layer. */
export function dumpStore(name) {
  return Object.fromEntries(storeFor(name))
}

export function getStore(options) {
  const name = typeof options === 'string' ? options : options.name
  const data = storeFor(name)

  return {
    async get(key, opts = {}) {
      if (!data.has(key)) return null
      const value = data.get(key)
      return opts.type === 'json' ? JSON.parse(value) : value
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value))
    },
    async set(key, value) {
      data.set(key, String(value))
    },
    async delete(key) {
      data.delete(key)
    },
    async list({ prefix } = {}) {
      const keys = [...data.keys()].filter((key) => !prefix || key.startsWith(prefix))
      return { blobs: keys.map((key) => ({ key, etag: `"${key}"` })) }
    },
  }
}
