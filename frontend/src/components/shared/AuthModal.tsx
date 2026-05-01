'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendSignupVerification } from '@/lib/api/auth'
import {
  getVerificationFailureFeedback,
  VERIFY_DELIVERY_STATE,
  type VerifyDeliveryState,
} from '@/lib/auth/verification-feedback'
import TokenSVG from '@/components/shared/TokenSVG'
import type { CurrentUser } from '@/lib/constants'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

// ─── MOCK MODE GUARD ──────────────────────────────────────────────────────────
// Simulate buttons are only visible when NEXT_PUBLIC_MOCK_MODE=true.
// Next.js inlines this at build time — the buttons are compiled out entirely
// in production builds where the var is absent.
const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

type AuthModalMode =
  | 'signin'
  | 'signup'
  | 'verify'
  | 'forgot'
  | 'forgot-sent'
  | 'reset-password'
  | 'magic-sent'
  | 'existing-google'

interface AuthModalProps {
  initialMode?: AuthModalMode
  onClose: () => void
  onAuth: (user: CurrentUser) => void
  onTokenCredit: (amount: number) => void
}

export default function AuthModal({ initialMode = 'signin', onClose, onAuth, onTokenCredit }: AuthModalProps) {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<AuthModalMode>(initialMode)
  const [signinMethod, setSigninMethod] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verifyMessage, setVerifyMessage] = useState('')
  const [verifyMessageError, setVerifyMessageError] = useState(false)
  const [verifyDeliveryState, setVerifyDeliveryState] = useState<VerifyDeliveryState>(VERIFY_DELIVERY_STATE.SENT)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const [forgotTurnstileToken, setForgotTurnstileToken] = useState<string | null>(null)
  const forgotTurnstileRef = useRef<TurnstileInstance>(null)
  /** True when `existing-google` was reached from forgot-password (affects footer actions). */
  const [googleHintFromForgot, setGoogleHintFromForgot] = useState(false)

  // Dev-only stand-in when backend hint is not used; real checks use /api/auth/signup-provider-hint.
  const MOCK_GOOGLE_EMAILS = ['player@gmail.com']
  const isMockGoogleOnlyEmail = MOCK_GOOGLE_EMAILS.includes(email.trim().toLowerCase())

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
    fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)',
    outline: 'none', transition: 'border-color 0.2s,box-shadow 0.2s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontFamily: 'var(--font-display)', fontSize: 10,
    letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6,
  }

  // ─── REAL SUPABASE AUTH ────────────────────────────────────────────────────

  function enterForgotMode() {
    setMode('forgot')
    setError('')
    setGoogleHintFromForgot(false)
    setForgotTurnstileToken(null)
    setTimeout(() => forgotTurnstileRef.current?.reset(), 0)
  }

  /** Supabase signUp often returns identities: [] for Google-first emails; backend checks auth.users / public.users. */
  async function fetchSignupGoogleHint(
    emailAddr: string,
    opts: { turnstileToken: string | null; accessToken: string | null; supabaseUserId?: string | null },
  ): Promise<{ useGoogle: boolean; serverMessage?: string }> {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
      const payload: { email: string; turnstileToken?: string; supabaseUserId?: string } = { email: emailAddr.trim() }
      if (opts.supabaseUserId) payload.supabaseUserId = opts.supabaseUserId
      if (!opts.accessToken && opts.turnstileToken) payload.turnstileToken = opts.turnstileToken
      const res = await fetch(`${backendUrl}/api/auth/signup-provider-hint`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const parsed = (await res.json()) as {
        has_google_provider?: boolean
        error?: string
        details?: string
      }
      if (!res.ok) {
        return {
          useGoogle: false,
          serverMessage: parsed.details ?? parsed.error,
        }
      }
      return { useGoogle: parsed.has_google_provider === true }
    } catch {
      return { useGoogle: false }
    }
  }

  async function handleSignUp() {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const supabase = createClient()
    const refParam = searchParams.get('ref')?.trim()
    const referralCodeFromUrl = refParam ? refParam.toUpperCase() : ''
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
          ...(referralCodeFromUrl ? { referral_code: referralCodeFromUrl } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/survey-showdown`,
      },
    })
    if (signUpError) {
      setLoading(false)
      setError(signUpError.message)
      return
    }
    if (data.user) {
      let useGoogleFlow = data.user.identities?.some(i => i.provider === 'google') === true
      const accessToken = data.session?.access_token ?? null
      const supabaseUserId = data.user.id
      let hintMessage: string | undefined
      if (!useGoogleFlow) {
        if (accessToken) {
          const hint = await fetchSignupGoogleHint(email, {
            turnstileToken: null,
            accessToken,
            supabaseUserId,
          })
          useGoogleFlow = hint.useGoogle
          hintMessage = hint.serverMessage
        } else {
          try {
            turnstileRef.current?.reset()
            const freshToken = await turnstileRef.current?.getResponsePromise(45_000, 250)
            if (freshToken) {
              const hint = await fetchSignupGoogleHint(email, {
                turnstileToken: freshToken,
                accessToken: null,
                supabaseUserId: null,
              })
              useGoogleFlow = hint.useGoogle
              hintMessage = hint.serverMessage
            }
          } catch {
            useGoogleFlow = false
          }
        }
      }
      setLoading(false)
      if (hintMessage) setError(hintMessage)
      if (useGoogleFlow) {
        if (data.session) {
          onClose()
          return
        }
        setGoogleHintFromForgot(false)
        setMode('existing-google')
        return
      }
      onAuth({
        id: data.user.id, email, username: username || email.split('@')[0],
        tokenBalance: 0, emailVerified: false, referralsClaimed: 0,
      })
      setVerifyDeliveryState(VERIFY_DELIVERY_STATE.SENT)
      setVerifyMessage('')
      setVerifyMessageError(false)
      if (accessToken) {
        try {
          const verificationResult = await sendSignupVerification(accessToken)
          if (verificationResult.alreadyVerified) {
            setVerifyDeliveryState(VERIFY_DELIVERY_STATE.SENT)
            setVerifyMessage('Email already verified. Your signup bonus is already unlocked.')
            setVerifyMessageError(false)
          }
          if (!verificationResult.sent) {
            setVerifyMessage('Verification email was already sent recently. Please check your inbox.')
          }
        } catch (verificationError) {
          const feedback = getVerificationFailureFeedback(verificationError)
          setVerifyDeliveryState(feedback.state)
          setVerifyMessage(feedback.message)
          setVerifyMessageError(true)
        }
      } else {
        setVerifyDeliveryState(VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE)
        setVerifyMessage('Could not send verification right now. Try resend or continue and verify later.')
        setVerifyMessageError(true)
      }
      setMode('verify')
      return
    }
    setLoading(false)
  }

  async function handleSignIn() {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) { setError(signInError.message); return }
    // onAuthStateChange in useAuth handles updating currentUser
    onClose()
  }

  async function handleGoogleAuth() {
    const supabase = createClient()
    const refParam = searchParams.get('ref')?.trim()
    const referralCodeFromUrl = refParam ? refParam.toUpperCase() : ''
    const base = `${window.location.origin}/auth/callback`
    const callbackParams = new URLSearchParams()
    if (referralCodeFromUrl) {
      callbackParams.set('next', '/survey-showdown')
      callbackParams.set('ref', referralCodeFromUrl)
    }
    if (mode === 'signup') callbackParams.set('oauth_signup', '1')
    const redirectTo = callbackParams.size > 0 ? `${base}?${callbackParams.toString()}` : base
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    // Page redirects — no further action needed
  }

  async function handleMagicLink() {
    setError('')
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/survey-showdown`,
      },
    })
    setLoading(false)
    if (otpError) { setError(otpError.message); return }
    setMode('magic-sent')
  }

  async function handleForgotPassword() {
    setError('')
    if (!email) { setError('Please enter your email address.'); return }
    if (isMockGoogleOnlyEmail) {
      setGoogleHintFromForgot(true)
      setMode('existing-google')
      return
    }
    if (!forgotTurnstileToken?.trim()) {
      setError('Please complete the captcha below.')
      return
    }
    setLoading(true)
    const hint = await fetchSignupGoogleHint(email, {
      turnstileToken: forgotTurnstileToken,
      accessToken: null,
      supabaseUserId: null,
    })
    if (hint.serverMessage) {
      setLoading(false)
      setError(hint.serverMessage)
      forgotTurnstileRef.current?.reset()
      setForgotTurnstileToken(null)
      return
    }
    if (hint.useGoogle) {
      setLoading(false)
      setGoogleHintFromForgot(true)
      setMode('existing-google')
      return
    }
    const supabase = createClient()
    const recoveryNext = encodeURIComponent('/survey-showdown?recovery=true')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${recoveryNext}`,
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setMode('forgot-sent')
  }

  async function handleSetNewPassword() {
    setError('')
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNewPassword('')
    setConfirmNewPassword('')
    onClose()
  }

  async function handleResendSignupVerification() {
    setVerifyMessage('')
    setVerifyMessageError(false)
    setIsResendingVerification(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) {
        setVerifyDeliveryState(VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE)
        setVerifyMessage('Please sign in again, then resend verification.')
        setVerifyMessageError(true)
        return
      }
      const result = await sendSignupVerification(accessToken)
      if (result.alreadyVerified) {
        setVerifyDeliveryState(VERIFY_DELIVERY_STATE.SENT)
        setVerifyMessage('Email already verified. Your signup bonus is already unlocked.')
        setVerifyMessageError(false)
        return
      }
      if (result.sent) {
        setVerifyDeliveryState(VERIFY_DELIVERY_STATE.SENT)
        setVerifyMessage('Verification email sent. Check your inbox and spam folder.')
        setVerifyMessageError(false)
        return
      }
      setVerifyDeliveryState(VERIFY_DELIVERY_STATE.SENT)
      setVerifyMessage('Verification email was sent recently. Please check your inbox.')
      setVerifyMessageError(false)
    } catch (verificationError) {
      const feedback = getVerificationFailureFeedback(verificationError)
      setVerifyDeliveryState(feedback.state)
      setVerifyMessage(feedback.message)
      setVerifyMessageError(true)
    } finally {
      setIsResendingVerification(false)
    }
  }

  const isSignUp = mode === 'signup'
  const isVerify = mode === 'verify'
  const isForgot = mode === 'forgot'
  const isForgotSent = mode === 'forgot-sent'
  const isResetPassword = mode === 'reset-password'
  const isMagicSent = mode === 'magic-sent'
  const isExistingGoogle = mode === 'existing-google'

  const googleButtonStyle: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text)',
    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '32px', width: 'min(440px,92vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#F0A500' }}>
              {isVerify ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Verify to unlock free tokens <TokenSVG size={20} /></span>
                : isExistingGoogle ? 'This email uses Google'
                  : isSignUp ? 'Create Account'
                    : isForgot ? 'Forgot Password'
                      : isForgotSent ? 'Check Your Email'
                        : isResetPassword ? 'Set New Password'
                          : isMagicSent ? 'Check Your Email'
                            : 'Welcome Back'}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {isVerify ? null
                : isExistingGoogle
                  ? (googleHintFromForgot
                    ? 'This account signs in with Google — use Google to continue'
                    : 'Sign in with Google, or finish linking a password via email')
                  : isSignUp ? 'Get instant account access. Bonus tokens unlock after email verification.'
                    : isForgot ? "We'll send you a reset link"
                      : isForgotSent ? null
                        : isResetPassword ? 'Choose a new password for your account'
                          : isMagicSent ? null
                            : 'Sign in to your account'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Forgot password — email entry */}
        {isForgot && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                onKeyDown={e => { if (e.key === 'Enter') void handleForgotPassword() }}
                autoFocus />
            </div>
            <Turnstile
              ref={forgotTurnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              onSuccess={setForgotTurnstileToken}
            />
            {error && <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{error}</div>}
            <button onClick={() => void handleForgotPassword()} disabled={loading || !forgotTurnstileToken} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(77,126,255,0.3)', ...(loading || !forgotTurnstileToken ? { opacity: 0.38 } : {}) }}>
              {loading ? '...' : 'SEND RESET LINK'}
            </button>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
              Remember it?{' '}
              <button onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Back to Sign In</button>
            </div>
          </div>
        )}

        {/* Recovery — set new password (after email link + PKCE exchange on /auth/callback) */}
        {isResetPassword && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>New password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                style={fieldStyle}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(77,126,255,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSetNewPassword()
                }}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter password"
                style={fieldStyle}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(77,126,255,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSetNewPassword()
                }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} style={{ accentColor: '#4D7EFF' }} />
              Show passwords
            </label>
            {error && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 9,
                  background: 'rgba(255,77,106,0.1)',
                  border: '1px solid rgba(255,77,106,0.3)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: '#FF4D6A',
                }}
              >
                {error}
              </div>
            )}
            <button
              onClick={() => void handleSetNewPassword()}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                background: 'linear-gradient(135deg,#F0A500,#C07A00)',
                color: '#fff',
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                letterSpacing: '0.08em',
                border: 'none',
                boxShadow: '0 4px 18px rgba(240,165,0,0.3)',
              }}
            >
              {loading ? '...' : 'UPDATE PASSWORD'}
            </button>
          </div>
        )}

        {/* Forgot password — sent confirmation */}
        {isForgotSent && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
              We sent a password reset link to <span style={{ color: 'var(--text)' }}>{email}</span>. Click the link in that email, and you&apos;ll be brought back here to set a new password.
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(77,126,255,0.07)', border: '1px solid rgba(77,126,255,0.2)', fontSize: 12, color: 'var(--text-faint)' }}>
                Didn&apos;t get it? Check your spam folder, or{' '}
                <button onClick={enterForgotMode} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0, cursor: 'pointer' }}>try again</button>.
              </div>
            </div>
            <button onClick={() => { setMode('signin'); setError('') }} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: '1px solid rgba(255,255,255,0.09)' }}>
              BACK TO SIGN IN
            </button>
          </div>
        )}

        {/* Email sign-up when this address already has Google — not a fresh signup / token verify flow */}
        {isExistingGoogle && (
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20, textAlign: 'left' }}>
              <span style={{ color: 'var(--text)' }}>{email}</span> is already tied to a Google account. Use <strong style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text)' }}>Continue with Google</strong> to sign in.
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(77,126,255,0.07)', border: '1px solid rgba(77,126,255,0.2)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                If you asked to add a password, we may have sent a confirmation email to link it to this account. Check your inbox and spam folder — after you confirm, you can sign in with Google or email and password.
              </div>
            </div>
            <button type="button" onClick={() => void handleGoogleAuth()} disabled={loading} style={{ ...googleButtonStyle, marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" /></svg>
              Continue with Google
            </button>
            {googleHintFromForgot ? (
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setGoogleHintFromForgot(false) }}
                style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
                Back to Sign In
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError('') }}
                  style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
                  Back to sign up
                </button>
                <div style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
                  Already have access?{' '}
                  <button type="button" onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Sign in</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Verify state */}
        {isVerify && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            {verifyDeliveryState === VERIFY_DELIVERY_STATE.SENT ? (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
                You are signed in and can start playing now. To unlock your signup bonus:
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                  {[
                    { n: '1', text: <span>Open the verification email for <span style={{ color: 'var(--text)' }}>{email}</span></span> },
                    { n: '2', text: <span>Tap the verification link</span> },
                  ].map(({ n, text }) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 12, color: '#F0A500', flexShrink: 0, marginTop: 1 }}>{n}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, paddingTop: 3 }}>{text}</div>
                    </div>
                  ))}
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, paddingLeft: 32 }}>
                    Verification unlocks your <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 signup tokens</span> and referral rewards.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
                You are signed in and can start playing now. We could not deliver a verification email yet.
                <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.24)', fontSize: 12, color: '#FF8DA0', lineHeight: 1.6 }}>
                  {verifyMessage || 'Could not send verification right now. Try resend or continue and verify later.'}
                </div>
                <div style={{ marginTop: 10, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>
                  You can still play now. Use resend below and verify later to unlock your <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 signup tokens</span>.
                </div>
              </div>
            )}
            {verifyMessage && verifyDeliveryState === VERIFY_DELIVERY_STATE.SENT && (
              <div style={{ marginTop: -8, marginBottom: 14, textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: 12, color: verifyMessageError ? '#FF4D6A' : 'var(--text-faint)' }}>
                {verifyMessage}
              </div>
            )}
            {/* MOCK MODE ONLY — gated behind NEXT_PUBLIC_MOCK_MODE */}
            {isMockMode && (
              <button
                onClick={() => { onTokenCredit(4); onClose() }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)' }}>
                🧪 SIMULATE EMAIL LINK CLICK
              </button>
            )}
            <button onClick={() => void handleResendSignupVerification()} disabled={isResendingVerification} style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: 12, background: 'rgba(77,126,255,0.18)', color: '#4D7EFF', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', border: '1px solid rgba(77,126,255,0.35)', opacity: isResendingVerification ? 0.38 : 1 }}>
              {isResendingVerification ? 'SENDING...' : 'RESEND VERIFICATION EMAIL'}
            </button>
            <button onClick={onClose} style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              I&apos;ll do it later
            </button>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 12 }}>You also now have access to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '🎮', label: 'More surveys to play' },
                  { icon: '⬆', label: 'Import your own custom surveys' },
                  { icon: '🚫', label: 'Ad-free gameplay' },
                  { icon: '📋', label: 'Game history' },
                ].map(({ icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-faint)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Magic link — sent confirmation */}
        {isMagicSent && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✉️</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
              We sent a sign-in link to <span style={{ color: 'var(--text)' }}>{email}</span>. Click it and you&apos;ll be signed in instantly — no password needed.
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(77,126,255,0.07)', border: '1px solid rgba(77,126,255,0.2)', fontSize: 12, color: 'var(--text-faint)' }}>
                Didn&apos;t get it? Check your spam folder, or{' '}
                <button onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0, cursor: 'pointer' }}>try again</button>.
              </div>
            </div>
            {/* MOCK MODE ONLY — simulates the magic link click; remove when Supabase auth is wired */}
            {isMockMode && (
              <button
                onClick={() => { onAuth({ id: 'mock-user-001', email, username: email.split('@')[0], tokenBalance: 4, emailVerified: true, referralsClaimed: 0 }); onClose() }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(77,126,255,0.3)', marginBottom: 10 }}>
                🧪 SIMULATE EMAIL LINK CLICK
              </button>
            )}
            <button onClick={() => { setMode('signin'); setError('') }} style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              BACK TO SIGN IN
            </button>
          </div>
        )}

        {/* Form — sign in / sign up */}
        {!isVerify && !isForgot && !isForgotSent && !isResetPassword && !isMagicSent && !isExistingGoogle && (<>
          <button onClick={() => void handleGoogleAuth()} disabled={loading} style={{ ...googleButtonStyle, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" /></svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.08em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isSignUp && (
              <div>
                <label style={labelStyle}>Username <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'none', fontWeight: 400 }}>— optional</span></label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" style={fieldStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }} />
              </div>
            )}
            {!isSignUp && (
              <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.03)' }}>
                {[{ id: 'password', label: 'Password' }, { id: 'magic', label: '✉ Magic Link' }].map(opt => (
                  <button key={opt.id} onClick={() => { setSigninMethod(opt.id as 'password' | 'magic'); setError('') }}
                    style={{ flex: 1, padding: '9px', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 600, border: 'none', borderRadius: 0, background: signinMethod === opt.id ? 'rgba(77,126,255,0.18)' : 'transparent', color: signinMethod === opt.id ? '#4D7EFF' : 'var(--text-faint)', boxShadow: signinMethod === opt.id ? 'inset 0 0 0 1px rgba(77,126,255,0.35)' : 'none', transition: 'all 0.15s ease' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && !isSignUp && signinMethod === 'magic') handleMagicLink() }} />
            </div>

            {(isSignUp || signinMethod === 'password') && (
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignUp ? 'At least 6 characters' : 'Your password'} style={{ ...fieldStyle, paddingRight: 44 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return
                      if (isSignUp) handleSignUp()
                      else handleSignIn()
                    }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-faint)', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {!isSignUp && signinMethod === 'magic' && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, padding: '10px 12px', borderRadius: 10, background: 'rgba(77,126,255,0.06)', border: '1px solid rgba(77,126,255,0.15)' }}>
                We&apos;ll email you a one-time link. Click it and you&apos;re in — no password needed.
              </div>
            )}

            {error && <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{error}</div>}

            {isSignUp && (
              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={setTurnstileToken}
              />
            )}

            <button onClick={isSignUp ? handleSignUp : signinMethod === 'magic' ? handleMagicLink : handleSignIn} disabled={loading || (isSignUp && !turnstileToken)}
              style={{ width: '100%', padding: '13px', borderRadius: 12, background: !isSignUp && signinMethod === 'magic' ? 'linear-gradient(135deg,#4D7EFF,#2952CC)' : 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: 'none', boxShadow: !isSignUp && signinMethod === 'magic' ? '0 4px 18px rgba(77,126,255,0.3)' : '0 4px 18px rgba(240,165,0,0.3)', marginTop: 4 }}>
              {loading ? '...' : (isSignUp ? 'CREATE ACCOUNT' : signinMethod === 'magic' ? 'SEND MAGIC LINK' : 'SIGN IN')}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
            {isSignUp ? (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Sign In</button>
              </>
            ) : signinMethod === 'password' ? (
              <>Forgot your password?{' '}
                <button onClick={enterForgotMode} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Reset it</button>
              </>
            ) : null}
          </div>
        </>)}
      </div>
    </div>
  )
}
