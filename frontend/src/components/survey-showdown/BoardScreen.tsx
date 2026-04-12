'use client'

import { useState, useEffect, useRef } from 'react'
import GameMenu from '@/components/survey-showdown/GameMenu'
import { AdBanner } from '@/components/survey-showdown/AdBanner'
import { judgeAnswer, playBuzz, playReveal, playTick } from '@/lib/constants'
import type { Answer, Round } from '@/lib/constants'

interface Team { name: string; score: number }
interface GameMenuProps { timerSecs: number; onTimerChange: (s: number) => void; onNewGame: () => void }

function ScoreBoard({ teams, activeTeam }: { teams: Team[]; activeTeam: number | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
      {teams.map((team, i) => {
        const isActive = activeTeam === i
        return (
          <div key={i} style={{ flex: 1, maxWidth: 280, padding: '16px 20px', borderRadius: 16, background: isActive ? 'linear-gradient(135deg,rgba(240,165,0,0.18) 0%,rgba(192,122,0,0.12) 100%)' : 'rgba(255,255,255,0.04)', border: isActive ? '1px solid rgba(240,165,0,0.5)' : '1px solid rgba(255,255,255,0.08)', boxShadow: isActive ? '0 0 32px rgba(240,165,0,0.2),inset 0 1px 0 rgba(255,255,255,0.07)' : 'inset 0 1px 0 rgba(255,255,255,0.04)', transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center', backdropFilter: 'blur(10px)', position: 'relative', overflow: 'hidden' }}>
            {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#F0A500,transparent)', animation: 'shimmer 2s linear infinite', backgroundSize: '200% auto' }} />}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', color: isActive ? '#F0A500' : 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', transition: 'color 0.3s' }}>{team.name}</div>
            <div style={{ fontFamily: 'var(--font-score)', fontSize: 'clamp(40px,5vw,52px)', color: isActive ? '#F0A500' : 'var(--text)', lineHeight: 1, textShadow: isActive ? '0 0 24px rgba(240,165,0,0.4)' : 'none', transition: 'all 0.35s ease' }}>{team.score}</div>
          </div>
        )
      })}
    </div>
  )
}

function AnswerTile({ row, revealed, guessed, index, animating }: { row: Answer; revealed: boolean; guessed: boolean; index: number; animating: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, border: `1px solid ${guessed ? 'rgba(77,126,255,0.35)' : 'rgba(255,255,255,0.07)'}`, background: guessed ? 'linear-gradient(135deg,rgba(36,64,160,0.55) 0%,rgba(20,40,110,0.75) 100%)' : 'rgba(255,255,255,0.03)', boxShadow: guessed ? '0 4px 24px rgba(77,126,255,0.22),inset 0 1px 0 rgba(255,255,255,0.08)' : 'none', transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)', transform: animating ? 'scale(1.025)' : 'scale(1)', animation: animating ? 'tileReveal 0.38s cubic-bezier(0.34,1.56,0.64,1)' : 'none', cursor: 'default' }}>
      <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: guessed ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.05)', border: guessed ? 'none' : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-score)', fontSize: 18, color: guessed ? '#fff' : 'var(--text-faint)', boxShadow: guessed ? '0 2px 12px rgba(240,165,0,0.3)' : 'none', transition: 'all 0.45s ease', flexShrink: 0 }}>{index + 1}</div>
      <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 'clamp(15px,1.8vw,20px)', fontWeight: 700, color: revealed ? (guessed ? 'var(--text)' : 'var(--text-muted)') : 'transparent', letterSpacing: '0.04em', transition: 'color 0.3s ease', textTransform: 'uppercase' }}>{revealed ? row.answer.toUpperCase() : ''}</div>
      <div style={{ fontFamily: 'var(--font-score)', fontSize: 'clamp(22px,2vw,28px)', color: revealed ? (guessed ? '#F0A500' : 'var(--text-muted)') : 'transparent', textShadow: guessed ? '0 0 16px rgba(240,165,0,0.5)' : 'none', transition: 'all 0.3s ease', minWidth: 44, textAlign: 'right' }}>{revealed ? row.points : ''}</div>
    </div>
  )
}

function XMark({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {Array.from({ length: count }).map((_, i) => <div key={i} style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,rgba(255,77,106,0.2),rgba(180,20,40,0.35))', border: '1px solid rgba(255,77,106,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-score)', fontSize: 28, color: '#FF4D6A', boxShadow: '0 0 20px rgba(255,77,106,0.35),inset 0 1px 0 rgba(255,255,255,0.06)', animation: 'xPop 0.35s cubic-bezier(0.34,1.56,0.64,1)', backdropFilter: 'blur(8px)' }}>✕</div>)}
      {count > 0 && count < 3 && Array.from({ length: 3 - count }).map((_, i) => <div key={`e${i}`} style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }} />)}
    </div>
  )
}

