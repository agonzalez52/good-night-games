'use client'

import { useState, useEffect, useRef } from 'react'

interface GameMenuProps {
  timerSecs: number
  onTimerChange: (secs: number) => void
  onNewGame: () => void
}

export default function GameMenu({ timerSecs, onTimerChange, onNewGame }: GameMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmEndGame, setConfirmEndGame] = useState(false)
  const [localTimer, setLocalTimer] = useState(timerSecs)
  const [localTimerDraft, setLocalTimerDraft] = useState(String(timerSecs))
  const menuRef = useRef<HTMLDivElement>(null)
  const timerOptions = [3, 5, 10]

  useEffect(() => { setLocalTimer(timerSecs) }, [timerSecs])

  useEffect(() => {
    if (open) setLocalTimerDraft(String(timerSecs))
  }, [open, timerSecs])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false); setConfirmEndGame(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function applyTimer(val: number) {
    const v = Math.max(3, Math.min(120, val))
    setLocalTimer(v)
    onTimerChange(v)
  }

  function commitTimerDraft() {
    const parsed = Number(localTimerDraft)
    if (localTimerDraft.trim() === '' || !Number.isFinite(parsed)) {
      setLocalTimerDraft(String(localTimer))
      return
    }
    const clamped = Math.max(3, Math.min(120, Math.floor(parsed)))
    applyTimer(clamped)
    setLocalTimerDraft(String(clamped))
  }

  const btnStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10,
    border: `1px solid ${open ? 'rgba(77,126,255,0.4)' : 'rgba(255,255,255,0.09)'}`,
    background: open ? 'rgba(77,126,255,0.15)' : 'rgba(255,255,255,0.04)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 4.5, padding: '9px', transition: 'all 0.2s ease',
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(o => !o); setConfirmEndGame(false) }} style={btnStyle} title="Game Menu">
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 16, height: 2, borderRadius: 2, background: open ? '#4D7EFF' : 'var(--text-muted)', transition: 'all 0.22s ease', transform: open && i === 0 ? 'translateY(6.5px) rotate(45deg)' : open && i === 2 ? 'translateY(-6.5px) rotate(-45deg)' : open && i === 1 ? 'scaleX(0)' : 'none' }} />
        ))}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 48, right: 0, width: 288, background: 'rgba(8,12,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 16px 56px rgba(0,0,0,0.7)', padding: '16px', animation: 'menuSlide 0.2s ease-out', zIndex: 9999 }}>
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>⏱ Face-Off Timer</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 9 }}>
              {timerOptions.map(s => (
                <button key={s} onClick={() => { applyTimer(s); setLocalTimerDraft(String(s)) }} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-score)', letterSpacing: '0.06em', background: localTimer === s ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.04)', color: localTimer === s ? '#fff' : 'var(--text-muted)', border: localTimer === s ? '1px solid rgba(240,165,0,0.6)' : '1px solid rgba(255,255,255,0.07)', boxShadow: localTimer === s ? '0 2px 12px rgba(240,165,0,0.25)' : 'none' }}>{s}s</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-body)', fontSize: 11 }}>Custom:</span>
              <input type="number" min={3} max={120} value={localTimerDraft} onChange={e => setLocalTimerDraft(e.target.value)} onBlur={commitTimerDraft} style={{ width: 56, padding: '5px 8px', borderRadius: 8, fontSize: 14, fontFamily: 'var(--font-score)', textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#F0A500' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-body)' }}>sec</span>
            </div>
          </div>

          {confirmEndGame && (
            <div style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.25)', borderRadius: 10, padding: '12px', marginBottom: 10, animation: 'slideDown 0.15s ease-out' }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,150,160,0.9)', marginBottom: 10, lineHeight: 1.4 }}>End this game and return to setup? Game progress will not be saved.</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => { onNewGame(); setConfirmEndGame(false); setOpen(false) }} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em', background: 'linear-gradient(135deg,#FF4D6A,#CC1A30)', color: '#fff', border: 'none', boxShadow: '0 2px 12px rgba(255,77,106,0.25)' }}>CONFIRM</button>
                <button onClick={() => setConfirmEndGame(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>CANCEL</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setConfirmEndGame(true)} style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'left', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.07)' }}>⊗  End Game</button>
          </div>
        </div>
      )}
    </div>
  )
}
