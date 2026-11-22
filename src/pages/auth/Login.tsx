import React from 'react'

export default function Login() {
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <h2 className="text-xl font-semibold text-text mb-2">Welcome back</h2>
        <p className="text-text-secondary mb-4">Sign in to cast your ballot or manage elections.</p>
        <form className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <input type="email" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary">Password</label>
            <input type="password" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="Your password" />
          </div>
          <button className="w-full btn btn-primary">Sign in</button>
        </form>
      </div>
    </div>
  )
}