function BetweenRoundNext({ isTokenGame, onNextRound, roundNumber }: { isTokenGame: boolean; onNextRound: () => void; roundNumber: number }) {
  const [countdown, setCountdown] = useState(isTokenGame ? 0 : 5)
  const [ready, setReady] = useState(isTokenGame)
  useEffect(() => {
    if (isTokenGame) return
    if (countdown <= 0) { setReady(true); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, isTokenGame])
  return (
    <button onClick={ready ? onNextRound : undefined} disabled={!ready} style={{ padding: '13px 30px', borderRadius: 14, fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em', background: ready ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.06)', color: ready ? '#fff' : 'var(--text-faint)', border: 'none', boxShadow: ready ? '0 4px 20px rgba(240,165,0,0.4)' : 'none', whiteSpace: 'nowrap', transition: 'all 0.3s ease', minWidth: 160 }}>
      {ready ? `▶ Round ${roundNumber + 1}` : `▶ Round ${roundNumber + 1} (${countdown}s)`}
    </button>
  )
}

interface BoardScreenProps {
  round: Round
  teams: Team[]
  controllingTeam: number
  faceOffAnswerIndex: number | null
  onRoundEnd: (winnerTeam: number, points: number) => void
  roundNumber: number
  totalRounds: number
  numRounds: number
  menuProps: GameMenuProps
  onNextRound: () => void
  onNewGame: (finalTeams: Team[]) => void
  getJudgeAccessToken: () => Promise<string | null>
  isTokenGame: boolean
}

export default function BoardScreen({ round, teams, controllingTeam, faceOffAnswerIndex, onRoundEnd, roundNumber, totalRounds, numRounds, menuProps, onNextRound, onNewGame, getJudgeAccessToken, isTokenGame }: BoardScreenProps) {
  const [revealed, setRevealed] = useState<number[]>(faceOffAnswerIndex !== null ? [faceOffAnswerIndex] : [])
  const [strikes, setStrikes] = useState(0)
  const [animatingTile, setAnimatingTile] = useState<number | null>(null)
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [roundScore, setRoundScore] = useState(faceOffAnswerIndex !== null ? round.answers[faceOffAnswerIndex].points : 0)
  const [stealing, setStealing] = useState(false)
  const [stealAnswer, setStealAnswer] = useState('')
  const [roundOver, setRoundOver] = useState(false)
  const [showAllAnswers, setShowAllAnswers] = useState(false)
  const [judging, setJudging] = useState(false)
  const [history, setHistory] = useState<{ revealed: number[]; strikes: number; roundScore: number; stealing: boolean }[]>([])
  const [roundResult, setRoundResult] = useState<{ winnerTeam: number; points: number; updatedTeams: Team[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const active = controllingTeam

  useEffect(() => { if (!roundOver && !judging) inputRef.current?.focus() }, [stealing, roundOver, judging])

  function snapshot(rev: number[], str: number, sc: number, st: boolean) { return { revealed: [...rev], strikes: str, roundScore: sc, stealing: st } }
  function redo() { if (history.length === 0) return; const prev = history[history.length - 1]; setHistory(h => h.slice(0, -1)); setRevealed(prev.revealed); setStrikes(prev.strikes); setRoundScore(prev.roundScore); setStealing(prev.stealing); setMessage(''); setAnswer(''); setStealAnswer('') }

  async function submitGuess() {
    if (!answer.trim() || roundOver || judging) return
    const submitted = answer; setAnswer(''); setJudging(true)
    setMessage('⏳ Checking…'); setMessageType('good')
    const idx = await judgeAnswer(submitted, round.answers, revealed, getJudgeAccessToken)
    setJudging(false)
    if (idx !== null) {
      setHistory(h => [...h, snapshot(revealed, strikes, roundScore, stealing)])
      playReveal(); setAnimatingTile(idx); setTimeout(() => setAnimatingTile(null), 600)
      const newRevealed = [...revealed, idx], pts = round.answers[idx].points, newScore = roundScore + pts
      setRevealed(newRevealed); setRoundScore(newScore)
      setMessage(`✓ ${round.answers[idx].answer} — ${pts} pts!`); setMessageType('good')
      if (newRevealed.length === round.answers.length) { setShowAllAnswers(true); setTimeout(() => endRound(active, newScore), 1200) }
    } else {
      setHistory(h => [...h, snapshot(revealed, strikes, roundScore, stealing)])
      playBuzz(); const ns = strikes + 1; setStrikes(ns)
      setMessage('✕ Not on the board!'); setMessageType('bad')
      if (ns >= 3) setTimeout(() => { setStealing(true); setMessage('') }, 800)
    }
    setTimeout(() => setMessage(''), 2500)
  }

  async function submitSteal() {
    if (!stealAnswer.trim() || judging) return
    const submitted = stealAnswer; setStealAnswer(''); setJudging(true)
    const idx = await judgeAnswer(submitted, round.answers, revealed, getJudgeAccessToken)
    setJudging(false)
    const stealTeam = active === 0 ? 1 : 0
    setShowAllAnswers(true); setRoundOver(true)
    if (idx !== null) { playReveal(); setAnimatingTile(idx); setTimeout(() => setAnimatingTile(null), 600); const newRevealed = [...revealed, idx]; setRevealed(newRevealed); setTimeout(() => endRound(stealTeam, roundScore + round.answers[idx].points), 1200) }
    else { playBuzz(); setTimeout(() => endRound(active, roundScore), 1000) }
  }

  function endRound(winnerTeam: number, score: number) {
    setRoundOver(true); setShowAllAnswers(true)
    const updatedTeams = teams.map((t, i) => i === winnerTeam ? { ...t, score: t.score + score } : t)
    setRoundResult({ winnerTeam, points: score, updatedTeams })
    onRoundEnd(winnerTeam, score)
  }

  const isLastRound = roundNumber >= numRounds
  const gameWinner = roundResult ? (roundResult.updatedTeams[0].score > roundResult.updatedTeams[1].score ? 0 : roundResult.updatedTeams[1].score > roundResult.updatedTeams[0].score ? 1 : null) : null

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 70% 45% at 50% 0%,rgba(77,126,255,0.08) 0%,transparent 65%),#060914', display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(77,126,255,0.05) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: '4px 11px', borderRadius: 100, background: 'rgba(77,126,255,0.1)', border: '1px solid rgba(77,126,255,0.22)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.16em', color: '#4D7EFF', textTransform: 'uppercase' }}>Round {roundNumber}/{totalRounds}</div>
        </div>
        <GameMenu {...menuProps} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {!roundResult && <div style={{ textAlign: 'center', marginBottom: 6, fontFamily: 'var(--font-score)', fontSize: 22, color: '#F0A500', textShadow: '0 0 16px rgba(240,165,0,0.35)' }}>{roundScore} PTS</div>}
        <ScoreBoard teams={roundResult ? roundResult.updatedTeams : teams} activeTeam={stealing ? (active === 0 ? 1 : 0) : active} />
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '11px 20px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(13px,1.8vw,22px)', color: 'var(--text)', letterSpacing: '-0.01em' }}>{round.question}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, position: 'relative', zIndex: 1 }}>
        {round.answers.map((ans, i) => <AnswerTile key={ans.id || i} row={ans} revealed={revealed.includes(i) || showAllAnswers} guessed={revealed.includes(i)} index={i} animating={animatingTile === i} />)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}><XMark count={strikes} /></div>

      {message && <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '0.06em', color: messageType === 'good' ? '#0FD98A' : '#FF4D6A', animation: 'slideUp 0.3s ease-out', textShadow: messageType === 'good' ? '0 0 20px rgba(15,217,138,0.45)' : '0 0 20px rgba(255,77,106,0.45)', position: 'relative', zIndex: 1 }}>{message}</div>}

      {stealing && !roundOver && (
        <div style={{ background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.3)', borderRadius: 14, padding: '14px 18px', textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', position: 'relative', zIndex: 1, boxShadow: '0 4px 28px rgba(155,109,255,0.1)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#9B6DFF', letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>⚡ Steal — {teams[active === 0 ? 1 : 0].name}</div>
          <div style={{ display: 'flex', gap: 9, justifyContent: 'center' }}>
            <input ref={inputRef} value={stealAnswer} onChange={e => setStealAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSteal()} placeholder="Enter steal answer…" disabled={judging} style={{ padding: '10px 14px', borderRadius: 11, fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(155,109,255,0.4)', color: 'var(--text)', width: 260, opacity: judging ? 0.55 : 1 }} />
            <button onClick={submitSteal} disabled={judging} style={{ padding: '10px 20px', borderRadius: 11, fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.08em', background: judging ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#9B6DFF,#6A3ACC)', color: judging ? 'var(--text-muted)' : '#fff', border: 'none', minWidth: 90, boxShadow: judging ? 'none' : '0 4px 18px rgba(155,109,255,0.3)' }}>{judging ? '⏳' : 'STEAL!'}</button>
          </div>
        </div>
      )}

      {!stealing && !roundOver && (
        <div style={{ display: 'flex', gap: 8, position: 'relative', zIndex: 1 }}>
          <div style={{ padding: '9px 14px', borderRadius: 11, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em', color: '#F0A500', background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.25)', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{teams[active].name}</div>
          <input ref={inputRef} value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitGuess()} placeholder="Type answer and press Enter…" disabled={judging} style={{ flex: 1, padding: '10px 14px', borderRadius: 11, fontSize: 16, fontFamily: 'var(--font-body)', fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', opacity: judging ? 0.55 : 1 }} />
          <button onClick={submitGuess} disabled={judging} style={{ padding: '10px 18px', borderRadius: 11, fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.08em', background: judging ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#F0A500,#C07A00)', color: judging ? 'var(--text-muted)' : '#fff', border: 'none', minWidth: 90, boxShadow: judging ? 'none' : '0 4px 16px rgba(240,165,0,0.3)' }}>{judging ? '⏳' : 'SUBMIT'}</button>
          <button onClick={redo} disabled={judging || history.length === 0} style={{ padding: '10px 12px', borderRadius: 11, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, background: history.length > 0 && !judging ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', color: history.length > 0 && !judging ? 'var(--text-muted)' : 'var(--text-faint)', border: '1px solid rgba(255,255,255,0.07)' }} title="Undo last guess">UNDO</button>
        </div>
      )}

      {roundResult && (
        <div style={{ animation: 'slideUp 0.45s cubic-bezier(0.34,1.56,0.64,1)', position: 'relative', zIndex: 2 }}>
          {isLastRound ? (
            <div style={{ borderRadius: 18, padding: '22px 28px', textAlign: 'center', background: 'rgba(8,10,24,0.98)', border: '1px solid rgba(240,165,0,0.35)', boxShadow: '0 16px 60px rgba(0,0,0,0.7),0 0 60px rgba(240,165,0,0.1)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#F0A500 30%,#F0A500 70%,transparent)' }} />
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.22em', color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Game Over</div>
              {gameWinner !== null ? (
                <><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px,4vw,44px)', color: '#F0A500', letterSpacing: '0.02em', animation: 'glow 2s infinite' }}>🏆 {roundResult.updatedTeams[gameWinner].name}</div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 8 }}>Wins with {roundResult.updatedTeams[gameWinner].score} points!</div></>
              ) : <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34, color: '#F0A500', marginBottom: 8, animation: 'glow 2s infinite' }}>It's a Tie!</div>}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 18 }}>
                {roundResult.updatedTeams.map((t, i) => (
                  <div key={i} style={{ padding: '12px 24px', borderRadius: 14, textAlign: 'center', background: i === gameWinner ? 'rgba(240,165,0,0.1)' : 'rgba(255,255,255,0.03)', border: i === gameWinner ? '1px solid rgba(240,165,0,0.45)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: i === gameWinner ? '#F0A500' : 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>{t.name}</div>
                    <div style={{ fontFamily: 'var(--font-score)', fontSize: 38, color: i === gameWinner ? '#F0A500' : 'var(--text)', textShadow: i === gameWinner ? '0 0 20px rgba(240,165,0,0.4)' : 'none' }}>{t.score}</div>
                  </div>
                ))}
              </div>
              {!isTokenGame && <AdBanner style={{ minHeight: 72, marginBottom: 16 }} />}
              <button onClick={() => onNewGame(roundResult.updatedTeams)} style={{ padding: '13px 38px', borderRadius: 14, fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em', background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', border: 'none', boxShadow: '0 6px 28px rgba(240,165,0,0.4),inset 0 1px 0 rgba(255,255,255,0.2)' }}>↺ Back to Setup</button>
            </div>
          ) : (
            <div style={{ borderRadius: 16, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(15,217,138,0.06)', border: '1px solid rgba(15,217,138,0.3)', boxShadow: '0 8px 32px rgba(15,217,138,0.08)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#0FD98A 30%,#0FD98A 70%,transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>Round {roundNumber} Winner</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(20px,2.8vw,30px)', color: '#F0A500', letterSpacing: '0.02em', animation: 'glow 2s infinite' }}>{teams[roundResult.winnerTeam].name}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#0FD98A', letterSpacing: '0.08em' }}>+{roundResult.points} points</div>
                </div>
                <BetweenRoundNext isTokenGame={isTokenGame} onNextRound={onNextRound} roundNumber={roundNumber} />
              </div>
              {!isTokenGame && <AdBanner style={{ minHeight: 72 }} />}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
