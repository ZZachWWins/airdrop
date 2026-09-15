import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Fingerprint, Radio, Users } from 'lucide-react'
import { VerifyPanel } from '../components/verify/VerifyPanel'
import { StatTile } from '../components/ui/StatTile'
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

export function Home() {
  const { stats, loading } = useStats()

  return (
    <div className="page home">
      <section className="container hero">
        <div className="hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge">
              <span className="hero-dot" />
              {NETWORK_LABEL} is live
            </div>

            <h1 className="hero-title">
              Verify your testnet wallet.
              <br />
              <span className="text-highlight">Claim {TOKEN_SYMBOL} at mainnet.</span>
            </h1>

            <p className="hero-sub">
              Every wallet that verifies on {NETWORK_LABEL} now is recorded in a signed, on-chain
              anchored registry. That registry becomes the claim list when {TOKEN_SYMBOL} launches
              on mainnet. One signature, no gas, no transaction.
            </p>

            <div className="hero-stats">
              <StatTile
                label="Wallets verified"
                value={(stats?.totalVerified ?? 0).toLocaleString()}
                loading={loading && !stats}
              />
              <StatTile
                label="Referrals"
                value={(stats?.totalReferrals ?? 0).toLocaleString()}
                loading={loading && !stats}
              />
              <StatTile
                label="Last 24h"
                value={(stats?.verifiedLast24h ?? 0).toLocaleString()}
                loading={loading && !stats}
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

        <Link to="/faq" className="how-more">
          What happens at mainnet? <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  )
}
