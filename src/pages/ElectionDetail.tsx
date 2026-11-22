import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'
import { useAuth } from '../lib/auth'
import { useParams, useNavigate } from 'react-router-dom'

interface Candidate {
  id: number
  name: string
  party: string
  bio: string | null
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
  createdBy: number | null
  createdAt: string | null
  updatedAt: string | null
  candidates: Candidate[]
  totalVotes: number
  registeredVoters: number
  hasVoted: boolean
  resultsVisible: boolean
}

export default function ElectionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [election, setElection] = useState<Election | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) {
      api.get(`/api/elections/${id}`).then((data: any) => {
        setElection(data.election)
      }).catch((err: any) => {
        toast(err.message || 'Failed to load election', 'error')
      }).finally(() => setLoading(false))
    }
  }, [id])

  const isMulti = election?.maxChoices && election.maxChoices > 1
  const isRanked = election?.ballotType === 'ranked'

  const toggleCandidate = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (isMulti || !next.size) {
        next.add(id)
      } else {
        next.clear()
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected.size) {
      toast('Please select at least one candidate', 'error')
      return
    }
    setSubmitting(true)
    try {
      if (isRanked) {
        // For ranked ballots, send ordered list
        const ordered = Array.from(selected)
        await api.post(`/api/elections/${id}/vote`, { candidateIds: ordered })
      } else {
        await api.post(`/api/elections/${id}/vote`, { candidateIds: Array.from(selected) })
      }
      toast('Ballot cast successfully!', 'success')
      navigate(`/election/${id}`)
    } catch (err: any) {
      toast(err.message || 'Failed to cast ballot', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!election) {
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
          <p className="text-text-secondary">Loading election…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-0 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-text">{election.title}</h1>
              <p className="text-text-secondary">{election.description || 'No description provided.'}</p>
            </div>
            <span className="text-xs font-bold tracking-[0.06em] uppercase border rounded px-[11px] py-[4px] text-[var(--success)] bg-[var(--success-soft)] border-[rgba(52,211,153,0.28)]">
              {election.status}
            </span>
          </div>
          <div className="flex gap-4 mb-6">
            <span className="text-sm text-text-muted">{election.totalVotes} ballots cast</span>
            <span className="text-sm text-text-muted">{election.registeredVoters} registered voters</span>
            <span className="text-sm text-text-muted">{election.candidateCount} candidates</span>
          </div>

          {election.status === 'scheduled' && (
            <div className="rounded-lg bg-[var(--panel-strong)] border border-[var(--line)] p-4">
              <p className="text-text-secondary">Voting has not opened yet. It opens on {new Date(election.opensAt!).toLocaleDateString()}.</p>
            </div>
          )}

          {election.status === 'closed' && (
            <div className="rounded-lg bg-[var(--panel-strong)] border border-[var(--line)] p-4">
              <p className="text-text-secondary">Voting is closed for this election.</p>
            </div>
          )}

          {election.status === 'open' && !election.hasVoted && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-text mb-4">Cast your ballot</h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                {election.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded border border-[var(--line)] p-3 hover:bg-[var(--panel-strong)] cursor-pointer transition-all group" onClick={() => toggleCandidate(candidate.id)}>
                    <div className="flex items-center gap-3">
                      <input
                        type={isMulti ? 'checkbox' : 'radio'}
                        name="candidate"
                        value={candidate.id.toString()}
                        checked={selected.has(candidate.id)}
                        onChange={() => toggleCandidate(candidate.id)}
                        className="rounded border-[var(--line-strong)] text-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      />
                      <div>
                        <div className="font-semibold text-text">{candidate.name}</div>
                        {candidate.party && <span className="text-xs text-[var(--accent-bright)]">{candidate.party}</span>}
                        {candidate.bio && <p className="text-xs text-text-muted mt-1">{candidate.bio}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="submit"
                  className="w-full btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selected.size || submitting}
                >
                  {submitting ? 'Casting ballot…' : 'Cast ballot'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
