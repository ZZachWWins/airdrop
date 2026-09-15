import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ConnectButton } from '../wallet/ConnectButton'
import { XerisMark } from '../ui/XerisMark'
import './Navbar.css'

const LINKS = [
  { to: '/', label: 'Verify', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/faq', label: 'FAQ' },
]

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const closeMenu = () => setIsMenuOpen(false)

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="navbar-logo" onClick={closeMenu}>
          <XerisMark size={26} className="logo-mark" />
          <span className="logo-badge">AIRDROP</span>
        </Link>

        <div className={`navbar-links ${isMenuOpen ? 'mobile-open' : ''}`}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={closeMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
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
