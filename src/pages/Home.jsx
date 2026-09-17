import { motion } from 'framer-motion'
import { Fingerprint, Radio, Users } from 'lucide-react'
import { VerifyPanel } from '../components/verify/VerifyPanel'
import { ClosingCta } from '../components/home/ClosingCta'
import { StatTile } from '../components/ui/StatTile'
import { NetworkBadge } from '../components/ui/NetworkBadge'
import { Card } from '../components/ui/Card'
import { XerisMark } from '../components/ui/XerisMark'
import { useStats } from '../hooks/useStats'
import { AIRDROP_POOL_DISPLAY, TOKEN_SYMBOL } from '../lib/config'
import './Home.css'

const STEPS = [
  { icon: <Radio size={18} />, title: 'Open in Xeris Web4', body: 'iOS first. The app injects your account.' },
  { icon: <Fingerprint size={18} />, title: 'Sign one message', body: 'Proves you hold the key. Costs nothing.' },
  { icon: <Users size={18} />, title: 'Invite and climb', body: 'Friends who verify are credited to you.' },
]

export function Home() {
  const { stats, loading } = useStats()
  const pending = loading && !stats

  return (
    <div className="page home">
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

            {/* The pool is the reason anyone is here, so it gets its own
                weight rather than being buried in the stat row beside live
                campaign counters. */}
            <div className="hero-pool">
              <span className="hero-pool-amount">
                {AIRDROP_POOL_DISPLAY} <em>{TOKEN_SYMBOL}</em>
              </span>
              <span className="hero-pool-label">Shared by everyone who verifies</span>
            </div>

            <p className="hero-sub">One signature locks in your place.</p>

            <div className="hero-stats">
              <StatTile
                label="Wallets verified"
                value={stats?.totalVerified ?? 0}
                loading={pending}
                count
              />
              <StatTile
                label="Referrals"
                value={stats?.totalReferrals ?? 0}
                loading={pending}
                count
              />
              <StatTile
                label="Last 24h"
                value={stats?.verifiedLast24h ?? 0}
                loading={pending}
                count
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
        <h2 className="section-title">Three steps, thirty seconds</h2>

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

      <ClosingCta totalVerified={stats?.totalVerified ?? 0} />
    </div>
  )
}
