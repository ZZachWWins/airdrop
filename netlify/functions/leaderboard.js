import { cached } from '../lib/cache.js'
import { maskAddress } from '../lib/campaign.js'
import { listAllReferralEdges, verificationsStore } from '../lib/storage.js'
import { json, methodNotAllowed } from '../lib/http.js'

const TTL_MS = 60_000
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 25

/**
 * GET /api/leaderboard?limit=25
 *   -> { entries: [{ rank, address, referralCount, verifiedAt }] }
 *
 * Built from the referral edge list — one listing, then a read only for the
 * addresses that actually make the top N. Addresses are masked: the board is a
 * public page, and a full wallet next to a large referral count is a target.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const requested = Number(new URL(request.url).searchParams.get('limit'))
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const ranked = await cached(`leaderboard:${limit}`, TTL_MS, async () => {
    const edges = await listAllReferralEdges()

    const counts = new Map()
    for (const { referrer } of edges) {
      counts.set(referrer, (counts.get(referrer) ?? 0) + 1)
    }

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)

    const store = verificationsStore()
    return Promise.all(
      top.map(async ([address, referralCount], index) => {
        const record = await store.get(address, { type: 'json' }).catch(() => null)
        return {
          rank: index + 1,
          address: maskAddress(address),
          referralCount,
          verifiedAt: record?.verifiedAt ?? null,
          activity: record?.onchain?.activity ?? 'new',
        }
      }),
    )
  })

  return json({ entries: ranked })
}

export const config = { path: '/api/leaderboard' }
