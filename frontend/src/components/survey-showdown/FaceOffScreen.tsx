'use client'

import { useState, useEffect, useRef } from 'react'
import GameMenu from '@/components/survey-showdown/GameMenu'
import { judgeAnswer, playBuzzerIn, playReveal, playBuzz, playTick, playTimerExpire } from '@/lib/constants'
import type { Round } from '@/lib/constants'

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

function FaceOffTimerRing({ totalSecs, remaining }: { totalSecs: number; remaining: number }) {
  const pct = remaining / totalSecs, r = 38, circ = 2 * Math.PI * r, offset = circ * (1 - pct)
  const isLow = pct <= 0.33, isCritical = pct <= 0.15
  const trackColor = isCritical ? '#FF4D6A' : isLow ? '#F0A500' : '#4D7EFF'
  const glowColor = isCritical ? 'rgba(255,77,106,0.5)' : isLow ? 'rgba(240,165,0,0.5)' : 'rgba(77,126,255,0.5)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: isCritical ? 'timerPulse 0.7s ease-in-out infinite' : 'none' }}>
      <svg width="96" height="96" style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}>
        <circle cx="48" cy="48" r={r} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={trackColor} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 48 48)" style={{ transition: 'stroke-dashoffset 0.9s linear,stroke 0.3s ease' }} />
        <text x="48" y="54" textAnchor="middle" fontFamily="'Bebas Neue',sans-serif" fontSize="28" fill={trackColor} style={{ transition: 'fill 0.3s ease' }}>{remaining}</text>
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: trackColor, textTransform: 'uppercase', transition: 'color 0.3s' }}>TIME</div>
    </div>
  )
}

interface FaceOffScreenProps {
  round: Round
  teams: Team[]
  onWinFaceOff: (teamIndex: number, answerIndex: number | null) => void
  roundNumber: number
  totalRounds: number
  timerSecs: number
  menuProps: GameMenuProps
  apiKey: string
  onSkip: () => void
}

