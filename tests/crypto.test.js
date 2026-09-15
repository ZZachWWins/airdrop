/**
 * Unit tests for the two pieces everything else trusts: base58 address
 * decoding and ed25519 signature verification.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { base58Decode, decodePublicKey, isValidAddress } from '../netlify/lib/base58.js'
import { verifySignature } from '../netlify/lib/ed25519.js'
import { normaliseCode } from '../netlify/lib/campaign.js'
import { createWallet } from './helpers/wallet.js'

describe('base58', () => {
  test('round-trips a real 32-byte public key', () => {
    const { address } = createWallet()
    assert.equal(decodePublicKey(address).length, 32)
    assert.ok(isValidAddress(address))
  })

  test('preserves leading zero bytes', () => {
    // Every leading zero byte encodes as a literal '1'.
    const decoded = decodePublicKey(`${'1'.repeat(31)}8`)
    assert.equal(decoded.length, 32)
    assert.equal(decoded[31], 7)
    assert.ok(decoded.slice(0, 31).every((byte) => byte === 0))
  })

  test('rejects characters outside the alphabet', () => {
    assert.throws(() => base58Decode('abc0OIl'), /invalid character/)
  })

  test('rejects lengths that are not 32 bytes', () => {
    assert.equal(isValidAddress('abc'), false)
    assert.equal(isValidAddress(''), false)
    assert.equal(isValidAddress(null), false)
    assert.equal(isValidAddress('1'.repeat(64)), false)
  })
})

describe('ed25519', () => {
  const message = 'Xeris Testnet Verification\nNonce: 1234'

  test('accepts a genuine signature', () => {
    const wallet = createWallet()
    assert.equal(verifySignature(wallet.address, message, wallet.sign(message)), true)
  })

  test('rejects a tampered message', () => {
    const wallet = createWallet()
    const signature = wallet.sign(message)
    assert.equal(verifySignature(wallet.address, `${message} `, signature), false)
    assert.equal(verifySignature(wallet.address, message.toUpperCase(), signature), false)
  })

  test('rejects another wallet claiming the signature', () => {
    const wallet = createWallet()
    const impostor = createWallet()
    assert.equal(verifySignature(impostor.address, message, wallet.sign(message)), false)
  })

  test('returns false rather than throwing on junk input', () => {
    const wallet = createWallet()
    assert.equal(verifySignature(wallet.address, message, ''), false)
    assert.equal(verifySignature(wallet.address, message, 'bm90LWEtc2ln'), false)
    assert.equal(verifySignature('not-an-address!', message, wallet.sign(message)), false)
    assert.equal(verifySignature(wallet.address, message, null), false)
  })

  test('rejects a signature of the wrong length', () => {
    const wallet = createWallet()
    const truncated = Buffer.from(wallet.sign(message), 'base64').subarray(0, 63)
    assert.equal(verifySignature(wallet.address, message, truncated.toString('base64')), false)
  })
})

describe('invite code normalisation', () => {
  test('canonicalises casing, spacing and a missing prefix', () => {
    assert.equal(normaliseCode('XRS-A2B3C4'), 'XRS-A2B3C4')
    assert.equal(normaliseCode('xrs-a2b3c4'), 'XRS-A2B3C4')
    assert.equal(normaliseCode('  A2B3C4  '), 'XRS-A2B3C4')
    assert.equal(normaliseCode('xrs a2b3c4'), 'XRS-A2B3C4')
  })

  test('rejects wrong lengths and ambiguous glyphs', () => {
    assert.equal(normaliseCode('XRS-A2B3C'), null)
    assert.equal(normaliseCode('XRS-A2B3C45'), null)
    // 0, O, I, L and U are deliberately outside the alphabet.
    assert.equal(normaliseCode('XRS-A0B3C4'), null)
    assert.equal(normaliseCode('XRS-AIB3C4'), null)
    assert.equal(normaliseCode('XRS-ALB3C4'), null)
    assert.equal(normaliseCode(''), null)
    assert.equal(normaliseCode(null), null)
  })
})
