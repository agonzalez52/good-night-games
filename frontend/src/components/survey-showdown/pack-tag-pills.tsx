'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SurveyPackTag } from '@/lib/api/survey-showdown/survey-packs'
import {
  PACK_TAG_PILL_GAP,
  getPackTagOverflowPillStyle,
  getPackTagPillStyleForTag,
  type PackTagPillSize,
} from '@/components/survey-showdown/pack-tag-pill-styles'

const WIDTH_EPSILON = 0.5

export interface PackTagPillsProps {
  tags: SurveyPackTag[]
  maxVisible: number
  size?: PackTagPillSize
  /** When true, pills stay on one row (no wrap) — e.g. closed pack picker beside ellipsized title */
  nowrap?: boolean
  /** When `end`, pill rows align to the trailing edge (e.g. beside a token icon) */
  align?: 'start' | 'end'
  /** When true with nowrap, the row can shrink inside a flex slot so pills ellipsize instead of forcing overflow */
  inFluidSlot?: boolean
}

/** Shared catalog tag pills (hex fill + border, or neutral when `color` is null). Overflow: +N with full hidden labels in `title`. */
export function PackTagPills({
  tags,
  maxVisible,
  size = 'default',
  nowrap = false,
  align = 'start',
  inFluidSlot = false,
}: PackTagPillsProps) {
  if (!tags.length) return null
  const visible = tags.slice(0, maxVisible)
  const hidden = tags.slice(maxVisible)
  const overflowTitle = hidden.map(t => t.label).join(', ')
  const overflowAria = hidden.length ? `Additional tags: ${overflowTitle}` : undefined

  const fluidPillStyle = inFluidSlot
    ? {
        minWidth: 0 as const,
        flexShrink: 1 as const,
        flexGrow: 0 as const,
        flexBasis: 'auto' as const,
      }
    : undefined

  const singleFluidPillStyle = inFluidSlot
    ? { ...fluidPillStyle, maxWidth: '100%' as const }
    : fluidPillStyle

  const pillsInner = visible.map(tag => (
    <span
      key={tag.id}
      style={{
        ...getPackTagPillStyleForTag(size, tag),
        ...(!inFluidSlot ? { maxWidth: '100%' as const } : null),
        ...(inFluidSlot && nowrap
          ? visible.length === 1
            ? singleFluidPillStyle
            : fluidPillStyle
          : null),
      }}
    >
      {tag.label}
    </span>
  ))

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: nowrap ? 'nowrap' : 'wrap',
        gap: PACK_TAG_PILL_GAP,
        alignItems: 'center',
        justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
        minWidth: 0,
        flexShrink: nowrap ? (inFluidSlot ? 1 : 0) : undefined,
        width: inFluidSlot ? '100%' : undefined,
        maxWidth: inFluidSlot ? '100%' : undefined,
        overflow: inFluidSlot ? 'hidden' : undefined,
      }}
    >
      {inFluidSlot && nowrap ? (
        <div
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: PACK_TAG_PILL_GAP,
            alignItems: 'center',
            overflow: 'hidden',
            justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
          }}
        >
          {pillsInner}
        </div>
      ) : (
        pillsInner
      )}
      {hidden.length > 0 && (
        <span
          title={overflowTitle}
          aria-label={overflowAria}
          style={{ ...getPackTagOverflowPillStyle(size), flexShrink: 0 }}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  )
}

export interface PackTagPillsResponsiveProps {
  tags: SurveyPackTag[]
  size?: PackTagPillSize
  align?: 'start' | 'end'
  /** First paint before measurement — matches previous fixed cap */
  initialMaxVisible?: number
}

function measureElementWidth(el: HTMLElement): number {
  return el.getBoundingClientRect().width
}

function computeMaxVisibleForBudget(
  budget: number,
  tagWidths: readonly number[],
  /** Width of the `+{hidden}` chip; use measured `+${tags.length - 1}` so all hidden counts fit (conservative). */
  overflowChipWidth: number,
): number {
  const tagCount = tagWidths.length
  if (tagCount === 0) return 0
  // Natural-width fit is only for how many whole pills to show; a single pill always
  // stays visible and ellipsizes inside the slot when intrinsic width exceeds the budget.
  if (!Number.isFinite(budget) || budget <= 0) return 1

  let best = 1
  for (let k = tagCount; k >= 1; k--) {
    let sum = 0
    for (let i = 0; i < k; i++) sum += tagWidths[i]!
    sum += (k - 1) * PACK_TAG_PILL_GAP
    if (k < tagCount) {
      sum += PACK_TAG_PILL_GAP + overflowChipWidth
    }
    if (sum <= budget + WIDTH_EPSILON) {
      best = k
      break
    }
  }
  return Math.min(tagCount, Math.max(1, best))
}

