import React from 'react'
import { Link } from 'react-router-dom'

export default function Terms() {
  const lastUpdated = 'November 2024'

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Terms of Service</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">These terms govern your use of Open Ballot. By using the service, you agree to these terms.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">1. Acceptance of Terms</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>By creating an account or using Open Ballot, you agree to these Terms of Service and our <Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link>. If you do not agree, do not use the service.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">2. Eligibility</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>You must be at least <strong>18 years old</strong>.</li>
            <li>You must provide accurate and complete registration information.</li>
            <li>You must not be prohibited from using the service under applicable law.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">3. Account Responsibilities</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>You are responsible for maintaining the confidentiality of your password.</li>
            <li>You must not share your account or let others use it.</li>
            <li>You must notify us immediately of any unauthorized access.</li>
            <li>One person = one account. Duplicate accounts are prohibited.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">4. Voting Rules</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>One person = one vote per election. Attempting to vote multiple times is prohibited.</li>
            <li>You may only vote in elections for which you are eligible (based on organization membership, geographic location, or other criteria).</li>
            <li>You may not automate voting, use bots, scripts, or any automated means to cast votes.</li>
            <li>You may not sell, transfer, or trade your vote or receipt code.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">5. Ballot Secrecy & Receipt</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot guarantees ballot secrecy:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your vote is anonymous. No one (including Open Ballot administrators) can link your identity to your ballot choice.</li>
            <li>You receive a receipt code proving your ballot was counted. This code does not reveal how you voted.</li>
            <li>You may verify your ballot at any time using your receipt code on the <Link to="/verify" className="underline hover:text-accent-bright">verification page</Link>.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">6. Prohibited Conduct</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>You may not:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Violate any applicable law or regulation.</li>
            <li>Interfere with the integrity of elections (tampering, DDoS, vote buying, coercion).</li>
            <li>Impersonate another user or organization.</li>
            <li>Scrape, crawl, or extract data from the service without permission.</li>
            <li>Reverse engineer, decompile, or attempt to derive source code.</li>
            <li>Use the service for illegal activities, harassment, or hate speech.</li>
            <li>Circumvent security measures or rate limits.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">7. Intellectual Property</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Open Ballot's code, design, and trademarks are owned by the Open Ballot Project.</li>
            <li>You retain ownership of content you submit (election titles, descriptions, candidate info).</li>
            <li>By submitting content, you grant us a license to display it as part of the service.</li>
            <li>You may not copy, modify, or distribute the Open Ballot software without permission.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">8. Free Service & No Warranty</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Open Ballot is provided <strong>free of charge</strong>.</li>
            <li>The service is provided <strong>"as is"</strong> without warranty of any kind.</li>
            <li>We do not guarantee uninterrupted or error-free service.</li>
            <li>We are not liable for any damages arising from use of the service.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">9. Limitation of Liability</h2>
        <p className="text-text-secondary leading-relaxed">
          To the maximum extent permitted by law, Open Ballot and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, or business opportunities.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">10. Indemnification</h2>
        <p className="text-text-secondary leading-relaxed">
          You agree to indemnify and hold harmless Open Ballot and its contributors from any claims, damages, or expenses arising from your use of the service, violation of these terms, or violation of any rights of a third party.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">11. Termination</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>You may delete your account at any time.</li>
            <li>We may suspend or terminate your account for violation of these terms.</li>
            <li>Upon termination, your right to use the service ceases immediately.</li>
            <li>Provisions that should survive termination will survive (e.g., IP, liability limits).</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">12. Governing Law & Disputes</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>These terms are governed by the <strong>laws of India</strong>.</li>
            <li>Disputes will be subject to the exclusive jurisdiction of the courts in India.</li>
            <li>If any provision is unenforceable, the rest remains in effect.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">13. Changes to Terms</h2>
        <p className="text-text-secondary leading-relaxed">
          We may update these terms at any time. Material changes will be announced via email and posted on this page with an updated "Last updated" date. Continued use constitutes acceptance.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">14. Contact Us</h2>
        <p className="text-text-secondary leading-relaxed">
          Questions about these terms? Contact us at:
        </p>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a><br />
          Open Ballot Project<br />
          <Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link> <span className="mx-2">·</span> <Link to="/refunds" className="underline hover:text-accent-bright">Refund Policy</Link> <span className="mx-2">·</span> <Link to="/data-request" className="underline hover:text-accent-bright">Data Request</Link>
        </address>
      </section>
    </div>
  )
}