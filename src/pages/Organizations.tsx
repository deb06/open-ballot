import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { useAuth } from '../lib/auth'

interface Organization {
  id: number
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  memberCount: number
  electionCount: number
  createdAt: string | null
}

export default function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const { isAuthenticated } = useAuth()
  const signedIn = isAuthenticated()

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<{ organizations: Organization[] }>('/api/orgs')
        setOrganizations(data.organizations)
      } catch (err: any) {
        toast(err.message || 'Failed to load organizations', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = organizations.filter((org) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return org.name.toLowerCase().includes(q) || (org.description ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Organizations</p>
        <h1 className="text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-text mb-4">
          Run elections with your <span className="font-normal italic text-accent">community.</span>
        </h1>
        <p className="text-text-secondary max-w-[54ch] leading-[1.6]">
          Organizations on Open Ballot host their own private elections. Members vote, ballots stay secret, and every tally is receipt-verifiable.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="search"
          className="input w-full sm:w-[320px]"
          placeholder="Search organizations…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search organizations"
        />
        {!signedIn && (
          <>
            <Link to="/register" className="btn btn-primary">Create account</Link>
            <Link to="/register-organization" className="btn btn-outline">Register organization</Link>
          </>
        )}
        {signedIn && (
          <Link to="/register-organization" className="btn btn-primary">Register organization</Link>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(40px,7vw,72px)] text-center">
          <p className="text-text-secondary">Loading organizations…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(40px,7vw,72px)] text-center">
          <div className="icon" style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-bright)', display: 'grid', placeItems: 'center', margin: '0 auto 8px' }}>
            <svg className="w-[28px] h-[28px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>
          </div>
          <h2 className="text-[1.15rem] mb-0">No organizations found</h2>
          <p className="text-text-secondary max-w-[46ch] mx-auto">
            {query ? 'Try a different search term.' : 'Be the first to register an organization and start hosting elections.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {filtered.map((org) => (
            <div key={org.id} className="group relative flex flex-col gap-[14px] p-[22px] rounded-lg bg-[var(--panel)] border border-[var(--line)] shadow-[var(--shadow-sm)] transition-[transform_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease] hover:translate-y-[-3px] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow)]">
              <Link to={`/organization/${org.slug}`} className="flex items-center gap-3">
                <span className="flex-none w-[40px] h-[40px] rounded-full bg-[var(--accent-soft)] text-[var(--accent)] font-bold flex items-center justify-center border border-[var(--accent)]">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3 className="text-[1.05rem] font-semibold text-text leading-[1.3]">{org.name}</h3>
                  <p className="text-[0.78rem] text-text-muted">/{org.slug}</p>
                </div>
              </Link>
              <p className="text-[0.9rem] text-text-secondary line-clamp-3">{org.description || 'No description provided.'}</p>
              <div className="flex items-center justify-between gap-4 mt-auto pt-[14px] border-t border-[var(--line)] text-[0.8rem] text-text-secondary">
                <span>{org.memberCount} {org.memberCount === 1 ? 'member' : 'members'} · {org.electionCount} {org.electionCount === 1 ? 'election' : 'elections'}</span>
                <Link to={`/organization/${org.slug}`} className="btn btn-sm btn-outline">View</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}