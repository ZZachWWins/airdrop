/**
 * Integration tests for the mainnet claim flow.
 *
 * The properties that matter most here: a payout address cannot be swapped
 * after signing, a verification signature cannot be spent as a claim, and a
 * paid claim cannot be re-pointed.
 */

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, mock, test } from 'node:test'

import { resetBlobs } from './helpers/blobsMock.js'
import { createWallet } from './helpers/wallet.js'

process.env.XERIS_NODE_URL = 'https://node.test'
process.env.XERIS_NETWORK_ID = 'xeris-testnet'
process.env.XERIS_MAINNET_NETWORK_ID = 'xeris-mainnet'
process.env.ADMIN_TOKEN = 'test-admin-token'
process.env.CLAIM_PHASE = 'open'

mock.module('@netlify/blobs', {
  namedExports: { getStore: (await import('./helpers/blobsMock.js')).getStore },
})

const challenge = (await import('../netlify/functions/challenge.js')).default
const verify = (await import('../netlify/functions/verify.js')).default
const claimChallenge = (await import('../netlify/functions/claim-challenge.js')).default
const claim = (await import('../netlify/functions/claim.js')).default
const payouts = (await import('../netlify/functions/payouts.js')).default
const exportRegistry = (await import('../netlify/functions/export.js')).default

// ── Node stub ─────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch

before(() => {
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname
    if (path === '/blocks') return Response.json([{ height: 900_100, hash: 'abc123' }])
    if (path.startsWith('/token/balance/')) return Response.json({ balance: 0 })
    return new Response('not found', { status: 404 })
  }
})
after(() => {
  globalThis.fetch = realFetch
})

beforeEach(() => {
  resetBlobs()
  process.env.CLAIM_PHASE = 'open'
})

// ── Helpers ───────────────────────────────────────────────────────────────

const post = (path, body) =>
  new Request(`https://airdrop.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const get = (path, headers = {}) =>
  new Request(`https://airdrop.test${path}`, { method: 'GET', headers })

const admin = { authorization: 'Bearer test-admin-token' }

async function verifyWallet(wallet) {
  const res = await challenge(post('/api/challenge', { address: wallet.address }))
  const { nonce, message } = await res.json()
  return verify(
    post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
  )
}

/** Full claim: challenge with the payout address, sign, submit. */
async function claimTo(wallet, mainnetAddress) {
  const res = await claimChallenge(
    post('/api/claim/challenge', { address: wallet.address, mainnetAddress }),
  )
  if (!res.ok) return { response: res, body: await res.json() }

  const { nonce, message } = await res.json()
  const response = await claim(
    post('/api/claim', { address: wallet.address, nonce, signature: wallet.sign(message) }),
  )
  return { response, body: await response.json(), message }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('claim challenge', () => {
  test('bakes the payout address into the signed text', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    const body = await res.json()

    assert.equal(res.status, 200)
    assert.match(body.message, new RegExp(mainnet.address))
    assert.match(body.message, new RegExp(wallet.address))
    assert.match(body.message, /xeris-mainnet/)
  })

  test('refuses an unverified wallet before any signing', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    assert.equal(res.status, 403)
    assert.equal((await res.json()).reason, 'not_verified')
  })

  test('rejects a malformed payout address', async () => {
    const wallet = createWallet()
    await verifyWallet(wallet)

    for (const bad of ['', 'nope', '0OIl-invalid', null]) {
      const res = await claimChallenge(
        post('/api/claim/challenge', { address: wallet.address, mainnetAddress: bad }),
      )
      assert.equal(res.status, 400)
      assert.equal((await res.json()).reason, 'invalid_mainnet_address')
    }
  })

  test('rejects the testnet address as the payout address', async () => {
    const wallet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: wallet.address }),
    )
    assert.equal(res.status, 400)
    assert.equal((await res.json()).reason, 'same_as_testnet')
  })

  test('is shut while the claim window is closed', async () => {
    process.env.CLAIM_PHASE = 'closed'
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    assert.equal(res.status, 403)
    assert.equal((await res.json()).reason, 'claim_closed')
  })
})

