'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

export const AI_JUDGE_ANIMATION_VARIANTS = {
  neuralPulse: 'neuralPulse',
  neuralBrain: 'neuralBrain',
  synapseWave: 'synapseWave',
} as const

export type AIJudgeAnimationVariant = typeof AI_JUDGE_ANIMATION_VARIANTS[keyof typeof AI_JUDGE_ANIMATION_VARIANTS]

interface AIJudgeThinkingIndicatorProps {
  variant?: AIJudgeAnimationVariant
}

const STAR_TICK_MS = 500
const STAR_DEGREES_PER_TICK = 45

function svgCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

function fourPointStar(cx: number, cy: number, outer: number, inner: number): string {
  const points: string[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const radius = i % 2 === 0 ? outer : inner
    points.push(`${svgCoord(cx + radius * Math.cos(angle))},${svgCoord(cy + radius * Math.sin(angle))}`)
  }
  return points.join(' ')
}

const shellStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  placeItems: 'center',
  position: 'relative',
}

const textWrapStyle: CSSProperties = {
  position: 'relative',
  width: 'fit-content',
  display: 'grid',
  placeItems: 'center',
  padding: '10px 0',
}

const starStageStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
  zIndex: 1,
}

const brainStageStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
  zIndex: 2,
}

const textStyle: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: '#E2EBFF',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  lineHeight: 1,
  textShadow: '0 0 14px rgba(77,126,255,0.45)',
  position: 'relative',
  zIndex: 3,
}

export function AIJudgeThinkingIndicator({ variant: _variant = AI_JUDGE_ANIMATION_VARIANTS.neuralPulse }: AIJudgeThinkingIndicatorProps) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setStep(previous => previous + 1)
    }, STAR_TICK_MS)
    return () => window.clearInterval(tickId)
  }, [])

  const frontRotation = step * STAR_DEGREES_PER_TICK
  const backRotation = 45 - step * STAR_DEGREES_PER_TICK
  const starPoints = fourPointStar(20, 20, 12.5, 3.8)

  return (
    <div style={shellStyle} aria-live="polite" role="status">
      <div style={textWrapStyle}>
        <div style={starStageStyle} aria-hidden="true">
          <svg width="85" height="85" viewBox="0 0 40 40" style={{ position: 'absolute', transform: `rotate(${backRotation}deg)`, transformOrigin: '50% 50%', transition: 'transform 340ms cubic-bezier(0.22,0.61,0.36,1)', filter: 'drop-shadow(0 0 10px rgba(240,165,0,0.85))', animation: 'pulse 1.15s ease-in-out infinite' }}>
            <polygon points={starPoints} fill="rgba(240,165,0,0.9)" />
          </svg>
          <svg width="85" height="85" viewBox="0 0 40 40" style={{ position: 'absolute', transform: `rotate(${frontRotation}deg)`, transformOrigin: '50% 50%', transition: 'transform 340ms cubic-bezier(0.22,0.61,0.36,1)', filter: 'drop-shadow(0 0 12px rgba(77,126,255,0.9))', animation: 'pulse 0.95s ease-in-out infinite' }}>
            <polygon points={starPoints} fill="rgba(120,170,255,0.92)" />
          </svg>
        </div>
        <div style={brainStageStyle} aria-hidden="true">
          <svg viewBox="0 0 56 34" width="40" height="24" style={{ opacity: 0.6, filter: 'drop-shadow(0 0 10px rgba(155,109,255,0.45))' }}>
            <path
              d="M19 6c-4.8 0-8.5 3.7-8.5 8.4 0 2.7 1 4.8 2.6 6.2.2 3.5 2.8 6.2 6.4 6.2 1.9 0 3.7-.8 4.9-2.1 1.1 1.3 2.8 2.1 4.8 2.1 3.7 0 6.3-2.7 6.5-6.2 1.6-1.4 2.6-3.5 2.6-6.2 0-4.7-3.8-8.4-8.6-8.4-1.9 0-3.7.6-5 1.8-1.4-1.2-3.1-1.8-5-1.8Z"
              fill="rgba(77,126,255,0.13)"
              stroke="rgba(155,109,255,0.82)"
              strokeWidth="1.4"
            />
            <path d="M28 7.5v17.8M22.2 10.2c1.8 1 2.8 2.6 2.8 4.5M33.8 10.2c-1.8 1-2.8 2.6-2.8 4.5M20.4 16.9h4.6M31 16.9h4.6M22.6 22.1c1.4-.2 2.2-1.1 2.6-2.2M33.4 22.1c-1.4-.2-2.3-1.1-2.6-2.2" stroke="rgba(77,126,255,0.85)" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>
        <div style={textStyle}>AI Judge Says…</div>
      </div>
    </div>
  )
}
