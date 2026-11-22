import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  const adminItems = [
    { label: 'Overview', href: '/admin' },
    { label: 'Elections', href: '/admin/elections' },
    <Link key="users" to="/admin/users" className="btn btn-ghost btn-sm">Voters</Link>,
    <Link key="polls" to="/admin/polls" className="btn btn-ghost btn-sm">Polls</Link>,
    <Link key="audit" to="/admin/audit" className="btn btn-ghost btn-sm">Audit log</Link>,
    <Link key="webhooks" to="/admin/webhooks" className="btn btn-ghost btn-sm">Webhooks</Link>,
    <Link key="api-keys" to="/admin/api-keys" className="btn btn-ghost btn-sm">API keys</Link>,
    <Link key="schema" to="/admin/schema" className="btn btn-ghost btn-sm">Schema</Link>,
  ]

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        {adminItems.map((item) => {
          if (typeof item === 'string') {
            return <Link key={item} to={item.href} className={location.pathname === item.href ? 'active' : ''} data-nav={item.toLowerCase()}>
              {item.label}
            </Link>
          }
          return item
        })}
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
