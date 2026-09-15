import { useState } from 'react'
import { Check, Copy, Share2, Users } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useToast } from '../../context/ToastContext'
import { buildInviteUrl } from '../../lib/referral'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../../lib/config'
import './ShareCard.css'

export function ShareCard({ code, referralCount = 0 }) {
  const toast = useToast()
  const [copied, setCopied] = useState(null)

  const inviteUrl = buildInviteUrl(code)
  const shareText = `I just verified my wallet on ${NETWORK_LABEL} to register for the ${TOKEN_SYMBOL} airdrop. Use my invite code ${code}:`

  const copy = async (value, which) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Could not copy — select the text and copy it manually.')
    }
  }

  // The Web Share sheet is the natural path on a phone, which is where nearly
  // every visitor is. Desktop falls back to copy.
  const share = async () => {
    if (!navigator.share) {
      copy(inviteUrl, 'link')
      return
    }
    try {
      await navigator.share({ title: 'Xeris Airdrop', text: shareText, url: inviteUrl })
    } catch {
      // A dismissed share sheet is not an error.
    }
  }

  return (
    <Card className="share-card static">
      <p className="eyebrow">Invite a friend</p>
      <h3 className="share-title">Your invite code</h3>
      <p className="share-copy">
        Anyone who verifies with your code is permanently credited to you. Referral counts are
        recorded alongside every verification and travel with the snapshot to mainnet.
      </p>

      <div className="share-code" onClick={() => copy(code, 'code')} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') copy(code, 'code') }}>
        <span className="mono">{code}</span>
        {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
      </div>

      <div className="share-link">
        <code>{inviteUrl}</code>
        <button onClick={() => copy(inviteUrl, 'link')} aria-label="Copy invite link">
          {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>

      <Button variant="accent" className="btn-block share-btn" onClick={share}>
        <Share2 size={16} /> Share invite link
      </Button>

      <div className="share-count">
        <Users size={15} />
        <span>
          <strong>{referralCount}</strong> {referralCount === 1 ? 'person has' : 'people have'}{' '}
          verified with your code
        </span>
      </div>
    </Card>
  )
}
