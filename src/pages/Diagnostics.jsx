import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useWallet } from '../context/WalletContext'
import { findXerisProvider, listForeignWallets } from '../lib/provider'
import { getCspViolations } from '../lib/cspReport'
import { fetchNetwork } from '../lib/api'
import { toSignatureBytes } from '../lib/signature'
import './Diagnostics.css'

/**
 * /diagnostics — a page to hand to someone whose wallet will not connect.
 *
 * Wallet bridges differ by platform in ways that are invisible from the
 * outside: the provider lands under a different global, arrives later than
 * expected, gets blocked by CSP, or returns a signature in a shape the page
 * cannot read. All of those present identically to a user ("it doesn't
 * work"), so this reports which one it actually is, on their device, and
 * gives them one button to copy the whole thing into a bug report.
 *
 * Deliberately unlinked from the nav — it is a support tool, not a feature.
 */

const GLOBALS = ['xeris', 'solana', 'xerisWallet', 'XerisWallet', 'ethereum']
const PROVIDER_METHODS = ['connect', 'disconnect', 'signMessage', 'signTransaction', 'on', 'off']

/**
 * Read the live globals rather than a value captured at render. The provider
 * can inject seconds after mount — a stale read here would report "no
 * provider" on a device that has one, which is the exact class of bug this
 * page exists to diagnose.
 */
function liveMatch() {
  if (typeof window === 'undefined') return null
  return findXerisProvider(window, navigator.userAgent)
}

function describe(value) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (value instanceof Uint8Array) return `Uint8Array(${value.length})`
  if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength})`
  if (Array.isArray(value)) return `Array(${value.length})`
  if (typeof value === 'string') return `string(${value.length}) "${value.slice(0, 24)}…"`
  if (typeof value === 'object') {
    const keys = Object.keys(value)
    const numeric = keys.length > 0 && keys.every((key) => /^\d+$/.test(key))
    return `object{${numeric ? `numeric-keyed, ${keys.length} entries` : keys.slice(0, 6).join(', ')}}`
  }
  return typeof value
}

function Row({ label, ok, detail }) {
  return (
    <div className="diag-row">
      <span className={`diag-mark ${ok === null ? 'unknown' : ok ? 'ok' : 'bad'}`}>
        {ok === null ? '·' : ok ? <Check size={13} /> : <X size={13} />}
      </span>
      <span className="diag-label">{label}</span>
      <span className="diag-detail mono">{detail}</span>
    </div>
  )
}

export function Diagnostics() {
  const [signTest, setSignTest] = useState(null)
  const [apiTest, setApiTest] = useState(null)
  const [copied, setCopied] = useState(false)

  // Re-render as detection progresses so the report reflects the live page
  // rather than whatever existed at mount.
  const { walletProvider, isDetecting } = useWallet()
  const found = GLOBALS.filter((name) => typeof window[name] !== 'undefined')
  const match = liveMatch()
  const provider = walletProvider ?? match?.provider
  const foreign = listForeignWallets(window)
  const violations = getCspViolations()

  const report = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    secureContext: window.isSecureContext,
    origin: window.location.origin,
    globalsPresent: found,
    providerMethods: provider
      ? PROVIDER_METHODS.filter((m) => typeof provider[m] === 'function')
      : [],
    isXerisFlag: provider?.isXeris ?? null,
    matchedVia: match?.via ?? null,
    matchedReason: match?.reason ?? null,
    otherWalletsOnPage: foreign,
    cspViolations: violations,
    signTest,
    apiTest,
  }

  const runApiTest = async () => {
    setApiTest({ state: 'running' })
    try {
      const data = await fetchNetwork()
      setApiTest({ state: 'ok', online: data.online, blockHeight: data.blockHeight })
    } catch (err) {
      setApiTest({ state: 'failed', error: String(err?.message ?? err) })
    }
  }

  // The important one. Reports the *raw shape* the wallet returned, so an
  // Android bridge quirk is visible instead of being guessed at.
  const runSignTest = async () => {
    setSignTest({ state: 'running' })
    try {
      // Read it again at click time — detection may have completed since.
      const active = liveMatch()?.provider ?? provider
      if (!active) {
        const others = listForeignWallets(window)
        throw new Error(
          isDetecting
            ? 'Still looking for a wallet provider — wait a moment and try again.'
            : others.length
              ? `No Xeris wallet found. ${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} installed, but this page will not connect another wallet.`
              : 'No wallet provider found on this page.',
        )
      }
      const address = await active.connect()
      const message = `Xeris diagnostics ${Date.now()}`
      const raw = await active.signMessage(new TextEncoder().encode(message))

      let decoded = null
      let decodeError = null
      try {
        decoded = `${toSignatureBytes(raw).length} bytes`
      } catch (err) {
        decodeError = String(err?.message ?? err)
      }

      setSignTest({
        state: 'ok',
        connected: describe(address),
        returnedType: describe(raw),
        unwrappedType: describe(raw?.signature ?? raw),
        decoded,
        decodeError,
      })
    } catch (err) {
      setSignTest({ state: 'failed', error: String(err?.message ?? err) })
    }
  }

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="page container diagnostics">
      <p className="eyebrow">Diagnostics</p>
      <h1 className="section-title">Wallet connection report</h1>
      <p className="section-sub">
        Open this page on the device where connecting fails, run both tests, then copy the report.
        It captures which wallet globals exist, what the bridge returns, and anything the browser
        blocked.
      </p>

      <Card className="diag-card static">
        <p className="eyebrow">Environment</p>
        <Row label="Secure context (https)" ok={window.isSecureContext} detail={window.location.protocol} />
        <Row label="Wallet global present" ok={found.length > 0} detail={found.join(', ') || 'none'} />
        <Row
          label="Xeris provider matched"
          ok={Boolean(provider)}
          detail={match ? `window.${match.via} — ${match.reason}` : 'no match'}
        />
        {/* Other wallets sharing window.solana are the reason detection is
            identity-based. Seeing them listed here, and ignored, is the
            answer to "why is it prompting Phantom". */}
        <Row
          label="Other wallets on page"
          ok={null}
          detail={foreign.length ? `${foreign.join(', ')} (ignored)` : 'none'}
        />
        <Row
          label="signMessage available"
          ok={typeof provider?.signMessage === 'function'}
          detail={report.providerMethods.join(', ') || 'none'}
        />
        <Row
          label="CSP violations"
          ok={violations.length === 0}
          detail={
            violations.length === 0
              ? 'none'
              : violations.map((v) => `${v.directive} blocked ${v.blockedURI || 'inline'}`).join(' | ')
          }
        />
      </Card>

      <Card className="diag-card static">
        <p className="eyebrow">Live tests</p>

        <div className="diag-actions">
          <Button variant="secondary" size="sm" onClick={runApiTest}>
            Test API
          </Button>
          <Button variant="accent" size="sm" onClick={runSignTest}>
            Test connect &amp; sign
          </Button>
        </div>

        {apiTest && (
          <pre className="diag-out mono">{JSON.stringify(apiTest, null, 2)}</pre>
        )}
        {signTest && (
          <pre className="diag-out mono">{JSON.stringify(signTest, null, 2)}</pre>
        )}
      </Card>

      <Card className="diag-card static">
        <p className="eyebrow">User agent</p>
        <pre className="diag-out mono">{navigator.userAgent}</pre>

        <Button variant="secondary" className="btn-block diag-copy" onClick={copyReport}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Report copied' : 'Copy full report'}
        </Button>
      </Card>
    </div>
  )
}
