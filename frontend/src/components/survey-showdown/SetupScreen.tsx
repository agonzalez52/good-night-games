'use client'

import { useState, useEffect, useRef } from 'react'
import SetupHeader, {
  VerificationBanner,
  SurveyPackPicker,
  SurveyPackDropdown,
  HowToPlayModal,
  ConversionModal,
} from '@/components/survey-showdown/SetupHeader'
import { AdBanner } from '@/components/survey-showdown/AdBanner'
import { FeedbackModal, ReferralModal, GameHistoryModal } from '@/components/survey-showdown/Modals'
import CustomSurveysModal from '@/components/survey-showdown/CustomSurveysModal'
import AuthModal from '@/components/shared/AuthModal'
import TokenSVG from '@/components/shared/TokenSVG'
import { TOKENS_PER_GAME } from '@/lib/constants'
import type { CurrentUser, CustomSurvey, CustomCollection, SurveyQuestion, GameHistoryRecord } from '@/lib/constants'
import type { SurveyPackFreeListItem, SurveyPackPremiumListItem } from '@/lib/api/survey-showdown/survey-packs'

const DEFAULT_SETUP_ROUNDS = 5

interface SetupScreenProps {
  onStart: (team1: string, team2: string, timerSecs: number, numRounds: number) => void
  packQuestions: SurveyQuestion[]
  /** Premium list `question_count` when `packQuestions` is empty until GET .../questions */
  setupRoundCountCap: number
  packsLoading: boolean
  packsError: string | null
  catalogFree: SurveyPackFreeListItem[]
  catalogPremium: SurveyPackPremiumListItem[]
  /** True while Supabase session + backend profile are still resolving on first load */
  authLoading?: boolean
  currentUser: CurrentUser | null
  onSignIn: (user: CurrentUser) => void
  onSignOut: () => void
  onTokensUpdated: (newBalance: number) => void
  onOpenPurchaseModal: () => void
  selectedPackId: string
  onSelectPack: (id: string) => void
  customSurveys: CustomSurvey[]
  customCollections: CustomCollection[]
  onSaveSurvey: (survey: CustomSurvey) => void
  onDeleteSurvey: (id: string) => void
  onSaveCollection: (collection: CustomCollection) => void
  onDeleteCollection: (id: string) => void
  onCloseSurveys: () => void
  onSimulateReferral: () => void
  gameHistory: GameHistoryRecord[]
}

