'use client'

import { useState } from 'react'
import type { CurrentUser, GameHistoryRecord } from '@/lib/constants'

// ─── FEEDBACK MODAL ───────────────────────────────────────────────────────────
// Phase 9: replace setTimeout with fetch('POST /api/feedback', { category, message, userId? })

interface FeedbackModalProps {
  onClose: () => void
  currentUser: CurrentUser | null
}

export function FeedbackModal({ onClose, currentUser }: FeedbackModalProps) {
  const [category, setCategory] = useState('General')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const cats = ['Bug Report', 'Feature Request', 'General']

  function handleSubmit() {
    if (!message.trim()) return
    setLoading(true)
    // Phase 9: replace with fetch('POST /api/feedback', { category, message, userId: currentUser?.id })
    setTimeout(() => { setLoading(false); setSubmitted(true) }, 700)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px', width: 'min(420px,96vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>Send Feedback 💬</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🙏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#0FD98A', marginBottom: 6 }}>Thanks for your feedback!</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>We read every submission.</div>
            <button onClick={onClose} style={{ padding: '11px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.06em', border: '1px solid rgba(255,255,255,0.09)' }}>CLOSE</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Category</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {cats.map(c => (
                  <button key={c} onClick={() => setCategory(c)} style={{ flex: 1, padding: '8px 4px', borderRadius: 9, fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: 600, background: category === c ? 'rgba(77,126,255,0.15)' : 'rgba(255,255,255,0.04)', color: category === c ? '#4D7EFF' : 'var(--text-muted)', border: `1px solid ${category === c ? 'rgba(77,126,255,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Message</div>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's on your mind…" rows={5} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-body)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', resize: 'vertical', outline: 'none', lineHeight: 1.55 }} />
            </div>
            <button onClick={handleSubmit} disabled={!message.trim() || loading} style={{ width: '100%', padding: '13px', borderRadius: 12, background: message.trim() ? 'linear-gradient(135deg,#4D7EFF,#2952CC)' : 'rgba(255,255,255,0.04)', color: message.trim() ? '#fff' : 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: 'none', boxShadow: message.trim() ? '0 4px 18px rgba(77,126,255,0.3)' : 'none', transition: 'all 0.2s' }}>
              {loading ? 'SENDING…' : 'SEND FEEDBACK'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── REFERRAL MODAL ───────────────────────────────────────────────────────────
// Phase 9: replace mock referralCode with currentUser.referralCode from GET /api/referrals
// Remove onSimulateReferral prop and handler in Phase 9 (simulate button already mock-gated)

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

interface ReferralModalProps {
  onClose: () => void
  currentUser: CurrentUser
  onSimulateReferral?: () => void
}

export function ReferralModal({ onClose, currentUser, onSimulateReferral }: ReferralModalProps) {
  const [copied, setCopied] = useState(false)
  const claimed = currentUser?.referralsClaimed || 0
  // Phase 9: replace with currentUser.referralCode from DB (GET /api/referrals)
  const referralCode = (currentUser?.id || 'USER').slice(-6).toUpperCase()
  const referralLink = `https://surveyshowdown.com/join?ref=${referralCode}`

  function handleCopy() {
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
              { n: '1', text: <span>Invite up to 3 friends <strong style={{ color: 'var(--text)', fontWeight: 600 }}>using your unique link</strong> — direct signups won't count</span> },
              { n: '2', text: <span>Each friend must <strong style={{ color: 'var(--text)', fontWeight: 600 }}>claim their 4 free signup tokens</strong></span> },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: 'rgba(15,217,138,0.12)', border: '1px solid rgba(15,217,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 11, color: '#0FD98A', flexShrink: 0, marginTop: 1 }}>{n}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, paddingTop: 2 }}>{text}</div>
              </div>
            ))}
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 2 }}>
              You'll automatically receive <strong style={{ color: '#0FD98A', fontWeight: 600 }}>2 tokens</strong> per successful referral
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Your Referral Link</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
              {referralLink}
            </div>
            <button onClick={handleCopy} style={{ padding: '10px 16px', borderRadius: 10, background: copied ? 'rgba(15,217,138,0.15)' : 'linear-gradient(135deg,#0FD98A,#0AAD6E)', color: copied ? '#0FD98A' : '#fff', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em', border: copied ? '1px solid rgba(15,217,138,0.4)' : 'none', boxShadow: copied ? 'none' : '0 3px 12px rgba(15,217,138,0.3)', whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0 }}>
              {copied ? '✓ COPIED' : 'COPY LINK'}
            </button>
          </div>
        </div>

        {/* MOCK MODE ONLY — gated behind NEXT_PUBLIC_MOCK_MODE; remove prop in Phase 9 */}
        {isMockMode && claimed < 3 && (
          <button onClick={() => onSimulateReferral && onSimulateReferral()} style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 12, border: '1px dashed rgba(255,255,255,0.1)', cursor: 'pointer', letterSpacing: '0.04em' }}>
            🧪 Simulate a friend claiming their tokens
          </button>
        )}
      </div>
    </div>
  )
}

// ─── GAME HISTORY MODAL ───────────────────────────────────────────────────────
// Phase 9: replace gameHistory prop with GET /api/survey-showdown/history?game=survey_showdown
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px', width: 'min(480px,96vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>🎮 Game History</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)', marginTop: 3 }}>
              {gameHistory.length === 0 ? 'No games yet' : `Last ${gameHistory.length} of 50 game${gameHistory.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
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
