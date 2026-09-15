import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Encode(bytes) {
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  let out = ''
  for (const byte of bytes) {
    if (byte === 0) out += '1'
    else break
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) out += ALPHABET[digits[i]]
  return out
}

/** A throwaway ed25519 keypair standing in for a Xeris Web4 wallet. */
export function createWallet() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  // Strip the 12-byte SPKI header to get the raw 32-byte key.
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12)

  return {
    address: base58Encode(raw),
    sign: (message) => cryptoSign(null, Buffer.from(message, 'utf8'), privateKey).toString('base64'),
  }
}
