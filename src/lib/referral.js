import { CODE_PREFIX, normaliseCode } from './inviteCode'

const STORAGE_KEY = 'xeris_airdrop_ref'

/**
 * Referral capture.
 *
 * A code arrives either as `?ref=XRS-A1B2C3` or as the path `/r/XRS-A1B2C3`,
 * and has to survive the round trip out to the Xeris Web4 browser — the
 * visitor usually lands here in Safari or Chrome, then reopens the same link
 * in the wallet app. Stashing it in localStorage means the code is still there
 * after that hop, and after any number of page reloads before they verify.
 */

export function readCodeFromLocation(search, pathname) {
  const fromQuery = new URLSearchParams(search || '').get('ref')
  if (fromQuery) return normaliseCode(fromQuery)

  const match = /^\/r\/([^/]+)/.exec(pathname || '')
  if (match) return normaliseCode(decodeURIComponent(match[1]))

  return null
}

export function storeCode(code) {
  const normalised = normaliseCode(code)
  if (!normalised) return null
  try {
    localStorage.setItem(STORAGE_KEY, normalised)
  } catch {
    // Private browsing blocks writes; the in-memory value still covers this
    // page view, it just will not survive a reload.
  }
  return normalised
}

export function readStoredCode() {
  try {
    return normaliseCode(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function clearStoredCode() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** The shareable link for an invite code. */
export function buildInviteUrl(code, origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/r/${code}`
}

export { CODE_PREFIX, normaliseCode }
