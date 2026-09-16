/**
 * Finding the Xeris wallet provider, and — just as importantly — not finding
 * somebody else's.
 *
 * `window.solana` is contested ground. It is where the older Xeris build
 * injects, and it is also where Phantom, Solflare, Backpack and every other
 * Solana wallet inject. A page that grabs whatever is there and calls
 * connect() will pop the wrong wallet, which to a crypto user looks exactly
 * like a phishing site.
 *
 * So identity beats capability. A provider is only used when it either says
 * it is Xeris, or is unlabelled *and* we are demonstrably inside the Xeris
 * Web4 browser. Anything carrying another wallet's badge is left alone no
 * matter what methods it exposes.
 */

/** Globals a Xeris provider has been seen under, in order of preference. */
const GLOBAL_NAMES = ['xeris', 'xerisWallet', 'XerisWallet', 'solana']

/**
 * Identity flags other wallets set on their injected provider. Any of these
 * disqualifies a provider outright — this list is the difference between
 * connecting a user's Xeris wallet and hijacking their Phantom.
 */
const FOREIGN_WALLET_FLAGS = [
  'isPhantom',
  'isSolflare',
  'isBackpack',
  'isGlow',
  'isGlowSolana',
  'isBraveWallet',
  'isExodus',
  'isCoinbaseWallet',
  'isCoinbaseBrowser',
  'isMetaMask',
  'isTrust',
  'isTrustWallet',
  'isTokenPocket',
  'isOkxWallet',
  'isOKExWallet',
  'isBitKeep',
  'isMathWallet',
  'isClover',
  'isCoin98',
  'isNightly',
  'isSlope',
  'isTorus',
  'isRabby',
  'isZerion',
]

/** The name of whatever wallet this provider claims to be, for diagnostics. */
export function identifyProvider(provider) {
  if (!provider || typeof provider !== 'object') return null
  if (provider.isXeris) return 'Xeris'
  const flag = FOREIGN_WALLET_FLAGS.find((name) => provider[name])
  if (!flag) return null
  // isPhantom -> Phantom
  return flag.replace(/^is/, '')
}

function isForeignWallet(provider) {
  return FOREIGN_WALLET_FLAGS.some((flag) => provider?.[flag])
}

function isUsable(provider) {
  return (
    provider &&
    typeof provider === 'object' &&
    typeof provider.connect === 'function' &&
    typeof provider.signMessage === 'function'
  )
}

/** True when the user agent says we are inside the Xeris Web4 browser. */
export function looksLikeXerisBrowser(userAgent) {
  return /xeris/i.test(String(userAgent ?? ''))
}

/**
 * Locate the Xeris provider on a window-like object.
 *
 * @param {object} win        window, or a stand-in in tests
 * @param {string} userAgent  navigator.userAgent
 * @returns {{provider: object, via: string, reason: string} | null}
 */
export function findXerisProvider(win, userAgent) {
  if (!win) return null

  const candidates = GLOBAL_NAMES.map((name) => ({ name, provider: win[name] })).filter(
    (entry) => entry.provider,
  )

  // 1. An explicit isXeris flag is definitive, wherever it is injected.
  const flagged = candidates.find((entry) => entry.provider.isXeris)
  if (flagged) {
    return { provider: flagged.provider, via: flagged.name, reason: 'isXeris flag' }
  }

  // 2. No flag. Only trust an unlabelled provider when the browser itself
  //    identifies as Xeris Web4 — this covers a build that forgets the flag
  //    without ever reaching for a third-party wallet on a normal browser.
  if (!looksLikeXerisBrowser(userAgent)) return null

  const unlabelled = candidates.find(
    (entry) => isUsable(entry.provider) && !isForeignWallet(entry.provider),
  )
  if (unlabelled) {
    return {
      provider: unlabelled.provider,
      via: unlabelled.name,
      reason: 'unflagged provider inside the Xeris Web4 browser',
    }
  }

  return null
}

/** Foreign wallets present on the page, for the diagnostics report. */
export function listForeignWallets(win) {
  if (!win) return []
  const seen = new Set()
  for (const name of [...GLOBAL_NAMES, 'ethereum']) {
    const label = identifyProvider(win[name])
    if (label && label !== 'Xeris') seen.add(label)
  }
  return [...seen]
}
