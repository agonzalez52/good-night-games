import type { CSSProperties } from 'react'
import type { SurveyPackTag } from '@/lib/api/survey-showdown/survey-packs'

/** Horizontal gap between pills in `PackTagPills` rows (must match flex `gap`). */
export const PACK_TAG_PILL_GAP = 6

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/

function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim())
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = parseHexRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Readable foreground on saturated pill backgrounds */
function pillLabelColor(hex: string): string {
  const { r, g, b } = parseHexRgb(hex)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.62 ? '#060914' : 'rgba(255,255,255,0.95)'
}

const PACK_TAG_PILL_LAYOUT = {
  compact: { fontSize: 9, padY: 2, padX: 6 },
  default: { fontSize: 10, padY: 3, padX: 8 },
} as const

export type PackTagPillSize = keyof typeof PACK_TAG_PILL_LAYOUT

export function getPackTagPillLayout(size: PackTagPillSize) {
  return PACK_TAG_PILL_LAYOUT[size]
}

/** Typography, padding, radius, and truncation — shared by visible pills and measurement spans. */
export function getPackTagPillBaseStyle(size: PackTagPillSize): CSSProperties {
  const { fontSize, padY, padX } = getPackTagPillLayout(size)
  return {
    fontFamily: 'var(--font-display)',
    fontSize,
    letterSpacing: '0.04em',
    padding: `${padY}px ${padX}px`,
    borderRadius: 6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }
}

export function getPackTagPillStyleForTag(size: PackTagPillSize, tag: SurveyPackTag): CSSProperties {
  const hex = isHexColor(tag.color) ? tag.color.trim() : null
  return {
    ...getPackTagPillBaseStyle(size),
    background: hex ? rgbaFromHex(hex, 0.22) : 'var(--surface)',
    border: `1px solid ${hex ? rgbaFromHex(hex, 0.45) : 'var(--border)'}`,
    color: hex ? pillLabelColor(hex) : 'var(--text-muted)',
  }
}

/** `+N` overflow chip — same base as content pills; pair label text with this style when measuring. */
export function getPackTagOverflowPillStyle(size: PackTagPillSize): CSSProperties {
  return {
    ...getPackTagPillBaseStyle(size),
    background: 'var(--surface-2)',
    border: '1px solid var(--border-2)',
    color: 'var(--text-muted)',
    cursor: 'default',
  }
}
