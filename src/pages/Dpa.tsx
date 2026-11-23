import React from 'react'
import { Link } from 'react-router-dom'

export default function Dpa() {
  const lastUpdated = 'November 2024'

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Data Processing Agreement</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">This agreement describes how Open Ballot processes personal data on behalf of organizations, in accordance with the Digital Personal Data Protection Act, 2023 (India) and the EU General Data Protection Regulation (GDPR).</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">1. Roles of the Parties</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Data Fiduciary / Data Controller:</strong> The organization that determines the purpose and means of processing (typically the organization running elections).</li>
            <li><strong>Data Processor:</strong> Open Ballot, which processes personal data on behalf of the organization, on its instructions, solely to provide the voting service.</li>
            <li><strong>Data Principal / Data Subject:</strong> The individual voter whose personal data is processed.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">2. Scope of Processing</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot processes the following categories of personal data solely to operate elections:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Name and email address (account identity and eligibility).</li>
            <li>Organization membership and role.</li>
            <li>Authentication data (password hash, MFA secrets, verification status).</li>
            <li>Security and audit logs (IP address, user agent, timestamps).</li>
          </ul>
          <p>Ballot choices are processed anonymously and are <strong>not</strong> linked to any Data Principal.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">3. Processor Obligations</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot, as Data Processor, shall:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Process personal data only on documented instructions from the organization.</li>
            <li>Ensure persons authorized to process the data are bound by confidentiality commitments.</li>
            <li>Implement appropriate technical and organizational security measures (encryption in transit, scrypt password hashing, MFA, rate limiting, audit logging).</li>
            <li>Not engage another processor without prior authorization from the organization.</li>
            <li>Assist the organization in responding to Data Principal requests (access, correction, erasure).</li>
            <li>Notify the organization without undue delay upon becoming aware of a personal data breach.</li>
            <li>Delete or return all personal data at the end of the service provision, at the organization's choice, unless retention is required by law.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">4. Data Principal Rights</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot provides the organization with the tools to honor Data Principal rights under both regimes:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Right to access</strong> — account data export via Account Settings.</li>
            <li><strong>Right to correction</strong> — profile editing via Account Settings.</li>
            <li><strong>Right to erasure</strong> — account deletion via Account Settings or by request.</li>
            <li><strong>Right to grievance redressal</strong> (DPDP) and <strong>right to lodge a complaint with a supervisory authority</strong> (GDPR).</li>
            <li><strong>Right to data portability</strong> — machine-readable export of personal data.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">5. International Transfers</h2>
        <p className="text-text-secondary leading-relaxed">
          Open Ballot is hosted in the United States. For GDPR purposes, transfers are made under Standard Contractual Clauses (SCCs) and, where applicable, the EU-US Data Privacy Framework. For DPDP purposes, transfers are made to countries not restricted by the Central Government under Section 16 of the DPDP Act, 2023.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">6. Audit & Compliance</h2>
        <p className="text-text-secondary leading-relaxed">
          Open Ballot maintains an append-only, tamper-evident audit log of administrative and ballot events. The organization may request information about processing activities relevant to its elections at any time.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">7. Liability & Indemnity</h2>
        <p className="text-text-secondary leading-relaxed">
          Each party is liable for damages caused by its own breach of this agreement. Open Ballot's total liability is limited to the fees paid under the service agreement (none, as Open Ballot is free). Nothing in this agreement limits a Data Principal's rights against either party.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">8. Term & Termination</h2>
        <p className="text-text-secondary leading-relaxed">
          This agreement remains in effect while Open Ballot processes personal data on behalf of the organization. Upon termination, Open Ballot will delete or return the personal data within 30 days, except where retention is required by law.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">9. Related Documents</h2>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link> <span className="mx-2">·</span> <Link to="/terms" className="underline hover:text-accent-bright">Terms of Service</Link> <span className="mx-2">·</span> <Link to="/subprocessors" className="underline hover:text-accent-bright">Subprocessors</Link> <span className="mx-2">·</span> <Link to="/data-request" className="underline hover:text-accent-bright">Data Access & Deletion</Link>
        </address>
      </section>
    </div>
  )
}