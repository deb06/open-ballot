import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { toast } from '../../lib/toast'
import { useAuth } from '../../lib/auth'

interface Profile {
  id: number
  name: string
  email: string
  role: string
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: string | null
  lastLoginAt: string | null
  termsAccepted: boolean
  termsAcceptedAt: string | null
  digestOptIn: boolean
}

interface Recovery {
  email: string | null
  verified: boolean
}

export default function Account() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recovery, setRecovery] = useState<Recovery | null>(null)
  const [digest, setDigest] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Editable profile fields
  const [name, setName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Recovery contact
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [savingRecovery, setSavingRecovery] = useState(false)

  // Danger zone
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  const { logout } = useAuth()

  useEffect(() => {
    const load = async () => {
      try {
        const [me, rec, dig] = await Promise.all([
          api.get<Profile>('/api/auth/me'),
          api.get<Recovery>('/api/account/recovery'),
          api.get<{ optedIn: boolean }>('/api/account/digest'),
        ])
        setProfile(me)
        setName(me.name)
        setRecovery(rec)
        setRecoveryEmail(rec.email ?? '')
        setDigest(dig.optedIn)
      } catch (err: any) {
        toast(err.message || 'Failed to load your account', 'error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      toast('Your name must be at least 2 characters.', 'error')
      return
    }
    setSavingProfile(true)
    try {
      await api.patch('/api/account/profile', { name: name.trim() })
      setProfile((current) => (current ? { ...current, name: name.trim() } : current))
      toast('Profile updated.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match.', 'error')
      return
    }
    setSavingPassword(true)
    try {
      await api.post('/api/auth/password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast('Password changed. Other sessions have been signed out.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to change password', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const saveRecovery = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingRecovery(true)
    try {
      await api.post('/api/account/recovery', { email: recoveryEmail.trim() })
      setRecovery({ email: recoveryEmail.trim(), verified: false })
      toast('Recovery contact saved. Please verify it from the email we sent.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to save recovery contact', 'error')
    } finally {
      setSavingRecovery(false)
    }
  }

  const toggleDigest = async () => {
    setBusy(true)
    try {
      const res = await api.post<{ optedIn: boolean }>('/api/account/digest', { optedIn: !digest })
      setDigest(res.optedIn)
      toast(res.optedIn ? 'Weekly digest enabled.' : 'Weekly digest disabled.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to update digest preference', 'error')
    } finally {
      setBusy(false)
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const data = await api.get<any>('/api/account/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'open-ballot-data-export.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast('Your data export has been downloaded.', 'success')
    } catch (error: any) {
      toast(error.message || 'Failed to export your data', 'error')
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!deletePassword) {
      toast('Enter your password to confirm account deletion.', 'error')
      return
    }
    setDeleting(true)
    try {
      await api.del('/api/account', { password: deletePassword })
      toast('Your account and personal data have been erased.', 'success')
      window.setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch (error: any) {
      toast(error.message || 'Failed to delete account', 'error')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <p className="text-text-secondary">Loading your account…</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="px-4 lg:px-0 py-8">
        <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-12 text-center">
          <h2 className="text-[1.15rem] mb-2">Account unavailable</h2>
          <p className="text-text-secondary">Please sign in again to manage your account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-0 py-8">
      <header className="mb-10">
        <p className="eyebrow">Account</p>
        <h1 className="text-[clamp(1.9rem,3vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-text mb-3">
          My account
        </h1>
        <p className="text-text-secondary max-w-[62ch]">
          Manage your profile, security and privacy. Your rights under the DPDP Act, 2023 and the GDPR are self-service here.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-8">
          {/* Profile */}
          <form onSubmit={saveProfile} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] space-y-5">
            <h2 className="text-[1.05rem] font-semibold text-text">Profile</h2>
            <div className="field">
              <label htmlFor="acc-name">Full name</label>
              <input id="acc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <div className="field">
              <label htmlFor="acc-email">Email address</label>
              <input id="acc-email" className="input" value={profile.email} disabled />
              <p className="field-hint">
                {profile.emailVerified
                  ? 'Verified. Contact support to change your email address.'
                  : 'Not yet verified — check your inbox for the verification code.'}
              </p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>

          {/* Password */}
          <form onSubmit={savePassword} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] space-y-5">
            <h2 className="text-[1.05rem] font-semibold text-text">Password</h2>
            <div className="field">
              <label htmlFor="acc-cur">Current password</label>
              <input id="acc-cur" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="acc-new">New password</label>
              <input id="acc-new" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 12 characters" required />
            </div>
            <div className="field">
              <label htmlFor="acc-conf">Confirm new password</label>
              <input id="acc-conf" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={savingPassword}>
                {savingPassword ? 'Changing…' : 'Change password'}
              </button>
              <Link to="/forgot-password" className="btn btn-ghost btn-sm">Forgot password?</Link>
            </div>
          </form>

          {/* Recovery contact */}
          <form onSubmit={saveRecovery} className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] space-y-5">
            <h2 className="text-[1.05rem] font-semibold text-text">Recovery contact</h2>
            <div className="field">
              <label htmlFor="acc-rec">Recovery email (optional)</label>
              <input id="acc-rec" type="email" className="input" value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="backup@example.com" />
              <p className="field-hint">
                {recovery?.verified
                  ? 'Verified. This address can be used to regain access if you lose your password.'
                  : 'A secondary address used only if you lose access to your primary email.'}
              </p>
            </div>
            <button type="submit" className="btn btn-outline" disabled={savingRecovery}>
              {savingRecovery ? 'Saving…' : 'Save recovery contact'}
            </button>
          </form>

          {/* Privacy & consent */}
          <section className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-[clamp(18px,2.4vw,24px)] space-y-5">
            <h2 className="text-[1.05rem] font-semibold text-text">Privacy & consent</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 flex-none accent-[var(--accent)]"
                checked={digest}
                disabled={busy}
                onChange={() => void toggleDigest()}
              />
              <span>
                <strong className="text-text block">Weekly digest email</strong>
                <span className="text-sm text-text-secondary">
                  A summary of newly opened elections. You can withdraw this consent at any time.
                </span>
              </span>
            </label>

            <div className="pt-4 border-t border-[var(--line)] flex flex-wrap gap-3">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => void exportData()} disabled={exporting}>
                {exporting ? 'Preparing…' : 'Download my data (JSON)'}
              </button>
              <Link to="/data-request" className="btn btn-ghost btn-sm">Submit a rights request</Link>
            </div>
            <p className="text-[0.78rem] text-text-muted">
              Access, correction, erasure and portability — DPDP Act, 2023 s.11–13 and GDPR Art.15–20.
            </p>
          </section>

          {/* Danger zone */}
          <section className="rounded-lg bg-[var(--panel)] border border-[rgba(248,113,113,0.4)] p-[clamp(18px,2.4vw,24px)] space-y-5">
            <h2 className="text-[1.05rem] font-semibold text-text">Delete account</h2>
            <p className="text-[0.88rem] text-text-secondary leading-[1.55]">
              Erasing your account removes your name, email and personal data within 30 days. Anonymous ballot receipts remain — they cannot identify you.
            </p>
            {!confirmDelete ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}>
                I want to delete my account
              </button>
            ) : (
              <form onSubmit={deleteAccount} className="space-y-4">
                <div className="field">
                  <label htmlFor="acc-del-pw">Confirm your password</label>
                  <input
                    id="acc-del-pw"
                    type="password"
                    className="input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Permanently delete my account'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setConfirmDelete(false); setDeletePassword('') }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-5">
            <h2 className="text-[0.95rem] font-semibold text-text mb-4">At a glance</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Role</dt>
                <dd className="text-text font-semibold">
                  {profile.role === 'admin' ? 'Platform admin' : profile.role === 'org_admin' ? 'Organization admin' : profile.role === 'observer' ? 'Observer' : 'Voter'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Email verified</dt>
                <dd className={profile.emailVerified ? 'text-[var(--success)] font-semibold' : 'text-text-faint'}>
                  {profile.emailVerified ? 'Yes' : 'Pending'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">MFA</dt>
                <dd className={profile.mfaEnabled ? 'text-[var(--success)] font-semibold' : 'text-text-faint'}>
                  {profile.mfaEnabled ? 'Enabled' : 'Off'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Member since</dt>
                <dd className="text-text">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg bg-[var(--panel)] border border-[var(--line)] p-5">
            <h2 className="text-[0.95rem] font-semibold text-text mb-3">Quick links</h2>
            <div className="space-y-2 text-sm">
              <Link to="/verify" className="block text-accent-bright hover:underline">Verify a receipt</Link>
              <Link to="/privacy" className="block text-accent-bright hover:underline">Privacy Policy</Link>
              <Link to="/terms" className="block text-accent-bright hover:underline">Terms of Service</Link>
              <Link to="/dpa" className="block text-accent-bright hover:underline">Data Processing Agreement</Link>
              <Link to="/subprocessors" className="block text-accent-bright hover:underline">Subprocessors</Link>
            </div>
          </div>

          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => void logout()}>
            Sign out
          </button>
        </aside>
      </div>
    </div>
  )
}