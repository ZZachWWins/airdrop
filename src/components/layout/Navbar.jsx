import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectButton } from '../wallet/ConnectButton'
import { XerisMark } from '../ui/XerisMark'
import { useStats } from '../../hooks/useStats'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Verify', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/faq', label: 'FAQ' },
]

const CLAIM_LINK = { to: '/claim', label: 'Claim', highlight: true }

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const closeMenu = () => setIsMenuOpen(false)

  // The server decides whether the claim window is open, so opening it is an
  // environment-variable change, not a redeploy of the frontend.
  const { stats } = useStats()
  const links = stats?.claimPhase === 'open' ? [...LINKS, CLAIM_LINK] : LINKS

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          <XerisMark size={26} className="logo-mark" />
          <span className="logo-badge">AIRDROP</span>
        </Link>

        <div className={`navbar-links ${isMenuOpen ? 'mobile-open' : ''}`}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={closeMenu}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''} ${link.highlight ? 'highlight' : ''}`
              }
            >
              {link.label}
            </NavLink>
          ))}

          <div className="mobile-only-actions">
            <ConnectButton />
          </div>
        </div>

        <div className="navbar-actions">
          <div className="desktop-actions">
            <ConnectButton />
          </div>

          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </nav>
  )
}
