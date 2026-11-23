import React from 'react'
import { Link } from 'react-router-dom'

interface Subprocessor {
  name: string
  purpose: string
  location: string
  data: string
}

const subprocessors: Subprocessor[] = [
  {
    name: 'Render',
    purpose: 'Cloud application hosting and deployment',
    location: 'United States',
    data: 'Application code, request logs (IP, user agent), environment configuration',
  },
  {
    name: 'PostgreSQL Database Provider',
    purpose: 'Managed PostgreSQL database hosting',
    location: 'United States',
    data: 'Account records, organization data, participation records, anonymous ballots, audit logs',
  },
  {
    name: 'Email Delivery Provider',
    purpose: 'Transactional email delivery (verification codes, security alerts)',
    location: 'United States',
    data: 'Email address, email content (verification codes and security notifications)',
  },
]

export default function Subprocessors() {
  const lastUpdated = 'November 2024'

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Subprocessors</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">Open Ballot uses the following third-party subprocessors to deliver the voting service. Each is bound by contractual obligations consistent with the DPDP Act, 2023 and the GDPR.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">1. Current Subprocessors</h2>
        <div className="space-y-6">
          {subprocessors.map((sub) => (
            <div key={sub.name} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)]">
              <h3 className="text-[1.05rem] font-semibold text-text mb-2">{sub.name}</h3>
              <dl className="space-y-2 text-text-secondary text-sm">
                <div>
                  <dt className="font-semibold text-text inline">Purpose: </dt>
                  <dd className="inline">{sub.purpose}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text inline">Location: </dt>
                  <dd className="inline">{sub.location}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-text inline">Data processed: </dt>
                  <dd className="inline">{sub.data}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">2. Contractual Safeguards</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Before any subprocessor is engaged, Open Ballot ensures:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>A written data processing agreement is in place with obligations no less protective than this DPA.</li>
            <li>Appropriate technical and organizational security measures are implemented.</li>
            <li>Cross-border transfers comply with Section 16 of the DPDP Act, 2023 and GDPR transfer mechanisms (SCCs / Data Privacy Framework).</li>
            <li>The subprocessor will promptly notify Open Ballot of any personal data breach.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">3. Changes to This List</h2>
        <p className="text-text-secondary leading-relaxed">
          We will update this page at least 30 days before engaging a new subprocessor that processes personal data. If you object to a new subprocessor, contact us at <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a>.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">4. What Subprocessors Never Receive</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your ballot choices — these are stored anonymously and cannot be linked to you.</li>
            <li>How you voted on any election.</li>
            <li>Plaintext passwords (only scrypt hashes are stored).</li>
            <li>Payment information (Open Ballot accepts no payments).</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">5. Related Documents</h2>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link> <span className="mx-2">·</span> <Link to="/dpa" className="underline hover:text-accent-bright">Data Processing Agreement</Link> <span className="mx-2">·</span> <Link to="/data-request" className="underline hover:text-accent-bright">Data Access & Deletion</Link>
        </address>
      </section>
    </div>
  )
}