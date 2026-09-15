/**
 * Client-side mirror of netlify/lib/campaign.js — same alphabet, same shape.
 *
 * Duplicated rather than shared because Netlify Functions and the Vite bundle
 * are separate build targets. The server is still the authority: this exists
 * only so the UI can reject a typo before spending a wallet signature on it.
 * If the format changes, both files change.
 */

export const CODE_PREFIX = import.meta.env.VITE_INVITE_CODE_PREFIX || 'XRS'

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 6

/** Canonicalise user input to `XRS-A1B2C3`, or null if it cannot be one. */
export function normaliseCode(input) {
  if (typeof input !== 'string') return null
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return null

  const body = cleaned.startsWith(CODE_PREFIX) ? cleaned.slice(CODE_PREFIX.length) : cleaned
  if (body.length !== CODE_LENGTH) return null
  if (![...body].every((char) => CODE_ALPHABET.includes(char))) return null

  return `${CODE_PREFIX}-${body}`
}

export function isValidCode(input) {
  return normaliseCode(input) !== null
}