describe('claim', () => {
  test('records the binding authorised by the testnet key', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const { response, body } = await claimTo(wallet, mainnet.address)

    assert.equal(response.status, 201)
    assert.equal(body.claim.mainnetAddress, mainnet.address)
    assert.equal(body.claim.testnetAddress, wallet.address)
    assert.equal(body.claim.status, 'pending')
    assert.equal(body.walletsPayingToThisAddress, 1)
  })

  test('ignores a payout address supplied in the claim body', async () => {
    const wallet = createWallet()
    const intended = createWallet()
    const attacker = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: intended.address }),
    )
    const { nonce, message } = await res.json()

    // Sign for `intended`, then try to submit with `attacker` in the body.
    const response = await claim(
      post('/api/claim', {
        address: wallet.address,
        nonce,
        signature: wallet.sign(message),
        mainnetAddress: attacker.address,
      }),
    )
    const body = await response.json()

    assert.equal(response.status, 201)
    // The signed address wins; the body is not consulted at all.
    assert.equal(body.claim.mainnetAddress, intended.address)
  })

  test('rejects a signature from a different key', async () => {
    const wallet = createWallet()
    const impostor = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    const { nonce, message } = await res.json()

    const response = await claim(
      post('/api/claim', { address: wallet.address, nonce, signature: impostor.sign(message) }),
    )
    assert.equal(response.status, 401)
    assert.equal((await response.json()).reason, 'bad_signature')
  })

  test('refuses a verification challenge used as a claim', async () => {
    const wallet = createWallet()
    await verifyWallet(wallet)

    // A fresh *verification* challenge, signed correctly, presented to /claim.
    const res = await challenge(post('/api/challenge', { address: wallet.address }))
    const { nonce, message } = await res.json()

    const response = await claim(
      post('/api/claim', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(response.status, 400)
    assert.equal((await response.json()).reason, 'nonce_purpose_mismatch')
  })

  test('refuses a claim challenge used as a verification', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    const { nonce, message } = await res.json()

    const response = await verify(
      post('/api/verify', { address: wallet.address, nonce, signature: wallet.sign(message) }),
    )
    assert.equal(response.status, 400)
    assert.equal((await response.json()).reason, 'nonce_purpose_mismatch')
  })

  test('rejects a replayed claim nonce', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const res = await claimChallenge(
      post('/api/claim/challenge', { address: wallet.address, mainnetAddress: mainnet.address }),
    )
    const { nonce, message } = await res.json()
    const signature = wallet.sign(message)

    await claim(post('/api/claim', { address: wallet.address, nonce, signature }))
    const replay = await claim(post('/api/claim', { address: wallet.address, nonce, signature }))

    assert.equal(replay.status, 400)
    assert.equal((await replay.json()).reason, 'nonce_not_found')
  })

  test('re-binding keeps history and moves the payout index', async () => {
    const wallet = createWallet()
    const first = createWallet()
    const second = createWallet()
    await verifyWallet(wallet)

    await claimTo(wallet, first.address)
    const { response, body } = await claimTo(wallet, second.address)

    assert.equal(response.status, 200)
    assert.equal(body.claim.mainnetAddress, second.address)
    assert.equal(body.claim.rebindCount, 1)
    // The old address no longer counts as paying out to this wallet.
    assert.equal(body.walletsPayingToThisAddress, 1)
  })

  test('several testnet wallets may consolidate to one payout address', async () => {
    const mainnet = createWallet()
    const wallets = [createWallet(), createWallet(), createWallet()]

    for (const wallet of wallets) {
      await verifyWallet(wallet)
      await claimTo(wallet, mainnet.address)
    }

    const last = await claimTo(createWallet(), mainnet.address)
    assert.equal(last.response.status, 403) // unverified wallet

    const list = await (await payouts(get('/api/payouts', admin))).json()
    const entry = list.entries.find((e) => e.testnetAddress === wallets[0].address)
    assert.equal(entry.walletsPayingToThisAddress, 3)
  })

  test('status reports eligibility and the current binding', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)

    const before = await (await claim(get(`/api/claim?address=${wallet.address}`))).json()
    assert.equal(before.eligible, true)
    assert.equal(before.claim, null)
    assert.equal(before.phase, 'open')

    await claimTo(wallet, mainnet.address)

    const after = await (await claim(get(`/api/claim?address=${wallet.address}`))).json()
    assert.equal(after.claim.mainnetAddress, mainnet.address)
    assert.equal(after.claim.status, 'pending')
  })

  test('the stored authorisation re-verifies offline', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    const list = await (await payouts(get('/api/payouts?verify=1', admin))).json()
    assert.equal(list.entries[0].proofValid, true)
    assert.equal(list.proofsInvalid, 0)
  })
})

