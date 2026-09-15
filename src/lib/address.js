/**
 * Client-side mirror of netlify/lib/base58.js.
 *
 * Duplicated because the bundle and the functions are separate build targets.
 * The server is still the authority — this exists so the claim form can reject
 * a mistyped payout address *before* the user signs for it, which is the one
 * place in this app where a bad value costs real tokens.
 *
 * If the address format changes, change both.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const INDEX = (() => {
  const map = new Map()
  for (let i = 0; i < ALPHABET.length; i += 1) map.set(ALPHABET[i], i)
  return map
})()

function base58Decode(str) {
  const bytes = [0]
  for (const char of str) {
    const value = INDEX.get(char)
    if (value === undefined) throw new Error(`base58: invalid character "${char}"`)

    let carry = value
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (let i = 0; i < str.length && str[i] === '1'; i += 1) bytes.push(0)
  return Uint8Array.from(bytes.reverse())
}

/** True when `address` decodes to exactly a 32-byte ed25519 public key. */
export function isValidAddress(address) {
  if (typeof address !== 'string') return false
  const trimmed = address.trim()
  if (trimmed.length < 32 || trimmed.length > 48) return false
  try {
    return base58Decode(trimmed).length === 32
  } catch {
    return false
  }
}
