/**
 * Base58 (Bitcoin alphabet) decoding for Xeris/Solana-style addresses.
 * Zero dependencies — mirrors the decoder in XerisLaunchpad's xerisTx.js.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const INDEX = (() => {
  const map = new Map()
  for (let i = 0; i < ALPHABET.length; i += 1) map.set(ALPHABET[i], i)
  return map
})()

/**
 * Decode a base58 string to bytes.
 * @throws {Error} if the string contains a character outside the alphabet.
 */
export function base58Decode(str) {
  if (typeof str !== 'string' || str.length === 0) {
    throw new Error('base58: empty input')
  }

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

  // Each leading '1' is a leading zero byte.
  for (let i = 0; i < str.length && str[i] === '1'; i += 1) bytes.push(0)

  return Uint8Array.from(bytes.reverse())
}

/**
 * Decode an address to exactly 32 bytes, the ed25519 public key.
 * @throws {Error} if the decoded value is not a 32-byte key.
 */
export function decodePublicKey(address) {
  const raw = base58Decode(address)
  if (raw.length !== 32) {
    throw new Error(`base58: expected a 32-byte public key, got ${raw.length} bytes`)
  }
  return raw
}

/** True when `address` is a syntactically valid 32-byte base58 address. */
export function isValidAddress(address) {
  if (typeof address !== 'string' || address.length < 32 || address.length > 48) return false
  try {
    decodePublicKey(address)
    return true
  } catch {
    return false
  }
}
