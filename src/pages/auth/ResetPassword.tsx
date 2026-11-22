import React from 'react'

export default function ResetPassword() {
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <h2 className="text-xl font-semibold text-text mb-2">Reset password</h2>
        <p className="text-text-secondary mb-4">Choose a new password for your Open Ballot account.</p>
        <form className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary">New password</label>
            <input type="password" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="New password" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary">Confirm new password</label>
            <input type="password" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="Repeat your password" />
          </div>
          <button className="w-full btn btn-primary">Reset password</button>
        </form>
      </div>
    </div>
  )
}
