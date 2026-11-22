import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import EmailOtpCard from '../../components/EmailOtpCard'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'

export default function VerifyEmailOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const stateEmail = (location.state as { email?: string } | null)?.email || ''
  const initialDevCode = (location.state as { devCode?: string } | null)?.devCode || ''

  const [email, setEmail] = useState(stateEmail)
  const [submittedEmail, setSubmittedEmail] = useState(stateEmail)
  const [devCode, setDevCode] = useState(initialDevCode)
  const [sending, setSending] = useState(false)

  const needEmail = !submittedEmail

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    try {
      const res: any = await api.post('/api/auth/request-otp', { email: email.trim() })
      setDevCode(res.devCode || '')
      setSubmittedEmail(email.trim())
    } catch (err: any) {
      toast(err.message || 'Could not send a code. Check the address.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <p className="eyebrow" style={{ justifyContent: 'center' }}>Secure access</p>
      <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.15rem)', marginBottom: '8px', textAlign: 'center' }}>
        Email verification
      </h1>

      {needEmail ? (
        <div className="glass-otp p-[clamp(20px,3vw,28px)] mt-4">
          <p className="text-text-secondary text-sm text-center mb-5">
            Enter your email address and we'll send you a 6-digit verification code.
          </p>
          <form onSubmit={sendCode} className="space-y-4">
            <div className="field">
              <label htmlFor="otp-email">Email address</label>
              <input
                id="otp-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary w-full" disabled={sending}>
              {sending ? 'Sending…' : 'Send verification code'}
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-4">
          <EmailOtpCard
            email={submittedEmail}
            initialDevCode={devCode}
            onVerified={() => setTimeout(() => navigate('/'), 1200)}
          />
        </div>
      )}
    </div>
  )
}