export default function SetupScreen({
  onStart, packQuestions, setupRoundCountCap, packsLoading, packsError, catalogFree, catalogPremium,
  authLoading = false, currentUser, onSignIn, onSignOut, onTokensUpdated,
  onOpenPurchaseModal, selectedPackId, onSelectPack,
  customSurveys, customCollections, onSaveSurvey, onDeleteSurvey,
  onSaveCollection, onDeleteCollection, onCloseSurveys,
  onSimulateReferral, gameHistory,
}: SetupScreenProps) {
  const [team1, setTeam1] = useState('TEAM 1')
  const [team2, setTeam2] = useState('TEAM 2')
  const [timerSecs, setTimerSecs] = useState(5)
  const [numRounds, setNumRounds] = useState(DEFAULT_SETUP_ROUNDS)
  const [showCustomSurveys, setShowCustomSurveys] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAuthFromPicker, setShowAuthFromPicker] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 320 })
  const pickerTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownPanelRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const timerOptions = [3, 5, 10]
  const maxRounds = Math.max(packQuestions.length, setupRoundCountCap, 1)

  useEffect(() => {
    if (packsLoading) return
    setNumRounds(n => Math.min(n, maxRounds))
  }, [maxRounds, packsLoading])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (pickerTriggerRef.current?.contains(e.target as Node)) return
      if (dropdownPanelRef.current?.contains(e.target as Node)) return
      setPickerOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function togglePicker() {
    if (!pickerOpen && pickerTriggerRef.current && screenRef.current) {
      const tRect = pickerTriggerRef.current.getBoundingClientRect()
      const sRect = screenRef.current.getBoundingClientRect()
      setDropdownPos({ top: tRect.bottom - sRect.top + 6, left: tRect.left - sRect.left, width: tRect.width })
    }
    setPickerOpen(o => !o)
  }

  const showVerifyBanner = currentUser && !currentUser.emailVerified
  const isPremium = !catalogFree.some(p => p.id === selectedPackId)
  const hasSurveySource =
    packQuestions.length > 0 ||
    setupRoundCountCap > 0 ||
    (selectedPackId === 'custom_all' && customSurveys.length > 0) ||
    (customCollections.some(c => c.id === selectedPackId) &&
      customSurveys.some(s => s.collectionId === selectedPackId))
  const canStart = !packsLoading && hasSurveySource

  return (
    <div ref={screenRef} style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 60% at 50% -10%,rgba(77,126,255,0.12) 0%,transparent 70%),#060914', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)', position: 'relative' }}>

      {/* Decorative background */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(77,126,255,0.06) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-8%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(240,165,0,0.04) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(77,126,255,0.07) 1px,transparent 1px)', backgroundSize: '32px 32px', opacity: 0.6 }} />
      </div>

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <SetupHeader
          authLoading={authLoading}
          currentUser={currentUser} onSignIn={onSignIn} onSignOut={onSignOut}
          onTokensUpdated={onTokensUpdated} onOpenPurchaseModal={onOpenPurchaseModal}
          onOpenCustomSurveys={() => setShowCustomSurveys(true)}
          onOpenFeedback={() => setShowFeedback(true)}
          onSimulateReferral={onSimulateReferral}
          onOpenReferral={() => setShowReferral(true)}
          onOpenGameHistory={() => setShowHistory(true)}
        />
        {showVerifyBanner && <VerificationBanner email={currentUser.email} onClaim={() => onTokensUpdated((currentUser.tokenBalance || 0) + 4)} />}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24, animation: 'logoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both' }}>
          <div style={{ fontFamily: 'var(--font-outfit)', fontWeight: 800, fontSize: 25, color: 'var(--text-faint)', marginBottom: 10 }}>good night games</div>
          <div style={{ display: 'inline-block', position: 'relative', verticalAlign: 'top' }}>
            {/* AnswerTile-shaped outline: no fill, gold border, centered on the line between SURVEY / SHOWDOWN */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100% + clamp(36px, 8vw, 72px))',
                height: 'clamp(40.25px, 6.51vw, 68.10px)',
                borderRadius: 14,
                border: '5px solid var(--gold)',
                background: 'transparent',
                boxSizing: 'border-box',
                opacity: 0.85,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(44px,8vw,88px)', color: 'var(--gold)', letterSpacing: '-0.01em', lineHeight: 0.92, animation: 'glow 3.5s ease-in-out infinite', textShadow: '0 4px 0 rgba(0,0,0,0.4), 0 0 60px rgba(240,165,0,0.45), 0 0 120px rgba(240,165,0,0.2)' }}>SURVEY<br />SHOWDOWN</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button onClick={() => setShowHowToPlay(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>How to Play</button>
          </div>
        </div>

        {/* Setup card column */}
        <div style={{ width: 'min(540px,100%)', display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideUp 0.5s 0.1s ease-out both' }}>

          {packsError && (
            <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,77,106,0.12)', border: '1px solid rgba(255,77,106,0.25)', fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {packsError}
            </div>
          )}

          {/* Team Names */}
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ val: team1, set: setTeam1, label: 'Team 1' }, { val: team2, set: setTeam2, label: 'Team 2' }].map(({ val, set, label }, i) => (
              <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                <input
                  value={val} onChange={e => set(e.target.value.toUpperCase())} maxLength={20}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 9, fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.06em', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#F0A500', textAlign: 'center', transition: 'border-color 0.2s,box-shadow 0.2s', outline: 'none', textTransform: 'uppercase', boxSizing: 'border-box' }}
                  onFocus={e => { if (e.target.value === 'TEAM 1' || e.target.value === 'TEAM 2') e.target.select(); e.target.style.borderColor = 'rgba(240,165,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(240,165,0,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            ))}
          </div>

          {/* Survey Pack */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>🎯 Survey Pack</div>
            <SurveyPackPicker
              selectedPackId={selectedPackId} onToggle={togglePicker} triggerRef={pickerTriggerRef} open={pickerOpen}
              customSurveys={customSurveys} customCollections={customCollections}
              catalogFree={catalogFree} catalogPremium={catalogPremium}
            />
          </div>

          {/* Rounds + Timer */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px', textAlign: 'center', minWidth: 140 }} aria-busy={packsLoading}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>🎮 Rounds</div>
              {packsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 2, paddingBottom: 2 }} aria-hidden>
                  <div style={{ width: 120, height: 36, borderRadius: 10, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} />
                  <div style={{ width: 72, height: 10, borderRadius: 5, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <button type="button" onClick={() => setNumRounds(r => Math.max(1, r - 1))} style={{ width: 32, height: 32, borderRadius: 9, fontSize: 18, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <div style={{ fontFamily: 'var(--font-score)', fontSize: 44, color: '#F0A500', minWidth: 40, textAlign: 'center', lineHeight: 1, textShadow: '0 0 20px rgba(240,165,0,0.3)' }}>{numRounds}</div>
                    <button type="button" onClick={() => setNumRounds(r => Math.min(maxRounds, r + 1))} style={{ width: 32, height: 32, borderRadius: 9, fontSize: 18, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-body)', marginTop: 5 }}>{maxRounds} available</div>
                </>
              )}
            </div>

            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>⏱ Face-Off Timer</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {timerOptions.map(s => (
                  <button key={s} onClick={() => setTimerSecs(s)} style={{ flex: 1, height: 38, borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-score)', letterSpacing: '0.04em', background: timerSecs === s ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.04)', color: timerSecs === s ? '#fff' : 'var(--text-muted)', border: timerSecs === s ? '1px solid rgba(240,165,0,0.6)' : '1px solid rgba(255,255,255,0.07)', boxShadow: timerSecs === s ? '0 2px 14px rgba(240,165,0,0.3)' : 'none' }}>{s}s</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 11, flexShrink: 0 }}>Custom:</span>
                <input type="number" min={3} max={120} value={timerSecs} onChange={e => setTimerSecs(Math.max(3, Math.min(120, Number(e.target.value) || 5)))} style={{ width: 52, padding: '5px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-score)', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#F0A500' }} />
                <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-body)' }}>sec</span>
              </div>
            </div>
          </div>

          {/* Buzz key hint */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[{ key: 'A', label: 'Team 1 Buzz' }, { key: 'L', label: 'Team 2 Buzz' }].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-score)', fontSize: 15, color: '#F0A500' }}>{key}</div>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Start Game */}
          <button
            onClick={() => onStart(team1 || 'TEAM 1', team2 || 'TEAM 2', timerSecs, numRounds)}
            disabled={!canStart}
            style={{
              width: '100%', padding: '16px 24px', borderRadius: 14, fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em', background: 'linear-gradient(135deg,#F0A500 0%,#C07A00 100%)', color: '#fff', border: 'none', boxShadow: '0 6px 28px rgba(240,165,0,0.4),inset 0 1px 0 rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              opacity: canStart ? 1 : 0.38, cursor: canStart ? 'pointer' : 'not-allowed',
            }}
          >
            <span>▶ START GAME</span>
            {isPremium && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: 0.85, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: 10, fontSize: 14 }}>
                {TOKENS_PER_GAME} <TokenSVG size={15} />
              </span>
            )}
          </button>
        </div>

        {/* Ad banner */}
        <div style={{ marginTop: 24, width: 'min(540px,100%)', animation: 'slideUp 0.5s 0.44s ease-out both' }}>
          <AdBanner style={{ minHeight: 80 }} />
        </div>
      </div>

      {/* Dropdown rendered at root — no stacking-context ancestors */}
      {pickerOpen && (
        <SurveyPackDropdown
          selectedPackId={selectedPackId} onSelectPack={onSelectPack} onClose={() => setPickerOpen(false)}
          currentUser={currentUser} customSurveys={customSurveys} customCollections={customCollections}
          catalogFree={catalogFree} catalogPremium={catalogPremium}
          dropdownPos={dropdownPos} panelRef={dropdownPanelRef}
        />
      )}

      {showHistory && <GameHistoryModal onClose={() => setShowHistory(false)} gameHistory={gameHistory} />}
      {showReferral && currentUser && <ReferralModal onClose={() => setShowReferral(false)} currentUser={currentUser} onSimulateReferral={onSimulateReferral} />}
      {showAuthFromPicker && <AuthModal initialMode="signup" onClose={() => setShowAuthFromPicker(false)} onAuth={user => { onSignIn(user); setShowAuthFromPicker(false) }} onTokenCredit={n => { onTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowAuthFromPicker(false) }} />}
      {showCustomSurveys && currentUser && <CustomSurveysModal surveys={customSurveys} collections={customCollections} onSaveSurvey={onSaveSurvey} onDeleteSurvey={onDeleteSurvey} onSaveCollection={onSaveCollection} onDeleteCollection={onDeleteCollection} onClose={() => { setShowCustomSurveys(false); onCloseSurveys() }} />}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} currentUser={currentUser} />}
    </div>
  )
}
