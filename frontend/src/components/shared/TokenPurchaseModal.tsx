'use client'

import { useState } from 'react'
import TokenSVG from '@/components/shared/TokenSVG'
import { TOKEN_BUNDLES, TOKENS_PER_GAME } from '@/lib/constants'

// Phase 7: replace mock setTimeout in handlePurchase with Stripe PaymentIntent flow.
// 1. Call POST /api/tokens/purchase { bundleId } → returns { clientSecret }
// 2. Mount <PaymentElement> from @stripe/react-stripe-js
// 3. On stripe.confirmPayment success, backend webhook credits tokens
// 4. Frontend polls /api/tokens/balance or uses Supabase realtime for updated balance

interface TokenBundle {
  id: string
  name: string
  tokens: number
  base_price: number
  current_price: number
  stripe_price_id: string
  is_most_popular: boolean
  is_active: boolean
}

interface TokenPurchaseModalProps {
  onClose: () => void
  onPurchase: (tokenAmount: number) => void
  currentBalance: number
  bundles?: TokenBundle[]
}

export default function TokenPurchaseModal({ onClose, onPurchase, currentBalance, bundles: bundlesProp }: TokenPurchaseModalProps) {
  // Phase 7: replace TOKEN_BUNDLES fallback with fetched data from GET /api/tokens/bundles
  const rawBundles = bundlesProp || TOKEN_BUNDLES

  const bundles = rawBundles
    .filter(b => b.is_active)
    .sort((a, b) => a.base_price - b.base_price)

  const bestValueId = bundles.length
    ? bundles.reduce((best, b) =>
      (b.current_price / b.tokens) < (best.current_price / best.tokens) ? b : best
    ).id
    : null

  const [selected, setSelected] = useState(() =>
    bundles.find(b => b.is_most_popular) || bundles[bundles.length - 1]
  )
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<TokenBundle | null>(null)

  function handlePurchase() {
    if (!selected) return
    setLoading(true)
    // Phase 7: replace with Stripe PaymentIntent flow
    setTimeout(() => {
      setLoading(false)
      setSuccess(selected)
      setTimeout(() => { onPurchase(selected.tokens); onClose() }, 1200)
    }, 900)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px', width: 'min(520px,96vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#F0A500', display: 'flex', alignItems: 'center', gap: 8 }}>Get Tokens <TokenSVG size={22} /></div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Each game costs {TOKENS_PER_GAME} tokens. Current balance: <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>{currentBalance}</span></div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {bundles.map(b => {
            const isSel = selected?.id === b.id
            const isBestValue = b.id === bestValueId
            const hasBadge = b.is_most_popular || isBestValue
            const isOnSale = b.current_price < b.base_price
            return (
              <div key={b.id} onClick={() => setSelected(b)} style={{ position: 'relative', borderRadius: 12, padding: '14px 16px', background: isSel ? 'rgba(240,165,0,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isSel ? 'rgba(240,165,0,0.55)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', transition: 'all 0.18s ease', boxShadow: isSel ? '0 0 0 1px rgba(240,165,0,0.25)' : 'none', display: 'flex', alignItems: 'center', gap: 14, marginTop: hasBadge ? 14 : 0 }}>
                {hasBadge && (
                  <div style={{ position: 'absolute', top: -1, right: 12, transform: 'translateY(-50%)', display: 'flex', gap: 5 }}>
                    {b.is_most_popular && <div style={{ background: 'linear-gradient(135deg,#9B6DFF,#6B3DCC)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.1em', padding: '3px 9px', borderRadius: '6px' }}>MOST POPULAR</div>}
                    {isBestValue && <div style={{ background: 'linear-gradient(135deg,#0FD98A,#0AAD6E)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '0.1em', padding: '3px 9px', borderRadius: '6px' }}>BEST VALUE</div>}
                  </div>
                )}
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isSel ? '#F0A500' : 'rgba(255,255,255,0.18)'}`, background: isSel ? '#F0A500' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                  {isSel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#060914' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text)', letterSpacing: '0.04em' }}>{b.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}><TokenSVG size={14} /></span>
                  <span style={{ fontFamily: 'var(--font-score)', fontSize: 28, color: '#F0A500', lineHeight: 1 }}>{b.tokens}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)' }}>tokens</span>
                </div>
                <div style={{ flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
                  {isOnSale && <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-faint)', textDecoration: 'line-through', lineHeight: 1, marginBottom: 2 }}>${b.base_price.toFixed(2)}</div>}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: isOnSale ? '#0FD98A' : 'var(--text)', letterSpacing: '0.02em' }}>${b.current_price.toFixed(2)}</div>
                </div>
              </div>
            )
          })}
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '14px', borderRadius: 12, background: 'rgba(15,217,138,0.1)', border: '1px solid rgba(15,217,138,0.3)', fontFamily: 'var(--font-display)', fontSize: 14, color: '#0FD98A', letterSpacing: '0.06em' }}>
            ✓ {success.tokens} TOKENS ADDED!
          </div>
        ) : (
          <button onClick={handlePurchase} disabled={!selected || loading}
            style={{ width: '100%', padding: '14px', borderRadius: 12, background: selected ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.05)', color: selected ? '#fff' : 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: selected ? 'none' : '1px solid rgba(255,255,255,0.08)', boxShadow: selected ? '0 4px 18px rgba(240,165,0,0.35)' : 'none', transition: 'all 0.2s ease' }}>
            {loading ? 'PROCESSING...' : (selected ? `BUY ${selected.tokens} TOKENS FOR $${selected.current_price.toFixed(2)}` : 'SELECT A BUNDLE')}
          </button>
        )}

        <div style={{ textAlign: 'center', marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)' }}>
          🔒 Payments powered by Stripe · Secure checkout
        </div>
      </div>
    </div>
  )
}
