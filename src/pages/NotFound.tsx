import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="empty-state">
      <div className="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r={7} />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.15rem)', marginBottom: '8px' }}>Page not found</h2>
      <p className="muted" style={{ margin: '0 auto', maxWidth: '46ch' }}>
        That page does not exist. It may have been moved, or the link may be incomplete.
      </p>
      <div className="empty-actions">
        <Link to="/" className="btn btn-primary">Back to elections</Link>
      </div>
    </div>
  )
}
