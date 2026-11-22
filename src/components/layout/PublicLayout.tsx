import React, { useEffect, useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function PublicLayout() {
  const { user, logout, isAuthenticated } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const navItems = [
    { label: 'Elections', href: '/elections' },
    { label: 'Verify', href: '/verify' },
    { label: 'Help', href: '/help' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Status', href: '/status' },
  ]

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Open Ballot home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 12.5 16 7l10 5.5v9L16 27 6 21.5v-9Z" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
                <path d="m11 15 3.5 3.5L22 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="brand-text">
              <span className="brand-name">Open<span>Ballot</span></span>
              <span className="brand-sub">Secure online voting</span>
            </span>
          </Link>

          <nav className={`primary-nav ${mobileOpen ? 'open' : ''}`} aria-label="Primary">
            {navItems.map((item) => (
              <Link key={item.label} to={item.href} className={location.pathname === item.href ? 'active' : ''} data-nav={item.label.toLowerCase()}>
                {item.label}
              </Link>
            ))}
            {mobileOpen && (
              <div className="mobile-actions">
                {isAuthenticated() && (
                  <>
                    <Link to="/account" className="btn btn-ghost btn-sm">Account</Link>
                    <button onClick={() => { logout(); setMobileOpen(false) }} className="btn btn-ghost btn-sm">Sign out</button>
                  </>
                )}
                {!isAuthenticated() && (
                  <>
                    <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                    <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
                  </>
                )}
              </div>
            )}
          </nav>

          <div className="header-actions">
            <button
              className="btn btn-ghost btn-sm btn-icon"
              id="lang-toggle"
              aria-label="Switch language"
              title="Language / Idioma"
            >
              <span className="lang-label" id="lang-label">EN</span>
            </button>
            <button className="btn btn-ghost btn-sm btn-icon header-search" aria-label="Search elections" title="Search elections">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <circle cx={11} cy={11} r={7} />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" id="theme-toggle" aria-label="Switch theme" title="Switch theme">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx={12} cy={12} r={4} />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m4.9 4.9 1.4 1.4" />
                <path d="m17.7 17.7 1.4 1.4" />
                <path d="m4.9 19.1 1.4-1.4" />
                <path d="m17.7 6.3 1.4-1.4" />
              </svg>
            </button>
            <span id="notif-slot" />
            <span id="header-links" className="header-links" />
            <button
              className="nav-toggle"
              id="nav-toggle"
              type="button"
              aria-expanded={mobileOpen}
              aria-controls="primary-nav"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="shell" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-legal">
            <p className="footer-brand"><strong>Open Ballot</strong> — decisions made together.</p>
            <p className="footer-note">Secret ballots · One person, one vote · Receipt-verifiable</p>
            <p className="footer-copyright">&copy; <span id="copyright-year"></span> Open Ballot. All rights reserved.</p>
            <p className="footer-contact">
              Contact: <a href="mailto:openballot@outlook.com">openballot@outlook.com</a> ·{' '}
              <Link to="/terms">Terms of Service</Link> ·{' '}
              <Link to="/privacy">Privacy Policy</Link> ·{' '}
              <Link to="/refunds">Refund Policy</Link> ·{' '}
              <Link to="/data-request">Data Access &amp; Deletion</Link> ·{' '}
              <Link to="/dpa">Data Processing Agreement</Link> ·{' '}
              <Link to="/subprocessors">Subprocessors</Link>
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <Link to="/help">Help</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/refunds">Refunds</Link>
            <Link to="/data-request">My data</Link>
            <Link to="/dpa">DPA</Link>
            <Link to="/subprocessors">Subprocessors</Link>
            <Link to="/audit">Audit chain</Link>
            <Link to="/archive">Results archive</Link>
            <Link to="/status">Status</Link>
          </nav>
        </div>
      </footer>

      <div id="toasts" className="toasts" role="status" aria-live="polite" />
      <div id="modal-root" />
      <div className="scroll-progress" aria-hidden="true" />
      <button className="back-to-top" id="back-to-top" type="button" aria-label="Back to top">
        <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      <button className="floating-contact" id="floating-contact" type="button" aria-label="Contact us" onClick={() => window.location.href = 'mailto:openballot@outlook.com'}>
        <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2H16.78A2 2 0 0 1 15 15.92v-3a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2zM12 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" /></svg>
      </button>
    </>
  )
}
