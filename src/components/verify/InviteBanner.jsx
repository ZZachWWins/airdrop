import { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'
import { useCampaign } from '../../context/CampaignContext'
import { lookupInvite } from '../../lib/api'
import './InviteBanner.css'

/**
 * Confirms the invite code riding along with this visit, and who it belongs to.
 * An unrecognised code is surfaced here rather than at submit time, so nobody
 * spends a wallet signature only to be told the code was junk.
 */
export function InviteBanner({ code }) {
  const { dropInviteCode } = useCampaign()
  // The parent keys this component on `code`, so a new code remounts it and
  // the initial state is already 'loading' — no reset needed on the way in.
  const [lookup, setLookup] = useState({ state: 'loading' })

  useEffect(() => {
    let cancelled = false

    lookupInvite(code)
      .then((data) => {
        if (cancelled) return
        setLookup(data.valid ? { state: 'valid', ...data } : { state: 'invalid' })
      })
      .catch(() => {
        // A lookup that fails on the network is not proof the code is bad —
        // leave it applied and let /api/verify be the judge.
        if (!cancelled) setLookup({ state: 'unknown' })
      })

    return () => {
      cancelled = true
    }
  }, [code])

  const isInvalid = lookup.state === 'invalid'

  return (
    <div className={`invite-banner ${isInvalid ? 'invalid' : ''}`}>
      <Gift size={15} />
      <div className="invite-banner-body">
        {lookup.state === 'loading' && (
          <p>
            Checking invite <strong className="mono">{code}</strong>…
          </p>
        )}
        {lookup.state === 'valid' && (
          <p>
            Invited by <strong className="mono">{lookup.referrer}</strong> · code{' '}
            <strong className="mono">{code}</strong>
          </p>
        )}
        {isInvalid && (
          <p>
            Invite code <strong className="mono">{code}</strong> was not recognised. You can still
            verify without one.
          </p>
        )}
        {lookup.state === 'unknown' && (
          <p>
            Invite code <strong className="mono">{code}</strong> applied.
          </p>
        )}
      </div>
      <button onClick={dropInviteCode} aria-label="Remove invite code" className="invite-banner-x">
        <X size={14} />
      </button>
    </div>
  )
}
