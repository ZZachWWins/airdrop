/**
 * The signature normaliser is the piece most likely to differ between iOS and
 * Android, because the shape depends on the platform's JS bridge rather than
 * on the wallet. These cases are the shapes real bridges produce.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { toSignatureBytes } from '../src/lib/signature.js'

const SIG = Uint8Array.from({ length: 64 }, (_, i) => (i * 7 + 13) % 256)

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

const sameBytes = (actual, expected = SIG) =>
  assert.deepEqual(Array.from(actual), Array.from(expected))

describe('signature normalisation', () => {
  test('iOS shapes: Uint8Array, wrapped and bare', () => {
    sameBytes(toSignatureBytes({ signature: SIG }))
    sameBytes(toSignatureBytes(SIG))
  })

  test('plain array, wrapped and bare', () => {
    sameBytes(toSignatureBytes({ signature: Array.from(SIG) }))
    sameBytes(toSignatureBytes(Array.from(SIG)))
  })

  test('Android bridge: numeric-keyed object', () => {
    // A Uint8Array marshalled through a JSON bridge comes back like this —
    // not an array, not a Uint8Array, and the old code threw on it.
    const marshalled = Object.fromEntries(Array.from(SIG).map((byte, i) => [String(i), byte]))
    sameBytes(toSignatureBytes({ signature: marshalled }))
    sameBytes(toSignatureBytes(marshalled))
  })

  test('Android bridge: base64 string', () => {
    const b64 = Buffer.from(SIG).toString('base64')
    sameBytes(toSignatureBytes({ signature: b64 }))
    sameBytes(toSignatureBytes(b64))
  })

  test('Android bridge: url-safe base64 string', () => {
    const b64url = Buffer.from(SIG).toString('base64url')
    sameBytes(toSignatureBytes(b64url))
  })

  test('hex string, with and without 0x', () => {
    const hex = Buffer.from(SIG).toString('hex')
    sameBytes(toSignatureBytes(hex))
    sameBytes(toSignatureBytes(`0x${hex}`))
    sameBytes(toSignatureBytes(hex.toUpperCase()))
  })

  test('base58 string, as Solana-derived wallets often return', () => {
    sameBytes(toSignatureBytes(base58Encode(SIG)))
    sameBytes(toSignatureBytes({ signature: base58Encode(SIG) }))
  })

  test('node Buffer JSON shape', () => {
    sameBytes(toSignatureBytes({ type: 'Buffer', data: Array.from(SIG) }))
    sameBytes(toSignatureBytes({ signature: { type: 'Buffer', data: Array.from(SIG) } }))
  })

  test('ArrayBuffer and other typed-array views', () => {
    sameBytes(toSignatureBytes(SIG.buffer.slice(0)))
    sameBytes(toSignatureBytes(new Int8Array(SIG.buffer.slice(0))))
  })

  test('alternative envelope keys', () => {
    sameBytes(toSignatureBytes({ sig: SIG }))
    sameBytes(toSignatureBytes({ result: SIG }))
    sameBytes(toSignatureBytes({ data: Array.from(SIG) }))
  })

  test('a 64-byte decode is preferred when encodings are ambiguous', () => {
    // 128 hex chars is also valid base58 and valid-ish base64; hex is the only
    // reading that yields exactly 64 bytes, and that is the one to take.
    const hex = Buffer.from(SIG).toString('hex')
    assert.equal(toSignatureBytes(hex).length, 64)
  })

  test('throws a user-facing message on genuinely unusable input', () => {
    for (const bad of [null, undefined, 42, {}, { signature: {} }, '', '   ', true]) {
      assert.throws(() => toSignatureBytes(bad), /could not read/i, `should reject ${String(bad)}`)
    }
  })
})
