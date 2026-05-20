import type { CSSProperties } from 'react'

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

const STAR_POINTS = fourPointStar(20, 20, 12.5, 3.8)

interface StackedStarsIconProps {
  size?: number
  style?: CSSProperties
}

/** Static stacked 4-point stars (gold back, blue front) — matches AIJudgeThinkingIndicator. */
export function StackedStarsIcon({ size = 20, style }: StackedStarsIconProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'rotate(22.5deg)',
          filter: 'drop-shadow(0 0 4px rgba(240,165,0,0.6))',
        }}
      >
        <polygon points={STAR_POINTS} fill="rgba(240,165,0,0.9)" />
      </svg>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        style={{
          position: 'absolute',
          inset: 0,
          transform: 'rotate(-22.5deg)',
          filter: 'drop-shadow(0 0 4px rgba(77,126,255,0.55))',
        }}
      >
        <polygon points={STAR_POINTS} fill="rgba(120,170,255,0.92)" />
      </svg>
    </span>
  )
}
