import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { XerisMark } from '../ui/XerisMark'
import { TOKEN_SYMBOL } from '../../lib/config'
import './ClosingCta.css'

/**
 * The page's last beat. Where the old trust section explained cryptography,
 * this states the payoff and points at the one action worth taking.
 *
 * The verified count is the persuasive element — other people are already on
 * the list — so it is only shown once there is a number worth showing. A
 * launch-day "0 wallets verified" argues the opposite of what it is here for.
 */
export function ClosingCta({ totalVerified = 0 }) {
  const showCount = totalVerified > 0

  return (
    <section className="closing">
      <div className="closing-glow" aria-hidden="true" />

      {/* Animates on mount, not on scroll. A whileInView reveal starts at
          opacity 0, so anything that stops the observer firing — and a
          full-page render is one — leaves the page's closing call invisible.
          Not a risk worth taking for a scroll flourish. */}
      <motion.div
        className="container closing-inner"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <XerisMark size={54} className="closing-mark" strokeWidth={46} />

        <h2 className="closing-title">
          {TOKEN_SYMBOL} lands at mainnet.
          <br />
          <span className="text-highlight">Be on the list.</span>
        </h2>

        <Link to="/" className="closing-action">
          <Button variant="accent" size="lg">
            Verify your wallet <ArrowRight size={16} />
          </Button>
        </Link>

        {showCount && (
          <p className="closing-count">
            <strong>{totalVerified.toLocaleString()}</strong> wallets verified so far
          </p>
        )}
      </motion.div>
    </section>
  )
}
