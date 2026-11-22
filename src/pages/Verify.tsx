import React from 'react'

export default function Verify() {
  return (
    <div className="px-4 lg:px-0 py-8 max-w-lg mx-auto">
      <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-6">
        <h2 className="text-xl font-semibold text-text mb-2">Verify a ballot</h2>
        <p className="text-text-secondary mb-4">Enter your receipt code to verify your ballot.</p>
        <input type="text" className="w-full px-4 py-3 rounded border border-[var(--line-strong)] bg-[var(--input-bg)] text-text" placeholder="OB-XXXX-XXXX-XXXX-XXXX" />
        <button className="mt-4 btn btn-primary">Verify ballot</button>
      </div>
    </div>
  )
}
