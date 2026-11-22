import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'

export default function VerifyEmail() {
  const { token } = useParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !token) return
    ran.current = true
    api.post('/api/auth/verify-email', { token })
      .then(() => { setStatus('ok'); toast('Email verified — thank you!', 'success') })
      .catch((err: any) => { setStatus('error'); setMessage(err.message || 'This link is invalid or has expired.') })
  }, [token])

  return (
    <div className="glass-otp p-[clamp(22px,3vw,30px)] text-center">
      {status === 'loading' && <p className="text-text-secondary py-6">Verifying your email…</p>}
      {status === 'ok' && (
        <div className="py-4">
          <div className="verified-badge mb-4">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Email verified
          </div>
          <h2 className="text-2xl font-semibold text-text mb-2">You're all set</h2>
          <p className="text-text-secondary mb-6">Your email address has been verified.</p>
          <Link to="/" className="btn btn-primary">Continue to Open Ballot</Link>
        </div>
      )}
      {status === 'error' && (
        <div className="py-4">
          <h2 className="text-2xl font-semibold text-text mb-2">Link not valid</h2>
          <p className="text-text-secondary mb-6">{message}</p>
          <Link to="/verify-email" className="btn btn-primary">Enter a code instead</Link>
        </div>
      )}
    </div>
  )
}