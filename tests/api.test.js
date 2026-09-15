/**
 * Integration tests for the campaign API.
 *
 * The real function handlers run against an in-memory @netlify/blobs and a
 * stubbed Xeris node, so the signature checks, nonce lifecycle and referral
 * bookkeeping are all exercised for real.
 *
 *   npm test
 */

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, mock, test } from 'node:test'

import { resetBlobs } from './helpers/blobsMock.js'
import { createWallet } from './helpers/wallet.js'

process.env.XERIS_NODE_URL = 'https://node.test'
process.env.XERIS_NETWORK_ID = 'xeris-testnet'
process.env.ADMIN_TOKEN = 'test-admin-token'

mock.module('@netlify/blobs', { namedExports: { getStore: (await import('./helpers/blobsMock.js')).getStore } })

const challenge = (await import('../netlify/functions/challenge.js')).default
const verify = (await import('../netlify/functions/verify.js')).default
const status = (await import('../netlify/functions/status.js')).default
const stats = (await import('../netlify/functions/stats.js')).default
const leaderboard = (await import('../netlify/functions/leaderboard.js')).default
const invite = (await import('../netlify/functions/invite.js')).default
const exportRegistry = (await import('../netlify/functions/export.js')).default

// ── Node stub ─────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch
let nodeState

function stubNode() {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname

    if (!nodeState.reachable) throw new Error('ECONNREFUSED')

    if (path === '/blocks') {
      return Response.json([{ height: nodeState.blockHeight, hash: 'abc123' }])
    }
    if (path.startsWith('/token/balance/')) {
      const address = path.split('/')[3]
      return Response.json({ balance: nodeState.balances[address] ?? 0 })
    }
    if (path.startsWith('/account/')) {
      const address = path.split('/')[2]
      const account = nodeState.accounts[address]
      return account
        ? Response.json(account)
        : new Response('not found', { status: 404 })
    }
    return new Response('not found', { status: 404 })
  }
}

before(stubNode)
after(() => {
  globalThis.fetch = realFetch
})

beforeEach(() => {
  resetBlobs()
  nodeState = { reachable: true, blockHeight: 900_100, balances: {}, accounts: {} }
})

// ── Request helpers ───────────────────────────────────────────────────────

