import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'

export default function Verify() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const data = await api.get(`/api/verify/${encodeURIComponent(code)}`)
      setResult(data)
      toast('Ballot verified!', 'success')
    } catch (err: any) {
      setError(err.message || 'No ballot found for that receipt code')
      toast(err.message || 'Verification failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 lg:px-0 py-8 max-w-2xl mx-auto">
      <div className="max-w-lg mx-auto">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
          <div className="flex items-center gap-4 mb-6">
            <svg className="w-8 h-8 text-accent-bright" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <h1 className="text-xl font-semibold text-text mb-0">Verify a ballot</h1>
          </div>
          <p className="text-text-secondary mb-6">Enter your receipt code to verify your ballot.</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="field">
              <label className="text-xs font-semibold text-text-secondary">Receipt code</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text font-mono focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="OB-XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/-/g, '').toUpperCase().match(/.{1,4}/g)?.join('-') || '')}
                maxLength="23"
                required
                autoComplete="off"
              />
              <p className="text-xs text-text-faint mt-1">Codes look like OB-7F2K-9QXA-3M4T-8ZPN. Spaces and lowercase are fine.</p>
            </div>
            <button
              className="w-full btn btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Checking…' : 'Verify ballot'}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-sm bg-[var(--danger-soft)] border border-[var(--danger)] p-3 text-[var(--danger)]">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-6 rounded-lg bg-[var(--success-soft)] border border-[var(--success)] p-4">
              <h3 className="text-sm font-semibold text-[var(--success)] mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Ballot verified
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-faint uppercase">Election</p>
                  <p className="text-text">{result.election?.title}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase">Recorded choice</p>
                  <p className="text-text">{result.candidate?.name}{result.candidate?.party ? ` · ${result.candidate.party}` : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase">Status</p>
                  <p className="text-text">{result.counted ? 'Counted in the tally' : 'Not counted'}</p>
                </div>
                <div>
                  <p className="text-xs text-text-faint uppercase">Receipt</p>
                  <p className="text-text font-mono text-xs break-all">{code}</p>
                </div>
              </div>
              <div className="mt-4">
                <Link to={`/election/${result.election.id}`} className="btn btn-outline btn-sm">
                  View this election
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
