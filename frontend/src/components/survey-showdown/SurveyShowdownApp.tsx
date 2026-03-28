'use client'

import { useState } from 'react'
import SetupScreen from '@/components/survey-showdown/SetupScreen'
import FaceOffScreen from '@/components/survey-showdown/FaceOffScreen'
import BoardScreen from '@/components/survey-showdown/BoardScreen'
import TokenSVG from '@/components/shared/TokenSVG'
import AuthModal from '@/components/shared/AuthModal'
import TokenPurchaseModal from '@/components/shared/TokenPurchaseModal'
import SpendConfirmModal from '@/components/shared/SpendConfirmModal'
import { ConversionModal } from '@/components/survey-showdown/SetupHeader'
import {
  FREE_PACKS, PREMIUM_PACKS, TOKENS_PER_GAME,
  resolvePackRounds, shuffleArray, playCoinCollect,
} from '@/lib/constants'
import type { CurrentUser, CustomSurvey, CustomCollection, GameHistoryRecord } from '@/lib/constants'

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
// This is injected inline for the single-file phase. In Phase 6 this moves to
// src/app/globals.css (already done separately in the Next.js scaffold).
// Keep this here only until the Next.js project is running and globals.css is active.
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Russo+One&family=DM+Sans:ital,wght@0,400;0,500;0,600&family=Bebas+Neue&display=swap');
  :root {
    --bg:#060914; --surface:rgba(255,255,255,0.035); --surface-2:rgba(255,255,255,0.06);
    --border:rgba(255,255,255,0.075); --border-2:rgba(255,255,255,0.13);
    --blue:#4D7EFF; --blue-dim:rgba(77,126,255,0.18); --blue-glow:rgba(77,126,255,0.35);
    --gold:#F0A500; --gold-mid:#C07A00; --gold-dim:rgba(240,165,0,0.14); --gold-glow:rgba(240,165,0,0.35);
    --green:#0FD98A; --green-dim:rgba(15,217,138,0.14); --green-glow:rgba(15,217,138,0.3);
    --red:#FF4D6A; --red-dim:rgba(255,77,106,0.14); --red-glow:rgba(255,77,106,0.3);
    --purple:#9B6DFF; --text:#EEF2FF; --text-muted:#A0B4CC; --text-faint:#6677AA;
    --font-display:'Russo One',sans-serif; --font-score:'Bebas Neue',sans-serif; --font-body:'DM Sans',sans-serif;
    --radius-sm:8px; --radius:14px; --radius-lg:20px;
  }
  @keyframes xPop{0%{transform:scale(0) rotate(-15deg);opacity:0}60%{transform:scale(1.18) rotate(3deg)}100%{transform:scale(1) rotate(0);opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
  @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes glow{0%,100%{text-shadow:0 4px 0 rgba(0,0,0,0.4),0 0 60px rgba(240,165,0,0.45),0 0 120px rgba(240,165,0,0.2)}50%{text-shadow:0 4px 0 rgba(0,0,0,0.4),0 0 80px rgba(240,165,0,0.7),0 0 160px rgba(240,165,0,0.35),0 0 240px rgba(240,165,0,0.12)}}
  @keyframes blueGlow{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 32px var(--blue-glow)}}
  @keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
  @keyframes menuSlide{from{transform:translateY(-8px) scale(0.97);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
  @keyframes tileReveal{0%{transform:scaleY(0) translateY(-4px);opacity:0}100%{transform:scaleY(1) translateY(0);opacity:1}}
  @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
  @keyframes scoreUp{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
  @keyframes borderPulse{0%,100%{border-color:rgba(77,126,255,0.2)}50%{border-color:rgba(77,126,255,0.7)}}
  @keyframes staggerIn{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes logoIn{from{transform:scale(0.88) translateY(-12px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  *{box-sizing:border-box;margin:0;padding:0;}
  input,textarea{outline:none;font-family:var(--font-body);}
  input::placeholder{color:var(--text-faint);opacity:1;}
  button{font-family:var(--font-display);transition:filter 0.15s ease,transform 0.12s ease,box-shadow 0.15s ease;cursor:pointer;position:relative;overflow:hidden;}
  button:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px);}
  button:active:not(:disabled){filter:brightness(0.92);transform:scale(0.97) translateY(0px);}
  button:disabled{opacity:0.38;cursor:default;transform:none!important;}
  @keyframes redPulse{0%,100%{box-shadow:0 0 10px rgba(255,77,106,0.3),0 0 24px rgba(255,77,106,0.12)}50%{box-shadow:0 0 16px rgba(255,77,106,0.55),0 0 40px rgba(255,77,106,0.22)}}
  @keyframes greenPulse{0%,100%{box-shadow:0 0 10px rgba(15,217,138,0.2),0 0 24px rgba(15,217,138,0.08)}50%{box-shadow:0 0 16px rgba(15,217,138,0.4),0 0 40px rgba(15,217,138,0.16)}}
  @keyframes coinFly{0%{transform:translate(0,0) scale(1.1);opacity:1}80%{opacity:1}100%{transform:translate(var(--coin-dx),var(--coin-dy)) scale(0.25);opacity:0}}
  @keyframes tokenPop{0%{transform:scale(1)}30%{transform:scale(1.35)}70%{transform:scale(0.95)}100%{transform:scale(1)}}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(77,126,255,0.25);border-radius:4px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(77,126,255,0.45)}
`

interface FlyingCoin {
  id: number
  startX: number
  startY: number
  dx: number
  dy: number
  delay: number
}

interface Team { name: string; score: number }

export default function SurveyShowdownApp() {
  const [screen, setScreen] = useState<'setup' | 'faceoff' | 'board'>('setup')
  const [teams, setTeams] = useState<Team[]>([{ name: 'TEAM 1', score: 0 }, { name: 'TEAM 2', score: 0 }])
  const [numRounds, setNumRounds] = useState(5)
  const [currentRound, setCurrentRound] = useState(0)
  const [timerSecs, setTimerSecs] = useState(5)
  const [controllingTeam, setControllingTeam] = useState(0)
  const [faceOffAnswerIndex, setFaceOffAnswerIndex] = useState<number | null>(null)
  const [shuffledRounds, setShuffledRounds] = useState<ReturnType<typeof resolvePackRounds>>([])
  const [apiKey] = useState('') // Phase 8: remove entirely — judge moves to backend
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  // Pack selection & custom surveys
  const [selectedPackId, setSelectedPackId] = useState('free_classic')
  const [customSurveys, setCustomSurveys] = useState<CustomSurvey[]>([])
  const [customCollections, setCustomCollections] = useState<CustomCollection[]>([])
  const [isTokenGame, setIsTokenGame] = useState(false)
  const [gameHistory, setGameHistory] = useState<GameHistoryRecord[]>([])

  // Token purchase & conversion flow
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [pendingGame, setPendingGame] = useState<{ t1: string; t2: string; secs: number; nr: number } | null>(null)
  const [flyingCoins, setFlyingCoins] = useState<FlyingCoin[]>([])
  const [showConversionModal, setShowConversionModal] = useState(false)
  const [conversionReason, setConversionReason] = useState<'premium' | 'postgame'>('premium')
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [showSignInGate, setShowSignInGate] = useState(false)
  const [freeGamesPlayed, setFreeGamesPlayed] = useState(0)

  // Derived
  const packRounds = resolvePackRounds(selectedPackId, customSurveys, customCollections)
  const activeRounds = shuffledRounds.length ? shuffledRounds : packRounds.slice(0, numRounds)

  function handleSignIn(user: CurrentUser) { setCurrentUser(user) }
  function handleSignOut() {
    setCurrentUser(null)
    const isCustom = !FREE_PACKS.some(p => p.id === selectedPackId) && !PREMIUM_PACKS.some(p => p.id === selectedPackId) && selectedPackId !== 'random'
    if (isCustom) setSelectedPackId('free_classic')
  }
  function handleTokensUpdated(newBalance: number) { setCurrentUser(u => u ? { ...u, tokenBalance: newBalance, emailVerified: true } : u) }

  // Phase 9: replace with real referral data from GET /api/referrals
  function handleSimulateReferral() {
    setCurrentUser(u => {
      if (!u) return u
      const current = u.referralsClaimed || 0
      if (current >= 3) return u
      return { ...u, referralsClaimed: current + 1, tokenBalance: (u.tokenBalance || 0) + 2 }
    })
  }

  // Custom survey handlers — Phase 9: each maps to an API call
  function handleSaveSurvey(survey: CustomSurvey) {
    setCustomSurveys(prev => {
      const exists = prev.find(s => s.id === survey.id)
      return exists ? prev.map(s => s.id === survey.id ? survey : s) : [...prev, survey]
    })
  }
  function handleDeleteSurvey(id: string) { setCustomSurveys(prev => prev.filter(s => s.id !== id)) }
  function handleSaveCollection(coll: CustomCollection) {
    setCustomCollections(prev => {
      const exists = prev.find(c => c.id === coll.id)
      return exists ? prev.map(c => c.id === coll.id ? coll : c) : [...prev, coll]
    })
  }
  function handleDeleteCollection(id: string) {
    setCustomCollections(prev => prev.filter(c => c.id !== id))
    setCustomSurveys(prev => prev.map(s => s.collectionId === id ? { ...s, collectionId: null } : s))
  }

  function handleSurveysModalClose() {
    const isBuiltIn = FREE_PACKS.some(p => p.id === selectedPackId) || PREMIUM_PACKS.some(p => p.id === selectedPackId) || selectedPackId === 'random'
    if (isBuiltIn) return
    const hasOwnContent =
      selectedPackId === 'custom_all'
        ? customSurveys.length > 0
        : customCollections.some(c => c.id === selectedPackId) && customSurveys.some(s => s.collectionId === selectedPackId)
    if (!hasOwnContent) setSelectedPackId('free_classic')
  }

  // Token purchase — Phase 7: replace mock setTimeout with Stripe PaymentIntent flow
  function handlePurchase(tokenAmount: number) {
    setShowPurchaseModal(false)
    const pillEl = document.querySelector('[data-token-pill]')
    const pillRect = pillEl?.getBoundingClientRect()
    const targetX = pillRect ? pillRect.left + pillRect.width / 2 : 60
    const targetY = pillRect ? pillRect.top + pillRect.height / 2 : 28
    const originX = window.innerWidth / 2
    const originY = window.innerHeight / 2
    const COIN_COUNT = 8, COIN_DURATION = 580, STAGGER = 70
    const coins: FlyingCoin[] = Array.from({ length: COIN_COUNT }, (_, i) => ({
      id: Date.now() + i,
      startX: originX + (Math.random() - 0.5) * 80,
      startY: originY + (Math.random() - 0.5) * 50,
      dx: targetX - (originX + (Math.random() - 0.5) * 80),
      dy: targetY - (originY + (Math.random() - 0.5) * 50),
      delay: i * STAGGER,
    }))
    setFlyingCoins(coins)
    playCoinCollect(COIN_COUNT)
    const lastCoinLands = COIN_DURATION + (COIN_COUNT - 1) * STAGGER + 80
    setTimeout(() => {
      setCurrentUser(u => u ? { ...u, tokenBalance: (u.tokenBalance || 0) + tokenAmount } : u)
      setFlyingCoins([])
    }, lastCoinLands)
  }

  // Game lifecycle
  // Phase 7: call POST /api/tokens/spend { amount: TOKENS_PER_GAME } before setScreen('faceoff')
  function commitGame(t1: string, t2: string, secs: number, nr: number, usedTokens: boolean) {
    if (usedTokens) {
      setCurrentUser(u => u ? { ...u, tokenBalance: Math.max(0, (u.tokenBalance || 0) - TOKENS_PER_GAME) } : u)
    }
    if (!usedTokens && !currentUser) { setFreeGamesPlayed(n => n + 1) }
    setIsTokenGame(!!usedTokens)
    setTeams([{ name: t1, score: 0 }, { name: t2, score: 0 }])
    setTimerSecs(secs); setNumRounds(nr); setCurrentRound(0)
    setShuffledRounds(shuffleArray(packRounds).slice(0, nr))
    setScreen('faceoff')
    setPendingGame(null)
  }

  function startGame(t1: string, t2: string, secs: number, nr: number) {
    const isFreePack = FREE_PACKS.some(p => p.id === selectedPackId)
    if (!currentUser) {
      if (isFreePack) { commitGame(t1, t2, secs, nr, false); return }
      setConversionReason('premium'); setShowConversionModal(true); return
    }
    if (isFreePack) { commitGame(t1, t2, secs, nr, false); return }
    setPendingGame({ t1, t2, secs, nr })
  }

  function handleFaceOffWin(teamIndex: number, answerIndex: number | null) {
    setControllingTeam(teamIndex); setFaceOffAnswerIndex(answerIndex); setScreen('board')
  }

  function handleRoundEnd(winnerTeam: number, points: number) {
    setTeams(t => t.map((team, i) => i === winnerTeam ? { ...team, score: team.score + points } : team))
  }

  function handleNextRound() { setCurrentRound(r => r + 1); setScreen('faceoff') }

  function handleSkipQuestion() {
    const usedInOtherRounds = new Set(shuffledRounds.slice(0, currentRound).map(r => r.question))
    const pool = packRounds.filter(r => !usedInOtherRounds.has(r.question))
    if (pool.length <= 1) return
    const currentQuestion = shuffledRounds[currentRound]?.question
    const currentIdx = pool.findIndex(r => r.question === currentQuestion)
    const nextIdx = (currentIdx + 1) % pool.length
    setShuffledRounds(prev => prev.map((r, i) => i === currentRound ? pool[nextIdx] : r))
  }

  function getPackName(id: string) {
    if (id === 'random') return 'Random Mix'
    if (id === 'custom_all') return 'All Custom'
    const fp = FREE_PACKS.find(p => p.id === id); if (fp) return fp.name
    const pp = PREMIUM_PACKS.find(p => p.id === id); if (pp) return pp.name
    const coll = customCollections.find(c => c.id === id); if (coll) return coll.name
    return 'Custom'
  }

  // Phase 9: also call POST /api/survey-showdown/history with game_id: "survey_showdown" here
  function handleNewGame(finalTeams?: Team[]) {
    if (finalTeams) {
      const winner =
        finalTeams[0].score > finalTeams[1].score ? finalTeams[0].name :
        finalTeams[1].score > finalTeams[0].score ? finalTeams[1].name : 'Tie'
      const record: GameHistoryRecord = {
        id: Date.now(),
        timestamp: new Date(),
        team1: finalTeams[0].name, team2: finalTeams[1].name,
        rounds: numRounds, pack: getPackName(selectedPackId),
        winner, score1: finalTeams[0].score, score2: finalTeams[1].score,
      }
      setGameHistory(prev => [record, ...prev].slice(0, 50))
    }
    setScreen('setup')
    if (!currentUser && freeGamesPlayed === 1) {
      setConversionReason('postgame'); setShowConversionModal(true)
    }
  }

  const menuProps = { timerSecs, onTimerChange: setTimerSecs, onNewGame: () => setScreen('setup') }

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen
          onStart={startGame} packRounds={packRounds}
          currentUser={currentUser} onSignIn={handleSignIn} onSignOut={handleSignOut}
          onTokensUpdated={handleTokensUpdated} onOpenPurchaseModal={() => setShowPurchaseModal(true)}
          selectedPackId={selectedPackId} onSelectPack={setSelectedPackId}
          customSurveys={customSurveys} customCollections={customCollections}
          onSaveSurvey={handleSaveSurvey} onDeleteSurvey={handleDeleteSurvey}
          onSaveCollection={handleSaveCollection} onDeleteCollection={handleDeleteCollection}
          onCloseSurveys={handleSurveysModalClose}
          onSimulateReferral={handleSimulateReferral}
          gameHistory={gameHistory}
        />
      )}
      {screen === 'faceoff' && activeRounds[currentRound] && (
        <FaceOffScreen
          round={activeRounds[currentRound]} teams={teams}
          onWinFaceOff={handleFaceOffWin}
          roundNumber={currentRound + 1} totalRounds={numRounds}
          timerSecs={timerSecs} menuProps={menuProps}
          apiKey={apiKey} onSkip={handleSkipQuestion}
        />
      )}
      {screen === 'board' && activeRounds[currentRound] && (
        <BoardScreen
          round={activeRounds[currentRound]} teams={teams}
          controllingTeam={controllingTeam} faceOffAnswerIndex={faceOffAnswerIndex}
          onRoundEnd={handleRoundEnd}
          roundNumber={currentRound + 1} totalRounds={numRounds} numRounds={numRounds}
          menuProps={menuProps} onNextRound={handleNextRound}
          onNewGame={handleNewGame} apiKey={apiKey} isTokenGame={isTokenGame}
        />
      )}

      {/* Coin flight animation */}
      {flyingCoins.map(coin => (
        <div key={coin.id} style={{
          position: 'fixed', left: coin.startX, top: coin.startY,
          pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%,-50%)',
          animation: `coinFly 580ms cubic-bezier(0.4,0,0.2,1) ${coin.delay}ms both`,
          ['--coin-dx' as string]: `${coin.dx}px`,
          ['--coin-dy' as string]: `${coin.dy}px`,
        }}><TokenSVG size={20} /></div>
      ))}

      {showConversionModal && (
        <ConversionModal
          reason={conversionReason}
          onClose={() => setShowConversionModal(false)}
          onSignUp={() => { setShowConversionModal(false); setShowAuthGate(true) }}
          onSignIn={() => { setShowConversionModal(false); setShowSignInGate(true) }}
        />
      )}
      {showAuthGate && (
        <AuthModal initialMode="signup" onClose={() => setShowAuthGate(false)} onAuth={user => { handleSignIn(user); setShowAuthGate(false) }} onTokenCredit={n => { handleTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowAuthGate(false) }} />
      )}
      {showSignInGate && (
        <AuthModal initialMode="signin" onClose={() => setShowSignInGate(false)} onAuth={user => { handleSignIn(user); setShowSignInGate(false) }} onTokenCredit={n => { handleTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowSignInGate(false) }} />
      )}
      {showPurchaseModal && (
        <TokenPurchaseModal currentBalance={currentUser?.tokenBalance || 0} onClose={() => setShowPurchaseModal(false)} onPurchase={handlePurchase} />
      )}
      {pendingGame && (
        <SpendConfirmModal
          balance={currentUser?.tokenBalance || 0}
          onConfirm={() => commitGame(pendingGame.t1, pendingGame.t2, pendingGame.secs, pendingGame.nr, true)}
          onCancel={() => setPendingGame(null)}
          onBuyMore={() => { setPendingGame(null); setShowPurchaseModal(true) }}
        />
      )}
    </>
  )
}