const post = (path, body) =>
  new Request(`https://airdrop.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const get = (path, headers = {}) =>
  new Request(`https://airdrop.test${path}`, { method: 'GET', headers })

/** Drive the full challenge -> sign -> verify flow for a wallet. */
async function verifyWallet(wallet, { inviteCode } = {}) {
  const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
  const { nonce, message } = await challengeResponse.json()

  const response = await verify(
    post('/api/verify', {
      address: wallet.address,
      nonce,
      signature: wallet.sign(message),
      inviteCode,
    }),
  )

  return { response, body: await response.json(), nonce, message }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('challenge', () => {
  test('issues a nonce and a message naming the address and network', async () => {
    const wallet = createWallet()
    const response = await challenge(post('/api/challenge', { address: wallet.address }))
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.ok(body.nonce)
    assert.match(body.message, new RegExp(wallet.address))
    assert.match(body.message, /xeris-testnet/)
    assert.ok(body.expiresAt > Date.now())
  })

  test('rejects a malformed address', async () => {
    const response = await challenge(post('/api/challenge', { address: 'nope' }))
    assert.equal(response.status, 400)
  })

  test('rejects GET', async () => {
    assert.equal((await challenge(get('/api/challenge'))).status, 405)
  })
})

describe('verify', () => {
  test('records a verification and mints an invite code', async () => {
    const wallet = createWallet()
    nodeState.balances[wallet.address] = 5_000_000_000

    const { response, body } = await verifyWallet(wallet)

    assert.equal(response.status, 201)
    assert.equal(body.record.address, wallet.address)
    assert.equal(body.record.verified, true)
    assert.equal(body.record.network, 'xeris-testnet')
    assert.match(body.record.inviteCode, /^XRS-[2-9A-HJKMNP-TV-Z]{6}$/)
    assert.equal(body.record.onchain.blockHeight, 900_100)
    assert.equal(body.record.onchain.activity, 'funded')
    assert.equal(body.record.referredByCode, null)
  })

  test('never returns the stored signature material', async () => {
    const wallet = createWallet()
    const { body } = await verifyWallet(wallet)
    assert.equal(body.record.proof, undefined)
  })

  test('tiers a wallet that has sent transactions as active', async () => {
    const wallet = createWallet()
    nodeState.accounts[wallet.address] = { nonce: 12 }

    const { body } = await verifyWallet(wallet)
    assert.equal(body.record.onchain.activity, 'active')
    assert.equal(body.record.onchain.accountFound, true)
  })

  test('accepts a brand new wallet with no balance or history', async () => {
    const wallet = createWallet()
    const { response, body } = await verifyWallet(wallet)

    assert.equal(response.status, 201)
    assert.equal(body.record.onchain.activity, 'new')
  })

  test('rejects a signature from a different key', async () => {
    const wallet = createWallet()
    const impostor = createWallet()

    const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await challengeResponse.json()

    const response = await verify(
      post('/api/verify', {
        address: wallet.address,
        nonce,
        signature: impostor.sign(message),
      }),
    )

    assert.equal(response.status, 401)
    assert.equal((await response.json()).reason, 'bad_signature')
  })

  test('burns the nonce after a bad signature', async () => {
    const wallet = createWallet()
    const impostor = createWallet()

    const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await challengeResponse.json()

    await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: impostor.sign(message) }),
    )

    // The real key cannot rescue a spent challenge.
    const retry = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(retry.status, 400)
    assert.equal((await retry.json()).reason, 'nonce_not_found')
  })

  test('rejects a replayed nonce', async () => {
    const wallet = createWallet()
    const { nonce, message } = await verifyWallet(wallet)

    const replay = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(replay.status, 400)
    assert.equal((await replay.json()).reason, 'nonce_not_found')
  })

  test('rejects a challenge issued for another address', async () => {
    const wallet = createWallet()
    const other = createWallet()

    const challengeResponse = await challenge(post('/api/challenge', { address: other.address }))
    const { nonce, message } = await challengeResponse.json()

    const response = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(response.status, 400)
    assert.equal((await response.json()).reason, 'nonce_address_mismatch')
  })

  test('rejects an expired challenge', async () => {
    const wallet = createWallet()
    const { putNonce } = await import('../netlify/lib/storage.js')
    const { buildChallengeMessage, NONCE_TTL_MS } = await import('../netlify/lib/campaign.js')

    const nonce = 'stale-nonce'
    const issuedAt = Date.now() - NONCE_TTL_MS - 1000
    const message = buildChallengeMessage({
      address: wallet.address,
      nonce,
      issuedAt,
      domain: 'airdrop.test',
    })
    await putNonce(nonce, { address: wallet.address, message, issuedAt })

    const response = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(response.status, 400)
    assert.equal((await response.json()).reason, 'nonce_expired')
  })

  test('returns 503 and keeps the nonce when the node is down', async () => {
    const wallet = createWallet()
    const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await challengeResponse.json()
    const signature = wallet.sign(message)

    nodeState.reachable = false
    const downResponse = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature }),
    )
    assert.equal(downResponse.status, 503)
    assert.equal((await downResponse.json()).reason, 'node_unreachable')

    // Same signature, no second wallet prompt.
    nodeState.reachable = true
    const retry = await verify(post('/api/verify', { address: wallet.address, nonce, signature }))
    assert.equal(retry.status, 201)
  })

  test('re-verifying refreshes the snapshot but preserves identity fields', async () => {
    const wallet = createWallet()
    const first = await verifyWallet(wallet)

    nodeState.blockHeight = 900_500
    nodeState.balances[wallet.address] = 42_000_000_000

    const second = await verifyWallet(wallet)

    assert.equal(second.response.status, 200)
    assert.equal(second.body.alreadyVerified, true)
    assert.equal(second.body.record.verifiedAt, first.body.record.verifiedAt)
    assert.equal(second.body.record.inviteCode, first.body.record.inviteCode)
    assert.equal(second.body.record.onchain.blockHeight, 900_500)
    assert.equal(second.body.record.onchain.activity, 'funded')
  })
})

