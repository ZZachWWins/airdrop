import { ShieldCheck } from 'lucide-react'
import { NETWORK_ID } from '../../lib/config'
import './SignaturePreview.css'

/**
 * Shows the exact message a wallet will be asked to sign, before anyone
 * connects.
 *
 * A signature request is the moment a user is most reasonably suspicious, and
 * the usual answer — "trust us, it's safe" — is what every drainer says too.
 * Publishing the template up front lets someone read it, compare it against
 * what their wallet actually shows, and notice if the two ever differ.
 *
 * Kept in sync with buildChallengeMessage() in netlify/lib/campaign.js. The
 * placeholder values are illustrative; the real nonce and timestamp are
 * issued per request.
 */
const SAMPLE = [
  ['Xeris Testnet Verification', 'title'],
  ['', null],
  ['I confirm that I control this wallet and am taking part in the Xeris testnet.', null],
  ['This registers my address for the future XRS mainnet airdrop.', null],
  ['', null],
  ['Address: 7xQpAb…3kAf', 'field'],
  [`Network: ${NETWORK_ID}`, 'field'],
  ['Site:    airdrop.xerisweb.com', 'field'],
  ['Nonce:   3f9c…a17e', 'field'],
  ['Issued:  2026-09-15T20:07:11Z', 'field'],
  ['', null],
  ['Signing costs nothing. It does not approve a transaction or move any funds.', 'note'],
]

export function SignaturePreview() {
  return (
    <div className="sigpreview">
      <div className="sigpreview-head">
        <ShieldCheck size={15} />
        <span>What your wallet will show you</span>
      </div>

      <pre className="sigpreview-body">
        {SAMPLE.map(([line, kind], index) => (
          <span key={index} className={kind ? `sig-${kind}` : undefined}>
            {line || ' '}
            {'\n'}
          </span>
        ))}
      </pre>

      <p className="sigpreview-foot">
        No approval, no spend allowance, no contract call. A signature over this text is the entire
        transaction — read it in your wallet and check it matches.
      </p>
    </div>
  )
}
