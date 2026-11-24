import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'

interface Member {
  id: number
  name: string
  email: string
  role: string
  emailVerified?: boolean
  createdAt?: string
}

interface Invite {
  id: number
  email: string
  role: string
  accepted: boolean
  expiresAt: string | null
  createdAt: string | null
}

const roleLabels: Record<string, string> = {
  admin: 'Platform admin',
  org_admin: 'Organization admin',
  observer: 'Observer',
  voter: 'Voter',
}

const roleOptions = [
  { key: 'voter', label: 'Voter', description: 'Can vote in organization elections.' },
  { key: 'observer', label: 'Observer', description: 'Can view elections and results, but cannot vote.' },
  { key: 'org_admin', label: 'Organization admin', description: 'Full control over the organization and its elections.' },
]

export default function AdminMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('voter')
  const [inviting, setInviting] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)

  const load = async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.get<{ members: Member[] }>('/api/org/members'),
        api.get<{ invites: Invite[] }>('/api/org/invites'),
      ])
      setMembers(membersRes.members)
      setInvites(invitesRes.invites)
    } catch (err: any) {
      toast(err.message || 'Failed to load members', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const invite = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!inviteEmail.trim()) {
      toast('Enter an email address to invite.', 'error')
      return
    }
    setInviting(true)
    try {
      const res = await api.post<{ invite: { link: string } }>('/api/org/invites', {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      setLastLink(res.invite.link)
      setInviteEmail('')
      toast('Invitation sent.', 'success')
      const invitesRes = await api.get<{ invites: Invite[] }>('/api/org/invites')
      setInvites(invitesRes.invites)
    } catch (error: any) {
      toast(error.message || 'Failed to send invitation', 'error')
    } finally {
      setInviting(false)
    }
  }

  const revokeInvite = async (invite: Invite) => {
    try {
      await api.delete(`/api/org/invites/${invite.id}`)
      setInvites((current) => current.filter((item) => item.id !== invite.id))
      toast('Invitation revoked.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to revoke invitation', 'error')
    }
  }

  const pendingInvites = invites.filter((invite) => !invite.accepted)

  if (loading) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <p className="text-text-secondary">Loading members…</p>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Organization</p>
        <h1 className="text-[clamp(1.9rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-text mb-3">
          Members
        </h1>
        <p className="text-text-secondary max-w-[62ch]">
          Invite people to your organization, manage their roles, and revoke pending invitations.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <section>
          <h2 className="text-[1.15rem] font-semibold text-text mb-5">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </h2>
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Name</th>
                    <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Email</th>
                    <th className="px-4 py-3 text-[0.75rem] font-bold tracking-[0.06em] uppercase text-text-muted">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-[var(--line)] last:border-0">
                      <td className="px-4 py-3 font-semibold text-text">{member.name}</td>
                      <td className="px-4 py-3 text-[0.85rem] text-text-secondary">{member.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-[10px] py-[3px] rounded-[7px] text-[0.72rem] font-bold text-[var(--accent-bright)] bg-[var(--accent-soft)] border border-[var(--accent)]">
                          {roleLabels[member.role] ?? member.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pendingInvites.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[1.15rem] font-semibold text-text mb-5">
                Pending invitations ({pendingInvites.length})
              </h2>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-lg bg-[var(--panel)] border border-[var(--line)] flex-wrap"
                  >
                    <div>
                      <p className="font-semibold text-text">{invite.email}</p>
                      <p className="text-[0.78rem] text-text-muted">
                        {roleLabels[invite.role] ?? invite.role}
                        {invite.expiresAt ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revokeInvite(invite)}>
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside>
          <form onSubmit={invite} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-5 space-y-5">
            <h2 className="text-[0.95rem] font-semibold text-text">Invite a member</h2>
            <div className="field">
              <label htmlFor="invite-email">Email address</label>
              <input
                id="invite-email"
                type="email"
                className="input"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="person@example.com"
                required
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-text mb-2">Role</legend>
              {roleOptions.map((option) => (
                <label
                  key={option.key}
                  className={`flex gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    inviteRole === option.key
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] hover:border-[var(--line-hover)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={option.key}
                    checked={inviteRole === option.key}
                    onChange={(event) => setInviteRole(event.target.value)}
                    className="mt-0.5 flex-none accent-[var(--accent)]"
                  />
                  <span>
                    <strong className="text-text block text-sm">{option.label}</strong>
                    <span className="text-[0.75rem] text-text-secondary">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn btn-primary w-full" disabled={inviting}>
              {inviting ? 'Sending…' : 'Send invitation'}
            </button>
          </form>

          {lastLink && (
            <div className="mt-4 rounded-lg bg-[var(--success-soft)] border border-[rgba(52,211,153,0.4)] p-4">
              <p className="text-[0.85rem] text-text font-semibold mb-2">Invitation link (dev mode)</p>
              <p className="text-[0.75rem] text-text-secondary mb-2 break-all font-mono">{lastLink}</p>
              <p className="text-[0.72rem] text-text-muted">
                Email delivery is not configured, so share this link manually. See <Link to="/subprocessors" className="underline">subprocessors</Link>.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}