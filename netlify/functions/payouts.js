import { isValidAddress } from '../lib/base58.js'
import { verifySignature } from '../lib/ed25519.js'
import { MAINNET_NETWORK_ID, claimPhase } from '../lib/campaign.js'
import {
  countMainnetLinks,
  getClaim,
  getVerification,
  listAllReferralEdges,
  listClaims,
  putClaim,
} from '../lib/storage.js'
import { error, json, methodNotAllowed, readJson } from '../lib/http.js'

/**
 * GET  /api/payouts   (Authorization: Bearer <ADMIN_TOKEN>)
 *   -> the payout list: every claim, its authorised mainnet address, and the
 *      eligibility data you need to size each allocation.
 *
 * POST /api/payouts   { payments: [{ testnetAddress, txId }] }
 *   -> marks claims paid, idempotently, so a distribution run can be retried
 *      without double-paying.
 *
 * Both are gated on ADMIN_TOKEN and refuse to run when it is unset.
 *
 * This endpoint deliberately does **not** send tokens. Paying out means a hot
 * key with the treasury behind it, and that does not belong in a public web
 * function — the safe shape is: export the list here, sign and broadcast from
 * wherever you keep that key, then POST the transaction ids back.
 */
export default async function handler(request) {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    return error('Payout administration is disabled. Set ADMIN_TOKEN to enable it.', 503)
  }

  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!provided || provided !== expected) return error('Unauthorized.', 401)

  if (request.method === 'GET') return listPayouts(request)
  if (request.method === 'POST') return markPaid(request)
  return methodNotAllowed('GET, POST')
}

async function listPayouts(request) {
  const url = new URL(request.url)
  const includePaid = url.searchParams.get('includePaid') === '1'
  const verifyProofs = url.searchParams.get('verify') === '1'

  const [claims, edges] = await Promise.all([listClaims(), listAllReferralEdges()])

  const referralCounts = new Map()
  for (const { referrer } of edges) {
    referralCounts.set(referrer, (referralCounts.get(referrer) ?? 0) + 1)
  }

  const selected = claims.filter((claim) => includePaid || !claim.paidAt)

  const entries = await Promise.all(
    selected.map(async (claim) => {
      const record = await getVerification(claim.testnetAddress)
      return {
        testnetAddress: claim.testnetAddress,
        mainnetAddress: claim.mainnetAddress,
        mainnetNetwork: claim.mainnetNetwork ?? MAINNET_NETWORK_ID,
        verifiedAt: record?.verifiedAt ?? null,
        testnetActivity: record?.onchain?.activity ?? null,
        verifiedAtBlock: record?.onchain?.blockHeight ?? null,
        referralCount: referralCounts.get(claim.testnetAddress) ?? 0,
        claimedAt: claim.claimedAt,
        rebindCount: claim.history?.length ?? 0,
        paidAt: claim.paidAt ?? null,
        payoutTxId: claim.payoutTxId ?? null,
        // Several testnet wallets legitimately consolidate to one mainnet
        // address; several *dozen* is worth a look before you pay.
        walletsPayingToThisAddress: await countMainnetLinks(claim.mainnetAddress),
        // Re-verified server-side on request, so the list can be trusted
        // without a separate offline pass.
        proofValid: verifyProofs
          ? verifySignature(claim.testnetAddress, claim.proof?.message, claim.proof?.signature)
          : undefined,
      }
    }),
  )

  entries.sort((a, b) => a.claimedAt - b.claimedAt)

  return json({
    phase: claimPhase(),
    mainnetNetwork: MAINNET_NETWORK_ID,
    exportedAt: new Date().toISOString(),
    totalClaims: claims.length,
    unpaid: claims.filter((claim) => !claim.paidAt).length,
    ...(verifyProofs
      ? { proofsInvalid: entries.filter((entry) => entry.proofValid === false).length }
      : {}),
    entries,
  })
}

async function markPaid(request) {
  const body = await readJson(request)
  const payments = body?.payments

  if (!Array.isArray(payments) || payments.length === 0) {
    return error('Provide a non-empty `payments` array of { testnetAddress, txId }.')
  }
  if (payments.length > 500) {
    return error('Mark at most 500 payments per request.', 413)
  }

  const results = []

  for (const payment of payments) {
    const testnetAddress = payment?.testnetAddress
    const txId = payment?.txId

    if (typeof testnetAddress !== 'string' || !isValidAddress(testnetAddress)) {
      results.push({ testnetAddress, status: 'invalid_address' })
      continue
    }
    if (typeof txId !== 'string' || !txId.trim()) {
      results.push({ testnetAddress, status: 'missing_tx_id' })
      continue
    }

    const claim = await getClaim(testnetAddress)
    if (!claim) {
      results.push({ testnetAddress, status: 'no_claim' })
      continue
    }
    if (claim.paidAt) {
      // Idempotent: re-running a distribution must not double-pay.
      results.push({
        testnetAddress,
        status: claim.payoutTxId === txId.trim() ? 'already_marked' : 'already_paid_other_tx',
        payoutTxId: claim.payoutTxId,
      })
      continue
    }

    await putClaim({ ...claim, paidAt: Date.now(), payoutTxId: txId.trim() })
    results.push({ testnetAddress, status: 'marked', payoutTxId: txId.trim() })
  }

  return json({
    marked: results.filter((result) => result.status === 'marked').length,
    results,
  })
}

export const config = { path: '/api/payouts' }
