import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { user } = useAuth()
  const isPlatformAdmin = user?.role === 'admin'
  const isOrgAdmin = user?.role === 'admin' || user?.role === 'org_admin'

  const navItems = [
    { label: 'Overview', href: '/admin', always: true },
    { label: 'Elections', href: '/admin/elections', always: true },
    { label: 'Voters', href: '/admin/users', always: true },
    { label: 'Polls', href: '/admin/polls', always: true },
    { label: 'Organization', href: '/admin/org', orgAdmin: true },
    { label: 'Members', href: '/admin/members', orgAdmin: true },
    { label: 'All organizations', href: '/admin/organizations', platformAdmin: true },
    { label: 'Audit log', href: '/admin/audit', always: true },
    { label: 'Webhooks', href: '/admin/webhooks', platformAdmin: true },
    { label: 'API keys', href: '/admin/api-keys', platformAdmin: true },
    { label: 'Schema', href: '/admin/schema', always: true },
  ].filter((item) => {
    if (item.platformAdmin) return isPlatformAdmin
    if (item.orgAdmin) return isOrgAdmin
    return item.always
  })

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={location.pathname === item.href ? 'active' : ''}
            data-nav={item.label.toLowerCase().replace(/\s+/g, '-')}
          >
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="admin-main">
        {children ?? <Outlet />}
      </main>
    </div>
  )
}