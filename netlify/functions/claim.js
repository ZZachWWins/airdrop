import { isValidAddress } from '../lib/base58.js'
import { verifySignature } from '../lib/ed25519.js'
import {
  MAINNET_NETWORK_ID,
  NONCE_TTL_MS,
  PURPOSE,
  claimPhase,
  toPublicClaim,
} from '../lib/campaign.js'
import {
  burnNonce,
  countMainnetLinks,
  getClaim,
  getVerification,
  linkMainnetAddress,
  peekNonce,
  putClaim,
  unlinkMainnetAddress,
} from '../lib/storage.js'
import { error, json, methodNotAllowed, readJson } from '../lib/http.js'

/**
 * GET  /api/claim?address=<testnet address>  -> eligibility + current binding
 * POST /api/claim  { address, nonce, signature }  -> record the binding
 *
 * Step two of the mainnet claim.
 *
 * Note what the POST body does *not* contain: a mainnet address. It is read
 * from the stored challenge, which is the same value that was baked into the
 * signed text. A caller cannot redirect someone else's payout, and cannot
 * redirect their own after signing.
 *
 * Re-binding is allowed while a claim is unpaid — people mistype addresses and
 * change wallets — and each previous binding is kept in `history` so the
 * record shows every address this wallet ever authorised. Once `paidAt` is
 * set the binding is frozen: after tokens have moved, a "correction" is just
 * a second payout.
 */
export default async function handler(request) {
  if (request.method === 'GET') return handleStatus(request)
  if (request.method !== 'POST') return methodNotAllowed('GET, POST')

  if (claimPhase() !== 'open') {
    return error('The mainnet claim window is not open yet.', 403, { reason: 'claim_closed' })
  }

  const body = await readJson(request)
  const address = body?.address
  const nonce = body?.nonce
  const signature = body?.signature

  if (typeof address !== 'string' || !isValidAddress(address)) {
    return error('A valid Xeris testnet wallet address is required.')
  }
  if (typeof nonce !== 'string' || !nonce) {
    return error('Missing challenge nonce. Request a new one and try again.')
  }
  if (typeof signature !== 'string' || !signature) {
    return error('Missing signature.')
  }

  const record = await getVerification(address)
  if (!record) {
    return error('This wallet did not verify during the testnet campaign.', 403, {
      reason: 'not_verified',
    })
  }

  const existing = await getClaim(address)
  if (existing?.paidAt) {
    return error('This claim has already been paid out.', 409, {
      reason: 'already_paid',
      claim: toPublicClaim(existing),
    })
  }

  // ── Check the challenge ─────────────────────────────────────────────────
  const challenge = await peekNonce(nonce)
  if (!challenge) {
    return error('This challenge has expired or was already used. Please try again.', 400, {
      reason: 'nonce_not_found',
    })
  }
  if (challenge.address !== address) {
    await burnNonce(nonce)
    return error('This challenge was issued for a different address.', 400, {
      reason: 'nonce_address_mismatch',
    })
  }
  // A verification signature must never be spendable as a payout authorisation.
  if (challenge.purpose !== PURPOSE.CLAIM) {
    await burnNonce(nonce)
    return error('This challenge was issued for a different purpose.', 400, {
      reason: 'nonce_purpose_mismatch',
    })
  }
  if (Date.now() - challenge.issuedAt > NONCE_TTL_MS) {
    await burnNonce(nonce)
    return error('This challenge has expired. Please try again.', 400, { reason: 'nonce_expired' })
  }

  if (!verifySignature(address, challenge.message, signature)) {
    await burnNonce(nonce)
    return error('Signature did not match this testnet wallet.', 401, { reason: 'bad_signature' })
  }

  // The authorised payout address, taken from the signed challenge.
  const mainnetAddress = challenge.mainnetAddress
  if (!mainnetAddress || !isValidAddress(mainnetAddress)) {
    await burnNonce(nonce)
    return error('This challenge carries no valid payout address.', 400, {
      reason: 'invalid_mainnet_address',
    })
  }

  // ── Commit ──────────────────────────────────────────────────────────────
  await burnNonce(nonce)

  const now = Date.now()
  const history = existing?.history ?? []

  if (existing && existing.mainnetAddress !== mainnetAddress) {
    history.push({
      mainnetAddress: existing.mainnetAddress,
      boundAt: existing.updatedAt ?? existing.claimedAt,
      replacedAt: now,
      proof: existing.proof,
    })
    await unlinkMainnetAddress(existing.mainnetAddress, address)
  }

  const claim = {
    version: 1,
    testnetAddress: address,
    mainnetAddress,
    mainnetNetwork: MAINNET_NETWORK_ID,
    claimedAt: existing?.claimedAt ?? now,
    updatedAt: now,
    paidAt: null,
    payoutTxId: null,
    history,
    // The authorisation itself, kept for the payout audit trail. Anyone with
    // the export can re-verify that this testnet key signed for this exact
    // payout address, without trusting the database.
    proof: {
      message: challenge.message,
      signature,
      nonce,
    },
  }

  await linkMainnetAddress(mainnetAddress, address)
  await putClaim(claim)

  return json(
    {
      claim: toPublicClaim(claim),
      walletsPayingToThisAddress: await countMainnetLinks(mainnetAddress),
    },
    existing ? 200 : 201,
  )
}

async function handleStatus(request) {
  const address = new URL(request.url).searchParams.get('address')
  if (!address || !isValidAddress(address)) {
    return error('A valid Xeris testnet wallet address is required.')
  }

  const [record, claim] = await Promise.all([getVerification(address), getClaim(address)])

  return json({
    address,
    phase: claimPhase(),
    mainnetNetwork: MAINNET_NETWORK_ID,
    eligible: Boolean(record),
    verifiedAt: record?.verifiedAt ?? null,
    claim: toPublicClaim(claim),
  })
}

export const config = { path: '/api/claim' }
