'use client'

// ─── AD BANNER ────────────────────────────────────────────────────────────────
// Phase 10: replace the inner div with a real AdSense <ins> tag once approved.
// AdSense snippet (activate in Phase 10):
//   <ins className="adsbygoogle" style={{display:"block"}}
//        data-ad-client="ca-pub-XXXXXXXX" data-ad-slot="XXXXXXXX"
//        data-ad-format="auto" data-full-width-responsive="true"/>
// Then call: (adsbygoogle = window.adsbygoogle || []).push({}) in a useEffect.
export function AdBanner({ style = {}, label = true }: { style?: React.CSSProperties; label?: boolean }) {
  return (
    <div style={{ width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', ...style }}>
      {label && <div style={{ position: 'absolute', top: 5, left: 9, fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', opacity: 0.5 }}>Advertisement</div>}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)', opacity: 0.25, letterSpacing: '0.1em' }}>AD PLACEHOLDER</div>
    </div>
  )
}
