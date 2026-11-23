import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { useAuth } from '../lib/auth'

type RequestType = 'access' | 'export' | 'correct' | 'delete' | 'withdraw'

const requestTypes: { key: RequestType; label: string; description: string }[] = [
  { key: 'access', label: 'Access my data', description: 'Get a summary of the personal data Open Ballot processes about you and how it is used.' },
  { key: 'export', label: 'Export my data', description: 'Download a machine-readable (JSON) copy of your personal data — the right to data portability.' },
  { key: 'correct', label: 'Correct my data', description: 'Fix inaccurate or incomplete personal information. Most changes can be made instantly in Account Settings.' },
  { key: 'delete', label: 'Delete my data', description: 'Erase your account and personal data. Anonymous ballot receipts remain as they cannot identify you.' },
  { key: 'withdraw', label: 'Withdraw consent', description: 'Stop processing based on consent. You will need to delete your account or contact us to complete withdrawal.' },
]

export default function DataRequest() {
  const lastUpdated = 'November 2024'
  const { user } = useAuth()
  const [type, setType] = useState<RequestType>('access')
  const [email, setEmail] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (user?.email) setEmail(user.email)
  }, [user])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      toast('Please enter the email address associated with your account.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/account/data-request', {
        type,
        email: email.trim(),
        details: details.trim(),
      })
      setSubmitted(true)
      toast('Your request has been submitted. We will respond within 30 days.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to submit your request. Please email openballot@outlook.com.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Data Access & Deletion Request</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">Exercise your rights as a Data Principal under the DPDP Act, 2023 and as a Data Subject under the GDPR. We respond to all requests within 30 days.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">Your Rights</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Under the <strong>DPDP Act, 2023</strong> (India): access information, correction, erasure, grievance redressal, nomination, and data portability where prescribed.</p>
          <p>Under the <strong>GDPR</strong> (EU/EEA/UK): access, rectification, erasure ("right to be forgotten"), restriction of processing, data portability, objection, and withdrawal of consent.</p>
          <p>Both frameworks give you the right to lodge a complaint with a supervisory authority — in India, the <strong>Data Protection Board of India</strong>.</p>
        </div>
      </section>

      {submitted ? (
        <section className="mb-10 rounded-lg bg-[var(--success-soft)] border border-[rgba(52,211,153,0.4)] p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Request Received</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>We have received your <strong>{requestTypes.find((r) => r.key === type)?.label}</strong> request for <strong>{email}</strong>.</p>
            <p>Our team will process it within <strong>30 days</strong>. For access and export requests, we will send your data summary or JSON export to this email address. For deletion requests, your personal data will be erased within 30 days.</p>
            <p>Need to follow up? Email <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a>.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSubmitted(false)}>Submit another request</button>
          </div>
        </section>
      ) : (
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-text mb-4">Submit a Request</h2>
          <form onSubmit={submit} className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-text mb-3">What would you like to do?</legend>
              {requestTypes.map((option) => (
                <label key={option.key} className={`flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${type === option.key ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-hover)]'}`}>
                  <input
                    type="radio"
                    name="request-type"
                    value={option.key}
                    checked={type === option.key}
                    onChange={() => setType(option.key)}
                    className="mt-1 flex-none accent-[var(--accent)]"
                  />
                  <span>
                    <strong className="text-text block">{option.label}</strong>
                    <span className="text-sm text-text-secondary">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="field">
              <label htmlFor="request-email">Email address on your account</label>
              <input
                id="request-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="request-details">Additional details (optional)</label>
              <textarea
                id="request-details"
                className="textarea"
                rows={4}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Anything that helps us identify your request…"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">What Happens to Ballot Data</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Your <strong>ballot choices are anonymous</strong> and cannot be exported, corrected, or erased because they are not linked to your identity.</p>
          <p>Your <strong>receipt codes</strong> are one-way HMAC values with no personal data. They remain as part of the public audit trail but cannot identify you or reveal how you voted.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">Self-Service Options</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><Link to="/account" className="underline hover:text-accent-bright">Account Settings</Link> — update your name/email, export your data, enable MFA.</li>
            <li><Link to="/verify" className="underline hover:text-accent-bright">Verification page</Link> — confirm your ballot was counted using your receipt code.</li>
            <li><Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link> — full details on processing, retention, and safeguards.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">Grievance Officer</h2>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <strong>Grievance Officer</strong><br />
          Open Ballot Project<br />
          Email: <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a>
        </address>
      </section>
    </div>
  )
}