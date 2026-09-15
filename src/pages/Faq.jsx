import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../lib/config'
import './Faq.css'

const FAQS = [
  {
    q: 'What am I actually signing?',
    a: `A plain-text message that names your address, the network, this site, a one-time nonce and a timestamp. It is a signature, not a transaction — it cannot move funds, approve a spend, or touch a contract. The wallet shows you the full text before you approve it.`,
  },
  {
    q: `How do you know I'm really on ${NETWORK_LABEL}?`,
    a: `Two independent checks. The signature proves you hold the private key for the address you claim. Then the server queries the live ${NETWORK_LABEL} node directly for that address and records the current block height alongside your record — so every verification is anchored to a point in the chain's history, and none of it is something the browser could fake.`,
  },
  {
    q: 'Does a new wallet with no balance still count?',
    a: `Yes. Verification is recorded whether or not the wallet has been funded. We tag each record with its testnet activity at the time of checking — new, funded, or active — so a future distribution can weight real testnet usage if it chooses to. Nobody is turned away for being early.`,
  },
  {
    q: `When do I get the ${TOKEN_SYMBOL}?`,
    a: `Not now. This campaign builds the registry of verified testnet participants. When ${TOKEN_SYMBOL} launches on mainnet, that registry becomes the claim list and verified addresses will be able to claim there. Final allocation rules are set at mainnet launch — verifying does not guarantee a specific amount.`,
  },
  {
    q: 'How do invite codes work?',
    a: 'You get a code the moment you verify. Anyone who verifies with your code is permanently credited to you — attribution is locked at their first verification and cannot be moved afterwards. You cannot use your own code, and codes only exist for wallets that have already verified.',
  },
  {
    q: 'Can I verify more than one wallet?',
    a: 'Each address verifies independently, and each gets its own invite code. Re-verifying an address you already registered is harmless — it refreshes the on-chain snapshot but never changes your original verification time, invite code, or who invited you.',
  },
  {
    q: 'Why does it only work in the Xeris Web4 browser?',
    a: 'Verification needs a signature from your Xeris key, and the Xeris Web4 browser on iOS and Android is what puts that key in reach of a web page. Open this URL inside the app and the connect button will find your wallet.',
  },
  {
    q: 'What do you store?',
    a: 'Your address, the signed message and its signature, the invite code, who invited you, and the on-chain snapshot taken at verification. No email, no name, no IP-based profile. The signature is kept as the evidence trail for the eventual mainnet claim.',
  },
]

export function Faq() {
  return (
    <div className="page container faq">
      <p className="eyebrow">FAQ</p>
      <h1 className="section-title">What this is, and what it is not</h1>
      <p className="section-sub">
        Straight answers about the verification, the referral system, and what happens at mainnet.
      </p>

      <div className="faq-list">
        {FAQS.map((item) => (
          <Card key={item.q} className="faq-item">
            <h2 className="faq-q">{item.q}</h2>
            <p className="faq-a">{item.a}</p>
          </Card>
        ))}
      </div>

      <Card className="faq-cta static">
        <h2 className="faq-cta-title">Ready to verify?</h2>
        <p className="faq-cta-copy">
          One signature in the Xeris Web4 browser and your address is on the list.
        </p>
        <Link to="/">
          <Button variant="accent" size="lg">
            Verify your wallet
          </Button>
        </Link>
      </Card>
    </div>
  )
}
