import { Link } from 'react-router-dom'
import { XerisMark } from '../ui/XerisMark'
import { DEX_URL, LAUNCHPAD_URL, NETWORK_LABEL } from '../../lib/config'
import './Footer.css'

export const Footer = () => (
  <footer className="site-footer">
    <div className="container footer-inner">
      <div className="footer-brand">
        <XerisMark size={20} />
        <span>Xeris</span>
        <span className="footer-network">{NETWORK_LABEL}</span>
      </div>

      <nav className="footer-links">
        <Link to="/faq">FAQ</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <a href={DEX_URL} target="_blank" rel="noreferrer noopener">
          DEX
        </a>
        <a href={LAUNCHPAD_URL} target="_blank" rel="noreferrer noopener">
          Launchpad
        </a>
      </nav>
    </div>

    <div className="container footer-note">
      <p>
        Verification records a testnet signature. It is not a purchase, not an investment, and
        confers no guarantee of a mainnet distribution — final allocation rules are set at mainnet
        launch.
      </p>
    </div>
  </footer>
)
