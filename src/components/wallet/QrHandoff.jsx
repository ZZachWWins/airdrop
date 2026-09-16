import { useEffect, useState } from 'react'
import './QrHandoff.css'

/**
 * A QR code of the current URL, so a desktop visitor can hand the page to
 * their phone.
 *
 * There is no Xeris wallet for desktop browsers — verification needs a key
 * that only lives in the mobile app — so desktop would otherwise be a dead
 * end that reads like a bug ("Chrome says it doesn't support Xeris Web4").
 * Scanning is the standard way out of that, and it is the same pattern
 * WalletConnect uses.
 *
 * The encoded URL is `window.location.href`, which carries any `?ref=` code
 * with it — a referral must survive the desktop-to-phone hop or the invite
 * is lost at exactly the moment it converts.
 *
 * The encoder is loaded on demand: mobile visitors, who are the overwhelming
 * majority, never download it.
 */
export function QrHandoff({ url }) {
  const [svg, setSvg] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    import('qrcode-generator')
      .then(({ default: qrcode }) => {
        if (cancelled) return
        // Type 0 auto-sizes to the data; 'M' tolerates ~15% damage, which is
        // plenty for a screen and keeps the modules large enough to scan.
        const qr = qrcode(0, 'M')
        qr.addData(url)
        qr.make()
        setSvg(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  if (failed) return null

  return (
    <div className="qr-handoff">
      <div className="qr-frame">
        {svg ? (
          // The markup comes from the QR encoder with our own URL as input —
          // no user-controlled content reaches it.
          <div className="qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="qr-placeholder" />
        )}
      </div>
      <p className="qr-caption">
        Scan with your phone
        <span>opens this page, invite code included</span>
      </p>
    </div>
  )
}