export default function FaceOffScreen({ round, teams, onWinFaceOff, roundNumber, totalRounds, timerSecs, menuProps, apiKey, onSkip }: FaceOffScreenProps) {
  const [buzzed, setBuzzed] = useState<number | null>(null)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<{ correct: boolean; teamIndex: number; answerIndex: number | null } | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [judging, setJudging] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timerSecs)
  const [timerActive, setTimerActive] = useState(false)
  const [timerExpiredFor, setTimerExpiredFor] = useState<number | null>(null)
  const [stealMode, setStealMode] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!timerActive) return
    tickRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        if (next <= 0) { clearInterval(tickRef.current!); return 0 }
        if (next <= 5) playTick()
        return next
      })
    }, 1000)
    return () => clearInterval(tickRef.current!)
  }, [timerActive])

  useEffect(() => {
    if (timeLeft === 0 && timerActive && !result) { setTimerActive(false); playTimerExpire(); setTimerExpiredFor(buzzed) }
  }, [timeLeft, timerActive, result])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (disabled || buzzed !== null) return
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); playBuzzerIn(); setBuzzed(0); setTimeLeft(timerSecs); setTimerActive(true); setTimeout(() => inputRef.current?.focus(), 100) }
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); playBuzzerIn(); setBuzzed(1); setTimeLeft(timerSecs); setTimerActive(true); setTimeout(() => inputRef.current?.focus(), 100) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [buzzed, disabled, timerSecs])

  async function submitAnswer() {
    if (!answer.trim() || buzzed === null || judging) return
    clearInterval(tickRef.current!); setTimerActive(false)
    const submitted = answer; setAnswer(''); setJudging(true)
    const idx = await judgeAnswer(submitted, round.answers, [], apiKey)
    setJudging(false)
    if (idx !== null) { playReveal(); setResult({ correct: true, teamIndex: buzzed, answerIndex: idx }) }
    else { playBuzz(); setResult({ correct: false, teamIndex: buzzed, answerIndex: null }) }
    setDisabled(true)
  }

  function passToOtherTeam() {
    const other = buzzed === 0 ? 1 : 0
    setTimerExpiredFor(buzzed); setStealMode(true); setBuzzed(other); setAnswer('')
    setTimeLeft(timerSecs); setTimerActive(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function proceed() {
    if (result?.correct) onWinFaceOff(result.teamIndex, result.answerIndex)
    else onWinFaceOff(buzzed === 0 ? 1 : 0, null)
  }

  function reset() {
    clearInterval(tickRef.current!)
    setBuzzed(null); setAnswer(''); setResult(null); setDisabled(false)
    setJudging(false); setTimeLeft(timerSecs); setTimerActive(false)
    setTimerExpiredFor(null); setStealMode(false)
  }

  const showTimer = buzzed !== null && !result && !stealMode
  const timerExpired = timerExpiredFor !== null && !stealMode

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse 80% 50% at 50% -5%,rgba(77,126,255,0.1) 0%,transparent 65%),#060914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 28px', gap: 20, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-8%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(77,126,255,0.055) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(77,126,255,0.055) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none', opacity: 0.5 }} />

      <div style={{ width: '100%', maxWidth: 880, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: '5px 12px', borderRadius: 100, background: 'rgba(77,126,255,0.12)', border: '1px solid rgba(77,126,255,0.25)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', color: '#4D7EFF', textTransform: 'uppercase' }}>Round {roundNumber} of {totalRounds}</div>
          <div style={{ padding: '5px 12px', borderRadius: 100, background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.22)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', color: '#F0A500', textTransform: 'uppercase' }}>Face-Off</div>
        </div>
        <GameMenu {...menuProps} />
      </div>

      <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}><ScoreBoard teams={teams} activeTeam={null} /></div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 18, padding: '22px 40px', textAlign: 'center', maxWidth: 780, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.06)', position: 'relative', zIndex: 1, animation: 'slideUp 0.5s ease-out both' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>The Question</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(18px,2.4vw,30px)', color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{round.question}</div>
        {!buzzed && !result && (
          <button onClick={onSkip} style={{ marginTop: 14, padding: '7px 18px', borderRadius: 10, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.12em', background: 'rgba(77,126,255,0.08)', color: '#4D7EFF', border: '1px solid rgba(77,126,255,0.25)', textTransform: 'uppercase', cursor: 'pointer' }}>⟳ Skip Question</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {teams.map((team, i) => {
          const isActive = buzzed === i
          const canBuzz = !disabled && buzzed === null
          function handleTileClick() { if (!canBuzz) return; playBuzzerIn(); setBuzzed(i); setTimeLeft(timerSecs); setTimerActive(true); setTimeout(() => inputRef.current?.focus(), 100) }
          return (
            <div key={i} onClick={handleTileClick} style={{ padding: '18px 28px', borderRadius: 18, textAlign: 'center', background: isActive ? 'linear-gradient(135deg,rgba(240,165,0,0.2),rgba(192,122,0,0.14))' : 'rgba(255,255,255,0.03)', border: isActive ? '1px solid rgba(240,165,0,0.55)' : '1px solid rgba(255,255,255,0.08)', boxShadow: isActive ? '0 0 36px rgba(240,165,0,0.22),inset 0 1px 0 rgba(255,255,255,0.07)' : 'none', transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)', minWidth: 168, position: 'relative', overflow: 'hidden', cursor: canBuzz ? 'pointer' : 'default' }}>
              {isActive && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#F0A500,transparent)' }} />}
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: isActive ? '#F0A500' : 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: 4, transition: 'color 0.25s' }}>{team.name}</div>
              <div style={{ color: isActive ? 'rgba(240,165,0,0.7)' : 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-body)', marginBottom: isActive ? 8 : 0 }}>{i === 0 ? 'Press A or tap to buzz' : 'Press L or tap to buzz'}</div>
              {isActive && !result && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', color: '#F0A500', animation: 'pulse 1s infinite', textTransform: 'uppercase' }}>{stealMode ? '⚡ Steal!' : timerExpiredFor === i ? '⏰ Time\'s Up' : '● Buzzed In'}</div>}
            </div>
          )
        })}
        {showTimer && <FaceOffTimerRing totalSecs={timerSecs} remaining={timeLeft} />}
      </div>

      {buzzed !== null && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 'min(560px,90vw)', animation: 'slideUp 0.3s ease-out', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 9, width: '100%' }}>
            <input ref={inputRef} value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitAnswer()} placeholder={judging ? 'Checking…' : `${teams[buzzed].name}'s answer…`} disabled={judging} style={{ flex: 1, padding: '13px 16px', borderRadius: 12, fontSize: 17, fontFamily: 'var(--font-body)', fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: `1px solid ${timerExpired ? 'rgba(255,77,106,0.5)' : 'rgba(240,165,0,0.4)'}`, color: 'var(--text)', opacity: judging ? 0.55 : 1, boxShadow: timerExpired ? '0 0 0 3px rgba(255,77,106,0.12)' : '0 0 0 3px rgba(240,165,0,0.1)', transition: 'all 0.2s' }} autoFocus />
            <button onClick={submitAnswer} disabled={judging} style={{ padding: '13px 22px', borderRadius: 12, fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.08em', background: judging ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#F0A500,#C07A00)', color: judging ? 'var(--text-muted)' : '#fff', border: 'none', minWidth: 100, boxShadow: judging ? 'none' : '0 4px 18px rgba(240,165,0,0.35)' }}>{judging ? '⏳' : 'SUBMIT'}</button>
          </div>
          {timerExpired && <button onClick={passToOtherTeam} style={{ padding: '10px 28px', borderRadius: 12, fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', background: 'rgba(155,109,255,0.15)', color: '#9B6DFF', border: '1px solid rgba(155,109,255,0.35)', boxShadow: '0 0 20px rgba(155,109,255,0.15)', animation: 'slideUp 0.3s ease-out' }}>⏭ PASS TO {teams[buzzed === 0 ? 1 : 0].name.toUpperCase()}</button>}
        </div>
      )}

      {result && (
        <div style={{ textAlign: 'center', animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)', padding: '24px 44px', borderRadius: 18, background: result.correct ? 'linear-gradient(135deg,rgba(15,217,138,0.1),rgba(5,100,60,0.15))' : 'linear-gradient(135deg,rgba(255,77,106,0.1),rgba(150,10,30,0.18))', border: `1px solid ${result.correct ? 'rgba(15,217,138,0.4)' : 'rgba(255,77,106,0.4)'}`, boxShadow: result.correct ? '0 8px 40px rgba(15,217,138,0.15)' : '0 8px 40px rgba(255,77,106,0.15)', position: 'relative', zIndex: 1 }}>
          {result.correct ? (
            <><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(26px,4vw,38px)', color: '#0FD98A', letterSpacing: '0.04em', textShadow: '0 0 28px rgba(15,217,138,0.4)' }}>✓ Good Answer!</div><div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--font-body)', marginTop: 5 }}>{teams[result.teamIndex].name} wins the face-off and controls the board</div></>
          ) : (
            <><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(26px,4vw,38px)', color: '#FF4D6A', letterSpacing: '0.04em', textShadow: '0 0 28px rgba(255,77,106,0.4)' }}>✕ Wrong Answer</div><div style={{ color: 'var(--text-muted)', fontSize: 14, fontFamily: 'var(--font-body)', marginTop: 5 }}>{teams[buzzed === 0 ? 1 : 0].name} wins control of the board</div></>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'center' }}>
            <button onClick={proceed} style={{ padding: '11px 28px', borderRadius: 12, fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.1em', background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', border: 'none', boxShadow: '0 4px 20px rgba(240,165,0,0.4)' }}>CONTINUE ▶</button>
            <button onClick={reset} style={{ padding: '11px 20px', borderRadius: 12, fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)' }}>RE-DO</button>
          </div>
        </div>
      )}

      {!buzzed && !result && <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.18em', color: 'var(--text-faint)', animation: 'pulse 2.2s infinite', textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>● Waiting for buzz-in…</div>}
    </div>
  )
}
