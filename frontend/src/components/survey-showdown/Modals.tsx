'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { postFeedback, type FeedbackCategory } from '@/lib/api/feedback'
import { getReferralData, type ReferralDataResponse } from '@/lib/api/referrals'
import { useAuth } from '@/hooks/useAuth'
import TokenSVG from '@/components/shared/TokenSVG'
import { FEEDBACK_MESSAGE_MAX_LENGTH, type CurrentUser, type GameHistoryRecord } from '@/lib/constants'

// ─── FEEDBACK MODAL ───────────────────────────────────────────────────────────
// POST /api/feedback (Bearer + category, message, game_id).

interface FeedbackModalProps {
  onClose: () => void
  currentUser: CurrentUser | null
}

export function FeedbackModal({ onClose, currentUser }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>('General')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const cats: FeedbackCategory[] = ['Bug Report', 'Feature Request', 'General']

  const len = message.length
  const isOverLimit = len > FEEDBACK_MESSAGE_MAX_LENGTH
  const canSend = Boolean(
    currentUser && message.trim() && !isOverLimit
  )

  async function handleSubmit() {
    const trimmed = message.trim()
    if (!currentUser || !trimmed || isOverLimit) return
    setLoading(true)
    setSubmitError(null)
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession()
      if (!session?.access_token) {
        setSubmitError("Can't verify your session. Please sign in again.")
        return
      }
      await postFeedback(
        { category, message: trimmed },
        session.access_token
      )
      setSubmitted(true)
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'Failed to send feedback. Try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px', boxSizing: 'border-box' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        style={{
          background: 'rgba(8,12,28,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: '28px',
          width: 'min(420px,96vw)',
          maxHeight: 'min(calc(100dvh - 32px), calc(100vh - 32px))',
          boxSizing: 'border-box',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>Send Feedback 💬</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🙏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#0FD98A', marginBottom: 6 }}>Thanks for your feedback!</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.55 }}>We read every submission.</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', marginBottom: 22, lineHeight: 1.5, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
              Responses will only come from{' '}
              <a
                href="mailto:support@goodnightgames.app"
                onClick={e => e.stopPropagation()}
                style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                support@goodnightgames.app
              </a>
              .
            </div>
            <button onClick={onClose} style={{ padding: '11px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.09)' }}>CLOSE</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!currentUser && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Sign in to send feedback.
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Category</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {cats.map(c => (
                  <button key={c} onClick={() => setCategory(c)} style={{ flex: 1, padding: '8px 4px', borderRadius: 9, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, background: category === c ? 'rgba(77,126,255,0.15)' : 'rgba(255,255,255,0.04)', color: category === c ? '#4D7EFF' : 'var(--text-muted)', border: `1px solid ${category === c ? 'rgba(77,126,255,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
              {category === 'Bug Report' && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 8 }}>
                  Please include your steps and any error messages you encountered.
                </div>
              )}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Message</div>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's on your mind…" rows={5} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', resize: 'vertical', outline: 'none', lineHeight: 1.55 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    color: isOverLimit ? '#FF4D6A' : 'var(--text-muted)',
                  }}
                >
                  {len}/{FEEDBACK_MESSAGE_MAX_LENGTH}
                </span>
              </div>
            </div>
            {submitError && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A', lineHeight: 1.5 }}>
                {submitError}
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              Responses will only come from{' '}
              <a
                href="mailto:support@goodnightgames.app"
                onClick={e => e.stopPropagation()}
                style={{ color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                support@goodnightgames.app
              </a>
              .
            </div>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSend || loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                background: canSend && !loading ? 'linear-gradient(135deg,#4D7EFF,#2952CC)' : 'rgba(255,255,255,0.04)',
                color: canSend && !loading ? '#fff' : 'var(--text-faint)',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                letterSpacing: '0.08em',
                border: 'none',
                boxShadow: canSend && !loading ? '0 4px 18px rgba(77,126,255,0.3)' : 'none',
                transition: 'all 0.2s',
                cursor: !canSend || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'SENDING…' : 'SEND FEEDBACK'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── REFERRAL MODAL ───────────────────────────────────────────────────────────
// Loads share code and counts from GET /api/referrals; claim awards both parties via POST /claim after verify.

interface ReferralModalProps {
  onClose: () => void
  currentUser: CurrentUser
}

export function ReferralModal({ onClose, currentUser }: ReferralModalProps) {
  const { referralSnapshot, revalidateReferralSnapshot } = useAuth()
  const [copied, setCopied] = useState(false)
  const [fallbackReferral, setFallbackReferral] = useState<ReferralDataResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const referralWarmKey =
    referralSnapshot != null
      ? `${referralSnapshot.referralCode}:${referralSnapshot.claimed}:${referralSnapshot.pending}:${referralSnapshot.max}`
      : ''
  const [blockingFetch, setBlockingFetch] = useState(() => referralWarmKey === '')
  const lastReferralUserId = useRef(currentUser.id)

  const referral = referralSnapshot ?? fallbackReferral
  const loading = !referral && !loadError && blockingFetch

  useEffect(() => {
    if (lastReferralUserId.current !== currentUser.id) {
      lastReferralUserId.current = currentUser.id
      setFallbackReferral(null)
      setLoadError(null)
    }
  }, [currentUser.id])

  useEffect(() => {
    void revalidateReferralSnapshot()

    if (referralWarmKey !== '') {
      setBlockingFetch(false)
      return
    }

    let cancelled = false
    setBlockingFetch(true)
    setLoadError(null)
    void (async () => {
      try {
        const {
          data: { session },
        } = await createClient().auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('No session')
        const data = await getReferralData(token)
        if (!cancelled) setFallbackReferral(data)
      } catch {
        if (!cancelled) {
          setLoadError('Could not load your referral link. Try again in a moment.')
        }
      } finally {
        if (!cancelled) setBlockingFetch(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [referralWarmKey, currentUser.id, revalidateReferralSnapshot])

  const claimed = referral?.claimed ?? currentUser.referralsClaimed ?? 0
  const maxReferrals = referral?.max ?? 3
  const referralCode = referral?.referralCode ?? ''
  const referralLink =
    typeof window !== 'undefined' && referralCode
      ? `${window.location.origin}/survey-showdown?ref=${encodeURIComponent(referralCode)}`
      : ''

  function handleCopy() {
    if (!referralLink) return
    navigator.clipboard?.writeText(referralLink).catch(() => { })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px', width: 'min(440px,96vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#0FD98A' }}>👥 Refer a Friend</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Share the fun, get rewarded!</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { n: '1', text: <span>Invite up to 3 friends <strong style={{ color: 'var(--text)', fontWeight: 600 }}>using your unique link</strong> — direct signups won&apos;t count</span> },
              { n: '2', text: <span>Each friend must <strong style={{ color: 'var(--text)', fontWeight: 600 }}>claim their 4 free signup tokens</strong> (verify email)</span> },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(15,217,138,0.12)', border: '1px solid rgba(15,217,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 11, color: '#0FD98A', flexShrink: 0, marginTop: 1 }}>{n}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, paddingTop: 2 }}>{text}</div>
              </div>
            ))}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              When that happens, <strong style={{ color: '#0FD98A', fontWeight: 600 }}>you and your friend</strong> each get{' '}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <strong style={{ color: '#0FD98A', fontWeight: 600 }}>2</strong> <TokenSVG size={14} />
              </span>
            </div>
          </div>
        </div>

        {!loading && referral && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', marginBottom: 12, letterSpacing: '0.02em' }}>
            Completed referrals: <span style={{ color: 'var(--text-muted)' }}>{claimed}</span> / {maxReferrals}
            {referral.pending > 0 && (
              <span style={{ marginLeft: 8 }}>({referral.pending} pending)</span>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Your Referral Link</div>
          {loadError && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A', marginBottom: 10, lineHeight: 1.5 }}>{loadError}</div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            {loading ? (
              <>
                <div style={{ flex: 1, height: 42, borderRadius: 10, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} aria-hidden />
                <div style={{ width: 108, height: 42, borderRadius: 10, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite', flexShrink: 0 }} aria-hidden />
              </>
            ) : (
              <>
                <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                  {referralLink || '—'}
                </div>
                <button type="button" onClick={handleCopy} disabled={!referralLink} style={{ padding: '10px 16px', borderRadius: 10, background: !referralLink ? 'rgba(255,255,255,0.04)' : copied ? 'rgba(15,217,138,0.15)' : 'linear-gradient(135deg,#0FD98A,#0AAD6E)', color: !referralLink ? 'var(--text-faint)' : copied ? '#0FD98A' : '#fff', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', border: copied ? '1px solid rgba(15,217,138,0.4)' : 'none', boxShadow: copied || !referralLink ? 'none' : '0 3px 12px rgba(15,217,138,0.3)', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0, opacity: !referralLink ? 0.38 : 1, cursor: !referralLink ? 'not-allowed' : 'pointer' }}>
                  {copied ? '✓ COPIED' : 'COPY LINK'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── GAME HISTORY MODAL ───────────────────────────────────────────────────────
// Rows come from parent local state; optional: load via GET /api/survey-showdown/history?game=survey_showdown
// Record shape: { id, timestamp, team1, team2, rounds, pack, winner, score1, score2 }

function formatHistoryTime(date: Date): string {
  const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function HistoryRow({ g }: { g: GameHistoryRecord }) {
  const t1won = g.winner === g.team1
  const t2won = g.winner === g.team2
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'flex-end', padding: '10px 10px', borderRadius: 9, transition: 'background 0.12s', cursor: 'default' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: t1won ? '#F0A500' : '#A0B4CC', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{g.team1}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-score)', fontSize: 22, color: t1won ? '#F0A500' : '#6677AA', lineHeight: 1 }}>{g.score1}</span>
          {t1won && <span style={{ fontSize: 11, display: 'block', marginTop: 2 }}>🏆</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 80 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, letterSpacing: '0.1em', color: '#6677AA', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>{g.pack.toUpperCase()}</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: '#6677AA', letterSpacing: '0.04em' }}>{g.rounds} Rounds</span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'rgba(102,119,170,0.55)', letterSpacing: '0.04em', lineHeight: 1 }}>{formatHistoryTime(g.timestamp)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: t2won ? '#F0A500' : '#A0B4CC', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', maxWidth: '100%' }}>{g.team2}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {t2won && <span style={{ fontSize: 11, display: 'block', marginTop: 2 }}>🏆</span>}
          <span style={{ fontFamily: 'var(--font-score)', fontSize: 22, color: t2won ? '#F0A500' : '#6677AA', lineHeight: 1 }}>{g.score2}</span>
        </div>
      </div>
    </div>
  )
}

interface GameHistoryModalProps {
  onClose: () => void
  gameHistory: GameHistoryRecord[]
}

export function GameHistoryModal({ onClose, gameHistory }: GameHistoryModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px', boxSizing: 'border-box' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px', width: 'min(480px,96vw)', maxHeight: 'min(calc(100dvh - 32px), calc(100vh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>🎮 Game History</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
              {gameHistory.length === 0 ? 'No games yet' : `Last ${gameHistory.length} of 50 games`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 2, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
          {gameHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6 }}>
              No games played yet.<br />Complete a game to see it here.
            </div>
          ) : (
            gameHistory.map((g, i) => (
              <div key={g.id}>
                <HistoryRow g={g} />
                {i < gameHistory.length - 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 10px' }} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
