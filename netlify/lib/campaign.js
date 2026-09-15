import { randomBytes, randomUUID } from 'node:crypto'
import { NETWORK_ID } from './chain.js'
import { getCodeOwner } from './storage.js'

/** Prefix on every invite code. */
export const CODE_PREFIX = process.env.INVITE_CODE_PREFIX || 'XRS'

/**
 * Crockford-style alphabet: no 0/O/1/I/L/U. Codes get read off a phone screen
 * and typed by hand, so ambiguous glyphs are a support burden.
 */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

/** How long a signing challenge stays valid. */
export const NONCE_TTL_MS = 10 * 60 * 1000

/** Current schema version of a stored verification record. */
export const RECORD_VERSION = 1

function randomCodeBody() {
  // rejection-free: 30 symbols, drawn from a byte each, modulo-biased by <2%,
  // which is irrelevant for a namespace this size.
  const bytes = randomBytes(CODE_LENGTH)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

/**
 * Normalise anything a user might paste into canonical code form.
 * Accepts "xrs-a1b2c3", "A1B2C3", " xrs a1b2c3 " — all become "XRS-A1B2C3".
 */
export function normaliseCode(input) {
  if (typeof input !== 'string') return null
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return null

  const body = cleaned.startsWith(CODE_PREFIX) ? cleaned.slice(CODE_PREFIX.length) : cleaned
  if (body.length !== CODE_LENGTH) return null
  if (![...body].every((char) => CODE_ALPHABET.includes(char))) return null

  return `${CODE_PREFIX}-${body}`
}

/** Mint a code that no one holds yet. */
export async function generateUniqueCode(attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const code = `${CODE_PREFIX}-${randomCodeBody()}`
    // Sequential by necessity — each candidate is only worth checking if the
    // previous one collided, which at this namespace size is near-never.
    const owner = await getCodeOwner(code)
    if (!owner) return code
  }
  throw new Error('Could not allocate a unique invite code')
}

// ── Signing challenge ─────────────────────────────────────────────────────

export function createNonce() {
  return randomUUID()
}

/**
 * The exact text the wallet displays and signs.
 *
 * It is written to be readable in a wallet prompt and to say plainly that it
 * authorises nothing — a signature request that looks like a transaction is
 * how users get trained into approving real ones.
 */
export function buildChallengeMessage({ address, nonce, issuedAt, domain }) {
  return [
    'Xeris Testnet Verification',
    '',
    'I confirm that I control this wallet and am taking part in the Xeris testnet.',
    'This registers my address for the future XRS mainnet airdrop.',
    '',
    `Address: ${address}`,
    `Network: ${NETWORK_ID}`,
    `Site:    ${domain}`,
    `Nonce:   ${nonce}`,
    `Issued:  ${new Date(issuedAt).toISOString()}`,
    '',
    'Signing costs nothing. It does not approve a transaction or move any funds.',
  ].join('\n')
}

// ── Public shapes ─────────────────────────────────────────────────────────

/** Mask an address for display to someone who is not its owner. */
export function maskAddress(address) {
  if (typeof address !== 'string' || address.length < 12) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

/**
 * The view of a record safe to return to its owner.
 * Signature material stays server-side — it is evidence, not something the UI
 * needs, and echoing it back invites replay experiments.
 */
export function toPublicRecord(record, extra = {}) {
  return {
    address: record.address,
    verified: true,
    verifiedAt: record.verifiedAt,
    network: record.network,
    inviteCode: record.inviteCode,
    referredByCode: record.referredByCode ?? null,
    referredByAddress: record.referredByAddress ? maskAddress(record.referredByAddress) : null,
    onchain: {
      blockHeight: record.onchain?.blockHeight ?? null,
      activity: record.onchain?.activity ?? 'new',
      balanceLamports: record.onchain?.balanceLamports ?? 0,
      accountFound: record.onchain?.accountFound ?? false,
      checkedAt: record.onchain?.checkedAt ?? record.verifiedAt,
    },
    ...extra,
  }
}
