import React from 'react'
import { Link } from 'react-router-dom'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-card">
      <div className="auth-head">
        <p className="eyebrow" style={{ justifyContent: 'center' }}>Secure access</p>
        <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.15rem)', marginBottom: '8px' }}>{children}</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }} />
      </div>
      <div className="card">{children}</div>
    </div>
  )
}
