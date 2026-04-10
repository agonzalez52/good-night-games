'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import SetupScreen from '@/components/survey-showdown/SetupScreen'
import FaceOffScreen from '@/components/survey-showdown/FaceOffScreen'
import BoardScreen from '@/components/survey-showdown/BoardScreen'
import TokenSVG from '@/components/shared/TokenSVG'
import AuthModal from '@/components/shared/AuthModal'
import TokenPurchaseModal from '@/components/shared/TokenPurchaseModal'
import SpendConfirmModal from '@/components/shared/SpendConfirmModal'
import { ConversionModal } from '@/components/survey-showdown/SetupHeader'
import { createClient } from '@/lib/supabase/client'
import {
  getPacks,
  getPackRounds,
  mergeSurveyPacksForGame,
  type GetPacksResponse,
} from '@/lib/api/survey-showdown/survey-packs'
import { spendTokens } from '@/lib/api/tokens'
import {
  TOKENS_PER_GAME, resolvePackRounds,
  shuffleArray, playCoinCollect,
} from '@/lib/constants'
import type { CurrentUser, CustomSurvey, CustomCollection, GameHistoryRecord, Round } from '@/lib/constants'

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
  const {
    currentUser,
    loading: authLoading,
    updateTokenBalance,
    markEmailVerified,
    signOut,
    setAuthUser,
    patchUser,
  } = useAuth()

  const router = useRouter()
  const searchParams = useSearchParams()
  const recoveryOpened = useRef(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)

  useEffect(() => {
    if (recoveryOpened.current) return
    if (searchParams.get('recovery') !== 'true') return
    recoveryOpened.current = true
    setShowRecoveryModal(true)
    router.replace('/games/survey-showdown', { scroll: false })
  }, [searchParams, router])

  const [screen, setScreen] = useState<'setup' | 'faceoff' | 'board'>('setup')
  const [teams, setTeams] = useState<Team[]>([{ name: 'TEAM 1', score: 0 }, { name: 'TEAM 2', score: 0 }])
  const [numRounds, setNumRounds] = useState(5)
  const [currentRound, setCurrentRound] = useState(0)
  const [timerSecs, setTimerSecs] = useState(5)
  const [controllingTeam, setControllingTeam] = useState(0)
  const [faceOffAnswerIndex, setFaceOffAnswerIndex] = useState<number | null>(null)
  const [shuffledRounds, setShuffledRounds] = useState<ReturnType<typeof resolvePackRounds>>([])
  const [apiKey] = useState('') // Phase 8: remove entirely — judge moves to backend

  // Pack catalog (GET /api/survey-showdown/packs) + cached premium rounds after auth fetch
  const [packs, setPacks] = useState<GetPacksResponse | null>(null)
  const [packsLoading, setPacksLoading] = useState(true)
  const [packsError, setPacksError] = useState<string | null>(null)
  const [premiumRoundsCache, setPremiumRoundsCache] = useState<Record<string, Round[]>>({})
  const [spendConfirmLoading, setSpendConfirmLoading] = useState(false)
  const [spendConfirmError, setSpendConfirmError] = useState<string | null>(null)

  // Pack selection & custom surveys
  const [selectedPackId, setSelectedPackId] = useState('')
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        setPacksLoading(true)
        setPacksError(null)
        const data = await getPacks()
        if (!cancelled) setPacks(data)
      } catch {
        if (!cancelled) setPacksError('Could not load survey packs. Check your connection and try again.')
      } finally {
        if (!cancelled) setPacksLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!packs?.free?.length || selectedPackId) return
    setSelectedPackId(packs.free[0].id)
  }, [packs, selectedPackId])

  const mergedSurveyPacks = useMemo(
    () => mergeSurveyPacksForGame(packs?.free ?? [], packs?.premium ?? [], premiumRoundsCache),
    [packs?.free, packs?.premium, premiumRoundsCache]
  )

  const packRounds = useMemo(
    () => resolvePackRounds(selectedPackId, customSurveys, customCollections, mergedSurveyPacks),
    [selectedPackId, customSurveys, customCollections, mergedSurveyPacks]
  )

  const selectedPremiumMeta = packs?.premium.find(p => p.id === selectedPackId)
  const setupRoundCountCap = selectedPremiumMeta?.round_count ?? 0

  const freePackIds = packs?.free ?? []
  const premiumPackIds = packs?.premium ?? []

  const activeRounds = shuffledRounds.length ? shuffledRounds : packRounds.slice(0, numRounds)

  function handleSignIn(user: CurrentUser) {
    setAuthUser(user)
  }
  async function handleSignOut() {
    await signOut()
    const isBuiltin =
      freePackIds.some(p => p.id === selectedPackId) ||
      premiumPackIds.some(p => p.id === selectedPackId) ||
      selectedPackId === 'random'
    if (!isBuiltin) {
      const fallback = freePackIds[0]?.id ?? ''
      setSelectedPackId(fallback)
    }
  }
  function handleTokensUpdated(newBalance: number) {
    updateTokenBalance(newBalance)
    markEmailVerified()
  }

  // Phase 9: replace with real referral data from GET /api/referrals
  function handleSimulateReferral() {
    patchUser(u => {
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
    const isBuiltIn =
      freePackIds.some(p => p.id === selectedPackId) ||
      premiumPackIds.some(p => p.id === selectedPackId) ||
      selectedPackId === 'random'
    if (isBuiltIn) return
    const hasOwnContent =
      selectedPackId === 'custom_all'
        ? customSurveys.length > 0
        : customCollections.some(c => c.id === selectedPackId) && customSurveys.some(s => s.collectionId === selectedPackId)
    if (!hasOwnContent) setSelectedPackId(freePackIds[0]?.id ?? '')
  }

  function handlePurchase(_tokensAdded: number, newBalance: number) {
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
      updateTokenBalance(newBalance)
      setFlyingCoins([])
    }, lastCoinLands)
  }

  // Game lifecycle
  async function commitGame(t1: string, t2: string, secs: number, nr: number, usedTokens: boolean) {
    if (!packs) return
    if (usedTokens) {
      setSpendConfirmError(null)
      setSpendConfirmLoading(true)
    }
    try {
      let cache = { ...premiumRoundsCache }
      const needsPremiumFetch =
        (selectedPackId === 'random' && packs.premium.some(p => !cache[p.id]?.length)) ||
        (packs.premium.some(p => p.id === selectedPackId) && !cache[selectedPackId]?.length)

      if (needsPremiumFetch) {
        const { data: { session } } = await createClient().auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (usedTokens) setSpendConfirmError('Sign in required to load this pack.')
          return
        }
        if (selectedPackId === 'random') {
          for (const p of packs.premium) {
            if (cache[p.id]?.length) continue
            const { rounds } = await getPackRounds(p.id, token)
            cache[p.id] = rounds
          }
        } else if (packs.premium.some(p => p.id === selectedPackId) && !cache[selectedPackId]?.length) {
          const { rounds } = await getPackRounds(selectedPackId, token)
          cache = { ...cache, [selectedPackId]: rounds }
        }
        setPremiumRoundsCache(cache)
      }

      const merged = mergeSurveyPacksForGame(packs.free, packs.premium, cache)
      const fullRounds = resolvePackRounds(selectedPackId, customSurveys, customCollections, merged)
      if (!fullRounds.length) {
        if (usedTokens) setSpendConfirmError('No questions available for this pack.')
        return
      }

      if (usedTokens) {
        const { data: { session } } = await createClient().auth.getSession()
        const accessToken = session?.access_token
        if (!accessToken) {
          setSpendConfirmError('Sign in required to spend tokens.')
          return
        }
        try {
          const spendResult = await spendTokens(accessToken, TOKENS_PER_GAME) as { balance: number }
          handleTokensUpdated(spendResult.balance)
        } catch {
          setSpendConfirmError('Could not spend tokens. Check your balance and try again.')
          return
        }
      }
      if (!usedTokens && !currentUser) { setFreeGamesPlayed(n => n + 1) }
      setIsTokenGame(!!usedTokens)
      setTeams([{ name: t1, score: 0 }, { name: t2, score: 0 }])
      setTimerSecs(secs); setNumRounds(nr); setCurrentRound(0)
      setShuffledRounds(shuffleArray(fullRounds).slice(0, nr))
      setScreen('faceoff')
      setPendingGame(null)
    } catch {
      if (usedTokens) setSpendConfirmError('Could not load pack questions. Try again.')
    } finally {
      if (usedTokens) setSpendConfirmLoading(false)
    }
  }

  function startGame(t1: string, t2: string, secs: number, nr: number) {
    const isFreePack = freePackIds.some(p => p.id === selectedPackId)
    if (!currentUser) {
      if (isFreePack) { void commitGame(t1, t2, secs, nr, false); return }
      setConversionReason('premium'); setShowConversionModal(true); return
    }
    if (isFreePack) { void commitGame(t1, t2, secs, nr, false); return }
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
    const fp = freePackIds.find(p => p.id === id); if (fp) return fp.name
    const pp = premiumPackIds.find(p => p.id === id); if (pp) return pp.name
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
          setupRoundCountCap={setupRoundCountCap}
          packsLoading={packsLoading}
          packsError={packsError}
          catalogFree={freePackIds}
          catalogPremium={premiumPackIds}
          authLoading={authLoading}
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
      {showRecoveryModal && (
        <AuthModal
          initialMode="reset-password"
          onClose={() => setShowRecoveryModal(false)}
          onAuth={user => { handleSignIn(user); setShowRecoveryModal(false) }}
          onTokenCredit={n => { handleTokensUpdated((currentUser?.tokenBalance || 0) + n); setShowRecoveryModal(false) }}
        />
      )}
      {showPurchaseModal && (
        <TokenPurchaseModal currentBalance={currentUser?.tokenBalance || 0} onClose={() => setShowPurchaseModal(false)} onPurchase={handlePurchase} />
      )}
      {pendingGame && (
        <SpendConfirmModal
          balance={currentUser?.tokenBalance || 0}
          onConfirm={() => commitGame(pendingGame.t1, pendingGame.t2, pendingGame.secs, pendingGame.nr, true)}
          onCancel={() => { setSpendConfirmError(null); setPendingGame(null) }}
          onBuyMore={() => { setSpendConfirmError(null); setPendingGame(null); setShowPurchaseModal(true) }}
          confirmLoading={spendConfirmLoading}
          errorMessage={spendConfirmError}
        />
      )}
    </>
  )
}
