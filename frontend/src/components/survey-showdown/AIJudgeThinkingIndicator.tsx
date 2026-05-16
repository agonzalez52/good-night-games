'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const DEFAULT_STAR_STEP_DEGREES = 45
// How long each full animation takes
const DEFAULT_STAR_STEP_INTERVAL_MS = 800
// How long the rotation part of the animation takes
const DEFAULT_STAR_STEP_TRANSITION_MS = 400
const MIN_STAR_STEP_DEGREES = 0.1
const MIN_STAR_STEP_INTERVAL_MS = 1
const STAR_TRANSFORM_EASING = 'cubic-bezier(0.22,0.61,0.36,1)'

/** Overall size vs original layout (stars, brain, label, glow blur). */
const INDICATOR_SCALE = 1.5

export interface AIJudgeThinkingIndicatorProps {
  /** Degrees the front star advances each step (back star moves the opposite way). Default 45. */
  starStepDegrees?: number
  /**
   * Milliseconds for each step’s transform to run (how quickly the stars sweep through `starStepDegrees`).
   * Use 0 for an instant snap.
   */
  starStepTransitionMs?: number
  /**
   * Milliseconds between each discrete rotation step. When omitted, `starFullRotationSeconds` is used
   * to derive an interval from `starStepDegrees`; when that is also omitted, defaults to 700ms.
   */
  starStepIntervalMs?: number
  /**
   * Wall-clock seconds for one full 360° at the current step size, used only to derive the step interval
   * when `starStepIntervalMs` is not set: interval = `starFullRotationSeconds * 1000 * starStepDegrees / 360`.
   */
  starFullRotationSeconds?: number
  /**
   * Milliseconds from mount until the first rotation step. When omitted, defaults to one `intervalMs`
   * so the first move still lines up with the legacy `setInterval`-only timing. Use `0` for an immediate
   * first step once the component paints.
   */
  starTimeBeforeFirstRotationMs?: number
}

function resolveStarStepDegrees(value: number | undefined): number {
  const resolved = value ?? DEFAULT_STAR_STEP_DEGREES
  if (!Number.isFinite(resolved) || resolved <= 0) return DEFAULT_STAR_STEP_DEGREES
  return Math.max(MIN_STAR_STEP_DEGREES, resolved)
}

function resolveStarStepTransitionMs(value: number | undefined): number {
  const resolved = value ?? DEFAULT_STAR_STEP_TRANSITION_MS
  if (!Number.isFinite(resolved) || resolved < 0) return DEFAULT_STAR_STEP_TRANSITION_MS
  return resolved
}

function resolveStarStepIntervalMs(
  intervalMs: number | undefined,
  fullRotationSeconds: number | undefined,
  stepDegrees: number,
): number {
  if (intervalMs !== undefined && Number.isFinite(intervalMs) && intervalMs > 0) {
    return Math.max(MIN_STAR_STEP_INTERVAL_MS, intervalMs)
  }
  if (
    fullRotationSeconds !== undefined &&
    Number.isFinite(fullRotationSeconds) &&
    fullRotationSeconds > 0
  ) {
    return Math.max(MIN_STAR_STEP_INTERVAL_MS, (fullRotationSeconds * 1000 * stepDegrees) / 360)
  }
  return DEFAULT_STAR_STEP_INTERVAL_MS
}

/** When `explicitMs` is omitted, match legacy first tick: one full interval after mount. */
function resolveStarTimeBeforeFirstRotationMs(
  explicitMs: number | undefined,
  intervalMs: number,
): number {
  if (explicitMs !== undefined && Number.isFinite(explicitMs) && explicitMs >= 0) {
    return explicitMs
  }
  return intervalMs
}

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
  padding: `${10 * INDICATOR_SCALE}px 0`,
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
  fontSize: 11 * INDICATOR_SCALE,
  fontWeight: 700,
  letterSpacing: '0.18em',
  color: '#E2EBFF',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  lineHeight: 1,
  textShadow: `0 0 ${14 * INDICATOR_SCALE}px rgba(77,126,255,0.45)`,
  position: 'relative',
  zIndex: 3,
}

interface ThinkingIndicatorChromeProps {
  frontRotation: number
  backRotation: number
  transitionMs: number
  intervalMs: number
  timeBeforeFirstRotationMs: number
}

