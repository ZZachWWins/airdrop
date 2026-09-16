// Explicit extension: this module is exercised by the Node test suite, which
// does not resolve extensionless imports the way Vite does.
import { base58Decode } from './address.js'

/**
 * Normalise whatever a wallet hands back from signMessage() into raw bytes.
 *
 * This is deliberately permissive, because the shape depends on the platform
 * bridge rather than on the wallet's intent:
 *
 *  - iOS (WKWebView) usually preserves a real Uint8Array, or gives an Array.
 *  - Android (WebView) marshals values through a JSON bridge, so typed arrays
 *    commonly arrive as a *numeric-keyed object* — {"0":12,"1":34,…} — or as
 *    a base64/hex/base58 string. None of those are `instanceof Uint8Array`,
 *    and none are arrays.
 *
 * Getting this wrong looks exactly like "works on iPhone, broken on Android",
 * so every plausible shape is handled rather than guessed at.
 */

const SIGNATURE_BYTES = 64

function fromNumericKeyedObject(value) {
  const keys = Object.keys(value)
  if (keys.length === 0) return null
  // Every key must be a plain array index, or this is some other object.
  if (!keys.every((key) => /^\d+$/.test(key))) return null

  const length = Math.max(...keys.map(Number)) + 1
  if (length !== keys.length) return null

  const bytes = new Uint8Array(length)
  for (const key of keys) {
    const byte = value[key]
    if (typeof byte !== 'number' || byte < 0 || byte > 255) return null
    bytes[Number(key)] = byte
  }
  return bytes
}

function fromHex(text) {
  const hex = text.startsWith('0x') || text.startsWith('0X') ? text.slice(2) : text
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function fromBase64(text) {
  // Accept the URL-safe alphabet too; some bridges use it.
  const normalised = text.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised)) return null
  try {
    const binary = atob(normalised)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function fromBase58(text) {
  try {
    return base58Decode(text)
  } catch {
    return null
  }
}

/**
 * A string could be hex, base64 or base58, and the encodings overlap — a
 * 64-byte signature is 128 hex chars, 88 base64 chars and ~87-88 base58
 * chars. Rather than sniff, decode each way and take the one that produces
 * the right number of bytes.
 */
function fromString(text) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const candidates = [fromHex(trimmed), fromBase64(trimmed), fromBase58(trimmed)]
  return (
    candidates.find((bytes) => bytes?.length === SIGNATURE_BYTES) ??
    candidates.find(Boolean) ??
    null
  )
}

/**
 * @param {unknown} result whatever signMessage() resolved to
 * @returns {Uint8Array}
 * @throws {Error} when nothing usable can be extracted
 */
export function toSignatureBytes(result) {
  // Unwrap the common envelopes first, in order of how often wallets use them.
  const raw =
    result?.signature ??
    result?.sig ??
    result?.data ??
    result?.result ??
    result

  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  if (typeof raw === 'string') {
    const bytes = fromString(raw)
    if (bytes) return bytes
  }
  if (raw && typeof raw === 'object') {
    // {type: 'Buffer', data: [...]} survives one more unwrap than the above.
    if (Array.isArray(raw.data)) return Uint8Array.from(raw.data)
    const bytes = fromNumericKeyedObject(raw)
    if (bytes) return bytes
  }

  throw new Error(
    'Your wallet returned a signature in a format this page could not read. Please update Xeris Web4 and try again.',
  )
}

export { SIGNATURE_BYTES }
