import { NETWORK_ID } from '../lib/chain.js'
import { MAINNET_NETWORK_ID } from '../lib/campaign.js'
import { getClaim, listAllReferralEdges, listVerifications } from '../lib/storage.js'
import { error, json, methodNotAllowed } from '../lib/http.js'

/**
 * GET /api/export        (Authorization: Bearer <ADMIN_TOKEN>)
 *   -> the full verification registry
 *
 * This is the artefact the whole campaign exists to produce: the snapshot that
 * becomes the mainnet claim list. It returns *unmasked* addresses and the
 * signature proof for each record, so it is gated on ADMIN_TOKEN and disabled
 * outright when that variable is unset — an export endpoint that defaults to
 * open is how a registry leaks.
 *
 * `?proof=1` includes the signed message and signature for each record, for
 * independently re-verifying the list offline before minting anything.
 */
export default async function handler(request) {
  if (request.method !== 'GET') return methodNotAllowed('GET')

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return error('Export is disabled. Set ADMIN_TOKEN to enable it.', 503)
  }

  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!provided || provided !== expected) {
    return error('Unauthorized.', 401)
  }

  const url = new URL(request.url)
  const includeProof = url.searchParams.get('proof') === '1'

  const [records, edges] = await Promise.all([listVerifications(), listAllReferralEdges()])

  const referralCounts = new Map()
  for (const { referrer } of edges) {
    referralCounts.set(referrer, (referralCounts.get(referrer) ?? 0) + 1)
  }

  const entries = (
    await Promise.all(
      records.map(async (record) => {
        const claim = await getClaim(record.address)
        return {
          address: record.address,
          verifiedAt: record.verifiedAt,
          network: record.network,
          inviteCode: record.inviteCode,
          referredByCode: record.referredByCode ?? null,
          referredByAddress: record.referredByAddress ?? null,
          referralCount: referralCounts.get(record.address) ?? 0,
          onchain: record.onchain,
          // The mainnet payout binding, once the holder has authorised one.
          mainnetAddress: claim?.mainnetAddress ?? null,
          claimedAt: claim?.claimedAt ?? null,
          paidAt: claim?.paidAt ?? null,
          payoutTxId: claim?.payoutTxId ?? null,
          ...(includeProof
            ? { proof: record.proof, claimProof: claim?.proof ?? null }
            : {}),
        }
      }),
    )
  ).sort((a, b) => a.verifiedAt - b.verifiedAt)

  return json({
    network: NETWORK_ID,
    mainnetNetwork: MAINNET_NETWORK_ID,
    exportedAt: new Date().toISOString(),
    totalVerified: entries.length,
    totalReferrals: edges.length,
    totalClaimed: entries.filter((entry) => entry.mainnetAddress).length,
    entries,
  })
}

export const config = { path: '/api/export' }
