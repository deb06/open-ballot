import React, { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { toast } from '../lib/toast'

interface Props {
  email: string
  /** Dev code surfaced by the API when no mail transport is configured. */
  initialDevCode?: string
  onVerified?: () => void
}

const LENGTH = 6
const COOLDOWN = 30

export default function EmailOtpCard({ email, initialDevCode, onVerified }: Props) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified'>('idle')
  const [error, setError] = useState('')
  const [devCode, setDevCode] = useState(initialDevCode || '')
  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Auto-fill the dev code when there is no mail transport (testing convenience)
  useEffect(() => {
    if (devCode && devCode.length === LENGTH) {
      setDigits(devCode.split(''))
      inputs.current[LENGTH - 1]?.focus()
    }
  }, [devCode])

  const code = digits.join('')

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '')
    if (v.length > 1) {
      // pasted multi-char
      const chars = v.slice(0, LENGTH).split('')
      const next = [...digits]
      chars.forEach((c, i) => { if (index + i < LENGTH) next[index + i] = c })
      setDigits(next)
      const focusIdx = Math.min(index + chars.length, LENGTH - 1)
      inputs.current[focusIdx]?.focus()
      return
    }
    const next = [...digits]
    next[index] = v
    setDigits(next)
    if (v && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  const onKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < LENGTH - 1) inputs.current[index + 1]?.focus()
  }

  const verify = async (fullCode: string) => {
    setError('')
    setStatus('verifying')
    try {
      await api.post('/api/auth/verify-otp', { email, code: fullCode })
      setStatus('verified')
      toast('Email verified — thank you!', 'success')
      onVerified?.()
    } catch (err: any) {
      setStatus('idle')
      setError(err.message || 'That code is incorrect or has expired.')
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
    }
  }

  // Auto-submit when complete
  useEffect(() => {
    if (code.length === LENGTH && status === 'idle') {
      verify(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const resend = async () => {
    if (cooldown > 0 || sending) return
    setSending(true)
    setError('')
    try {
      const res: any = await api.post('/api/auth/request-otp', { email })
      setCooldown(COOLDOWN)
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
      if (res.devCode) {
        setDevCode(res.devCode)
        toast('A new code was sent (dev mode).', 'info')
      } else {
        toast('A new code was sent to your email.', 'success')
      }
    } catch (err: any) {
      setError(err.message || 'Could not resend the code. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="glass-otp p-[clamp(20px,3vw,28px)]">
      {status === 'verified' ? (
        <div className="text-center py-6">
          <div className="verified-badge mb-4">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Email verified
          </div>
          <h2 className="text-2xl font-semibold text-text mb-2">You're all set</h2>
          <p className="text-text-secondary mb-6">Your email <strong className="text-text">{email}</strong> is verified.</p>
          <a href="/" className="btn btn-primary">Continue to Open Ballot</a>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)] mb-4">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
            </div>
            <h2 className="text-[clamp(1.5rem,3vw,1.9rem)] font-semibold text-text mb-2">Verify your email</h2>
            <p className="text-text-secondary text-sm max-w-[42ch] mx-auto">
              Enter the 6-digit code sent to <strong className="text-text">{email}</strong>
            </p>
          </div>

          <div className="otp-grid mb-4" id="otp-grid">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el }}
                className={`otp-input ${d ? 'filled' : ''}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                aria-label={`Digit ${i + 1}`}
                value={d}
                disabled={status === 'verifying'}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => { e.preventDefault(); setDigit(i, e.clipboardData.getData('text')) }}
              />
            ))}
          </div>

          {error && (
            <div className="form-error mb-4" role="alert">{error}</div>
          )}

          {devCode && devCode.length === LENGTH && (
            <p className="text-xs text-text-faint text-center mb-4">
              Dev mode — no mail transport configured. Code: <strong className="text-[var(--accent-bright)] font-mono">{devCode}</strong>
            </p>
          )}

          <button
            className="btn btn-primary btn-block w-full"
            disabled={code.length !== LENGTH || status === 'verifying'}
            onClick={() => verify(code)}
          >
            {status === 'verifying' ? 'Verifying…' : 'Verify email'}
          </button>

          <div className="text-center mt-5 text-sm text-text-secondary">
            Didn't get the code?{' '}
            <button
              className="text-[var(--accent-bright)] font-semibold hover:underline disabled:opacity-50 disabled:no-underline bg-transparent border-0 cursor-pointer p-0"
              disabled={cooldown > 0 || sending}
              onClick={resend}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}