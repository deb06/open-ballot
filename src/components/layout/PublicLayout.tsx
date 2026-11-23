import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { api } from '../../lib/api'

type ThemePreference = 'dark' | 'light' | 'system'
type Language = 'en' | 'es'

interface SearchResult {
  id: number
  title: string
  description: string
  status: string
  kind: string
  url: string
}

const copy = {
  en: {
    elections: 'Elections', verify: 'Verify ballot', organizations: 'Organizations', createPoll: 'Create a poll',
    help: 'Help', privacy: 'Privacy', terms: 'Terms', status: 'Status',
    account: 'Account', signOut: 'Sign out', signIn: 'Sign in', createAccount: 'Create account', registerOrg: 'Register organization',
    search: 'Search elections', searchPlaceholder: 'Search elections or candidates…', noResults: 'No matching elections found.',
  },
  es: {
    elections: 'Elecciones', verify: 'Verificar papeleta', organizations: 'Organizaciones', createPoll: 'Crear encuesta',
    help: 'Ayuda', privacy: 'Privacidad', terms: 'Términos', status: 'Estado',
    account: 'Cuenta', signOut: 'Cerrar sesión', signIn: 'Iniciar sesión', createAccount: 'Crear cuenta', registerOrg: 'Registrar organización',
    search: 'Buscar elecciones', searchPlaceholder: 'Buscar elecciones o candidatos…', noResults: 'No se encontraron elecciones.',
  },
} as const

export default function PublicLayout() {
  const { user, logout, isAuthenticated } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem('openballot.lang')
    return stored === 'es' ? 'es' : 'en'
  })
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('openballot.theme')
    return stored === 'light' || stored === 'system' ? stored : 'dark'
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  const labels = copy[language]
  const signedIn = isAuthenticated()

  const navItems = [
    { label: labels.elections, href: '/elections', key: 'elections' },
    { label: labels.verify, href: '/verify', key: 'verify' },
    { label: labels.organizations, href: '/organizations', key: 'organizations' },
    { label: labels.createPoll, href: '/polls/new', key: 'create-poll' },
  ]

  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const applyTheme = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.setAttribute('data-theme-pref', theme)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f5f3ec' : '#0c0c0a')
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved === 'light' ? 'light dark' : 'dark light')
      localStorage.setItem('openballot.theme', theme)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = 'ltr'
    localStorage.setItem('openballot.lang', language)
  }, [language])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 480)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setSearchOpen(false)
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchError('')
      return
    }
    let active = true
    const timer = window.setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const data = await api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`)
        if (active) setSearchResults(data.results)
      } catch (error: any) {
        if (active) setSearchError(error.message || 'Search is unavailable right now.')
      } finally {
        if (active) setSearching(false)
      }
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchOpen, searchQuery])

  const cycleTheme = () => {
    setTheme((current) => current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark')
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSearchError('')
  }

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
              <Link key={item.key} to={item.href} onClick={() => setMobileOpen(false)} className={location.pathname === item.href ? 'active' : ''} data-nav={item.key}>
                {item.label}
              </Link>
            ))}
            {mobileOpen && (
              <div className="mobile-actions">
                {signedIn && (
                  <>
                    <Link to="/account" onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-sm">{labels.account}</Link>
                    <button onClick={() => { void logout(); setMobileOpen(false) }} className="btn btn-ghost btn-sm">{labels.signOut}</button>
                  </>
                )}
                {!signedIn && (
                  <>
                    <Link to="/register-organization" onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-sm">{labels.registerOrg}</Link>
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-sm">{labels.signIn}</Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="btn btn-primary btn-sm">{labels.createAccount}</Link>
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
              onClick={() => setLanguage((current) => current === 'en' ? 'es' : 'en')}
            >
              <span className="lang-label" id="lang-label">{language.toUpperCase()}</span>
            </button>
            <button className="btn btn-ghost btn-sm btn-icon header-search" aria-label={labels.search} title={`${labels.search} (Ctrl+K)`} onClick={() => setSearchOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                <circle cx={11} cy={11} r={7} />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" id="theme-toggle" aria-label={`Switch theme. Current preference: ${theme}`} title={`Theme: ${theme}`} onClick={cycleTheme}>
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
            <span id="header-links" className="header-links">
              {signedIn ? (
                <>
                  <Link to="/account" className="btn btn-ghost btn-sm">{labels.account}</Link>
                  <button onClick={() => void logout()} className="btn btn-ghost btn-sm">{labels.signOut}</button>
                </>
              ) : (
                <>
                  <Link to="/register-organization" className="btn btn-ghost btn-sm header-org">{labels.registerOrg}</Link>
                  <Link to="/login" className="btn btn-ghost btn-sm">{labels.signIn}</Link>
                  <Link to="/register" className="btn btn-primary btn-sm">{labels.createAccount}</Link>
                </>
              )}
            </span>
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

      {user && !user.emailVerified && (
        <div className="verify-banner" role="status">
          <span>Please verify your email address to unlock all features.</span>
          <Link to="/verify-email" state={{ email: user.email }}>Verify now</Link>
        </div>
      )}

      <main id="main" className="shell" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-legal">
            <p className="footer-brand"><strong>Open Ballot</strong> — decisions made together.</p>
            <p className="footer-note">Secret ballots · One person, one vote · Receipt-verifiable</p>
            <p className="footer-copyright">&copy; {new Date().getFullYear()} Open Ballot. All rights reserved.</p>
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

      {searchOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSearch() }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="site-search-title">
            <div className="modal-head">
              <div>
                <h2 id="site-search-title">{labels.search}</h2>
                <p className="small muted">Type at least two characters.</p>
              </div>
              <button type="button" className="modal-close" aria-label="Close search" onClick={closeSearch}>×</button>
            </div>
            <div className="modal-body">
              <input
                ref={searchInputRef}
                type="search"
                className="input"
                value={searchQuery}
                placeholder={labels.searchPlaceholder}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <div className="stack-sm" aria-live="polite">
                {searching && <p className="small muted">Searching…</p>}
                {searchError && <p className="form-error">{searchError}</p>}
                {!searching && !searchError && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                  <p className="small muted">{labels.noResults}</p>
                )}
                {searchResults.map((result) => (
                  <Link key={`${result.kind}-${result.id}`} to={result.url} onClick={closeSearch} className="card-flat">
                    <strong>{result.title}</strong>
                    {result.description && <p className="small">{result.description}</p>}
                    <span className="badge">{result.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      <div id="toasts" className="toasts" role="status" aria-live="polite" />
      <div id="modal-root" />
      <div className="scroll-progress" aria-hidden="true" />
      <button className={`back-to-top ${showBackToTop ? 'visible' : ''}`} id="back-to-top" type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
      <button className="floating-contact" id="floating-contact" type="button" aria-label="Contact us" onClick={() => window.location.href = 'mailto:openballot@outlook.com'}>
        <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2H16.78A2 2 0 0 1 15 15.92v-3a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2zM12 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" /></svg>
      </button>
    </>
  )
}
