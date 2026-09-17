import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { SignaturePreview } from '../components/verify/SignaturePreview'
import { AIRDROP_POOL_DISPLAY, NETWORK_LABEL, TOKEN_SYMBOL } from '../lib/config'
import './Faq.css'

const FAQS = [
  {
    q: 'What am I actually signing?',
    a: 'Plain text naming your address, the network, a one-time nonce and a timestamp. Your wallet shows it in full before you approve. It cannot move funds or touch a contract.',
  },
  {
    q: `How do you know I'm on ${NETWORK_LABEL}?`,
    a: `Two checks. Your signature proves you hold the key. Then the server asks the live ${NETWORK_LABEL} node about your address and records the block height it saw. Your browser can't fake that second one.`,
  },
  {
    q: 'Does a new wallet with no balance count?',
    a: 'Yes. Each record is tagged new, funded or active, so a later distribution can weight real usage. Nobody is turned away for being early.',
  },
  {
    q: 'How much is in the airdrop?',
    a: `${AIRDROP_POOL_DISPLAY} ${TOKEN_SYMBOL} in total, divided among everyone who verifies. It is a shared pool, not a fixed amount per wallet, so your share depends on how many wallets are on the final list when sign-ups close.`,
  },
  {
    q: `When do I get the ${TOKEN_SYMBOL}?`,
    a: `Not yet. At mainnet launch a Claim tab appears here: connect the same testnet wallet, enter your mainnet address, sign once. Allocation rules are set at launch, so verifying doesn't guarantee an amount.`,
  },
  {
    q: 'My mainnet wallet is a different keypair.',
    a: "That's expected. You paste the mainnet address and sign with your testnet key. The address is written into the message you sign, so the signature authorises that exact payout address and nothing can redirect it.",
  },
  {
    q: 'What happens if I lose my testnet key?',
    a: 'You lose the claim. No email recovery, no support override. That is what makes the registry trustworthy and it cuts both ways. Back up your recovery phrase now, not at launch.',
  },
  {
    q: 'What if I typo my mainnet address?',
    a: 'Invalid addresses are rejected, and your testnet address is refused outright. You can re-sign with a corrected address any time before the distribution runs. After that, no.',
  },
  {
    q: 'How do invite codes work?',
    a: "You get one when you verify. Anyone who verifies with it is credited to you permanently, locked at their first verification. You can't use your own.",
  },
  {
    q: 'Can I verify more than one wallet?',
    a: 'Yes, each gets its own code. Re-verifying refreshes the on-chain snapshot and changes nothing else.',
  },
  {
    q: 'Why iOS first?',
    a: 'Sign-ups are rolling out to iPhone first, Android next. The Xeris Web4 app is live on both stores either way, and nothing about the registry is platform-specific, so Android wallets verify exactly the same way when it opens.',
  },
  {
    q: 'What do you store?',
    a: 'Your address, the signed message and signature, your invite code, who invited you, and the snapshot taken at verification. No email, no name, no tracking profile.',
  },
]

export function Faq() {
  return (
    <div className="page container faq">
      <p className="eyebrow">FAQ</p>
      <h1 className="section-title">Questions</h1>

      <div className="faq-list">
        {FAQS.map((item, index) => (
          <Card key={item.q} className="faq-item">
            <h2 className="faq-q">{item.q}</h2>
            <p className="faq-a">{item.a}</p>
            {/* The signed message belongs with the question that asks about
                it, not on the landing page where it reads as a warning. */}
            {index === 0 && (
              <div className="faq-preview">
                <SignaturePreview />
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="faq-cta static">
        <h2 className="faq-cta-title">Ready?</h2>
        <Link to="/">
          <Button variant="accent" size="lg">
            Verify your wallet
          </Button>
        </Link>
      </Card>
    </div>
  )
}
