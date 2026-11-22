import React from 'react'

export default function ForgotPassword() {
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <h2 className="text-xl font-semibold text-text mb-2">Reset password</h2>
        <p className="text-text-secondary mb-4">Enter your e-mail to receive a reset link.</p>
        <form className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary">Email</label>
            <input type="email" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="you@example.com" />
          </div>
          <button className="w-full btn btn-primary">Send reset link</button>
        </form>
      </div>
    </div>
  )
}
