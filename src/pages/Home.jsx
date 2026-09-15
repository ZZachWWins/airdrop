import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Blocks, Fingerprint, KeyRound, Radio, Users } from 'lucide-react'
import { VerifyPanel } from '../components/verify/VerifyPanel'
import { SignaturePreview } from '../components/verify/SignaturePreview'
import { StatTile } from '../components/ui/StatTile'
import { NetworkBadge } from '../components/ui/NetworkBadge'
import { Card } from '../components/ui/Card'
import { XerisMark } from '../components/ui/XerisMark'
import { useStats } from '../hooks/useStats'
import { NETWORK_LABEL, TOKEN_SYMBOL } from '../lib/config'
import './Home.css'

const STEPS = [
  {
    icon: <Radio size={18} />,
    title: 'Open in Xeris Web4',
    body: `The wallet browser on iOS and Android injects your ${NETWORK_LABEL} account into the page. Nothing to install here.`,
  },
  {
    icon: <Fingerprint size={18} />,
    title: 'Sign one message',
    body: 'A single signature proves you hold the key. We check your address against the live testnet node and record the block it was seen at.',
  },
  {
    icon: <Users size={18} />,
    title: 'Invite and climb',
    body: 'You get an invite code the moment you verify. Every friend who verifies with it is credited to you, permanently.',
  },
]

// The mechanism, stated precisely. Every line here is something a sceptical
// reader could go and check, which is the only kind of trust claim worth
// printing.
const GUARANTEES = [
  {
    icon: <KeyRound size={17} />,
    title: 'Your address is your public key',
    body: 'A Xeris address is an ed25519 public key. Every record is stored with the exact message that was signed, so anyone holding the export can re-verify the whole registry themselves — no trust in us required.',
  },
  {
    icon: <Blocks size={17} />,
    title: 'Anchored to a real block',
    body: `Verification is not just a signature. The server queries the ${NETWORK_LABEL} node directly and stamps your record with the block height it saw — a value your browser has no way to fabricate.`,
  },
  {
    icon: <Fingerprint size={17} />,
    title: 'Signatures, never approvals',
    body: 'Nothing here asks for a transaction, a spend allowance or a contract call. The challenge is single-use and expires in ten minutes, so a captured signature is worth nothing later.',
  },
]

export function Home() {
  const { stats, loading } = useStats()
  const pending = loading && !stats

  return (
    <div className="page home">
      {/* Depth layers behind the hero — the same glow and grid the share card
          uses, so the page and the link preview read as one thing. */}
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-grid-texture" aria-hidden="true" />

      <section className="container hero">
        <div className="hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <NetworkBadge />

            <h1 className="hero-title">
              Verify your testnet wallet.
              <br />
              <span className="text-highlight">Claim {TOKEN_SYMBOL} at mainnet.</span>
            </h1>

            <p className="hero-sub">
              Every wallet that verifies on {NETWORK_LABEL} is recorded in a signed registry,
              anchored to the block it was seen at. That registry becomes the claim list when{' '}
              {TOKEN_SYMBOL} launches on mainnet. One signature, no gas, no transaction.
            </p>

            <div className="hero-stats">
              <StatTile
                label="Wallets verified"
                value={(stats?.totalVerified ?? 0).toLocaleString()}
                loading={pending}
              />
              <StatTile
                label="Referrals"
                value={(stats?.totalReferrals ?? 0).toLocaleString()}
                loading={pending}
              />
              <StatTile
                label="Last 24h"
                value={(stats?.verifiedLast24h ?? 0).toLocaleString()}
                loading={pending}
              />
            </div>
          </motion.div>

          <motion.div
            className="hero-panel"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <XerisMark size={120} className="hero-watermark" strokeWidth={40} />
            <VerifyPanel />
          </motion.div>
        </div>
      </section>

      <section className="container how">
        <p className="eyebrow">How it works</p>
        <h2 className="section-title">Three steps, about thirty seconds</h2>
        <p className="section-sub">
          Verification is a proof of key ownership checked against the live testnet — not a form.
          There is nothing to pay and nothing to approve beyond the signature itself.
        </p>

        <div className="how-grid">
          {STEPS.map((step, index) => (
            <Card key={step.title} withBeam>
              <span className="how-index">0{index + 1}</span>
              <span className="how-icon">{step.icon}</span>
              <h3 className="how-title">{step.title}</h3>
              <p className="how-body">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* The transparency section. A signature prompt is exactly where a user
          should be suspicious, so show the text up front rather than asking
          them to take it on faith at the moment their wallet opens. */}
      <section className="container trust">
        <div className="trust-grid">
          <div className="trust-copy">
            <p className="eyebrow">Why you can trust it</p>
            <h2 className="section-title">Read the message before you sign it</h2>
            <p className="section-sub">
              Every safe signature request looks like every unsafe one until you read it. Here is
              the exact text your wallet will show, published before you connect anything.
            </p>

            <ul className="trust-list">
              {GUARANTEES.map((item) => (
                <li key={item.title}>
                  <span className="trust-icon">{item.icon}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link to="/faq" className="how-more">
              Read the full FAQ <ArrowRight size={14} />
            </Link>
          </div>

          <div className="trust-preview">
            <SignaturePreview />
          </div>
        </div>
      </section>
    </div>
  )
}
