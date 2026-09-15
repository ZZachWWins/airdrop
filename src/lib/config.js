/**
 * Frontend configuration. Everything here can be overridden at build time with
 * a `VITE_*` environment variable in the Netlify UI — no rebuild of the code
 * itself is needed to repoint the campaign at a different network or wallet.
 */

const env = import.meta.env

/** Human-readable name of the network users are verifying on. */
export const NETWORK_LABEL = env.VITE_NETWORK_LABEL || 'Xeris Testnet'

/** Stable network id recorded on every verification record. */
export const NETWORK_ID = env.VITE_NETWORK_ID || 'xeris-testnet'

/** Ticker of the token being airdropped on mainnet. */
export const TOKEN_SYMBOL = env.VITE_TOKEN_SYMBOL || 'XRS'

/**
 * Deep link used to reopen this page inside the Xeris Web4 browser when the
 * visitor is on a mobile browser that is *not* Xeris. Set
 * `VITE_WALLET_DEEPLINK` to the scheme the Xeris app registers — the `{url}`
 * placeholder is replaced with the URL-encoded current page. When unset the UI
 * falls back to copy-the-link instructions instead of offering a dead link.
 */
export const WALLET_DEEPLINK = env.VITE_WALLET_DEEPLINK || ''

/** Store links shown to visitors who do not have the app yet. */
export const APP_STORE_URL = env.VITE_APP_STORE_URL || ''
export const PLAY_STORE_URL = env.VITE_PLAY_STORE_URL || ''

/** Where to send people who want the wallet but are on desktop. */
export const WALLET_SITE_URL = env.VITE_WALLET_SITE_URL || 'https://xerisweb.com'

/** Sibling dapps, linked from the footer. */
export const DEX_URL = env.VITE_DEX_URL || 'https://dex.xerisweb.com'
export const LAUNCHPAD_URL = env.VITE_LAUNCHPAD_URL || 'https://launchpad.xerisweb.com'

/** Build the Web4 deep link for a given page URL, or null if unconfigured. */
export function buildDeeplink(pageUrl) {
  if (!WALLET_DEEPLINK) return null
  return WALLET_DEEPLINK.includes('{url}')
    ? WALLET_DEEPLINK.replace('{url}', encodeURIComponent(pageUrl))
    : WALLET_DEEPLINK + encodeURIComponent(pageUrl)
}
