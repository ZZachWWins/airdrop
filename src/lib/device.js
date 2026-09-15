/**
 * Platform sniffing, used only to tailor the "how do I get a wallet here"
 * instructions. Nothing about eligibility depends on it.
 */

function ua() {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
}

export function isIOS() {
  const s = ua()
  // iPadOS 13+ reports as a Mac; the touch-point count gives it away.
  const iPadOS =
    /Macintosh/.test(s) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(s) || iPadOS
}

export function isAndroid() {
  return /Android/i.test(ua())
}

export function isMobile() {
  return isIOS() || isAndroid()
}

/**
 * True when the page is running inside the Xeris Web4 browser. The injected
 * provider is the reliable signal; the UA string is only a hint for the brief
 * window before injection lands.
 */
export function isXerisBrowser() {
  if (typeof window === 'undefined') return false
  if (window.xeris?.isXeris || window.solana?.isXeris) return true
  return /Xeris/i.test(ua())
}

export function platformName() {
  if (isIOS()) return 'iOS'
  if (isAndroid()) return 'Android'
  return 'desktop'
}
