import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { useAuth } from '../lib/auth'

/** Sample receipt shown on the landing page as an illustrative example. */
const SAMPLE_RECEIPT = {
  receipt: 'OB-7F3A-9C2E-1B8D',
  merkle: 'included · proof valid',
  audit: 'chainhead verified',
}

interface Election {
  id: number
  title: string
  description: string | null
  status: string
  resultsVisibility: string
  maxChoices: number
  ballotType: string
  kind: string
  slug: string | null
  organizationId: number | null
  createdBy: number | null
  brandColor: string | null
  logoUrl: string | null
  opensAt: string | null
  closesAt: string | null
  createdAt: string | null
  updatedAt: string | null
  candidateCount: number
  totalVotes: number
  registeredVoters: number
  hasVoted: boolean
  resultsVisible: boolean
}

interface Stats {
  appName: string
  openElections: number
  scheduledElections: number
  completedElections: number
  ballotsCast: number
  registeredVoters: number
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all')
  const { user, isOrgAdmin } = useAuth()
  const isOrgAdminUser = isOrgAdmin()

  useEffect(() => {
    const load = async () => {
      try {
        const [sRes, eRes] = await Promise.all([
          api.get<Stats>('/api/stats'),
          api.get<{ elections: Election[] }>('/api/elections'),
        ])
        setStats(sRes)
        setElections(eRes.elections)
      } catch (err: any) {
        toast(err.message || 'Failed to load data', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const openCount = elections.filter((e) => e.status === 'open').length
  const completedCount = elections.filter((e) => e.status === 'closed').length

  const filteredElections = elections.filter((e) => {
    if (filter === 'open') return e.status === 'open'
    if (filter === 'closed') return e.status === 'closed'
    return true
  })

  return (
    <div className="space-y-0">
      {/* Hero */}
      <section className="hero relative overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-0 py-12 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="space-y-6">
              <p className="eyebrow">Secure · anonymous · receipt-verified</p>
              <h1 className="text-[clamp(2.4rem,5vw,3.9rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-text">
                Your voice, <span className="font-normal italic text-accent">counted.</span>
              </h1>
              <p className="text-text-secondary max-w-[54ch] leading-[1.6]">
                Open Ballot is a secure online voting platform for student and community elections. One person, one vote — with a secret ballot, a receipt you can check at any time and a public audit trail.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/elections" className="btn btn-primary btn-lg">
                  Browse elections
                  <svg className="ml-2 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>
                <Link to="/verify" className="btn btn-outline btn-lg">
                  Verify a receipt
                </Link>
              </div>

              {/* Receipt record excerpt — illustrative sample */}
              <div className="pt-4 w-full max-w-[520px]">
                <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] border-l-2 border-l-[var(--accent)] p-[clamp(14px,2vw,18px)] font-mono text-[0.8rem]">
                  <div className="text-text-muted text-[0.72rem] tracking-[0.08em] uppercase border-b border-[var(--line)] pb-2 mb-3 flex items-center gap-2">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></svg>
                    Verified receipt · record excerpt
                  </div>
                  <dl className="space-y-2 text-text-secondary">
                    <div className="flex gap-4">
                      <dt className="w-[72px] flex-none text-text-muted">receipt</dt>
                      <dd className="text-accent-bright break-all">{SAMPLE_RECEIPT.receipt}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-[72px] flex-none text-text-muted">merkle</dt>
                      <dd className="text-accent-bright">{SAMPLE_RECEIPT.merkle}</dd>
                    </div>
                    <div className="flex gap-4">
                      <dt className="w-[72px] flex-none text-text-muted">audit</dt>
                      <dd className="text-accent-bright">{SAMPLE_RECEIPT.audit}</dd>
                    </div>
                  </dl>
                  <p className="text-[0.7rem] text-text-muted mt-3 mb-0">Sample record. Your receipt code proves your ballot was counted without revealing how you voted.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <span className="flex items-center gap-2 px-3 py-1 rounded text-xs font-bold text-text bg-[var(--accent-soft)] border border-[rgba(217,164,65,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-current inline-block" />
                  One person, one vote
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded text-xs font-bold text-text bg-[var(--accent-soft)] border border-[rgba(217,164,65,0.2)]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6" /><path d="M19 21v-6a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v6" /></svg>
                  Secret ballot
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded text-xs font-bold text-text bg-[var(--accent-soft)] border border-[rgba(217,164,65,0.2)]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><path d="M20 4v7a4 4 0 0 1-4 4H5a4 4 0 0 0-4-4V4a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v7" /></svg>
                  Receipt verified
                </span>
              </div>
            </div>

            {/* Right-hand panel: how it works for everyone, platform activity for org admins */}
            <aside className="relative w-full max-w-[520px] mx-auto">
              {isOrgAdminUser ? (
              <div className="relative rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] shadow-[var(--shadow-sm)]">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <p className="text-[0.78rem] text-text-muted tracking-[0.06em] uppercase mb-0">Platform activity</p>
                  <span className="inline-flex items-center gap-2 px-[10px] py-[3px] rounded-[7px] text-[0.72rem] font-bold text-[var(--success)] bg-[var(--success-soft)] border border-[rgba(52,211,153,0.4)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                    LIVE
                  </span>
                </div>
                <h2 className="text-[1.2rem] font-semibold text-text mb-5">Every ballot counts</h2>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[0.85rem] text-text-secondary">Ballots cast</span>
                      <span className="text-[0.95rem] font-bold text-text font-variant-numeric">{formatNumber(stats?.ballotsCast ?? 0)}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: '100%' }} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[0.85rem] text-text-secondary">Registered voters</span>
                      <span className="text-[0.95rem] font-bold text-text font-variant-numeric">{formatNumber(stats?.registeredVoters ?? 0)}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: '100%' }} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[0.85rem] text-text-secondary">Elections open</span>
                      <span className="text-[0.95rem] font-bold text-text font-variant-numeric">{formatNumber(stats?.openElections ?? 0)}</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: '100%' }} /></div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-[var(--line)] text-[0.8rem] text-text-muted">
                  <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  {Math.round(stats && stats.registeredVoters > 0 ? (stats.ballotsCast / stats.registeredVoters) * 100 : 0)}% turnout across all recorded ballots
                </div>
                <Link to="/admin" className="btn btn-primary btn-sm mt-5">Open admin dashboard</Link>
              </div>
              ) : (
              <div className="relative rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] shadow-[var(--shadow-sm)]">
                <div className="text-text-secondary text-[0.8rem] tracking-[0.08em] uppercase border-b border-[var(--line)] pb-3 mb-[10px] flex items-center gap-2">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4 9.5L9 4l5 5M5 20h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2-2v12a2 2 0 0 0 2 2z" /></svg>
                  How it works
                </div>
                <div className="space-y-0 py-2">
                  <div className="flex items-start gap-3 border-b border-[var(--line)] pb-[2px] pt-0">
                    <span className="w-[28px] h-[28px] flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center border border-[var(--accent)]">1</span>
                    <div>
                      <strong className="text-text">Register once</strong>
                      <p className="text-[0.8rem] text-text-secondary mt-[2px] leading-[1.2]">Create your account with email verification.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 border-b border-[var(--line)] pb-[2px] pt-0">
                    <span className="w-[28px] h-[28px] flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center border border-[var(--accent)]">2</span>
                    <div>
                      <strong className="text-text">Vote anonymously</strong>
                      <p className="text-[0.8rem] text-text-secondary mt-[2px] leading-[1.2]">Your ballot is stored without your identity.</p>
                    </div>
                  </div>
                  <div className="flex items-start pb-0 pt-0">
                    <span className="w-[28px] h-[28px] flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center border border-[var(--accent)]">3</span>
                    <div>
                      <strong className="text-text">Verify your receipt</strong>
                      <p className="text-[0.8rem] text-text-secondary mt-[2px] leading-[1.2]">Check your ballot is counted — anytime.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--line)] flex flex-wrap gap-2">
                  <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
                  <Link to="/organizations" className="btn btn-outline btn-sm">Browse organizations</Link>
                </div>
              </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      {isOrgAdminUser && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-6 lg:py-12 px-4 lg:px-0 animate-[page-enter_0.45s_cubic-bezier(0.22,1,0.36,1)_both]">
          {[
            { label: 'Elections open now', value: stats?.openElections ?? 0, icon: 'ballot', color: 'var(--success)' },
            { label: 'Ballots recorded', value: stats?.ballotsCast ?? 0, icon: 'check', color: 'var(--accent-bright)' },
            { label: 'Registered voters', value: stats?.registeredVoters ?? 0, icon: 'users', color: 'var(--info)' },
            { label: 'Elections completed', value: stats?.completedElections ?? 0, icon: 'chart', color: 'var(--text-muted)' },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,3vw,24px)] hover:border-[var(--line-hover)] transition-all duration-200">
              <span className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.1] tracking-[-0.03em] text-text font-variant-numeric">{formatNumber(tile.value)}</span>
              <p className="mt-[4px] text-[0.8rem] text-text-secondary tracking-[0.02em]">{tile.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* Elections list */}
      {isOrgAdminUser && (
        <section id="elections" className="px-4 lg:px-0 py-8">
          <div className="flex items-end justify-between gap-20px flex-wrap mb-6">
            <div>
              <h2 id="elections-title" className="text-[clamp(1.5rem,3vw,2.05rem)] font-semibold text-text">Elections</h2>
              <p className="text-text-secondary mt-[6px]">Every published ballot, open and past.</p>
            </div>
            <div className="flex gap-10px flex-wrap">
              <select className="select w-[200px]" defaultValue="closing" onChange={(e) => {/* sorting handled by API */}}>
                <option value="closing">Closing soonest</option>
                <option value="turnout">Highest turnout</option>
                <option value="newest">Newest first</option>
              </select>
              <div className="inline-flex gap-2 rounded bg-[var(--panel)] border border-[var(--line)] p-1">
                {[
                  { key: 'all', label: 'All', count: elections.length },
                  { key: 'open', label: 'Open', count: openCount },
                  { key: 'closed', label: 'Closed', count: completedCount },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`text-[0.83rem] font-bold px-4 py-2 rounded transition-all ${
                      filter === f.key
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm'
                        : 'text-text bg-transparent hover:bg-[var(--panel-strong)]'
                    }`}
                  >
                    {f.label} <span className="ml-1 text-text-muted font-normal">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
            {filteredElections.length === 0 ? (
              <div className="col-span-full">
                <div className="rounded border border-[var(--line)] bg-[var(--panel)] p-[clamp(40px,7vw,72px)] text-center">
                  <div className="icon" style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--accent-soft)', color: 'var(--accent-bright)', display: 'grid', placeItems: 'center', margin: '0 auto 8px' }}>
                    <svg className="w-[28px] h-[28px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r={7} /><path d="m20 20-3.5-3.5" /></svg>
                  </div>
                  <h2 className="text-[1.15rem] mb-0">No elections here yet</h2>
                  <p className="text-text-secondary max-w-[46ch] mx-auto">There are no published elections at the moment. Check back soon.</p>
                </div>
              </div>
            ) : filteredElections.map((election) => (
              <div key={election.id} className="group relative flex flex-col gap-[14px] p-[22px] rounded-lg bg-[var(--panel)] border border-[var(--line)] shadow-[var(--shadow-sm)] transition-[transform_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease] text-inherit hover:translate-y-[-3px] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow)] cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.06em] uppercase border rounded px-[11px] py-[4px] text-[var(--success)] bg-[var(--success-soft)] border-[rgba(52,211,153,0.28)]">
                    {election.status === 'open' ? 'Open' : election.status === 'closed' ? 'Closed' : 'Scheduled'}
                  </span>
                  <span className="text-[0.8rem] text-text-secondary">{election.candidateCount} {election.candidateCount === 1 ? 'candidate' : 'candidates'}</span>
                </div>
                <h3 className="text-[1.16rem] leading-[1.3]">{election.title}</h3>
                <p className="text-[0.9rem] text-text-secondary line-clamp-3">{election.description || 'No description was provided for this election.'}</p>
                {election.status === 'open' && election.closesAt && (
                  <div className="flex items-center gap-6px rounded-[var(--radius-pill)] bg-[var(--accent-soft)] text-[var(--accent-bright)] px-[10px] py-[5px] text-[0.8rem] font-semibold">
                    <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={9} /><path d="M12 7v6" /></svg>
                    Closes {new Date(election.closesAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                )}
                <div className="flex items-center justify-between gap-[16px] font-[0.8rem] text-text-secondary mt-auto pt-[14px] border-t border-[var(--line)]">
                  <div className="flex items-center gap-[6px]">
                    <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={9} /><path d="M12 7v6" /></svg>
                    {new Date(election.opensAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-[6px]">
                    <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
                    {formatNumber(election.totalVotes)} {election.totalVotes === 1 ? 'ballot' : 'ballots'} cast
                  </div>
                  <div className="flex items-center gap-[6px]">{Math.round((election.totalVotes / election.registeredVoters) * 100)}% turnout</div>
                </div>
                <div className="flex items-center justify-between gap-[12px] mt-auto pt-[14px] border-t border-[var(--line)]">
                  <span className="text-[0.8rem] text-text-secondary">{election.status === 'closed' ? 'View final outcome' : 'Open ballot'}</span>
                  <Link to={`/election/${election.id}`} className="btn btn-sm btn-outline">{election.status === 'closed' ? 'View results' : election.hasVoted ? 'Your ballot' : 'Vote now'}</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-[clamp(48px,7vw,88px)] px-4 lg:px-0">
        <div className="flex items-center gap-[16px] flex-wrap mb-[22px]">
          <h2 className="text-[clamp(1.5rem,3vw,2.05rem)] font-semibold text-text">How voting works</h2>
          <p className="text-text-secondary">Three steps, no queues, no paper forms.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)]">
            <div className="flex items-start gap-[14px] mb-[14px]">
              <span className="flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center w-[28px] h-[28px] border border-[var(--accent)]">1</span>
              <svg className="flex-none w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x={4} y={10} width={16} height={11} rx={2.5} /><circle cx={9} cy={7} r={3.5} /></svg>
            </div>
            <h3 className="text-[1.02rem] font-semibold text-text">Register once</h3>
            <p className="text-[0.88rem] text-text-secondary mt-0 leading-[1.55]">Create an account with your name and email. Your password is hashed with scrypt — never stored in plain text.</p>
          </div>
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)]">
            <div className="flex items-start gap-[14px] mb-[14px]">
              <span className="flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center w-[28px] h-[28px] border border-[var(--accent)]">2</span>
              <svg className="flex-none w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x={4} y={10} width={16} height={11} rx={2.5} /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
            </div>
            <h3 className="text-[1.02rem] font-semibold text-text">Vote anonymously</h3>
            <p className="text-[0.88rem] text-text-secondary mt-0 leading-[1.55]">Choose your candidate and confirm. Your identity and your choice are stored separately, so no one can tell how you voted.</p>
          </div>
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)]">
            <div className="flex items-start gap-[14px] mb-[14px]">
              <span className="flex-none rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold flex items-center justify-center w-[28px] h-[28px] border border-[var(--accent)]">3</span>
              <svg className="flex-none w-[20px] h-[20px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><path d="M20 4v7a4 4 0 0 1-4 4H5a4 4 0 0 0-4-4V4a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v7" /></svg>
            </div>
            <h3 className="text-[1.02rem] font-semibold text-text">Verify with your receipt</h3>
            <p className="text-[0.88rem] text-text-secondary mt-0 leading-[1.55]">Every ballot produces a unique receipt code. Use it any time to prove your ballot was recorded in the tally.</p>
          </div>
        </div>
      </section>

      {/* Integrity */}
      <section className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] shadow-[var(--shadow-sm)] mt-[clamp(40px,6vw,64px)]">
        <div className="flex items-center justify-between gap-[16px] mb-[18px]">
          <div>
            <h2 className="text-[1.2rem] font-semibold text-text mb-0">Built for integrity</h2>
            <p className="text-[0.88rem] text-text-secondary mt-[6px]">The safeguards behind every tally.</p>
          </div>
          <span className="px-[9px] py-[3px] rounded-[7px] text-[0.74rem] font-bold text-[var(--accent-bright)] bg-[var(--accent-soft)] border border-[rgba(217,164,65,0.3)]">
            <svg className="w-[14px] h-[14px] mr-[6px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v6" /><path d="M19 21v-6a4 4 0 0 1-4-4H9a4 4 0 0 0-4 4v6" /></svg>
            Audited design
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
          {[
            { title: 'One person, one vote', text: 'A unique key on the participation table rejects a second ballot from the same voter, even under concurrent requests.' },
            { title: 'Secret ballots', text: 'Participation (who voted) and ballots (what was chosen) are separate tables. Ballots have no voter id and no timestamp.' },
            { title: 'Tamper evidence', text: 'Every administrative action and ballot event is written to an append-only audit log with timestamps and IPs.' },
          ].map((item, i) => (
            <div key={item.title} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)]">
              <h4 className="text-[1rem] font-semibold text-text mb-[6px]">{item.title}</h4>
              <p className="text-[0.88rem] text-text-secondary mt-0 leading-[1.55]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}
