import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'
import { useAuth } from '../../lib/auth'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [age18, setAge18] = useState(false)
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast('Passwords do not match', 'error')
      return
    }
    if (!age18) {
      toast('You must confirm your age to register', 'error')
      return
    }
    if (!terms) {
      toast('You must accept the Terms of Service and Privacy Policy', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await register({ name, email, password, ageConfirmed: age18, termsAccepted: terms, marketingOptIn: false })
      toast('Account created — verify your email to finish.', 'success')
      navigate('/verify-email', { state: { email, devCode: res?.devCode } })
    } catch (err: any) {
      toast(err.message || 'Registration failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <div className="auth-head">
          <p className="eyebrow">Secure access</p>
          <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.15rem)', marginBottom: '8px' }}>Create your account</h1>
          <p className="text-text-secondary mb-4">One account, one ballot per election.</p>
        </div>
        <form className="card stack space-y-4" onSubmit={handleSubmit}>
          <div className="field">
            <label className="text-xs font-semibold text-text-secondary">Full name</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Alex Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength="80"
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-text-secondary">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-text-secondary">Confirm password</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <div className="field flex items-start gap-2 pt-2 border-t border-[var(--line)]">
            <input
              type="checkbox"
              id="age18"
              checked={age18}
              onChange={(e) => setAge18(e.target.checked)}
              required
            />
            <label className="text-sm text-text-secondary" htmlFor="age18">
              I am at least 18 years old.
            </label>
          </div>
          <div className="field flex items-start gap-2 pt-2 border-t border-[var(--line)]">
            <input
              type="checkbox"
              id="terms"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              required
            />
            <label className="text-sm text-text-secondary" htmlFor="terms">
              I agree to the <Link to="/terms" className="text-accent-bright hover:text-accent-bright">Terms of Service</Link>{' '}
              and <Link to="/privacy" className="text-accent-bright hover:text-accent-bright">Privacy Policy</Link>.
            </label>
          </div>
          <button
            className="w-full btn btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-alt mt-6">
          Already registered?{' '}
          <Link to="/login" className="text-accent-bright hover:text-accent-bright">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
