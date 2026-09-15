import { useState } from 'react'
import { Apple, Check, Copy, Smartphone, ExternalLink } from 'lucide-react'
import { Button } from '../ui/Button'
import { APP_STORE_URL, PLAY_STORE_URL, WALLET_SITE_URL, buildDeeplink } from '../../lib/config'
import { isAndroid, isIOS, isMobile } from '../../lib/device'
import './WalletGate.css'

/**
 * Shown when the page is open somewhere the Xeris provider is not injected.
 * Verification requires a signature from the Xeris Web4 wallet, so the only
 * way forward is to reopen this URL inside the app — this panel makes that
 * as short a path as we can manage on each platform.
 */
export function WalletGate() {
  const [copied, setCopied] = useState(false)
  const pageUrl = typeof window === 'undefined' ? '' : window.location.href
  const deeplink = buildDeeplink(pageUrl)

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
      <p className="eyebrow">Wallet required</p>
      <h3 className="wallet-gate-title">Open this page in Xeris Web4</h3>
      <p className="wallet-gate-copy">
        Verification is a signature from your Xeris wallet key, so it has to happen inside the
        Xeris Web4 browser on {isMobile() ? 'your phone' : 'iOS or Android'}. Nothing is spent and
        no transaction is broadcast.
      </p>

      {deeplink && isMobile() && (
        <Button variant="accent" size="lg" className="btn-block" onClick={() => { window.location.href = deeplink }}>
          <Smartphone size={16} /> Open in Xeris Web4
        </Button>
      )}

      <ol className="wallet-gate-steps">
        <li>Open the Xeris Web4 app.</li>
        <li>Tap the browser tab and paste the link below.</li>
        <li>Come back here and hit Connect.</li>
      </ol>

      <div className="wallet-gate-url">
        <code>{pageUrl}</code>
        <button onClick={copyLink} aria-label="Copy link" className="wallet-gate-copy-btn">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {copied && <p className="wallet-gate-copied">Link copied.</p>}

      <div className="wallet-gate-stores">
        {APP_STORE_URL && (!isMobile() || isIOS()) && (
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer noopener" className="store-link">
            <Apple size={14} /> App Store
          </a>
        )}
        {PLAY_STORE_URL && (!isMobile() || isAndroid()) && (
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
