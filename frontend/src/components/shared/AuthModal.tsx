'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TokenSVG from '@/components/shared/TokenSVG'
import type { CurrentUser } from '@/lib/constants'
import { Turnstile } from '@marsidev/react-turnstile'

// ─── MOCK MODE GUARD ──────────────────────────────────────────────────────────
// Simulate buttons are only visible when NEXT_PUBLIC_MOCK_MODE=true.
// Next.js inlines this at build time — the buttons are compiled out entirely
// in production builds where the var is absent.
const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

interface AuthModalProps {
  initialMode?: 'signin' | 'signup' | 'verify' | 'forgot' | 'forgot-sent' | 'magic-sent'
  onClose: () => void
  onAuth: (user: CurrentUser) => void
  onTokenCredit: (amount: number) => void
}

export default function AuthModal({ initialMode = 'signin', onClose, onAuth, onTokenCredit }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify' | 'forgot' | 'forgot-sent' | 'magic-sent'>(initialMode)
  const [signinMethod, setSigninMethod] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // In production this check will be done server-side against auth_provider.
  // The MOCK_GOOGLE_EMAILS array is a local stand-in for Phase 6.
  const MOCK_GOOGLE_EMAILS = ['player@gmail.com']
  const isGoogleOnlyAccount = MOCK_GOOGLE_EMAILS.includes(email.trim().toLowerCase())

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

  async function handleSignUp() {
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username || email.split('@')[0] } },
    })
    setLoading(false)
    if (signUpError) { setError(signUpError.message); return }
    if (data.user) {
      onAuth({
        id: data.user.id, email, username: username || email.split('@')[0],
        tokenBalance: 0, emailVerified: false, referralsClaimed: 0,
      })
      setMode('verify')
    }
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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (otpError) { setError(otpError.message); return }
    setMode('magic-sent')
  }

  async function handleForgotPassword() {
    setError('')
    if (!email) { setError('Please enter your email address.'); return }
    if (isGoogleOnlyAccount) {
      setError("This account uses Google Sign-In. Please use the 'Continue with Google' button instead.")
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?recovery=true`,
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setMode('forgot-sent')
  }

  const isSignUp = mode === 'signup'
  const isVerify = mode === 'verify'
  const isForgot = mode === 'forgot'
  const isForgotSent = mode === 'forgot-sent'
  const isMagicSent = mode === 'magic-sent'

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
              {isVerify ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Your free tokens have been sent! <TokenSVG size={20} /></span>
                : isSignUp ? 'Create Account'
                  : isForgot ? 'Forgot Password'
                    : isForgotSent ? 'Check Your Email'
                      : isMagicSent ? 'Check Your Email'
                        : 'Welcome Back'}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {isVerify ? null : isSignUp ? 'Sign up for free tokens and more!'
                : isForgot ? "We'll send you a reset link"
                  : isForgotSent ? null : isMagicSent ? null
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
                onKeyDown={e => { if (e.key === 'Enter') handleForgotPassword() }}
                autoFocus />
            </div>
            {error && <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{error}</div>}
            <button onClick={handleForgotPassword} disabled={loading} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(77,126,255,0.3)' }}>
              {loading ? '...' : 'SEND RESET LINK'}
            </button>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
              Remember it?{' '}
              <button onClick={() => { setMode('signin'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Back to Sign In</button>
            </div>
          </div>
        )}

        {/* Forgot password — sent confirmation */}
        {isForgotSent && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
              We sent a password reset link to <span style={{ color: 'var(--text)' }}>{email}</span>. Click the link in that email, and you'll be brought back here to set a new password.
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(77,126,255,0.07)', border: '1px solid rgba(77,126,255,0.2)', fontSize: 12, color: 'var(--text-faint)' }}>
                Didn't get it? Check your spam folder, or{' '}
                <button onClick={() => { setMode('forgot'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 2, padding: 0, cursor: 'pointer' }}>try again</button>.
              </div>
            </div>
            <button onClick={() => { setMode('signin'); setError('') }} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: '1px solid rgba(255,255,255,0.09)' }}>
              BACK TO SIGN IN
            </button>
          </div>
        )}

        {/* Verify state */}
        {isVerify && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24, textAlign: 'left' }}>
              Steps to claim:
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                {[
                  { n: '1', text: <span>Open the email we just sent to you at <span style={{ color: 'var(--text)' }}>{email}</span></span> },
                  { n: '2', text: <span>Click the redemption link</span> },
                ].map(({ n, text }) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(240,165,0,0.15)', border: '1px solid rgba(240,165,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 12, color: '#F0A500', flexShrink: 0, marginTop: 1 }}>{n}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, paddingTop: 3 }}>{text}</div>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, paddingLeft: 32 }}>
                  You'll be brought straight back here with your <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 free tokens</span> already in your account.
                </div>
              </div>
            </div>
            {/* MOCK MODE ONLY — gated behind NEXT_PUBLIC_MOCK_MODE */}
            {isMockMode && (
              <button
                onClick={() => { onTokenCredit(4); onClose() }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)' }}>
                🧪 SIMULATE EMAIL LINK CLICK
              </button>
            )}
            <button onClick={onClose} style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              I'll do it later
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
              We sent a sign-in link to <span style={{ color: 'var(--text)' }}>{email}</span>. Click it and you'll be signed in instantly — no password needed.
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(77,126,255,0.07)', border: '1px solid rgba(77,126,255,0.2)', fontSize: 12, color: 'var(--text-faint)' }}>
                Didn't get it? Check your spam folder, or{' '}
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
        {!isVerify && !isForgot && !isForgotSent && !isMagicSent && (<>
          <button onClick={handleGoogleAuth} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" /></svg>
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
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={fieldStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                onKeyDown={e => { if (e.key === 'Enter' && !isSignUp && signinMethod === 'magic') handleMagicLink() }} />
            </div>

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

            {(isSignUp || signinMethod === 'password') && (
              <div>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={isSignUp ? 'At least 6 characters' : 'Your password'} style={{ ...fieldStyle, paddingRight: 44 }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(77,126,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(77,126,255,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter') isSignUp ? handleSignUp() : handleSignIn() }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-faint)', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            {!isSignUp && signinMethod === 'magic' && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, padding: '10px 12px', borderRadius: 10, background: 'rgba(77,126,255,0.06)', border: '1px solid rgba(77,126,255,0.15)' }}>
                We'll email you a one-time link. Click it and you're in — no password needed.
              </div>
            )}

            {error && <div style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,77,106,0.1)', border: '1px solid rgba(255,77,106,0.3)', fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A' }}>{error}</div>}

            {isSignUp && (
              <Turnstile
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
                <button onClick={() => { setMode('forgot'); setError('') }} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Reset it</button>
              </>
            ) : null}
          </div>
        </>)}
      </div>
    </div>
  )
}
