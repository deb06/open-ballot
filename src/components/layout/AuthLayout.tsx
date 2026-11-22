import React from 'react'
import { Link } from 'react-router-dom'

/** Centered shell for auth screens. Each screen owns its own card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <Link to="/" className="auth-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
        Back to Open Ballot
      </Link>
      {children}
    </div>
  )
}