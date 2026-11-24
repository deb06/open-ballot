import React, { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'

interface Organization {
  id: number
  name: string
  slug: string
  description: string | null
  domain: string | null
  logoUrl: string | null
  membershipMode: string
  status: string
  createdAt: string | null
}

interface OrgSummary {
  organization: Organization
  members: number
  elections: number
}

export default function AdminOrganization() {
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [membershipMode, setMembershipMode] = useState('invite')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<OrgSummary>('/api/org')
        setSummary(data)
        setName(data.organization.name)
        setDomain(data.organization.domain ?? '')
        setMembershipMode(data.organization.membershipMode)
      } catch (err: any) {
        toast(err.message || 'Failed to load organization', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      toast('Organization name must be at least 2 characters.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await api.patch<{ organization: Organization }>('/api/org', {
        name: name.trim(),
        domain: domain.trim(),
        membershipMode,
      })
      setSummary((current) => (current ? { ...current, organization: res.organization } : current))
      toast('Organization settings saved.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <p className="text-text-secondary">Loading organization…</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-12 text-center">
          <h2 className="text-[1.15rem] mb-2">Organization not found</h2>
          <p className="text-text-secondary">Your account is not associated with an organization.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Organization</p>
        <h1 className="text-[clamp(1.9rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-text mb-3">
          {summary.organization.name}
        </h1>
        <p className="text-text-secondary">
          {summary.members} {summary.members === 1 ? 'member' : 'members'} ·{' '}
          {summary.elections} {summary.elections === 1 ? 'election' : 'elections'}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <form onSubmit={save} className="space-y-6">
          <div className="field">
            <label htmlFor="org-name">Organization name</label>
            <input
              id="org-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={160}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="org-domain">Email domain (optional)</label>
            <input
              id="org-domain"
              className="input"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="university.edu"
            />
            <p className="field-hint">
              Members who register with an address on this domain can join automatically. Leave blank to disable.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-text mb-3">Membership mode</legend>
            {[
              {
                key: 'domain',
                title: 'Domain match',
                description: 'Anyone registering with an email address on your domain joins automatically.',
              },
              {
                key: 'invite',
                title: 'Invitation only',
                description: 'Only people you invite can join. Invitations expire after 7 days.',
              },
            ].map((option) => (
              <label
                key={option.key}
                className={`flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  membershipMode === option.key
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-hover)]'
                }`}
              >
                <input
                  type="radio"
                  name="membership-mode"
                  value={option.key}
                  checked={membershipMode === option.key}
                  onChange={(event) => setMembershipMode(event.target.value)}
                  className="mt-1 flex-none accent-[var(--accent)]"
                />
                <span>
                  <strong className="text-text block">{option.title}</strong>
                  <span className="text-sm text-text-secondary">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-5">
            <h2 className="text-[0.95rem] font-semibold text-text mb-4">At a glance</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Slug</dt>
                <dd className="text-text font-mono">/{summary.organization.slug}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Status</dt>
                <dd className="text-[var(--success)] font-semibold">Active</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Domain</dt>
                <dd className="text-text">{summary.organization.domain ? `@${summary.organization.domain}` : 'Not set'}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}