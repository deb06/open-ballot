import React from 'react'
import { Link } from 'react-router-dom'

export default function Privacy() {
  const lastUpdated = 'November 2024'

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Privacy Policy</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">This policy explains how Open Ballot collects, uses, and protects your personal data under the Digital Personal Data Protection Act, 2023 (DPDP Act, 2023) and the Information Technology Act, 2000.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">1. Who We Are</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot is the <strong>Data Fiduciary</strong> for the personal data processed through this platform, as defined under the DPDP Act, 2023. You, the individual whose data is processed, are the <strong>Data Principal</strong>.</p>
          <p>This policy constitutes the <strong>notice</strong> required under Section 5 and Section 6 of the DPDP Act, 2023. By creating an account and consenting to this notice, you allow us to process your personal data for the purposes described below.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">2. Personal Data We Process</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>When you register for Open Ballot, we process:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Account information:</strong> Your full name and email address.</li>
            <li><strong>Authentication data:</strong> Password hash (scrypt), email verification status, and MFA secrets if enabled.</li>
            <li><strong>Organization data:</strong> If you join an organization, your organization ID and role.</li>
            <li><strong>Usage data:</strong> IP address, user agent, and timestamps for login, voting, and administrative actions (for security and audit purposes).</li>
          </ul>
          <p>We do <strong>not</strong> process:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your ballot choices (ballots are stored without voter identity).</li>
            <li>How you voted on any specific election.</li>
            <li>Payment information (Open Ballot is free).</li>
            <li>Aadhaar numbers, government IDs, or financial account details.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">3. Purpose of Processing</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>We process your personal data only for the following lawful purposes, for which we obtain your consent or which are permitted under the DPDP Act, 2023:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Creating and managing your account.</li>
            <li>Verifying your email address and authenticating you securely.</li>
            <li>Enabling you to vote in elections you are eligible for.</li>
            <li>Generating your receipt code so you can confirm your ballot was counted.</li>
            <li>Sending security notifications (login alerts, password changes, MFA events).</li>
            <li>Maintaining audit logs for election integrity.</li>
            <li>Complying with applicable law and responding to legal requests.</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data or use it for advertising, profiling, or behavioural monitoring.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">4. Consent and Withdrawal</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Your consent is:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Free, specific, informed, unconditional, and unambiguous</strong>, given through a clear affirmative action (account registration) as required under Section 6 of the DPDP Act, 2023.</li>
            <li>Preceded by this notice describing the personal data processed and its purpose.</li>
            <li>Limited to the purposes listed above — we do not process data beyond what is necessary.</li>
          </ul>
          <p><strong>Withdrawal of consent:</strong> You may withdraw consent at any time through <Link to="/account" className="underline hover:text-accent-bright">Account Settings</Link> or by emailing us. Withdrawal is as easy as giving consent. Upon withdrawal, we will stop processing and erase your personal data within 30 days, except where retention is required by law.</p>
          <p><strong>Consequences of withdrawal:</strong> If you withdraw consent, you will not be able to vote in open elections or use authenticated features. Your ballot receipts remain anonymous and are not linked to you.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">5. Ballot Anonymity & Receipt Verification</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot maintains a strict cryptographic separation of identity and ballot:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Participation records</strong> note <em>that</em> you voted (and when), but not <em>how</em> you voted.</li>
            <li><strong>Ballot records</strong> contain <em>what</em> was chosen, but contain <strong>no identity, no email, no IP address, and no timestamp</strong>.</li>
            <li>The two tables share <strong>no foreign keys</strong> and have <strong>no joinable columns</strong>.</li>
          </ul>
          <p>When you vote, you receive a unique <strong>receipt code</strong> (format: <code className="bg-[var(--panel)] px-1.5 rounded text-sm font-mono">OB-XXXX-XXXX-XXXX-XXXX</code>). This code:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Is a one-way HMAC of your vote, salted with a secret key only the server knows.</li>
            <li>Cannot be reversed to reveal your vote.</li>
            <li>Can be entered on the <Link to="/verify" className="underline hover:text-accent-bright">verification page</Link> to prove your ballot was included in the final tally.</li>
            <li>Does not reveal your identity or how you voted to anyone, including Open Ballot administrators.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">6. Your Rights as a Data Principal</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Under Chapter II of the DPDP Act, 2023, you have the following rights:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Right to access information</strong> — a summary of the personal data we process about you, the processing activities, and any sharing with other Data Fiduciaries.</li>
            <li><strong>Right to correction</strong> — have inaccurate or misleading personal data corrected or completed.</li>
            <li><strong>Right to erasure</strong> — have your personal data erased where it is no longer necessary for the purpose it was collected, or if consent is withdrawn. You can delete your account via <Link to="/account" className="underline hover:text-accent-bright">Account Settings</Link>.</li>
            <li><strong>Right to grievance redressal</strong> — have your complaints resolved by our grievance officer (see Section 11).</li>
            <li><strong>Right to nominate</strong> — nominate another person to exercise your rights in the event of your death or incapacity.</li>
            <li><strong>Right to data portability</strong> — where prescribed by the Central Government, receive your personal data in a structured, commonly used, machine-readable format. You can currently export your data via <Link to="/account" className="underline hover:text-accent-bright">Account Settings</Link>.</li>
          </ul>
          <p>To exercise any right, email <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a> or use the <Link to="/data-request" className="underline hover:text-accent-bright">Data Access & Deletion Request</Link> form. We will respond within 30 days.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">7. Children's Personal Data</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot is <strong>not intended for children under 18</strong>. In accordance with Section 9 of the DPDP Act, 2023:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>We do not knowingly process personal data of children under 18 without <strong>verifiable parental consent</strong>.</li>
            <li>We do not undertake tracking, behavioural monitoring, or targeted advertising directed at children.</li>
            <li>If we become aware that a child's data has been processed without verifiable parental consent, we will erase it promptly.</li>
          </ul>
          <p>If you are a parent or guardian and believe your child has provided us personal data, contact us immediately at <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a>.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">8. Data Retention & Erasure</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>We retain personal data only for as long as necessary to fulfil the purposes described in this policy, and thereafter erase it, consistent with Section 8(7) of the DPDP Act, 2023:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Account data:</strong> Retained while your account is active; erased within 30 days of account deletion or consent withdrawal.</li>
            <li><strong>Ballot receipts:</strong> HMAC receipt codes are retained permanently as part of the public audit trail. They contain no personal data and cannot identify you.</li>
            <li><strong>Audit logs:</strong> Retained for 7 years for election integrity and legal compliance.</li>
            <li><strong>Login/session data:</strong> Expired sessions are purged after 90 days.</li>
            <li><strong>IP addresses in logs:</strong> Truncated to /24 (IPv4) or /48 (IPv6) after 90 days.</li>
          </ul>
          <p>Where retention is required by law (e.g., audit records under applicable law), we retain the minimum required for the statutory period.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">9. Security Safeguards</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>We maintain reasonable technical and organisational security safeguards as required under Section 8(5) of the DPDP Act, 2023:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Passwords:</strong> Hashed with scrypt (N=32768, r=8, p=1), never stored in plaintext.</li>
            <li><strong>MFA:</strong> TOTP (RFC 6238) with optional backup codes.</li>
            <li><strong>Rate limiting:</strong> Per-IP and per-account limits on authentication endpoints.</li>
            <li><strong>Transport security:</strong> TLS 1.2+ enforced; HSTS, COOP, COEP, Referrer-Policy, and Permissions-Policy headers.</li>
            <li><strong>Audit log:</strong> Append-only, tamper-evident log of all administrative and ballot events.</li>
            <li><strong>Data minimisation:</strong> We collect only the data necessary for each stated purpose.</li>
          </ul>
          <p><strong>Breach notification:</strong> In the event of a personal data breach, we will notify the Data Protection Board of India and every affected Data Principal in accordance with Section 8(6) of the DPDP Act, 2023 and applicable rules, describing the nature of the breach and the steps taken.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">10. Cross-Border Transfer</h2>
        <p className="text-text-secondary leading-relaxed">
          Open Ballot is hosted on cloud infrastructure located in the United States. Under Section 16 of the DPDP Act, 2023, personal data may be transferred outside India to any country or territory not restricted by the Central Government. We ensure that such transfers are made under contracts affording the same level of protection as the DPDP Act, 2023. We do not transfer personal data to any country on the Central Government's restricted list.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">11. Grievance Redressal</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>If you have any grievances regarding the processing of your personal data, you may contact our Grievance Officer:</p>
          <address className="not-italic text-text-secondary mt-4 leading-relaxed">
            <strong>Grievance Officer</strong><br />
            Open Ballot Project<br />
            Email: <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a>
          </address>
          <p className="mt-4">We will acknowledge and resolve your grievance within <strong>30 days</strong> of receipt. If you are not satisfied with the resolution, you may escalate to the <strong>Data Protection Board of India</strong> as provided under the DPDP Act, 2023.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">12. Cookies & Local Storage</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>Session cookie:</strong> Secure, HttpOnly, SameSite=Lax; stores encrypted session ID.</li>
            <li><strong>CSRF token:</strong> Stored in localStorage (not a cookie) for CSRF protection.</li>
            <li><strong>Theme preference:</strong> Stored in localStorage (dark/light/system).</li>
            <li><strong>Language preference:</strong> Stored in localStorage (en/es).</li>
            <li>No third-party analytics, advertising, or tracking cookies.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">13. Changes to This Policy</h2>
        <p className="text-text-secondary leading-relaxed">
          We may update this policy from time to time to reflect changes in law or our practices. Material changes will be notified via email and posted on this page with an updated "Last updated" date. Continued use of Open Ballot after changes constitutes your consent to the updated policy.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">14. Related Documents</h2>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <Link to="/terms" className="underline hover:text-accent-bright">Terms of Service</Link> <span className="mx-2">·</span> <Link to="/refunds" className="underline hover:text-accent-bright">Refund Policy</Link> <span className="mx-2">·</span> <Link to="/data-request" className="underline hover:text-accent-bright">Data Access & Deletion</Link> <span className="mx-2">·</span> <Link to="/dpa" className="underline hover:text-accent-bright">Data Processing Agreement</Link> <span className="mx-2">·</span> <Link to="/subprocessors" className="underline hover:text-accent-bright">Subprocessors</Link>
        </address>
      </section>
    </div>
  )
}