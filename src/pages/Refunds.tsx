import React from 'react'
import { Link } from 'react-router-dom'

export default function Refunds() {
  const lastUpdated = 'November 2024'

  return (
    <div className="px-4 lg:px-0 py-8 max-w-3xl mx-auto">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold text-text mb-4">Refund Policy</h1>
        <p className="text-text-secondary text-sm mb-2">Last updated: {lastUpdated}</p>
        <p className="text-text-secondary text-sm">Open Ballot is free to use. This policy explains our position on payments, refunds, and chargebacks.</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">1. Free of Charge</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot is provided <strong>completely free of charge</strong>. There are no subscription fees, per-election fees, hidden costs, or paid tiers.</p>
          <p>All core features — account creation, voting, receipt verification, organization management, and the admin dashboard — are free for all users.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">2. No Payments Accepted</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Open Ballot does <strong>not</strong> collect, process, or store any payment information:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>No credit or debit card details are collected.</li>
            <li>No UPI, net banking, or wallet payments are accepted.</li>
            <li>No payment gateway is integrated into the platform.</li>
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">3. Refunds</h2>
        <div className="space-y-4 text-text-secondary leading-relaxed">
          <p>Since Open Ballot charges no fees, <strong>there are no payments to refund</strong>. Nothing in this service creates a payment obligation for you.</p>
          <p>If you believe you have been charged by a third party claiming to represent Open Ballot, that charge did not originate from us. Please contact your payment provider and email us at <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a> so we can investigate.</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">4. Donations</h2>
        <p className="text-text-secondary leading-relaxed">
          Open Ballot does not currently accept donations. If this changes, any donation terms will be published on this page. Donations, if ever accepted, would be voluntary and non-refundable unless required by law.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">5. Third-Party Costs</h2>
        <p className="text-text-secondary leading-relaxed">
          Your mobile carrier or internet service provider may charge for data usage while using Open Ballot. These charges are between you and your provider and are outside our control. Open Ballot is not responsible for any such charges.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">6. Chargebacks & Disputes</h2>
        <p className="text-text-secondary leading-relaxed">
          Because no payments are processed by Open Ballot, chargebacks against us are not possible. Any dispute about a charge must be raised with the entity that charged you.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">7. Changes to This Policy</h2>
        <p className="text-text-secondary leading-relaxed">
          We may update this policy from time to time. Material changes will be posted on this page with an updated "Last updated" date.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-text mb-4">8. Contact Us</h2>
        <address className="not-italic text-text-secondary mt-4 leading-relaxed">
          <a href="mailto:openballot@outlook.com" className="underline hover:text-accent-bright">openballot@outlook.com</a><br />
          Open Ballot Project<br />
          <Link to="/terms" className="underline hover:text-accent-bright">Terms of Service</Link> <span className="mx-2">·</span> <Link to="/privacy" className="underline hover:text-accent-bright">Privacy Policy</Link> <span className="mx-2">·</span> <Link to="/data-request" className="underline hover:text-accent-bright">Data Access & Deletion</Link>
        </address>
      </section>
    </div>
  )
}