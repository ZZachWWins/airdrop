import { useState } from 'react'
import { Apple, Check, Copy, Smartphone, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { QrHandoff } from './QrHandoff'
import {
  ANDROID_SUPPORTED,
  APP_STORE_URL,
  PLAY_STORE_URL,
  WALLET_SITE_URL,
  buildDeeplink,
} from '../../lib/config'
import { isAndroid, isIOS, isMobile } from '../../lib/device'
import './WalletGate.css'

/**
 * Shown when the page is open somewhere the Xeris provider is not injected.
 *
 * Three genuinely different situations, and conflating them is what makes
 * this panel read as an error:
 *
 *  - **Android, before the bridge ships.** Nothing the visitor does will
 *    work, so they are told that instead of being walked through steps that
 *    end in failure. This is messaging only — detection stays
 *    capability-based, so an Android device that does inject a working
 *    provider never reaches this panel.
 *  - **iOS in the wrong browser.** They have the app; the job is to get them
 *    into it with the URL intact.
 *  - **Desktop.** There is no Xeris wallet here and never will be, so this is
 *    a handoff to a phone, not a failure.
 */
export function WalletGate() {
  const [copied, setCopied] = useState(false)
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href
  const deeplink = buildDeeplink(pageUrl)

  const onMobile = isMobile()
  const androidWaiting = isAndroid() && !ANDROID_SUPPORTED

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard is blocked in some in-app browsers — the URL is shown in
      // full below so it can still be selected by hand.
      setCopied(false)
    }
  }

  // ── Android, bridge not shipped ─────────────────────────────────────────
  if (androidWaiting) {
    return (
      <div className="wallet-gate">
        <p className="eyebrow">Coming to Android</p>
        <h3 className="wallet-gate-title">iPhone only for now</h3>
        <p className="wallet-gate-copy">
          Verifying needs the Xeris Web4 wallet bridge, which is live on iOS first. Android
          support is on the way.
        </p>

        <div className="wallet-gate-note">
          <Smartphone size={15} />
          <p>
            On an iPhone? Open this link in Xeris Web4 there and it will work today.
          </p>
        </div>

        <div className="wallet-gate-url">
          <code>{pageUrl}</code>
          <button onClick={copyLink} aria-label="Copy link" className="wallet-gate-copy-btn">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        {copied && <p className="wallet-gate-copied">Link copied.</p>}

        <div className="wallet-gate-stores">
          <Link to="/faq" className="store-link">
            Read the FAQ
          </Link>
        </div>
      </div>
    )
  }

  // ── iOS in the wrong browser, or desktop ────────────────────────────────
  return (
    <div className="wallet-gate">
      <p className="eyebrow">{onMobile ? 'Wallet required' : 'Continue on your phone'}</p>
      <h3 className="wallet-gate-title">
        {onMobile ? 'Open this page in Xeris Web4' : 'Verifying happens on iPhone'}
      </h3>
      <p className="wallet-gate-copy">
        {onMobile
          ? 'Signing needs your Xeris key, so it happens inside the app.'
          : 'Your Xeris key lives in the iOS app. Scan to continue there.'}
      </p>

      {!onMobile && <QrHandoff url={pageUrl} />}

      {deeplink && onMobile && (
        <Button
          variant="accent"
          size="lg"
          className="btn-block"
          onClick={() => {
            window.location.href = deeplink
          }}
        >
          <Smartphone size={16} /> Open in Xeris Web4
        </Button>
      )}

      {onMobile && (
        <ol className="wallet-gate-steps">
          <li>Open Xeris Web4.</li>
          <li>Paste this link in its browser.</li>
          <li>Hit Connect.</li>
        </ol>
      )}

      <div className="wallet-gate-url">
        <code>{pageUrl}</code>
        <button onClick={copyLink} aria-label="Copy link" className="wallet-gate-copy-btn">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {copied && <p className="wallet-gate-copied">Link copied.</p>}

      <div className="wallet-gate-stores">
        {APP_STORE_URL && (!onMobile || isIOS()) && (
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer noopener" className="store-link">
            <Apple size={14} /> App Store
          </a>
        )}
        {PLAY_STORE_URL && ANDROID_SUPPORTED && (!onMobile || isAndroid()) && (
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer noopener" className="store-link">
            <Smartphone size={14} /> Google Play
          </a>
        )}
        {!APP_STORE_URL && !PLAY_STORE_URL && (
          <a href={WALLET_SITE_URL} target="_blank" rel="noreferrer noopener" className="store-link">
            <ExternalLink size={14} /> Get Xeris Web4
          </a>
        )}
      </div>
    </div>
  )
}