describe('payouts', () => {
  test('requires the admin token', async () => {
    assert.equal((await payouts(get('/api/payouts'))).status, 401)
    assert.equal(
      (await payouts(get('/api/payouts', { authorization: 'Bearer wrong' }))).status,
      401,
    )
  })

  test('lists unpaid claims with the data needed to size an allocation', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    const list = await (await payouts(get('/api/payouts', admin))).json()
    const entry = list.entries[0]

    assert.equal(list.unpaid, 1)
    assert.equal(entry.testnetAddress, wallet.address)
    assert.equal(entry.mainnetAddress, mainnet.address)
    assert.equal(entry.testnetActivity, 'new')
    assert.equal(entry.verifiedAtBlock, 900_100)
    assert.equal(entry.referralCount, 0)
  })

  test('marks paid, and is idempotent on a re-run', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    const first = await (
      await payouts(
        new Request('https://airdrop.test/api/payouts', {
          method: 'POST',
          headers: { ...admin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments: [{ testnetAddress: wallet.address, txId: 'tx-1' }] }),
        }),
      )
    ).json()
    assert.equal(first.marked, 1)

    // Same run again — must not double-pay.
    const second = await (
      await payouts(
        new Request('https://airdrop.test/api/payouts', {
          method: 'POST',
          headers: { ...admin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments: [{ testnetAddress: wallet.address, txId: 'tx-1' }] }),
        }),
      )
    ).json()
    assert.equal(second.marked, 0)
    assert.equal(second.results[0].status, 'already_marked')

    // A different tx id for an already-paid claim is flagged, not applied.
    const third = await (
      await payouts(
        new Request('https://airdrop.test/api/payouts', {
          method: 'POST',
          headers: { ...admin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments: [{ testnetAddress: wallet.address, txId: 'tx-2' }] }),
        }),
      )
    ).json()
    assert.equal(third.results[0].status, 'already_paid_other_tx')
    assert.equal(third.results[0].payoutTxId, 'tx-1')

    // Unpaid list is now empty.
    const list = await (await payouts(get('/api/payouts', admin))).json()
    assert.equal(list.unpaid, 0)
    assert.equal(list.entries.length, 0)
  })

  test('a paid claim cannot be re-pointed', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    const other = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    await payouts(
      new Request('https://airdrop.test/api/payouts', {
        method: 'POST',
        headers: { ...admin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments: [{ testnetAddress: wallet.address, txId: 'tx-1' }] }),
      }),
    )

    const { response, body } = await claimTo(wallet, other.address)
    assert.equal(response.status, 409)
    assert.equal(body.reason, 'already_paid')
    assert.equal(body.claim.mainnetAddress, mainnet.address)
  })

  test('reports bad entries per-payment without failing the batch', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    const result = await (
      await payouts(
        new Request('https://airdrop.test/api/payouts', {
          method: 'POST',
          headers: { ...admin, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payments: [
              { testnetAddress: wallet.address, txId: 'tx-ok' },
              { testnetAddress: 'garbage', txId: 'tx-2' },
              { testnetAddress: createWallet().address, txId: 'tx-3' },
              { testnetAddress: wallet.address, txId: '  ' },
            ],
          }),
        }),
      )
    ).json()

    assert.equal(result.marked, 1)
    assert.deepEqual(
      result.results.map((r) => r.status),
      ['marked', 'invalid_address', 'no_claim', 'missing_tx_id'],
    )
  })
})

describe('export with claims', () => {
  test('carries the payout binding and both proofs', async () => {
    const wallet = createWallet()
    const mainnet = createWallet()
    await verifyWallet(wallet)
    await claimTo(wallet, mainnet.address)

    const registry = await (
      await exportRegistry(get('/api/export?proof=1', admin))
    ).json()
    const entry = registry.entries[0]

    assert.equal(registry.totalClaimed, 1)
    assert.equal(entry.mainnetAddress, mainnet.address)
    assert.ok(entry.claimProof.signature)
    assert.match(entry.claimProof.message, new RegExp(mainnet.address))

    const { verifySignature } = await import('../netlify/lib/ed25519.js')
    assert.equal(
      verifySignature(wallet.address, entry.claimProof.message, entry.claimProof.signature),
      true,
    )
  })

  test('leaves the binding null for wallets that have not claimed', async () => {
    const wallet = createWallet()
    await verifyWallet(wallet)

    const registry = await (await exportRegistry(get('/api/export', admin))).json()
    assert.equal(registry.totalClaimed, 0)
    assert.equal(registry.entries[0].mainnetAddress, null)
  })
})