/** Pulse uses `intervalMs`; delay lines phase 0 up with T0 + intervalMs/4 each cycle (¼-interval glow). */
function resolveQuarterIntervalGlowDelayMs(timeBeforeFirstRotationMs: number, intervalMs: number): number {
  return -(timeBeforeFirstRotationMs + intervalMs / 2)
}

function ThinkingIndicatorChrome({
  frontRotation,
  backRotation,
  transitionMs,
  intervalMs,
  timeBeforeFirstRotationMs,
}: ThinkingIndicatorChromeProps) {
  const starPoints = fourPointStar(20, 20, 12.5, 3.8)
  const transformTransition =
    transitionMs <= 0 ? 'none' : `transform ${transitionMs}ms ${STAR_TRANSFORM_EASING}`

  const pulseDelayMs = resolveQuarterIntervalGlowDelayMs(timeBeforeFirstRotationMs, intervalMs)
  const pulseAnimation = `pulse ${intervalMs}ms ease-in-out infinite`
  const pulseTiming: Pick<CSSProperties, 'animation' | 'animationDelay'> = {
    animation: pulseAnimation,
    animationDelay: `${pulseDelayMs}ms`,
  }

  const starMotionBase: CSSProperties = {
    position: 'absolute',
    transformOrigin: '50% 50%',
    transition: transformTransition,
  }

  const backStarSvgStyle: CSSProperties = {
    ...starMotionBase,
    transform: `rotate(${backRotation}deg)`,
    filter: 'drop-shadow(0 0 10px rgba(240,165,0,0.85))',
    ...pulseTiming,
  }

  const frontStarSvgStyle: CSSProperties = {
    ...starMotionBase,
    transform: `rotate(${frontRotation}deg)`,
    filter: 'drop-shadow(0 0 12px rgba(77,126,255,0.9))',
    ...pulseTiming,
  }

  return (
    <div style={shellStyle} aria-live="polite" role="status">
      <div style={textWrapStyle}>
        <div style={starStageStyle} aria-hidden="true">
          <svg width={100 * INDICATOR_SCALE} height={100 * INDICATOR_SCALE} viewBox="0 0 40 40" style={backStarSvgStyle}>
            <polygon points={starPoints} fill="rgba(240,165,0,0.9)" />
          </svg>
          <svg width={100 * INDICATOR_SCALE} height={100 * INDICATOR_SCALE} viewBox="0 0 40 40" style={frontStarSvgStyle}>
            <polygon points={starPoints} fill="rgba(120,170,255,0.92)" />
          </svg>
        </div>
        <div style={brainStageStyle} aria-hidden="true">
          <svg
            viewBox="0 0 56 34"
            width={40 * INDICATOR_SCALE}
            height={24 * INDICATOR_SCALE}
            style={{ opacity: 0.6, filter: `drop-shadow(0 0 ${10 * INDICATOR_SCALE}px rgba(155,109,255,0.45))` }}
          >
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

export function AIJudgeThinkingIndicator({
  starStepDegrees,
  starStepTransitionMs,
  starStepIntervalMs,
  starFullRotationSeconds,
  starTimeBeforeFirstRotationMs,
}: AIJudgeThinkingIndicatorProps = {}) {
  const stepDegrees = resolveStarStepDegrees(starStepDegrees)
  const transitionMs = resolveStarStepTransitionMs(starStepTransitionMs)
  const intervalMs = resolveStarStepIntervalMs(starStepIntervalMs, starFullRotationSeconds, stepDegrees)
  const timeBeforeFirstRotationMs = resolveStarTimeBeforeFirstRotationMs(
    starTimeBeforeFirstRotationMs,
    intervalMs,
  )

  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)

    let intervalId: number | undefined
    const delayId = window.setTimeout(() => {
      setStep(previous => previous + 1)
      intervalId = window.setInterval(() => {
        setStep(previous => previous + 1)
      }, intervalMs)
    }, timeBeforeFirstRotationMs)

    return () => {
      window.clearTimeout(delayId)
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [intervalMs, timeBeforeFirstRotationMs])

  const frontRotation = step * stepDegrees
  const backRotation = stepDegrees - step * stepDegrees

  return (
    <ThinkingIndicatorChrome
      frontRotation={frontRotation}
      backRotation={backRotation}
      transitionMs={transitionMs}
      intervalMs={intervalMs}
      timeBeforeFirstRotationMs={timeBeforeFirstRotationMs}
    />
  )
}
