import React, { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'

interface Organization {
  id: number
  name: string
  slug: string
  domain: string | null
  membershipMode: string
  status: string
  memberCount: number
  electionCount: number
  createdAt: string | null
}

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<{ organizations: Organization[] }>('/api/admin/organizations')
        setOrganizations(data.organizations)
      } catch (err: any) {
        toast(err.message || 'Failed to load organizations', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const setStatus = async (org: Organization, status: 'active' | 'suspended') => {
    setBusyId(org.id)
    try {
      await api.patch(`/api/admin/organizations/${org.id}`, { status })
      setOrganizations((current) =>
        current.map((item) => (item.id === org.id ? { ...item, status } : item)),
      )
      toast(`${org.name} is now ${status}.`, 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to update organization status', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = organizations.filter((org) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      org.name.toLowerCase().includes(q) ||
      org.slug.toLowerCase().includes(q) ||
      (org.domain ?? '').toLowerCase().includes(q)
    )
  })

  const totalMembers = organizations.reduce((sum, org) => sum + org.memberCount, 0)
  const activeCount = organizations.filter((org) => org.status === 'active').length

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Administration</p>
        <h1 className="text-[clamp(1.9rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-text mb-3">
          Organizations
        </h1>
        <p className="text-text-secondary max-w-[62ch]">
          Every organization on the platform. Suspend an organization to immediately block its members from voting or creating elections.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Organizations', value: organizations.length },
          { label: 'Active', value: activeCount },
          { label: 'Total members', value: totalMembers },
        ].map((tile) => (
          <div key={tile.label} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,22px)]">
            <span className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.1] tracking-[-0.03em] text-text font-variant-numeric">
              {new Intl.NumberFormat().format(tile.value)}
            </span>
            <p className="mt-[4px] text-[0.8rem] text-text-secondary tracking-[0.02em]">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <input
          type="search"
          className="input w-full sm:w-[340px]"
          placeholder="Search by name, slug or domain…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search organizations"
        />
      </div>

      {loading ? (
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-12 text-center">
          <p className="text-text-secondary">Loading organizations…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(40px,7vw,72px)] text-center">
          <h2 className="text-[1.15rem] mb-2">No organizations found</h2>
          <p className="text-text-secondary max-w-[46ch] mx-auto">
            {query ? 'Try a different search term.' : 'No organizations have been registered yet.'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Organization</th>
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Domain</th>
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Members</th>
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Elections</th>
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Status</th>
                  <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((org) => (
                  <tr key={org.id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--panel-strong)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text">{org.name}</div>
                      <div className="text-[0.78rem] text-text-muted">/{org.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-text-secondary">
                      {org.domain ? `@${org.domain}` : <span className="text-text-faint">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[0.85rem] text-text font-variant-numeric">{org.memberCount}</td>
                    <td className="px-4 py-3 text-[0.85rem] text-text font-variant-numeric">{org.electionCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-[10px] py-[3px] rounded-[7px] text-[0.72rem] font-bold border ${
                          org.status === 'active'
                            ? 'text-[var(--success)] bg-[var(--success-soft)] border-[rgba(52,211,153,0.4)]'
                            : 'text-[var(--danger)] bg-[var(--danger-soft)] border-[rgba(248,113,113,0.4)]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {org.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {org.status === 'active' ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === org.id}
                          onClick={() => void setStatus(org, 'suspended')}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busyId === org.id}
                          onClick={() => void setStatus(org, 'active')}
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}