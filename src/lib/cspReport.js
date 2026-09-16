/**
 * Collects Content-Security-Policy violations from page load onward.
 *
 * Installed before React mounts, because the violation that matters most —
 * the wallet browser's provider injection being blocked — happens during
 * initial load, long before anyone could navigate to the diagnostics page.
 *
 * A blocked injection is invisible otherwise: the page looks fine, the wallet
 * simply is not there, and the user is told they need an app they are already
 * using.
 */

const violations = []
const MAX = 25

export function installCspReporter() {
  if (typeof document === 'undefined') return

  document.addEventListener('securitypolicyviolation', (event) => {
    if (violations.length >= MAX) return
    violations.push({
      directive: event.effectiveDirective || event.violatedDirective,
      blockedURI: event.blockedURI,
      sourceFile: event.sourceFile,
      line: event.lineNumber,
      at: Date.now(),
    })
  })
}

export function getCspViolations() {
  return violations
}
