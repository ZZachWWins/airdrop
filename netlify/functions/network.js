import { cached } from '../lib/cache.js'
import { NETWORK_ID, NodeUnreachableError, fetchChainTip } from '../lib/chain.js'
import { json, methodNotAllowed } from '../lib/http.js'

const TTL_MS = 10_000

/**
 * GET /api/network
 *   -> { network, online, blockHeight, blockHash, checkedAt }
 *
 * The live chain tip, read from the node the verifications are checked
 * against. Deliberately separate from /api/stats: a node hiccup should grey
 * out one badge, not take down the campaign counters with it.
 *
 * `online: false` is a normal response, not an error — the UI shows a degraded
 * state rather than an empty one, and a 200 keeps that path simple.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const tip = await cached('chain-tip', TTL_MS, async () => {
    try {
      const { height, hash, observedAt } = await fetchChainTip()
      return { online: true, blockHeight: height, blockHash: hash, checkedAt: observedAt }
    } catch (err) {
      if (err instanceof NodeUnreachableError) {
        return { online: false, blockHeight: null, blockHash: null, checkedAt: Date.now() }
      }
      throw err
    }
  })

  return json({ network: NETWORK_ID, ...tip })
}

export const config = { path: '/api/network' }
