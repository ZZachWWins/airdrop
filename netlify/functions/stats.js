import { cached } from '../lib/cache.js'
import { NETWORK_ID } from '../lib/chain.js'
import { MAINNET_NETWORK_ID, claimPhase } from '../lib/campaign.js'
import {
  countVerifications,
  listAllReferralEdges,
  listVerifications,
} from '../lib/storage.js'
import { json, methodNotAllowed } from '../lib/http.js'

const HEADLINE_TTL_MS = 15_000
const BREAKDOWN_TTL_MS = 60_000

/**
 * GET /api/stats
 *   -> { network, totalVerified, totalReferrals, activity, verifiedLast24h }
 *
 * The two headline numbers come from key listings — one call each, no per-blob
 * reads — so they stay cheap as the campaign grows. The activity breakdown
 * does read every record, so it is cached harder and treated as a nice-to-have.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const [totalVerified, totalReferrals] = await cached('headline', HEADLINE_TTL_MS, async () =>
    Promise.all([countVerifications(), listAllReferralEdges().then((edges) => edges.length)]),
  )

  const breakdown = await cached('breakdown', BREAKDOWN_TTL_MS, async () => {
    const records = await listVerifications()
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000

    const activity = { new: 0, funded: 0, active: 0 }
    let verifiedLast24h = 0

    for (const record of records) {
      const tier = record.onchain?.activity
      if (tier && tier in activity) activity[tier] += 1
      if ((record.verifiedAt ?? 0) > dayAgo) verifiedLast24h += 1
    }

    return { activity, verifiedLast24h }
  })

  return json({
    network: NETWORK_ID,
    // Drives whether the app shows the claim route at all, so the frontend
    // never has to be redeployed to open or close the window.
    claimPhase: claimPhase(),
    mainnetNetwork: MAINNET_NETWORK_ID,
    totalVerified,
    totalReferrals,
    ...breakdown,
  })
}

export const config = { path: '/api/stats' }
