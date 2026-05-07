'use client'

import { useEffect, useMemo, useRef } from 'react'
import Script from 'next/script'
import type { CSSProperties } from 'react'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const ADSENSE_SCRIPT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

const PLACEMENT_TO_SLOT: Record<AdPlacement, string | undefined> = {
  setup: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SETUP,
  'board-round': process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOARD_ROUND,
  'board-gameover': process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOARD_GAMEOVER,
  faceoff: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FACEOFF,
}

type AdPlacement = 'setup' | 'board-round' | 'board-gameover' | 'faceoff'

interface AdBannerProps {
  placement?: AdPlacement
  style?: CSSProperties
  label?: boolean
}

export function AdBanner({ placement = 'board-round', style = {}, label = true }: AdBannerProps) {
  const adElementRef = useRef<HTMLModElement>(null)
  const didAttemptPushRef = useRef(false)

  const isAdSenseEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true'
  const isTestMode = process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE === 'true'
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim()
  const adSlot = useMemo(() => PLACEMENT_TO_SLOT[placement]?.trim(), [placement])
  const canRenderAdUnit = isAdSenseEnabled && Boolean(adClient) && Boolean(adSlot)

  useEffect(() => {
    didAttemptPushRef.current = false
  }, [placement, adSlot])

  useEffect(() => {
    if (!canRenderAdUnit || didAttemptPushRef.current || !adElementRef.current) return

    if (adElementRef.current.getAttribute('data-adsbygoogle-status')) return

    didAttemptPushRef.current = true
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      didAttemptPushRef.current = false
    }
  }, [canRenderAdUnit])

  return (
    <div style={{ width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', ...style }}>
      {label && <div style={{ position: 'absolute', top: 5, left: 9, fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', opacity: 0.5 }}>Advertisement</div>}
      {canRenderAdUnit ? (
        <>
          <Script
            id="adsbygoogle-script"
            src={`${ADSENSE_SCRIPT_URL}?client=${adClient}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
          <ins
            ref={adElementRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={adClient}
            data-ad-slot={adSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
            data-adtest={isTestMode ? 'on' : undefined}
          />
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', opacity: 0.25, letterSpacing: '0.1em' }}>AD PLACEHOLDER</div>
      )}
    </div>
  )
}