describe('referrals', () => {
  test('credits the referrer and records the edge', async () => {
    const alice = createWallet()
    const bob = createWallet()

    const { body: aliceBody } = await verifyWallet(alice)
    const code = aliceBody.record.inviteCode

    const { response, body: bobBody } = await verifyWallet(bob, { inviteCode: code })
    assert.equal(response.status, 201)
    assert.equal(bobBody.record.referredByCode, code)
    assert.ok(bobBody.record.referredByAddress.includes('…'))

    const aliceStatus = await (await status(get(`/api/status?address=${alice.address}`))).json()
    assert.equal(aliceStatus.record.referralCount, 1)
    assert.equal(aliceStatus.referrals.length, 1)
    assert.ok(aliceStatus.referrals[0].address.includes('…'))
  })

  test('accepts a code in any casing or spacing', async () => {
    const alice = createWallet()
    const bob = createWallet()
    const { body } = await verifyWallet(alice)
    const code = body.record.inviteCode

    const messy = ` ${code.replace('-', '').toLowerCase()} `
    const { response } = await verifyWallet(bob, { inviteCode: messy })
    assert.equal(response.status, 201)
  })

  test('rejects self-referral without consuming the nonce', async () => {
    const alice = createWallet()
    const { body } = await verifyWallet(alice)
    const code = body.record.inviteCode

    const bob = createWallet()
    await verifyWallet(bob, { inviteCode: code })

    // Bob now has his own code; he cannot re-point his attribution to himself.
    const carol = createWallet()
    const { body: carolBody } = await verifyWallet(carol)

    const challengeResponse = await challenge(post('/api/challenge', { address: carol.address }))
    const { nonce, message } = await challengeResponse.json()
    const response = await verify(
      post('/api/verify', {
        address: carol.address,
        nonce,
        signature: carol.sign(message),
        inviteCode: carolBody.record.inviteCode,
      }),
    )
    // Carol is already verified, so the code is ignored rather than rejected.
    assert.equal(response.status, 200)
  })

  test('rejects an unknown code and leaves the nonce usable', async () => {
    const wallet = createWallet()
    const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await challengeResponse.json()
    const signature = wallet.sign(message)

    const rejected = await verify(
      post('/api/verify', {
        address: wallet.address,
        nonce,
        signature,
        inviteCode: 'XRS-ZZZZZZ',
      }),
    )
    assert.equal(rejected.status, 400)
    assert.equal((await rejected.json()).reason, 'unknown_code')

    // Retry without the code — same signature, no new wallet prompt.
    const retry = await verify(post('/api/verify', { address: wallet.address, nonce, signature }))
    assert.equal(retry.status, 201)
  })

  test('rejects a malformed code', async () => {
    const wallet = createWallet()
    const challengeResponse = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await challengeResponse.json()

    const response = await verify(
      post('/api/verify', {
        address: wallet.address,
        nonce,
        signature: wallet.sign(message),
        inviteCode: 'not-a-code',
      }),
    )
    assert.equal(response.status, 400)
    assert.equal((await response.json()).reason, 'invalid_code')
  })

  test('refuses to re-point attribution on a verified address', async () => {
    const alice = createWallet()
    const bob = createWallet()
    const carol = createWallet()

    const { body: aliceBody } = await verifyWallet(alice)
    const { body: bobBody } = await verifyWallet(bob)

    // Carol verifies under Alice, then tries again under Bob.
    await verifyWallet(carol, { inviteCode: aliceBody.record.inviteCode })
    const { body: retry } = await verifyWallet(carol, { inviteCode: bobBody.record.inviteCode })

    assert.equal(retry.record.referredByCode, aliceBody.record.inviteCode)

    const bobStatus = await (await status(get(`/api/status?address=${bob.address}`))).json()
    assert.equal(bobStatus.record.referralCount, 0)
  })

  test('counts each referee once even if they re-verify', async () => {
    const alice = createWallet()
    const bob = createWallet()
    const { body } = await verifyWallet(alice)

    await verifyWallet(bob, { inviteCode: body.record.inviteCode })
    await verifyWallet(bob, { inviteCode: body.record.inviteCode })
    await verifyWallet(bob)

    const aliceStatus = await (await status(get(`/api/status?address=${alice.address}`))).json()
    assert.equal(aliceStatus.record.referralCount, 1)
  })
})

describe('status', () => {
  test('reports an unverified address', async () => {
    const wallet = createWallet()
    const body = await (await status(get(`/api/status?address=${wallet.address}`))).json()
    assert.equal(body.verified, false)
  })

  test('rejects a malformed address', async () => {
    assert.equal((await status(get('/api/status?address=nope'))).status, 400)
  })
})

