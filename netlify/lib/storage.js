import { getStore } from '@netlify/blobs'

/**
 * Persistence for the verification campaign, on Netlify Blobs.
 *
 * Blobs is zero-config on Netlify (no database to provision) and every store
 * here is opened with strong consistency, because the flows below are
 * read-after-write: a freshly minted invite code must be visible to the very
 * next uniqueness check.
 *
 * Stores
 *   verifications  address            -> VerificationRecord
 *   codes          CODE               -> { address, createdAt }
 *   nonces         nonce              -> { address, message, issuedAt }
 *   referrals      referrer/referee   -> { at }   (one blob per edge)
 *
 * Referral counts are derived by listing the `referrals` prefix rather than by
 * incrementing a counter. One blob per edge means two people redeeming the
 * same code at the same moment cannot clobber each other's increment — there
 * is no read-modify-write to lose.
 */

const options = { consistency: 'strong' }

export const verificationsStore = () => getStore({ name: 'verifications', ...options })
export const codesStore = () => getStore({ name: 'codes', ...options })
export const noncesStore = () => getStore({ name: 'nonces', ...options })
export const referralsStore = () => getStore({ name: 'referrals', ...options })

// ── Verifications ─────────────────────────────────────────────────────────

export async function getVerification(address) {
  return verificationsStore().get(address, { type: 'json' })
}

export async function putVerification(record) {
  await verificationsStore().setJSON(record.address, record)
  return record
}

/** Every verification record. Used for stats and the leaderboard. */
export async function listVerifications() {
  const store = verificationsStore()
  const { blobs } = await store.list()
  const records = await Promise.all(
    blobs.map((blob) => store.get(blob.key, { type: 'json' }).catch(() => null)),
  )
  return records.filter(Boolean)
}

export async function countVerifications() {
  const { blobs } = await verificationsStore().list()
  return blobs.length
}

// ── Invite codes ──────────────────────────────────────────────────────────

export async function getCodeOwner(code) {
  const entry = await codesStore().get(code, { type: 'json' })
  return entry?.address ?? null
}

export async function claimCode(code, address) {
  await codesStore().setJSON(code, { address, createdAt: Date.now() })
}

// ── Nonces ────────────────────────────────────────────────────────────────

export async function putNonce(nonce, payload) {
  await noncesStore().setJSON(nonce, payload)
}

/** Read a challenge without consuming it. */
export async function peekNonce(nonce) {
  return noncesStore().get(nonce, { type: 'json' })
}

/**
 * Consume a challenge. Deliberately separate from the read so a caller can
 * fail on a recoverable error — an unknown invite code, an unreachable node —
 * without spending the user's signature and forcing a second wallet prompt.
 */
export async function burnNonce(nonce) {
  await noncesStore().delete(nonce).catch(() => {})
}

// ── Referral edges ────────────────────────────────────────────────────────

const edgeKey = (referrer, referee) => `${referrer}/${referee}`

export async function recordReferral(referrerAddress, refereeAddress) {
  await referralsStore().setJSON(edgeKey(referrerAddress, refereeAddress), { at: Date.now() })
}

/** Addresses that `referrerAddress` brought in. */
export async function listReferees(referrerAddress) {
  const { blobs } = await referralsStore().list({ prefix: `${referrerAddress}/` })
  return blobs.map((blob) => blob.key.slice(referrerAddress.length + 1))
}

export async function countReferrals(referrerAddress) {
  const { blobs } = await referralsStore().list({ prefix: `${referrerAddress}/` })
  return blobs.length
}

/** All edges at once — one list call instead of one per referrer. */
export async function listAllReferralEdges() {
  const { blobs } = await referralsStore().list()
  return blobs.map((blob) => {
    const slash = blob.key.indexOf('/')
    return { referrer: blob.key.slice(0, slash), referee: blob.key.slice(slash + 1) }
  })
}
