import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

interface Stats {
  openElections: number
  scheduledElections: number
  completedElections: number
  ballotsCast: number
  registeredVoters: number
}

const quickLinks = [
  {
    href: '/admin/org',
    title: 'Organization settings',
    description: 'Name, email domain and how members join.',
    orgAdmin: true,
  },
  {
    href: '/admin/members',
    title: 'Members & invitations',
    description: 'Invite voters, assign roles, revoke pending invites.',
    orgAdmin: true,
  },
  {
    href: '/admin/elections',
    title: 'Elections',
    description: 'Create ballots, manage candidates and publish.',
    always: true,
  },
  {
    href: '/admin/users',
    title: 'Voters',
    description: 'The voter register for your organization.',
    always: true,
  },
  {
    href: '/admin/audit',
    title: 'Audit log',
    description: 'Tamper-evident record of every administrative action.',
    always: true,
  },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const { isAdmin, isOrgAdmin } = useAuth()
  const isPlatformAdmin = isAdmin()
  const isOrgAdminUser = isPlatformAdmin || isOrgAdmin()

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Stats>('/api/stats')
        setStats(data)
      } catch {
        // Stats are advisory; the dashboard still renders without them.
      }
    }
    void load()
  }, [])

  const tiles = [
    { label: 'Elections open now', value: stats?.openElections ?? 0 },
    { label: 'Ballots recorded', value: stats?.ballotsCast ?? 0 },
    { label: 'Registered voters', value: stats?.registeredVoters ?? 0 },
    { label: 'Elections completed', value: stats?.completedElections ?? 0 },
  ]

  const links = quickLinks.filter((link) => {
    if (link.platformAdmin) return isPlatformAdmin
    if (link.orgAdmin) return isOrgAdminUser
    return link.always
  })

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Administration</p>
        <h1 className="text-[clamp(1.9rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-text mb-3">
          {isPlatformAdmin ? 'Platform dashboard' : 'Organization dashboard'}
        </h1>
        <p className="text-text-secondary max-w-[62ch]">
          Run elections, watch turnout and keep the register up to date.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,22px)]">
            <span className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-[1.1] tracking-[-0.03em] text-text font-variant-numeric">
              {new Intl.NumberFormat().format(tile.value)}
            </span>
            <p className="mt-[4px] text-[0.8rem] text-text-secondary tracking-[0.02em]">{tile.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-[1.15rem] font-semibold text-text mb-5">Quick actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="group flex flex-col gap-2 p-[22px] rounded-lg bg-[var(--panel)] border border-[var(--line)] shadow-[var(--shadow-sm)] transition-[transform_0.2s_ease,border-color_0.2s_ease,box-shadow_0.2s_ease] hover:translate-y-[-3px] hover:border-[var(--line-strong)] hover:shadow-[var(--shadow)]"
            >
              <h3 className="text-[1.05rem] font-semibold text-text leading-[1.3]">{link.title}</h3>
              <p className="text-[0.88rem] text-text-secondary leading-[1.55]">{link.description}</p>
              <span className="mt-2 text-[0.8rem] font-semibold text-accent-bright">Open →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}