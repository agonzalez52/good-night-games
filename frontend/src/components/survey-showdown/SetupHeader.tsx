'use client'

import { useState, useEffect, useRef } from 'react'
import TokenSVG from '@/components/shared/TokenSVG'
import { StackedStarsIcon } from '@/components/shared/StackedStarsIcon'
import AuthModal from '@/components/shared/AuthModal'
import type { CurrentUser, CustomSurvey, CustomCollection } from '@/lib/constants'
import type { SurveyPackFreeListItem, SurveyPackPremiumListItem, SurveyPackTag } from '@/lib/api/survey-showdown/survey-packs'
import { PackTagPillsResponsive } from '@/components/survey-showdown/pack-tag-pills'
import { createClient } from '@/lib/supabase/client'
import { sendSignupVerification } from '@/lib/api/auth'
import {
  getVerificationFailureFeedback,
  VERIFY_DELIVERY_STATE,
  type VerifyDeliveryState,
} from '@/lib/auth/verification-feedback'

const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true'

// ─── VERIFICATION BANNER ──────────────────────────────────────────────────────
interface VerificationBannerProps {
  email: string
  onClaim: () => void
}

export function VerificationBanner({ email, onClaim }: VerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState(false)
  const [deliveryState, setDeliveryState] = useState<VerifyDeliveryState>(VERIFY_DELIVERY_STATE.SENT)

  async function handleResendVerification() {
    setResendMessage('')
    setResendError(false)
    setIsSending(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) {
        setDeliveryState(VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE)
        setResendMessage('Please sign in again, then click to resend your signup email.')
        setResendError(true)
        return
      }
      const result = await sendSignupVerification(accessToken)
      if (result.alreadyVerified) {
        setDeliveryState(VERIFY_DELIVERY_STATE.SENT)
        setClaimed(true)
        setResendMessage('Signup bonus is already available on this account.')
        return
      }
      if (result.sent) {
        setDeliveryState(VERIFY_DELIVERY_STATE.SENT)
        setResendMessage('Signup email sent. Check your inbox and spam folder.')
        return
      }
      setDeliveryState(VERIFY_DELIVERY_STATE.SENT)
      setResendMessage('Your signup email was already sent recently. Please check your inbox.')
    } catch (verificationError) {
      const feedback = getVerificationFailureFeedback(verificationError)
      setDeliveryState(feedback.state)
      setResendMessage(feedback.message)
      setResendError(true)
    } finally {
      setIsSending(false)
    }
  }

  if (dismissed) return null
  return (
    <div style={{ width: '100%', background: 'linear-gradient(90deg,rgba(77,126,255,0.18),rgba(77,126,255,0.1))', borderBottom: '1px solid rgba(77,126,255,0.25)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>📧</span>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', minWidth: 0 }}>
          {claimed
            ? <span style={{ color: '#0FD98A' }}>✓ Tokens secured! <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 free tokens</span> have been added to your account.</span>
            : deliveryState === VERIFY_DELIVERY_STATE.TARGETED_FAILURE ? (
              <span>
                We could not verify delivery for <span style={{ color: 'var(--text)' }}>{email}</span>. Use a different email provider to unlock your{' '}
                <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 signup tokens</span>.
              </span>
            ) : deliveryState === VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE ? (
              <span>
                Signup email could not be sent right now. You can keep playing and retry to unlock your{' '}
                <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>4 signup tokens</span>.
              </span>
            ) : (
              <span>
                Claim your free signup tokens via email
              </span>
            )
          }
          {resendMessage && (
            <div style={{ marginTop: 4, color: resendError ? '#FF4D6A' : 'var(--text-faint)' }}>
              {resendMessage}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {!claimed && (
          <button
            onClick={() => void handleResendVerification()}
            disabled={isSending}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(77,126,255,0.2)', color: '#4D7EFF', border: '1px solid rgba(77,126,255,0.35)', opacity: isSending ? 0.38 : 1 }}
          >
            {isSending ? 'SENDING...' : 'RESEND EMAIL'}
          </button>
        )}
        {/* MOCK MODE ONLY */}
        {isMockMode && !claimed && (
          <button onClick={() => { setClaimed(true); onClaim(); setTimeout(() => setDismissed(true), 2500) }}
            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(77,126,255,0.3)' }}>
            MOCK VERIFY
          </button>
        )}
        <button onClick={() => setDismissed(true)} style={{ width: 24, height: 24, borderRadius: 6, fontSize: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
      </div>
    </div>
  )
}

// ─── SURVEY PACK PICKER (trigger button only) ─────────────────────────────────
interface SurveyPackPickerProps {
  selectedPackId: string
  onToggle: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
  open: boolean
  customSurveys: CustomSurvey[]
  customCollections: CustomCollection[]
  catalogFree: SurveyPackFreeListItem[]
  catalogPremium: SurveyPackPremiumListItem[]
}

export function SurveyPackPicker({
  selectedPackId,
  onToggle,
  triggerRef,
  open,
  customCollections,
  catalogFree,
  catalogPremium,
}: SurveyPackPickerProps) {
  function getLabel(id: string) {
    if (id === 'random') return '🎲 Random Mix'
    if (id === 'custom_all') return '✏ All Custom Surveys'
    const coll = customCollections.find(c => c.id === id)
    if (coll) return `✏ ${coll.name}`
    const fp = catalogFree.find(p => p.id === id); if (fp) return fp.name
    const pp = catalogPremium.find(p => p.id === id); if (pp) return pp.name
    return 'Select Surveys'
  }
  const catalogPack =
    catalogFree.find(p => p.id === selectedPackId) ??
    catalogPremium.find(p => p.id === selectedPackId)
  const catalogTags = catalogPack?.tags?.length ? catalogPack.tags : undefined
  const primaryLabel = getLabel(selectedPackId)

  return (
    <div style={{ width: '100%' }}>
      <button ref={triggerRef} onClick={onToggle} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${open ? 'rgba(240,165,0,0.5)' : 'rgba(255,255,255,0.1)'}`, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.04em', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', transition: 'border-color 0.18s', boxShadow: open ? '0 0 0 3px rgba(240,165,0,0.1)' : 'none' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
          <span style={{ flex: '0 1 auto', minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{primaryLabel}</span>
          {catalogTags ? (
            <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <PackTagPillsResponsive key={selectedPackId} tags={catalogTags} size="compact" align="end" initialMaxVisible={2} />
            </div>
          ) : null}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
      </button>
    </div>
  )
}

// ─── SURVEY PACK DROPDOWN (rendered at SetupScreen root) ──────────────────────
interface SurveyPackDropdownProps {
  selectedPackId: string
  onSelectPack: (id: string) => void
  onClose: () => void
  currentUser: CurrentUser | null
  customSurveys: CustomSurvey[]
  customCollections: CustomCollection[]
  catalogFree: SurveyPackFreeListItem[]
  catalogPremium: SurveyPackPremiumListItem[]
  dropdownPos: { top: number; left: number; width: number }
  panelRef: React.RefObject<HTMLDivElement | null>
}

export function SurveyPackDropdown({ selectedPackId, onSelectPack, onClose, currentUser, customSurveys, customCollections, catalogFree, catalogPremium, dropdownPos, panelRef }: SurveyPackDropdownProps) {
  const balance = currentUser?.tokenBalance || 0
  const isPremiumLocked = !currentUser || (currentUser && balance === 0)

  function handleSelect(id: string) { onSelectPack(id); onClose() }

  const sectionLabel = (txt: string) => (
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', padding: '8px 10px 4px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>{txt}</div>
  )

  const row = (id: string, name: string, desc: string | null, locked: boolean, extra?: React.ReactNode, catalogTags?: SurveyPackTag[]) => {
    const isSel = selectedPackId === id
    const hasPills = Boolean(catalogTags?.length)
    const showDesc = Boolean(desc?.trim())
    return (
      <div key={id} onClick={() => handleSelect(id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', background: isSel ? 'rgba(240,165,0,0.12)' : 'transparent', transition: 'background 0.15s', opacity: locked ? 0.55 : 1 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: isSel ? '#F0A500' : 'var(--text)', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 1 auto', minWidth: 0 }}>{name}</div>
            {hasPills && catalogTags && (
              <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
                <PackTagPillsResponsive tags={catalogTags} size="default" align="end" initialMaxVisible={4} />
              </div>
            )}
          </div>
          {showDesc && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.35 }}>{desc}</div>
          )}
        </div>
        {extra}
        {isSel && <span style={{ color: '#F0A500', fontSize: 12, flexShrink: 0, marginTop: 2 }}>✓</span>}
      </div>
    )
  }

  const hasCustomSurveys = currentUser && customSurveys.length > 0

  return (
    <div ref={panelRef} style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, background: '#0d1224', border: '2px solid rgba(255,255,255,0.2)', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,1)', padding: '8px', maxHeight: 360, overflowY: 'auto', animation: 'menuSlide 0.18s ease-out', zIndex: 9999 }}>
      {hasCustomSurveys && (<>
        {sectionLabel('Custom')}
        {row('custom_all', 'All Custom Surveys', 'All your surveys', false)}
        {customCollections.filter(c => customSurveys.some(s => s.collectionId === c.id)).map(c =>
          row(c.id, `✏ ${c.name}`, `${customSurveys.filter(s => s.collectionId === c.id).length} survey(s)`, false)
        )}
      </>)}
      {sectionLabel('Free')}
      {catalogFree.map(p => row(p.id, p.name, p.description, false, undefined, p.tags))}
      {sectionLabel('Tokens Required')}
      {row('random', '🎲 Random Mix', 'Draw from all available surveys', isPremiumLocked,
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}><TokenSVG size={14} /></span>
      )}
      {catalogPremium.map(p => row(p.id, p.name, p.description, isPremiumLocked,
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}><TokenSVG size={14} /></span>,
        p.tags,
      ))}
    </div>
  )
}

// ─── HOW TO PLAY MODAL ────────────────────────────────────────────────────────
export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  const sections = [
    { icon: '⚡', title: 'Face-Off', body: "Each round opens with a face-off. One player from each team buzzes in first. The first to buzz in answers. Guess any correct answer before the timer runs out and your team controls the board. Miss, and the other team takes control." },
    { icon: '📋', title: 'Play the Board', body: "The controlling team guesses answers one at a time. Every correct answer earns its point value. Rack up 3 wrong answers and you're out — the other team gets one shot to steal all the points on the board with a single guess." },
    { icon: '🏆', title: 'Win the Game', body: "Points stack up across every round. Most points when the last round ends wins. Ties mean a rematch — no complaints." },
    { icon: '💡', title: 'Good to Know', body: "• Hit ⟳ Skip Question during the face-off to swap in a different question\n• Use the ⚙️ menu mid-game to adjust the timer or end the game early\n• Tap UNDO or RE-DO if you submit a guess by mistake" },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px 32px', width: 'min(600px,92vw)', maxHeight: '88vh', overflow: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: '#F0A500', letterSpacing: '0.02em' }}>How to Play</div>
          </div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'linear-gradient(135deg,rgba(77,126,255,0.1),rgba(77,126,255,0.05))', border: '1px solid rgba(77,126,255,0.3)', marginBottom: 18 }}>
          <StackedStarsIcon size={65} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', color: '#4D7EFF', marginBottom: 2 }}>AI-POWERED JUDGING</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>An AI judge handles all answer checking — synonyms, close matches, and everything in between. Everyone plays. No one sits out to host.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sections.map(({ icon, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, color: 'var(--text)', letterSpacing: '0.06em', marginBottom: 5, textTransform: 'uppercase' }}>{title}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 20, width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)', cursor: 'pointer' }}>LET&rsquo;S PLAY!</button>
      </div>
    </div>
  )
}

// ─── CONVERSION MODAL ─────────────────────────────────────────────────────────
interface ConversionModalProps {
  reason: 'premium' | 'postgame'
  onClose: () => void
  onSignUp: () => void
  onSignIn: () => void
}

export function ConversionModal({ reason, onClose, onSignUp, onSignIn }: ConversionModalProps) {
  const isPremium = reason === 'premium'
  const headline = isPremium ? 'Unlock the full game' : 'That was just the warm-up'
  const sub = isPremium ? 'Sign up free and start playing premium packs in seconds.' : 'Create a free account to unlock everything — and keep the fun going.'
  const benefits = [
    { icon: '🎟', title: '4 Free Tokens', desc: 'Yours on signup. No card required.', highlight: true },
    { icon: <StackedStarsIcon size={20} />, title: 'AI-Powered Judging', desc: 'No host required so everyone can play.' },
    { icon: '✏', title: 'Custom Surveys', desc: 'Create custom surveys and collections for personalized fun.' },
    { icon: '🚫', title: 'Ad-Free Gameplay', desc: 'No interruptions. Just the game.' },
    { icon: '🎮', title: 'Game History', desc: 'Track every win across all your game nights.' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(10px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(6,9,20,0.99)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, width: 'min(500px,96vw)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 32px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(240,165,0,0.08)', animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '22px 22px 0 0', background: 'linear-gradient(90deg,transparent 0%,#F0A500 30%,#FFD166 60%,#C07A00 100%)' }} />
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 8, fontSize: 15, background: 'rgba(255,255,255,0.05)', color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>✕</button>
        <div style={{ padding: '32px 32px 20px', textAlign: 'center', background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(240,165,0,0.1) 0%, transparent 70%)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 100, background: 'linear-gradient(135deg,rgba(240,165,0,0.2),rgba(192,122,0,0.12))', border: '1px solid rgba(240,165,0,0.45)', marginBottom: 16, boxShadow: '0 0 28px rgba(240,165,0,0.18)' }}>
            <TokenSVG size={18} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', color: '#F0A500' }}>4 FREE TOKENS ON SIGN UP</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(26px,5vw,36px)', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.1, marginBottom: 10 }}>{headline}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>{sub}</div>
        </div>
        <div style={{ padding: '4px 24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {benefits.map(({ icon, title, desc, highlight }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 14px', borderRadius: 12, background: highlight ? 'linear-gradient(135deg,rgba(240,165,0,0.1),rgba(192,122,0,0.06))' : 'rgba(255,255,255,0.03)', border: highlight ? '1px solid rgba(240,165,0,0.35)' : '1px solid rgba(255,255,255,0.06)', boxShadow: highlight ? '0 0 20px rgba(240,165,0,0.08)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: highlight ? 'rgba(240,165,0,0.14)' : 'rgba(255,255,255,0.05)', border: highlight ? '1px solid rgba(240,165,0,0.3)' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.04em', color: highlight ? '#F0A500' : 'var(--text)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{desc}</div>
              </div>
              {highlight && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-score)', fontSize: 30, color: '#F0A500', lineHeight: 1 }}>4</span>
                  <TokenSVG size={16} />
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: '0 24px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={onSignUp} style={{ width: '100%', padding: '15px', borderRadius: 14, fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em', background: 'linear-gradient(135deg,#F0A500 0%,#C07A00 100%)', color: '#fff', border: 'none', boxShadow: '0 6px 28px rgba(240,165,0,0.45),inset 0 1px 0 rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span>CREATE FREE ACCOUNT</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 10, fontSize: 13, opacity: 0.9 }}>
              <TokenSVG size={14} /> 4 free
            </span>
          </button>
          <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, background: 'transparent', color: 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.02em' }}>
            {isPremium ? 'Maybe later — play Classic for free' : 'Maybe later'}
          </button>
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-faint)' }}>
            Already have an account?{' '}
            <button onClick={onSignIn} style={{ background: 'none', border: 'none', color: '#4D7EFF', fontFamily: 'var(--font-body)', fontSize: 12, textDecoration: 'underline', textUnderlineOffset: 3, padding: 0, cursor: 'pointer' }}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SETUP HEADER ─────────────────────────────────────────────────────────────
interface SetupHeaderProps {
  /** First-load: session may exist but profile not fetched yet — avoid logged-out chrome */
  authLoading?: boolean
  currentUser: CurrentUser | null
  onSignIn: (user: CurrentUser) => void
  onSignOut: () => void
  onTokensUpdated: (newBalance: number) => void
  onOpenPurchaseModal: () => void
  onOpenCustomSurveys: () => void
  onOpenFeedback: () => void
  onOpenReferral: () => void
  onOpenGameHistory: () => void
}

export default function SetupHeader({
  authLoading = false,
  currentUser, onSignIn, onSignOut, onTokensUpdated,
  onOpenPurchaseModal, onOpenCustomSurveys, onOpenFeedback,
  onOpenReferral, onOpenGameHistory,
}: SetupHeaderProps) {
  const [open, setOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup')
  const [pillAnimKey, setPillAnimKey] = useState(0)
  const prevBalance = useRef(currentUser?.tokenBalance)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const newBal = currentUser?.tokenBalance
    if (newBal !== undefined && newBal !== prevBalance.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remount key + tokenPop when balance changes
      setPillAnimKey(k => k + 1)
      prevBalance.current = newBal
    }
  }, [currentUser?.tokenBalance])

  useEffect(() => {
    function handle(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const initials = currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : '?'
  const balance = currentUser?.tokenBalance ?? 0
  const referralsClaimed = currentUser?.referralsClaimed || 0
  const canOpenReferral = Boolean(currentUser?.emailVerified) && referralsClaimed < 3
  const zeroBal = currentUser && balance === 0
  /** Session is syncing (e.g. after sign-in) — hide logged-in/out chrome until /me + balance return */
  const headerPending = authLoading && !currentUser

  useEffect(() => {
    if (headerPending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu while auth is mid-flight
      setOpen(false)
    }
  }, [headerPending])

  return (
    <>
      <div
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'relative', zIndex: 1000, flexShrink: 0 }}
        aria-busy={headerPending}
      >
        <div style={{ minWidth: 60, display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerPending && (
            <div style={{ width: 88, height: 34, borderRadius: 100, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} aria-hidden />
          )}
          {currentUser && (
            <>
              <div key={pillAnimKey} data-token-pill onClick={() => onOpenPurchaseModal()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, background: zeroBal ? 'rgba(255,77,106,0.12)' : 'rgba(240,165,0,0.1)', border: `1px solid ${zeroBal ? 'rgba(255,77,106,0.35)' : 'rgba(240,165,0,0.25)'}`, cursor: 'pointer', animation: zeroBal ? 'redPulse 2.2s ease-in-out infinite' : (pillAnimKey > 0 ? 'tokenPop 0.4s ease-out' : 'none') }}>
                <TokenSVG size={14} />
                <span style={{ fontFamily: 'var(--font-score)', fontSize: 18, color: zeroBal ? '#FF4D6A' : '#F0A500', lineHeight: 1 }}>{balance}</span>
              </div>
              {canOpenReferral && (() => {
                const claimed = referralsClaimed
                const pct = Math.round((claimed / 3) * 100)
                return (
                  <button onClick={() => onOpenReferral()} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 100, background: 'rgba(15,217,138,0.06)', border: '1px solid rgba(15,217,138,0.25)', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', animation: claimed === 0 ? 'greenPulse 2.6s ease-in-out infinite' : 'none' }}>
                    {claimed > 0 && <div style={{ position: 'absolute', inset: 0, borderRadius: 100, background: 'rgba(15,217,138,0.18)', width: `${pct}%`, transition: 'width 0.5s ease' }} />}
                    <span style={{ position: 'relative', fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '0.08em', color: '#0FD98A' }}>
                      {claimed === 0 ? '✦ EARN FREE TOKENS' : `✦ ${claimed} / 3 REFERRALS`}
                    </span>
                  </button>
                )
              })()}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!headerPending && !currentUser && (
            <button onClick={() => { setAuthMode('signup'); setShowAuth(true) }}
              style={{ padding: '8px 14px', borderRadius: 10, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: '#F0A500', color: '#fff', border: 'none', boxShadow: '0 2px 10px rgba(240,165,0,0.3)', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><TokenSVG size={13} /><span style={{ color: '#fff' }}>SIGN UP</span> <span style={{ color: '#060914' }}>FOR FREE TOKENS!</span></span>
            </button>
          )}

          <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
            {headerPending ? (
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} aria-hidden />
            ) : (
              <button type="button" onClick={() => setOpen(o => !o)} title="Settings" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${open ? 'rgba(77,126,255,0.4)' : 'rgba(255,255,255,0.09)'}`, background: open ? 'rgba(77,126,255,0.15)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4.5, padding: '9px', transition: 'all 0.2s ease' }}>
                {[0, 1, 2].map(i => (<div key={i} style={{ width: 16, height: 2, borderRadius: 2, background: open ? '#4D7EFF' : 'var(--text-muted)', transition: 'all 0.22s ease', transform: open && i === 0 ? 'translateY(6.5px) rotate(45deg)' : open && i === 2 ? 'translateY(-6.5px) rotate(-45deg)' : open && i === 1 ? 'scaleX(0)' : 'none' }} />))}
              </button>
            )}
            {open && (
              <div style={{ position: 'absolute', top: 48, right: 0, width: 260, background: 'rgba(8,12,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 16px 56px rgba(0,0,0,0.7)', padding: '14px', animation: 'menuSlide 0.2s ease-out', backdropFilter: 'blur(20px)' }}>
                {currentUser && (<>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#4D7EFF,#2952CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 13, color: '#fff', flexShrink: 0 }}>{initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{currentUser.username}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <button onClick={() => { onOpenPurchaseModal(); setOpen(false) }} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'rgba(240,165,0,0.08)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}><TokenSVG size={14} /></span>Get Tokens
                    </button>
                    {[
                      { icon: '✏', label: 'My Surveys & Collections', fn: () => { onOpenCustomSurveys(); setOpen(false) } },
                      { icon: '🎮', label: 'Game History', fn: () => { onOpenGameHistory(); setOpen(false) } },
                      ...(canOpenReferral ? [{ icon: '👥', label: 'Refer a Friend', fn: () => { onOpenReferral(); setOpen(false) } }] : []),
                      { icon: '💬', label: 'Feedback', fn: () => { onOpenFeedback(); setOpen(false) } },
                    ].map(({ icon, label, fn }) => (
                      <button key={label} onClick={fn} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text-muted)', border: 'none', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                        <span style={{ fontSize: 14 }}>{icon}</span>{label}
                      </button>
                    ))}
                    <button onClick={() => { onSignOut(); setOpen(false) }} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'transparent', color: '#FF4D6A', border: 'none', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ fontSize: 14 }}>→</span>Sign Out
                    </button>
                  </div>
                </>)}
                {!currentUser && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => { setOpen(false); setAuthMode('signin'); setShowAuth(true) }} style={{ width: '100%', padding: '9px 10px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--text-muted)', border: 'none', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ fontSize: 14 }}>→</span>Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showAuth && <AuthModal initialMode={authMode} onClose={() => setShowAuth(false)} onAuth={user => { onSignIn(user) }} onTokenCredit={n => { onTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowAuth(false) }} />}
    </>
  )
}
