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
 *   verifications  address                   -> VerificationRecord
 *   codes          CODE                      -> { address, createdAt }
 *   nonces         nonce                     -> { address, message, issuedAt, purpose }
 *   referrals      referrer/referee          -> { at }   (one blob per edge)
 *   claims         testnetAddress            -> ClaimRecord (mainnet payout binding)
 *   mainnetLinks   mainnetAddr/testnetAddr   -> { at }   (one blob per edge)
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
export const claimsStore = () => getStore({ name: 'claims', ...options })
export const mainnetLinksStore = () => getStore({ name: 'mainnetLinks', ...options })

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

// ── Mainnet claims ────────────────────────────────────────────────────────

export async function getClaim(testnetAddress) {
  return claimsStore().get(testnetAddress, { type: 'json' })
}

export async function putClaim(claim) {
  await claimsStore().setJSON(claim.testnetAddress, claim)
  return claim
}

export async function listClaims() {
  const store = claimsStore()
  const { blobs } = await store.list()
  const claims = await Promise.all(
    blobs.map((blob) => store.get(blob.key, { type: 'json' }).catch(() => null)),
  )
  return claims.filter(Boolean)
}

const linkKey = (mainnetAddress, testnetAddress) => `${mainnetAddress}/${testnetAddress}`

/**
 * Index a mainnet payout address against the testnet wallet claiming to it.
 * One blob per pair, so concurrent claims cannot lose each other — and so
 * "how many testnet wallets point at this payout address" is a prefix count
 * rather than a scan.
 */
export async function linkMainnetAddress(mainnetAddress, testnetAddress) {
  await mainnetLinksStore().setJSON(linkKey(mainnetAddress, testnetAddress), { at: Date.now() })
}

export async function unlinkMainnetAddress(mainnetAddress, testnetAddress) {
  await mainnetLinksStore().delete(linkKey(mainnetAddress, testnetAddress)).catch(() => {})
}

/** How many distinct testnet wallets are paying out to this mainnet address. */
export async function countMainnetLinks(mainnetAddress) {
  const { blobs } = await mainnetLinksStore().list({ prefix: `${mainnetAddress}/` })
  return blobs.length
}
