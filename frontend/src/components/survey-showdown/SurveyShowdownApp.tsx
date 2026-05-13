'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  getPackQuestions,
  mergeSurveyPacksForGame,
  type GetPacksResponse,
} from '@/lib/api/survey-showdown/survey-packs'
import { getGameHistory, saveGameHistory } from '@/lib/api/survey-showdown/history'
import { spendTokens } from '@/lib/api/tokens'
import {
  createCustomCollection,
  createCustomSurvey,
  deleteCustomCollection,
  deleteCustomSurvey,
  getCustomSurveys,
  patchCustomSurveyCollection,
  updateCustomCollection,
  updateCustomSurvey,
  type UpsertCustomSurveyInput,
} from '@/lib/api/survey-showdown/custom-surveys'
import {
  TOKENS_PER_GAME, resolvePackQuestions,
  shuffleArray, playCoinCollect,
  reconcileSurveyRoundQuestions,
} from '@/lib/constants'
import type { CurrentUser, CustomSurvey, CustomCollection, GameHistoryRecord, SurveyQuestion } from '@/lib/constants'

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
    router.replace('/survey-showdown', { scroll: false })
  }, [searchParams, router])

  const [screen, setScreen] = useState<'setup' | 'faceoff' | 'board'>('setup')
  const [teams, setTeams] = useState<Team[]>([{ name: 'TEAM 1', score: 0 }, { name: 'TEAM 2', score: 0 }])
  const [numRounds, setNumRounds] = useState(5)
  const [currentRound, setCurrentRound] = useState(0)
  const [timerSecs, setTimerSecs] = useState(5)
  const [controllingTeam, setControllingTeam] = useState(0)
  const [faceOffAnswerIndex, setFaceOffAnswerIndex] = useState<number | null>(null)
  const [shuffledQuestions, setShuffledQuestions] = useState<SurveyQuestion[]>([])
  const getSessionAccessToken = useCallback(async () => {
    const { data: { session } } = await createClient().auth.getSession()
    return session?.access_token ?? null
  }, [])
  const getJudgeAccessToken = useCallback(
    async () => getSessionAccessToken(),
    [getSessionAccessToken]
  )

  // Pack catalog (GET /api/survey-showdown/packs) + cached premium questions after auth fetch
  const [packs, setPacks] = useState<GetPacksResponse | null>(null)
  const [packsLoading, setPacksLoading] = useState(true)
  const [packsError, setPacksError] = useState<string | null>(null)
  const [premiumQuestionsCache, setPremiumQuestionsCache] = useState<Record<string, SurveyQuestion[]>>({})
  const [spendConfirmLoading, setSpendConfirmLoading] = useState(false)
  const [spendConfirmError, setSpendConfirmError] = useState<string | null>(null)

  // Pack selection & custom surveys
  const [selectedPackId, setSelectedPackId] = useState('')
  const [customSurveys, setCustomSurveys] = useState<CustomSurvey[]>([])
  const customSurveysRef = useRef<CustomSurvey[]>([])
  useEffect(() => {
    customSurveysRef.current = customSurveys
  }, [customSurveys])
  const [customCollections, setCustomCollections] = useState<CustomCollection[]>([])
  const [gameHistory, setGameHistory] = useState<GameHistoryRecord[]>([])
  const showPlaythroughAds = !authLoading && !currentUser

  // When a user signs in, server history replaces the in-memory list. Guest-only rows are not uploaded.
  useEffect(() => {
    if (authLoading || !currentUser) return
    let cancelled = false
    void (async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const token = session?.access_token
        if (!token || cancelled) return
        const records = await getGameHistory(token)
        if (!cancelled) setGameHistory(records)
      } catch {
        if (!cancelled) console.error('Failed to load game history')
        // On failure, keep previous in-memory state to avoid clearing guest history or flicker.
      }
    })()
    return () => { cancelled = true }
  }, [currentUser, authLoading])

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

  useEffect(() => {
    if (authLoading) return
    if (!currentUser) {
      setCustomSurveys([])
      setCustomCollections([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const token = await getSessionAccessToken()
        if (!token || cancelled) return
        const data = await getCustomSurveys(token)
        if (cancelled) return
        setCustomSurveys(data.surveys)
        setCustomCollections(data.collections)
      } catch (error) {
        if (!cancelled) console.error('Failed to load custom surveys', error)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, currentUser, getSessionAccessToken])

  const mergedSurveyPacks = useMemo(
    () => mergeSurveyPacksForGame(packs?.free ?? [], packs?.premium ?? [], premiumQuestionsCache),
    [packs?.free, packs?.premium, premiumQuestionsCache]
  )

  const packQuestions = useMemo(
    () => resolvePackQuestions(selectedPackId, customSurveys, customCollections, mergedSurveyPacks),
    [selectedPackId, customSurveys, customCollections, mergedSurveyPacks]
  )

  const selectedPremiumMeta = packs?.premium.find(p => p.id === selectedPackId)
  const setupRoundCountCap = selectedPremiumMeta?.question_count ?? 0

  const freePackIds = packs?.free ?? []
  const premiumPackIds = packs?.premium ?? []

  const activeQuestions = shuffledQuestions.length ? shuffledQuestions : packQuestions.slice(0, numRounds)

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

  function toUpsertSurveyPayload(survey: CustomSurvey): UpsertCustomSurveyInput {
    return {
      name: survey.name,
      collectionId: survey.collectionId,
      question: survey.question,
      answers: survey.answers.map((answer) => ({
        answer: answer.answer,
        points: answer.points,
      })),
    }
  }

  async function handleSaveSurvey(survey: CustomSurvey) {
    const token = await getSessionAccessToken()
    if (!token) {
      console.error('Sign in required to save custom surveys.')
      return
    }
    let snapshot: CustomSurvey[] = []
    let isExisting = false
    setCustomSurveys((prev) => {
      snapshot = [...prev]
      isExisting = prev.some((existing) => existing.id === survey.id)
      if (isExisting) {
        return prev.map((existing) => (existing.id === survey.id ? survey : existing))
      }
      return [...prev, survey]
    })
    try {
      const payload = toUpsertSurveyPayload(survey)
      const savedSurvey = isExisting
        ? await updateCustomSurvey(token, survey.id, payload)
        : await createCustomSurvey(token, payload)
      setCustomSurveys((prev) => {
        const didExist = prev.some(
          (existing) => existing.id === survey.id || existing.id === savedSurvey.id
        )
        if (!didExist) return [...prev, savedSurvey]
        return prev.map((existing) => (
          existing.id === survey.id || existing.id === savedSurvey.id ? savedSurvey : existing
        ))
      })
    } catch (error) {
      console.error('Failed to save custom survey', error)
      setCustomSurveys(() => snapshot)
    }
  }

  async function handleMoveSurveyToCollection(surveyId: string, targetCollectionId: string | null) {
    // Sync read before / after async token: awaiting would otherwise let another update commit, so
    // the setState(optimistic) "no-op" branch can wrongly skip with a side-effect (shouldPatch) on
    // a stale `prev` every other time when moves interleave.
    const s0 = customSurveysRef.current.find((x) => x.id === surveyId)
    if (!s0) return
    if ((s0.collectionId ?? null) === (targetCollectionId ?? null)) return
    const snapshot = [...customSurveysRef.current]

    const token = await getSessionAccessToken()
    if (!token) {
      console.error('Sign in required to move custom surveys.')
      return
    }
    // After the async gap, re-check so we do not re-apply an already-committed move.
    const s1 = customSurveysRef.current.find((x) => x.id === surveyId)
    if (!s1) return
    if ((s1.collectionId ?? null) === (targetCollectionId ?? null)) return

    setCustomSurveys((prev) =>
      prev.map((x) => (x.id === surveyId ? { ...x, collectionId: targetCollectionId } : x))
    )
    try {
      const saved = await patchCustomSurveyCollection(token, surveyId, targetCollectionId)
      setCustomSurveys((prev) => prev.map((x) => (x.id === saved.id ? saved : x)))
    } catch (error) {
      console.error('Failed to move custom survey', error)
      setCustomSurveys(() => snapshot)
    }
  }

  async function handleDeleteSurvey(id: string) {
    const token = await getSessionAccessToken()
    if (!token) {
      console.error('Sign in required to delete custom surveys.')
      return
    }
    let snapshot: CustomSurvey[] = []
    setCustomSurveys((prev) => {
      snapshot = [...prev]
      return prev.filter((s) => s.id !== id)
    })
    try {
      await deleteCustomSurvey(token, id)
    } catch (error) {
      console.error('Failed to delete custom survey', error)
      setCustomSurveys(() => snapshot)
    }
  }

  async function handleSaveCollection(coll: CustomCollection) {
    const token = await getSessionAccessToken()
    if (!token) {
      console.error('Sign in required to save custom collections.')
      return
    }
    let snapshot: CustomCollection[] = []
    let isExisting = false
    setCustomCollections((prev) => {
      snapshot = [...prev]
      isExisting = prev.some((existing) => existing.id === coll.id)
      if (isExisting) {
        return prev.map((existing) => (existing.id === coll.id ? coll : existing))
      }
      return [...prev, coll]
    })
    try {
      const savedCollection = isExisting
        ? await updateCustomCollection(token, coll.id, { name: coll.name })
        : await createCustomCollection(token, { name: coll.name })
      setCustomCollections((prev) => {
        const didExist = prev.some(
          (existing) => existing.id === coll.id || existing.id === savedCollection.id
        )
        if (!didExist) return [...prev, savedCollection]
        return prev.map((existing) => (
          existing.id === coll.id || existing.id === savedCollection.id ? savedCollection : existing
        ))
      })
    } catch (error) {
      console.error('Failed to save custom collection', error)
      setCustomCollections(() => snapshot)
    }
  }

  async function handleDeleteCollection(id: string) {
    const token = await getSessionAccessToken()
    if (!token) {
      console.error('Sign in required to delete custom collections.')
      return
    }
    let collectionSnapshot: CustomCollection[] = []
    let surveySnapshot: CustomSurvey[] = []
    setCustomCollections((prev) => {
      collectionSnapshot = [...prev]
      return prev.filter(c => c.id !== id)
    })
    setCustomSurveys((prev) => {
      surveySnapshot = [...prev]
      return prev.map(s => s.collectionId === id ? { ...s, collectionId: null } : s)
    })
    try {
      await deleteCustomCollection(token, id)
    } catch (error) {
      console.error('Failed to delete custom collection', error)
      setCustomCollections(() => collectionSnapshot)
      setCustomSurveys(() => surveySnapshot)
    }
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
      let cache = { ...premiumQuestionsCache }
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
            const { questions } = await getPackQuestions(p.id, token)
            cache[p.id] = questions
          }
        } else if (packs.premium.some(p => p.id === selectedPackId) && !cache[selectedPackId]?.length) {
          const { questions } = await getPackQuestions(selectedPackId, token)
          cache = { ...cache, [selectedPackId]: questions }
        }
        setPremiumQuestionsCache(cache)
      }

      const merged = mergeSurveyPacksForGame(packs.free, packs.premium, cache)
      const fullQuestions = resolvePackQuestions(selectedPackId, customSurveys, customCollections, merged)
      if (!fullQuestions.length) {
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
      setTeams([{ name: t1, score: 0 }, { name: t2, score: 0 }])
      setTimerSecs(secs); setNumRounds(nr); setCurrentRound(0)
      setShuffledQuestions(shuffleArray(fullQuestions).slice(0, nr))
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

  function handleNextRound() {
    const nextFaceOffRound = currentRound + 1
    setShuffledQuestions((prev) => reconcileSurveyRoundQuestions(prev, nextFaceOffRound, packQuestions))
    setCurrentRound((r) => r + 1)
    setScreen('faceoff')
  }

  function handleSkipQuestion() {
    const usedIds = new Set(shuffledQuestions.slice(0, currentRound).map((q) => q.id))
    const pool = packQuestions.filter((q) => !usedIds.has(q.id))
    if (pool.length <= 1) return
    const currentId = shuffledQuestions[currentRound]?.id
    const currentIdx = pool.findIndex((q) => q.id === currentId)
    const nextIdx = (currentIdx + 1) % pool.length
    setShuffledQuestions((prev) => {
      const swapped = prev.map((r, i) => (i === currentRound ? pool[nextIdx] : r))
      return reconcileSurveyRoundQuestions(swapped, currentRound, packQuestions)
    })
  }

  function getPackName(id: string) {
    if (id === 'random') return 'Random Mix'
    if (id === 'custom_all') return 'All Custom'
    const fp = freePackIds.find(p => p.id === id); if (fp) return fp.name
    const pp = premiumPackIds.find(p => p.id === id); if (pp) return pp.name
    const coll = customCollections.find(c => c.id === id); if (coll) return coll.name
    return 'Custom'
  }

  function handleNewGame(finalTeams?: Team[]) {
    if (finalTeams) {
      const winner =
        finalTeams[0].score > finalTeams[1].score ? finalTeams[0].name :
        finalTeams[1].score > finalTeams[0].score ? finalTeams[1].name : 'Tie'
      const pack = getPackName(selectedPackId)
      const t1 = finalTeams[0].name
      const t2 = finalTeams[1].name
      const s1 = finalTeams[0].score
      const s2 = finalTeams[1].score
      if (!currentUser) {
        const record: GameHistoryRecord = {
          id: Date.now(),
          timestamp: new Date(),
          team1: t1, team2: t2,
          rounds: numRounds, pack,
          winner, score1: s1, score2: s2,
        }
        setGameHistory(prev => [record, ...prev].slice(0, 50))
      } else {
        // Save in the background so setup is never blocked by the network; on failure we add no row.
        void (async () => {
          const { data: { session } } = await createClient().auth.getSession()
          const token = session?.access_token
          if (!token) {
            console.error('Sign in required to save game history.')
            return
          }
          try {
            const res = await saveGameHistory(token, {
              team1: t1,
              team2: t2,
              rounds: numRounds,
              pack,
              winner,
              score1: s1,
              score2: s2,
            })
            const record: GameHistoryRecord = {
              id: res.session.id,
              timestamp: new Date(res.session.timestamp),
              team1: t1, team2: t2,
              rounds: numRounds, pack,
              winner, score1: s1, score2: s2,
            }
            setGameHistory(prev => [record, ...prev].slice(0, 50))
          } catch (e) {
            console.error('Failed to save game history', e)
          }
        })()
      }
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
          onStart={startGame} packQuestions={packQuestions}
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
          onMoveSurveyToCollection={handleMoveSurveyToCollection}
          onSaveCollection={handleSaveCollection} onDeleteCollection={handleDeleteCollection}
          onCloseSurveys={handleSurveysModalClose}
          gameHistory={gameHistory}
        />
      )}
      {screen === 'faceoff' && activeQuestions[currentRound] && (
        <FaceOffScreen
          currentQuestion={activeQuestions[currentRound]} teams={teams}
          onWinFaceOff={handleFaceOffWin}
          roundNumber={currentRound + 1} totalRounds={numRounds}
          timerSecs={timerSecs} menuProps={menuProps}
          getJudgeAccessToken={getJudgeAccessToken} onSkip={handleSkipQuestion}
          showPlaythroughAds={showPlaythroughAds}
        />
      )}
      {screen === 'board' && activeQuestions[currentRound] && (
        <BoardScreen
          currentQuestion={activeQuestions[currentRound]} teams={teams}
          controllingTeam={controllingTeam} faceOffAnswerIndex={faceOffAnswerIndex}
          onRoundEnd={handleRoundEnd}
          roundNumber={currentRound + 1} totalRounds={numRounds} numRounds={numRounds}
          menuProps={menuProps} onNextRound={handleNextRound}
          onNewGame={handleNewGame} getJudgeAccessToken={getJudgeAccessToken}
          showPlaythroughAds={showPlaythroughAds}
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
