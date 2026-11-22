import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { useAuth } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast('Welcome back!', 'success')
      navigate('/')
    } catch (err: any) {
      toast(err.message || 'Login failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <div className="auth-head">
          <p className="eyebrow">Secure access</p>
          <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.15rem)', marginBottom: '8px' }}>Welcome back</h1>
          <p className="text-text-secondary mb-4">Sign in to cast your ballot or manage elections.</p>
        </div>
        <form className="card stack space-y-4" onSubmit={handleSubmit}>
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
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="w-full btn btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-alt mt-6">
          New here?{' '}
          <Link to="/register" className="text-accent-bright hover:text-accent-bright">Create an account</a>{' '}
          ·{' '}
          <Link to="/forgot-password" className="text-accent-bright hover:text-accent-bright">Forgot password?</a>
        </div>
      </div>
    </div>
  )
}