describe('invite lookup', () => {
  test('resolves a real code to a masked referrer', async () => {
    const alice = createWallet()
    const { body } = await verifyWallet(alice)
    const code = body.record.inviteCode

    const lookup = await (await invite(get(`/api/invite?code=${code}`))).json()
    assert.equal(lookup.valid, true)
    assert.equal(lookup.code, code)
    assert.ok(lookup.referrer.includes('…'))
    assert.ok(!lookup.referrer.includes(alice.address))
  })

  test('reports unknown and malformed codes distinctly', async () => {
    const unknown = await (await invite(get('/api/invite?code=XRS-ZZZZZZ'))).json()
    assert.equal(unknown.valid, false)
    assert.equal(unknown.reason, 'unknown_code')

    const malformed = await (await invite(get('/api/invite?code=zzz'))).json()
    assert.equal(malformed.valid, false)
    assert.equal(malformed.reason, 'invalid_format')
  })
})

describe('export', () => {
  test('requires the admin token', async () => {
    assert.equal((await exportRegistry(get('/api/export'))).status, 401)
    assert.equal(
      (await exportRegistry(get('/api/export', { authorization: 'Bearer wrong' }))).status,
      401,
    )
  })

  test('returns the full registry with the admin token', async () => {
    const alice = createWallet()
    const bob = createWallet()
    const { body } = await verifyWallet(alice)
    await verifyWallet(bob, { inviteCode: body.record.inviteCode })

    const response = await exportRegistry(
      get('/api/export', { authorization: 'Bearer test-admin-token' }),
    )
    const registry = await response.json()

    assert.equal(response.status, 200)
    assert.equal(registry.totalVerified, 2)
    assert.equal(registry.totalReferrals, 1)

    // Unmasked addresses — this is the mainnet claim list.
    const addresses = registry.entries.map((entry) => entry.address)
    assert.ok(addresses.includes(alice.address))
    assert.ok(addresses.includes(bob.address))

    const aliceEntry = registry.entries.find((entry) => entry.address === alice.address)
    assert.equal(aliceEntry.referralCount, 1)
    assert.equal(aliceEntry.proof, undefined)
  })

  test('includes signature proof when asked', async () => {
    const wallet = createWallet()
    await verifyWallet(wallet)

    const response = await exportRegistry(
      get('/api/export?proof=1', { authorization: 'Bearer test-admin-token' }),
    )
    const registry = await response.json()
    const entry = registry.entries[0]

    assert.ok(entry.proof.signature)
    assert.ok(entry.proof.message.includes(wallet.address))

    // The exported proof must re-verify offline.
    const { verifySignature } = await import('../netlify/lib/ed25519.js')
    assert.equal(verifySignature(wallet.address, entry.proof.message, entry.proof.signature), true)
  })
})

// These read through a per-instance TTL cache, so they run last and each uses
// a fresh dataset with its own cache key where it matters.
describe('aggregates', () => {
  test('stats counts verifications, referrals and activity tiers', async () => {
    const alice = createWallet()
    const bob = createWallet()
    nodeState.balances[bob.address] = 1_000_000_000

    const { body } = await verifyWallet(alice)
    await verifyWallet(bob, { inviteCode: body.record.inviteCode })

    const result = await (await stats(get('/api/stats'))).json()
    assert.equal(result.network, 'xeris-testnet')
    assert.equal(result.totalVerified, 2)
    assert.equal(result.totalReferrals, 1)
    assert.equal(result.activity.new, 1)
    assert.equal(result.activity.funded, 1)
    assert.equal(result.verifiedLast24h, 2)
  })

  test('leaderboard ranks by referral count with masked addresses', async () => {
    const top = createWallet()
    const runnerUp = createWallet()

    const { body: topBody } = await verifyWallet(top)
    const { body: runnerBody } = await verifyWallet(runnerUp)

    for (let i = 0; i < 3; i += 1) {
      await verifyWallet(createWallet(), { inviteCode: topBody.record.inviteCode })
    }
    await verifyWallet(createWallet(), { inviteCode: runnerBody.record.inviteCode })

    const result = await (await leaderboard(get('/api/leaderboard?limit=7'))).json()

    assert.equal(result.entries.length, 2)
    assert.equal(result.entries[0].rank, 1)
    assert.equal(result.entries[0].referralCount, 3)
    assert.equal(result.entries[1].referralCount, 1)
    assert.ok(result.entries[0].address.includes('…'))
    assert.ok(!result.entries[0].address.includes(top.address))
  })

  test('leaderboard clamps the limit', async () => {
    const result = await (await leaderboard(get('/api/leaderboard?limit=99999'))).json()
    assert.ok(Array.isArray(result.entries))
  })
})