/**
 * Fits as many tag pills as the flex slot allows using ResizeObserver + DOM widths (same styles as visible pills).
 */
export function PackTagPillsResponsive({
  tags,
  size = 'default',
  align = 'start',
  initialMaxVisible = 2,
}: PackTagPillsResponsiveProps) {
  const slotRef = useRef<HTMLDivElement>(null)
  const measureRootRef = useRef<HTMLDivElement>(null)

  const tagsKey = useMemo(
    () => tags.map(t => `${t.id}\0${t.label}\0${t.color ?? ''}`).join('\n'),
    [tags],
  )

  // `tagsKey` fully encodes list identity; avoids effect churn on new array references from parents.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tagsKey is derived from `tags`
  const tagsSnapshot = useMemo(() => tags, [tagsKey])

  const [prevTagsKey, setPrevTagsKey] = useState(tagsKey)
  const [maxVisible, setMaxVisible] = useState(() =>
    tags.length ? Math.min(initialMaxVisible, tags.length) : 0,
  )

  if (prevTagsKey !== tagsKey) {
    setPrevTagsKey(tagsKey)
    setMaxVisible(tags.length ? Math.min(initialMaxVisible, tags.length) : 0)
  }

  useLayoutEffect(() => {
    const tags = tagsSnapshot
    if (!tags.length) {
      setMaxVisible(0)
      return
    }

    const runMeasure = () => {
      const slot = slotRef.current
      const budget = slot?.clientWidth ?? 0
      const measureRoot = measureRootRef.current

      const tagWidths = tags.map((_, i) => {
        const el = measureRoot?.querySelector(`[data-pack-tag-pill="${i}"]`) as HTMLElement | null
        return el ? measureElementWidth(el) : 0
      })

      const overflowEl = measureRoot?.querySelector('[data-pack-tag-overflow="max"]') as HTMLElement | null
      const overflowChipWidth =
        tags.length > 1 ? (overflowEl ? measureElementWidth(overflowEl) : 0) : 0

      const next = computeMaxVisibleForBudget(budget, tagWidths, overflowChipWidth)
      setMaxVisible(prev => (prev === next ? prev : next))
    }

    runMeasure()

    const slot = slotRef.current
    const ro = slot ? new ResizeObserver(() => runMeasure()) : null
    if (slot && ro) ro.observe(slot)

    let cancelled = false
    const safeRunMeasure = () => {
      if (!cancelled) runMeasure()
    }

    const fontsReady = document.fonts?.ready
    if (fontsReady) void fontsReady.then(safeRunMeasure)

    const fonts = document.fonts
    const onLoadingDone = () => safeRunMeasure()
    fonts?.addEventListener?.('loadingdone', onLoadingDone)

    return () => {
      cancelled = true
      ro?.disconnect()
      fonts?.removeEventListener?.('loadingdone', onLoadingDone)
    }
  }, [tagsSnapshot, size, initialMaxVisible])

  if (!tags.length) return null

  return (
    <>
      <div
        ref={slotRef}
        style={{
          minWidth: 0,
          flex: '1 1 0%',
          maxWidth: '100%',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: align === 'end' ? 'flex-end' : 'flex-start',
        }}
      >
        <PackTagPills tags={tags} maxVisible={maxVisible} size={size} nowrap align={align} inFluidSlot />
      </div>
      <div
        ref={measureRootRef}
        aria-hidden
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
        }}
      >
        {tags.map((tag, i) => (
          <span
            key={tag.id}
            data-pack-tag-pill={i}
            style={{ ...getPackTagPillStyleForTag(size, tag), display: 'inline-block', width: 'max-content' }}
          >
            {tag.label}
          </span>
        ))}
        {tags.length > 1 && (
          <span
            data-pack-tag-overflow="max"
            style={{
              ...getPackTagOverflowPillStyle(size),
              display: 'inline-block',
              width: 'max-content',
            }}
          >
            +{tags.length - 1}
          </span>
        )}
      </div>
    </>
  )
}
