'use client'

import { useState, useEffect, useRef } from 'react'
import SetupHeader, {
  VerificationBanner,
  SurveyPackPicker,
  SurveyPackDropdown,
  HowToPlayModal,
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

const TIMER_SEC_MIN = 3
const TIMER_SEC_MAX = 120

const clampTimer = (n: number) => Math.max(TIMER_SEC_MIN, Math.min(TIMER_SEC_MAX, n))

/** Empty or invalid `raw` uses `fallback`, then result is clamped to 3–120. */
const parseTimerSeconds = (raw: string, fallback: number): number => {
  const trimmed = raw.trim()
  if (trimmed === '') return clampTimer(fallback)
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed)) return clampTimer(fallback)
  return clampTimer(parsed)
}

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
  onMoveSurveyToCollection: (surveyId: string, targetCollectionId: string | null) => void
  onSaveCollection: (collection: CustomCollection) => void
  onDeleteCollection: (id: string) => void
  onCloseSurveys: () => void
  gameHistory: GameHistoryRecord[]
}

export default function SetupScreen({
  onStart, packQuestions, setupRoundCountCap, packsLoading, packsError, catalogFree, catalogPremium,
  authLoading = false, currentUser, onSignIn, onSignOut, onTokensUpdated,
  onOpenPurchaseModal, selectedPackId, onSelectPack,
  customSurveys, customCollections, onSaveSurvey, onDeleteSurvey, onMoveSurveyToCollection,
  onSaveCollection, onDeleteCollection, onCloseSurveys,
  gameHistory,
}: SetupScreenProps) {
  const [team1, setTeam1] = useState('TEAM 1')
  const [team2, setTeam2] = useState('TEAM 2')
  const [timerSecs, setTimerSecs] = useState(5)
  const [timerCustomInput, setTimerCustomInput] = useState('5')
  const [numRounds, setNumRounds] = useState(DEFAULT_SETUP_ROUNDS)
  const [showCustomSurveys, setShowCustomSurveys] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAuthFromPicker, setShowAuthFromPicker] = useState(false)
  const [showAiJudgingInfo, setShowAiJudgingInfo] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 320 })
  const pickerTriggerRef = useRef<HTMLButtonElement>(null)
  const dropdownPanelRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const timerOptions = [3, 5, 10]
  const maxRounds = Math.max(packQuestions.length, setupRoundCountCap, 1)
  const clampedNumRounds = Math.min(numRounds, maxRounds)

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
  const isAuthenticated = Boolean(currentUser)
  const aiJudgingPending = authLoading && !currentUser

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
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, verticalAlign: 'top' }}>
            {['SURVEY', 'SHOWDOWN'].map(word => (
              <div
                key={word}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 'clamp(44px,8vw,88px)',
                  color: 'var(--gold)',
                  letterSpacing: '-0.01em',
                  lineHeight: 0.92,
                  animation: 'glow 3.5s ease-in-out infinite',
                  textShadow: '0 4px 0 rgba(0,0,0,0.4), 0 0 60px rgba(240,165,0,0.45), 0 0 120px rgba(240,165,0,0.2)',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '58%',
                    transform: 'translate(-50%, -50%)',
                    width: '125%',
                    height: '0.7em',
                    borderRadius: 14,
                    border: '5px solid var(--gold)',
                    background: 'transparent',
                    boxSizing: 'border-box',
                    opacity: 0.85,
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
                <span style={{ position: 'relative', zIndex: 1 }}>{word}</span>
              </div>
            ))}
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
                    <button type="button" onClick={() => setNumRounds(r => Math.max(1, Math.min(r, maxRounds) - 1))} style={{ width: 32, height: 32, borderRadius: 9, fontSize: 18, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <div style={{ fontFamily: 'var(--font-score)', fontSize: 44, color: '#F0A500', minWidth: 40, textAlign: 'center', lineHeight: 1, textShadow: '0 0 20px rgba(240,165,0,0.3)' }}>{clampedNumRounds}</div>
                    <button type="button" onClick={() => setNumRounds(r => Math.min(maxRounds, Math.min(r, maxRounds) + 1))} style={{ width: 32, height: 32, borderRadius: 9, fontSize: 18, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: 'var(--font-body)', marginTop: 5 }}>{maxRounds} available</div>
                </>
              )}
            </div>

            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>⏱ Face-Off Timer</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {timerOptions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setTimerSecs(s)
                      setTimerCustomInput(String(s))
                    }}
                    style={{ flex: 1, height: 38, borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-score)', letterSpacing: '0.04em', background: timerSecs === s ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.04)', color: timerSecs === s ? '#fff' : 'var(--text-muted)', border: timerSecs === s ? '1px solid rgba(240,165,0,0.6)' : '1px solid rgba(255,255,255,0.07)', boxShadow: timerSecs === s ? '0 2px 14px rgba(240,165,0,0.3)' : 'none' }}
                  >
                    {s}s
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 11, flexShrink: 0 }}>Custom:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={timerCustomInput}
                  onChange={e => setTimerCustomInput(e.target.value)}
                  onBlur={() => {
                    const result = parseTimerSeconds(timerCustomInput, 5)
                    setTimerSecs(result)
                    setTimerCustomInput(String(result))
                  }}
                  style={{ width: 52, padding: '5px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-score)', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#F0A500' }}
                />
                <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-body)' }}>sec</span>
              </div>
            </div>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}
            aria-busy={aiJudgingPending}
          >
            {aiJudgingPending ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }} aria-hidden>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite', flexShrink: 0 }} />
                <div style={{ width: 170, height: 12, borderRadius: 6, background: 'var(--surface)', animation: 'shimmer 1.2s ease-in-out infinite' }} />
              </div>
            ) : (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isAuthenticated ? 'var(--green)' : 'var(--red)',
                    boxShadow: isAuthenticated ? '0 0 10px var(--green-glow)' : '0 0 10px var(--red-glow)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {isAuthenticated ? 'AI Judging Enabled' : 'AI Judging Disabled'}
                </span>
                {!isAuthenticated && (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      type="button"
                      aria-label="How to enable AI judging"
                      onMouseEnter={() => setShowAiJudgingInfo(true)}
                      onMouseLeave={() => setShowAiJudgingInfo(false)}
                      onFocus={() => setShowAiJudgingInfo(true)}
                      onBlur={() => setShowAiJudgingInfo(false)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: '1px solid var(--border-2)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 12,
                        lineHeight: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'help',
                        padding: 0,
                      }}
                    >
                      i
                    </button>
                    {showAiJudgingInfo && (
                      <div
                        role="tooltip"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          width: 260,
                          padding: '10px 11px',
                          borderRadius: 10,
                          border: '1px solid var(--border-2)',
                          background: 'rgba(6,9,20,0.98)',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 11,
                          lineHeight: 1.4,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                          zIndex: 20,
                        }}
                      >
                        Only exact matching will be used. Sign up or sign in to enable AI judging.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Start Game */}
          <button
            onClick={() => {
              const secs = parseTimerSeconds(timerCustomInput, timerSecs)
              setTimerSecs(secs)
              setTimerCustomInput(String(secs))
              onStart(team1 || 'TEAM 1', team2 || 'TEAM 2', secs, clampedNumRounds)
            }}
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
          <AdBanner placement="setup" style={{ minHeight: 80 }} />
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
      {showReferral && currentUser && <ReferralModal onClose={() => setShowReferral(false)} currentUser={currentUser} />}
      {showAuthFromPicker && <AuthModal initialMode="signup" onClose={() => setShowAuthFromPicker(false)} onAuth={user => { onSignIn(user); setShowAuthFromPicker(false) }} onTokenCredit={n => { onTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowAuthFromPicker(false) }} />}
      {showCustomSurveys && currentUser && <CustomSurveysModal surveys={customSurveys} collections={customCollections} onSaveSurvey={onSaveSurvey} onDeleteSurvey={onDeleteSurvey} onMoveSurveyToCollection={onMoveSurveyToCollection} onSaveCollection={onSaveCollection} onDeleteCollection={onDeleteCollection} onClose={() => { setShowCustomSurveys(false); onCloseSurveys() }} />}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} currentUser={currentUser} />}
    </div>
  )
}
