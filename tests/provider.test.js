/**
 * Provider detection.
 *
 * The case that matters most: `window.solana` is shared ground between Xeris
 * and every other Solana wallet. Grabbing whatever sits there pops the wrong
 * wallet, which to a user looks like a phishing site — so these tests pin
 * the rule that identity beats capability.
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  findXerisProvider,
  identifyProvider,
  listForeignWallets,
  looksLikeXerisBrowser,
} from '../src/lib/provider.js'

const methods = () => ({ connect: async () => {}, signMessage: async () => {} })

const xeris = () => ({ isXeris: true, ...methods() })
const phantom = () => ({ isPhantom: true, ...methods() })
const solflare = () => ({ isSolflare: true, ...methods() })
const unlabelled = () => ({ ...methods() })

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'
const XERIS_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 XerisWeb4/1.2.0'

describe('refusing other wallets', () => {
  test('Phantom on window.solana is never used', () => {
    assert.equal(findXerisProvider({ solana: phantom() }, CHROME_UA), null)
  })

  test('Phantom is refused even inside the Xeris browser', () => {
    // A badge from another wallet disqualifies it regardless of context.
    assert.equal(findXerisProvider({ solana: phantom() }, XERIS_UA), null)
  })

  test('other known wallets are refused too', () => {
    for (const make of [solflare, () => ({ isBackpack: true, ...methods() }), () => ({ isBraveWallet: true, ...methods() })]) {
      assert.equal(findXerisProvider({ solana: make() }, CHROME_UA), null)
      assert.equal(findXerisProvider({ solana: make() }, XERIS_UA), null)
    }
  })

  test('Xeris wins when it shares the page with Phantom', () => {
    const wallet = xeris()
    const found = findXerisProvider({ xeris: wallet, solana: phantom() }, CHROME_UA)
    assert.equal(found.provider, wallet)
    assert.equal(found.via, 'xeris')
  })

  test('Xeris on window.solana is still found when it is the flagged one', () => {
    const wallet = xeris()
    const found = findXerisProvider({ solana: wallet }, CHROME_UA)
    assert.equal(found.provider, wallet)
    assert.equal(found.reason, 'isXeris flag')
  })
})

describe('accepting Xeris', () => {
  test('the isXeris flag is honoured on every known global', () => {
    for (const name of ['xeris', 'xerisWallet', 'XerisWallet', 'solana']) {
      const wallet = xeris()
      const found = findXerisProvider({ [name]: wallet }, CHROME_UA)
      assert.equal(found?.provider, wallet, `should find provider on window.${name}`)
    }
  })

  test('an unflagged provider is accepted inside the Xeris browser', () => {
    // Covers an Android build that forgets to set isXeris.
    const wallet = unlabelled()
    const found = findXerisProvider({ xeris: wallet }, XERIS_UA)
    assert.equal(found.provider, wallet)
    assert.match(found.reason, /unflagged/)
  })

  test('an unflagged provider is refused in an ordinary browser', () => {
    // This is what stopped the page reaching for Phantom on desktop.
    assert.equal(findXerisProvider({ solana: unlabelled() }, CHROME_UA), null)
    assert.equal(findXerisProvider({ xeris: unlabelled() }, CHROME_UA), null)
  })

  test('an unflagged provider missing signMessage is refused', () => {
    const useless = { connect: async () => {} }
    assert.equal(findXerisProvider({ xeris: useless }, XERIS_UA), null)
  })
})

describe('edge cases', () => {
  test('an empty or absent window yields nothing', () => {
    assert.equal(findXerisProvider({}, CHROME_UA), null)
    assert.equal(findXerisProvider(null, CHROME_UA), null)
    assert.equal(findXerisProvider(undefined, undefined), null)
  })

  test('user agent sniffing only matches Xeris', () => {
    assert.equal(looksLikeXerisBrowser(XERIS_UA), true)
    assert.equal(looksLikeXerisBrowser(CHROME_UA), false)
    assert.equal(looksLikeXerisBrowser(undefined), false)
    assert.equal(looksLikeXerisBrowser(''), false)
  })
})

describe('diagnostics helpers', () => {
  test('identifyProvider names the wallet', () => {
    assert.equal(identifyProvider(xeris()), 'Xeris')
    assert.equal(identifyProvider(phantom()), 'Phantom')
    assert.equal(identifyProvider(solflare()), 'Solflare')
    assert.equal(identifyProvider(unlabelled()), null)
    assert.equal(identifyProvider(null), null)
  })

  test('listForeignWallets reports what else is on the page', () => {
    const wallets = listForeignWallets({
      xeris: xeris(),
      solana: phantom(),
      ethereum: { isMetaMask: true },
    })
    assert.deepEqual(wallets.sort(), ['MetaMask', 'Phantom'])
    assert.deepEqual(listForeignWallets({ xeris: xeris() }), [])
  })
})
