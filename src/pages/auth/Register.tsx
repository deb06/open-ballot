import React from 'react'

export default function Register() {
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <h2 className="text-xl font-semibold text-text mb-2">Create your account</h2>
        <p className="text-text-secondary mb-4">One account, one ballot per election.</p>
        <form className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary">Full name</label>
            <input type="text" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="Alex Rivera" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <input type="email" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary">Password</label>
            <input type="password" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="At least 12 characters" />
          </div>
          <button className="w-full btn btn-primary">Create account</button>
        </form>
      </div>
    </div>
  )
}
