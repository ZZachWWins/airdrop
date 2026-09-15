import { isValidAddress } from '../lib/base58.js'
import { verifySignature } from '../lib/ed25519.js'
import { buildChainSnapshot, NodeUnreachableError } from '../lib/chain.js'
import {
  NONCE_TTL_MS,
  PURPOSE,
  RECORD_VERSION,
  generateUniqueCode,
  normaliseCode,
  toPublicRecord,
} from '../lib/campaign.js'
import {
  burnNonce,
  claimCode,
  countReferrals,
  getCodeOwner,
  getVerification,
  peekNonce,
  putVerification,
  recordReferral,
} from '../lib/storage.js'
import { error, json, methodNotAllowed, readJson } from '../lib/http.js'

/**
 * POST /api/verify  { address, nonce, signature, inviteCode? }
 *   -> { record }
 *
 * Step two: check the signature issued by /api/challenge, confirm the address
 * against the live testnet node, and write the verification record.
 *
 * Ordering matters here. The invite code and the node snapshot are resolved
 * *before* the nonce is consumed, so a recoverable failure (bad code, node
 * hiccup) lets the client retry with the signature it already has instead of
 * asking the user to approve a second signing prompt.
 *
 * Re-verifying an address is idempotent: the on-chain snapshot is refreshed,
 * but the original verifiedAt, invite code and referral attribution are
 * immutable. Attribution has to be, or referral credit could be re-pointed
 * after the fact.
 */
export default async function handler(request) {
  if (request.method !== 'POST') return methodNotAllowed('POST')

  const body = await readJson(request)
  const address = body?.address
  const nonce = body?.nonce
  const signature = body?.signature

  if (typeof address !== 'string' || !isValidAddress(address)) {
    return error('A valid Xeris wallet address is required.')
  }
  if (typeof nonce !== 'string' || !nonce) {
    return error('Missing challenge nonce. Request a new one and try again.')
  }
  if (typeof signature !== 'string' || !signature) {
    return error('Missing signature.')
  }

  const existing = await getVerification(address)

  // ── 1. Resolve the invite code before anything is consumed ──────────────
  let referrerAddress = null
  let referralCode = null

  // Attribution is locked at first verification, so only look at a supplied
  // code when this address has never been verified.
  if (!existing && body?.inviteCode) {
    referralCode = normaliseCode(body.inviteCode)
    if (!referralCode) {
      return error('That invite code is not in a valid format.', 400, { reason: 'invalid_code' })
    }

    referrerAddress = await getCodeOwner(referralCode)
    if (!referrerAddress) {
      return error('That invite code does not exist.', 400, { reason: 'unknown_code' })
    }
    if (referrerAddress === address) {
      return error('You cannot invite yourself.', 400, { reason: 'self_referral' })
    }
  }

  // ── 2. Check the challenge ──────────────────────────────────────────────
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
  // A claim authorisation must never be spendable as a verification.
  if ((challenge.purpose ?? PURPOSE.VERIFY) !== PURPOSE.VERIFY) {
    await burnNonce(nonce)
    return error('This challenge was issued for a different purpose.', 400, {
      reason: 'nonce_purpose_mismatch',
    })
  }
  if (Date.now() - challenge.issuedAt > NONCE_TTL_MS) {
    await burnNonce(nonce)
    return error('This challenge has expired. Please try again.', 400, { reason: 'nonce_expired' })
  }

  // Verify against the message we issued, not one the client rebuilt.
  if (!verifySignature(address, challenge.message, signature)) {
    // A bad signature spends the challenge — otherwise one nonce would allow
    // unlimited guesses.
    await burnNonce(nonce)
    return error('Signature did not match this wallet address.', 401, {
      reason: 'bad_signature',
    })
  }

  // ── 3. Anchor against the live testnet ──────────────────────────────────
  let onchain
  try {
    onchain = await buildChainSnapshot(address)
  } catch (err) {
    if (err instanceof NodeUnreachableError) {
      // Nonce intact — the client can retry with the same signature.
      return error(
        'The Xeris testnet node is not responding right now. Your signature is still valid — please try again in a moment.',
        503,
        { reason: 'node_unreachable' },
      )
    }
    throw err
  }

  // ── 4. Commit ───────────────────────────────────────────────────────────
  await burnNonce(nonce)

  if (existing) {
    const refreshed = {
      ...existing,
      onchain,
      lastCheckedAt: Date.now(),
    }
    await putVerification(refreshed)
    const referralCount = await countReferrals(address)
    return json({
      record: toPublicRecord(refreshed, { referralCount }),
      alreadyVerified: true,
    })
  }

  const inviteCode = await generateUniqueCode()
  const now = Date.now()

  const record = {
    version: RECORD_VERSION,
    address,
    verifiedAt: now,
    lastCheckedAt: now,
    network: onchain.network,
    inviteCode,
    referredByCode: referralCode,
    referredByAddress: referrerAddress,
    onchain,
    // Kept server-side as the evidence trail for the eventual mainnet claim.
    proof: {
      message: challenge.message,
      signature,
      nonce,
    },
  }

  // Claim the code before announcing it, so a second verification cannot be
  // handed the same string in the window before the record lands.
  await claimCode(inviteCode, address)
  await putVerification(record)

  if (referrerAddress) {
    await recordReferral(referrerAddress, address)
  }

  return json({ record: toPublicRecord(record, { referralCount: 0 }) }, 201)
}

export const config = { path: '/api/verify' }
