import { useState } from 'react'
import { Apple, Check, Copy, Smartphone, ExternalLink } from 'lucide-react'
import { Button } from '../ui/Button'
import { QrHandoff } from './QrHandoff'
import { APP_STORE_URL, PLAY_STORE_URL, WALLET_SITE_URL, buildDeeplink } from '../../lib/config'
import { isAndroid, isIOS, isMobile } from '../../lib/device'
import './WalletGate.css'

/**
 * Shown when the page is open somewhere the Xeris provider is not injected.
 *
 * There are two genuinely different situations here, and conflating them is
 * what makes this panel read as an error:
 *
 *  - On **desktop** there is no Xeris wallet at all, and there never will be
 *    — the key lives in the mobile app. This is not a failure, it is a
 *    handoff, so desktop gets a QR code and is told plainly that verifying
 *    happens on a phone.
 *  - On **mobile**, the user probably does have the app and is simply in the
 *    wrong browser, so the job is to get them into Xeris Web4 with the URL
 *    intact.
 */
export function WalletGate() {
  const [copied, setCopied] = useState(false)
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href
  const deeplink = buildDeeplink(pageUrl)
  const onMobile = isMobile()

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

  return (
    <div className="wallet-gate">
      <p className="eyebrow">{onMobile ? 'Wallet required' : 'Continue on your phone'}</p>
      <h3 className="wallet-gate-title">
        {onMobile ? 'Open this page in Xeris Web4' : 'Verifying happens on mobile'}
      </h3>
      <p className="wallet-gate-copy">
        {onMobile ? (
          <>
            Verification is a signature from your Xeris wallet key, so it has to happen inside the
            Xeris Web4 browser. Nothing is spent and no transaction is broadcast.
          </>
        ) : (
          <>
            Your Xeris key lives in the Xeris Web4 app on iOS and Android, so there is nothing to
            install on desktop. Scan the code below to carry this page — and your invite code —
            straight to your phone.
          </>
        )}
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
          <li>Open the Xeris Web4 app.</li>
          <li>Tap the browser tab and paste the link below.</li>
          <li>Come back here and hit Connect.</li>
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
        {PLAY_STORE_URL && (!onMobile || isAndroid()) && (
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
