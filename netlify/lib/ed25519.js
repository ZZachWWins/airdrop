import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import { decodePublicKey } from './base58.js'

/**
 * Ed25519 signature verification against a base58 Xeris address, using Node's
 * built-in crypto — no third-party dependency in the trust path.
 *
 * Node wants an SPKI-wrapped key, so we prepend the fixed DER header for
 * `id-Ed25519` (RFC 8410 §4) to the raw 32-byte key:
 *
 *   30 2a                SEQUENCE (42 bytes)
 *     30 05              SEQUENCE (5 bytes)  — AlgorithmIdentifier
 *       06 03 2b 65 70   OID 1.3.101.112 (Ed25519)
 *     03 21 00           BIT STRING (33 bytes, 0 unused bits)
 *       <32-byte key>
 */
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

function publicKeyFromAddress(address) {
  const raw = decodePublicKey(address)
  const der = Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(raw)])
  return createPublicKey({ key: der, format: 'der', type: 'spki' })
}

/**
 * Verify that `signatureBase64` is `address`'s signature over `message`.
 *
 * Returns a boolean rather than throwing: a malformed address or signature is
 * a failed verification, not a server error.
 *
 * @param {string} address  base58 Xeris address (the ed25519 public key)
 * @param {string} message  the exact UTF-8 string that was signed
 * @param {string} signatureBase64  64-byte signature, base64-encoded
 * @returns {boolean}
 */
export function verifySignature(address, message, signatureBase64) {
  try {
    const signature = Buffer.from(signatureBase64, 'base64')
    if (signature.length !== 64) return false

    const key = publicKeyFromAddress(address)
    // Ed25519 takes no separate digest algorithm — pass null.
    return cryptoVerify(null, Buffer.from(message, 'utf8'), key, signature)
  } catch {
    return false
  }
}
