import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'

interface Organization {
  id: number
  name: string
  slug: string
  description: string | null
  domain: string | null
  logoUrl: string | null
  membershipMode: string
  memberCount: number
  electionCount: number
}

interface Election {
  id: number
  title: string
  description: string | null
  status: string
  candidateCount: number
  totalVotes: number
  registeredVoters: number
  closesAt: string | null
  opensAt: string | null
  hasVoted: boolean
}

export default function OrganizationDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [orgRes, electionsRes] = await Promise.all([
          api.get<{ organization: Organization }>(`/api/orgs/${slug}`),
          api.get<{ elections: Election[] }>(`/api/orgs/${slug}/elections`),
        ])
        setOrganization(orgRes.organization)
        setElections(electionsRes.elections)
      } catch (err: any) {
        if (err.status === 404 || (err.message ?? '').toLowerCase().includes('not found')) {
          setNotFound(true)
        } else {
          toast(err.message || 'Failed to load organization', 'error')
        }
      } finally {
        setLoading(false)
      }
    }
    if (slug) void load()
  }, [slug])

  if (loading) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <p className="text-text-secondary">Loading organization…</p>
      </div>
    )
  }

  if (notFound || !organization) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(40px,7vw,72px)] text-center">
          <h1 className="text-[1.15rem] mb-2">Organization not found</h1>
          <p className="text-text-secondary max-w-[46ch] mx-auto mb-6">
            No active organization exists at that address.
          </p>
          <Link to="/organizations" className="btn btn-outline">
            Browse all organizations
          </Link>
        </div>
      </div>
    )
  }

  const statusLabel: Record<string, string> = { open: 'Open', closed: 'Closed', scheduled: 'Scheduled', draft: 'Draft' }

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Organization</p>
        <h1 className="text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-text mb-4">
          {organization.name}
        </h1>
        <p className="text-text-secondary max-w-[62ch] leading-[1.6] mb-6">
          {organization.description || 'This organization has not added a description yet.'}
        </p>
        <div className="flex gap-6 flex-wrap text-[0.85rem] text-text-secondary">
          <span>{organization.memberCount} {organization.memberCount === 1 ? 'member' : 'members'}</span>
          <span>{organization.electionCount} {organization.electionCount === 1 ? 'election' : 'elections'}</span>
          {organization.domain && <span>@{organization.domain}</span>}
        </div>
      </header>

      <section>
        <h2 className="text-[clamp(1.5rem,3vw,2.05rem)] font-semibold text-text mb-5">Elections</h2>
        {elections.length === 0 ? (
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(40px,7vw,72px)] text-center">
            <h3 className="text-[1.05rem] mb-2">No elections yet</h3>
            <p className="text-text-secondary max-w-[46ch] mx-auto">
              This organization has not published any elections. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
            {elections.map((election) => (
              <div
                key={election.id}
                className="group relative flex flex-col gap-[14px] p-[22px] rounded-lg bg-[var(--panel)] border border-[var(--line)] shadow-[var(--shadow-sm)] transition-[transform_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease] hover:translate-y-[-3px] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-xs font-bold tracking-[0.06em] uppercase border rounded px-[11px] py-[4px] ${
                      election.status === 'open'
                        ? 'text-[var(--success)] bg-[var(--success-soft)] border-[rgba(52,211,153,0.28)]'
                        : 'text-text-secondary bg-[var(--panel-strong)] border-[var(--line-strong)]'
                    }`}
                  >
                    {statusLabel[election.status] ?? election.status}
                  </span>
                  <span className="text-[0.8rem] text-text-secondary">
                    {election.candidateCount} {election.candidateCount === 1 ? 'candidate' : 'candidates'}
                  </span>
                </div>
                <h3 className="text-[1.16rem] leading-[1.3] font-semibold text-text">{election.title}</h3>
                <p className="text-[0.9rem] text-text-secondary line-clamp-3">
                  {election.description || 'No description was provided for this election.'}
                </p>
                <div className="flex items-center justify-between gap-[16px] mt-auto pt-[14px] border-t border-[var(--line)] font-[0.8rem] text-text-secondary">
                  <span>{election.totalVotes} {election.totalVotes === 1 ? 'ballot' : 'ballots'} cast</span>
                  <Link to={`/election/${election.id}`} className="btn btn-sm btn-outline">
                    {election.status === 'open' ? (election.hasVoted ? 'Your ballot' : 'Vote now') : 'View'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        <Link to="/organizations" className="btn btn-ghost btn-sm">
          ← All organizations
        </Link>
      </div>
    </div>
  )
}