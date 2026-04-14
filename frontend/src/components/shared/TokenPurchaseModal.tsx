'use client'

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import TokenSVG from '@/components/shared/TokenSVG'
import { TOKENS_PER_GAME } from '@/lib/constants'
import {
  createPurchaseIntent,
  getAccessToken,
  getTokenBundles,
  pollTokenBalanceAtLeast,
  type TokenBundle,
} from '@/lib/api/tokens'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
const stripePromise = stripePublishableKey !== '' ? loadStripe(stripePublishableKey) : null

const BUNDLE_SKELETON_COUNT = 3

/** Matches FaceOff/Board active bar: gradient + background-size so global `shimmer` keyframes sweep visibly. */
const bundleCardShimmerLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: 'linear-gradient(90deg, transparent, rgba(240, 165, 0, 0.14), transparent)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
}

function BundleCardSkeleton({ staggerIndex }: { staggerIndex: number }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        padding: '14px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          ...bundleCardShimmerLayer,
          animationDelay: `${staggerIndex * 0.14}s`,
        }}
        aria-hidden
      />
      <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: 'var(--surface)', position: 'relative', zIndex: 1 }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ height: 14, width: 'min(200px, 58%)', borderRadius: 7, background: 'var(--surface-2)' }} aria-hidden />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative', zIndex: 1 }} aria-hidden>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--surface-2)' }} />
        <div style={{ width: 40, height: 24, borderRadius: 6, background: 'var(--surface-2)' }} />
      </div>
      <div style={{ flexShrink: 0, minWidth: 52, position: 'relative', zIndex: 1 }} aria-hidden>
        <div style={{ width: 48, height: 11, borderRadius: 5, background: 'var(--surface-2)', marginLeft: 'auto', marginBottom: 5 }} />
        <div style={{ width: 40, height: 17, borderRadius: 6, background: 'var(--surface-2)', marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

interface PaymentStepBodyProps {
  accessToken: string
  startingBalance: number
  tokensToAdd: number
  onCancel: () => void
  onPaid: (newBalance: number) => void
}

function PaymentStepBody({
  accessToken,
  startingBalance,
  tokensToAdd,
  onCancel,
  onPaid,
}: PaymentStepBodyProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setLocalErr(null)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}${window.location.search}`,
      },
      redirect: 'if_required',
    })
    if (error) {
      setBusy(false)
      setLocalErr(error.message ?? 'Payment failed')
      return
    }
    try {
      const newBalance = await pollTokenBalanceAtLeast(accessToken, startingBalance + tokensToAdd)
      setBusy(false)
      onPaid(newBalance)
    } catch {
      setBusy(false)
      setLocalErr('Payment succeeded, but your balance is still updating. Wait a moment or refresh the page.')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '12px 0' }}>
        <PaymentElement />
      </div>
      {localErr && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red)' }}>
          {localErr}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 12,
            background: 'rgba(77,126,255,0.12)',
            color: 'var(--blue)',
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            letterSpacing: '0.06em',
            border: '1px solid rgba(77,126,255,0.35)',
            opacity: busy ? 0.38 : 1,
          }}
        >
          BACK
        </button>
        <button
          type="submit"
          disabled={!stripe || busy}
          style={{
            flex: 2,
            padding: '12px',
            borderRadius: 12,
            background: 'linear-gradient(135deg,#F0A500,#C07A00)',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            letterSpacing: '0.08em',
            border: 'none',
            boxShadow: '0 4px 18px rgba(240,165,0,0.35)',
            opacity: !stripe || busy ? 0.38 : 1,
          }}
        >
          {busy ? 'PROCESSING...' : 'PAY NOW'}
        </button>
      </div>
    </form>
  )
}

interface TokenPurchaseModalProps {
  onClose: () => void
  /** Called after Stripe confirms payment and balance reflects the webhook credit. */
  onPurchase: (tokenAmount: number, newBalance: number) => void
  currentBalance: number
}

export default function TokenPurchaseModal({ onClose, onPurchase, currentBalance }: TokenPurchaseModalProps) {
  const [bundles, setBundles] = useState<TokenBundle[]>([])
  const [bundlesLoading, setBundlesLoading] = useState(true)
  const [bundlesError, setBundlesError] = useState<string | null>(null)

  const [step, setStep] = useState<'pick' | 'pay' | 'success'>('pick')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [payAccessToken, setPayAccessToken] = useState<string | null>(null)
  const [startPayLoading, setStartPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [success, setSuccess] = useState<TokenBundle | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await getTokenBundles()
        if (!cancelled) setBundles(rows.filter(b => b.is_active))
      } catch {
        if (!cancelled) setBundlesError('Could not load token packs.')
      } finally {
        if (!cancelled) setBundlesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const sortedBundles = useMemo(
    () => [...bundles].sort((a, b) => a.base_price - b.base_price),
    [bundles],
  )

  const bestValueId = sortedBundles.length
    ? sortedBundles.reduce((best, b) =>
      (b.current_price / b.tokens) < (best.current_price / best.tokens) ? b : best
    ).id
    : null

  const [selected, setSelected] = useState<TokenBundle | null>(null)
  useEffect(() => {
    if (sortedBundles.length === 0) return
    setSelected(prev => {
      if (prev && sortedBundles.some(b => b.id === prev.id)) return prev
      return sortedBundles.find(b => b.is_most_popular) ?? sortedBundles[sortedBundles.length - 1] ?? null
    })
  }, [sortedBundles])

  async function startCheckout() {
    if (!selected) return
    setPayError(null)
    if (stripePromise === null) {
      setPayError('Payments are not configured (missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).')
      return
    }
    const token = await getAccessToken()
    if (token == null) {
      setPayError('Sign in to purchase tokens.')
      return
    }
    setStartPayLoading(true)
    try {
      const { clientSecret: secret } = await createPurchaseIntent(token, selected.id)
      setClientSecret(secret)
      setPayAccessToken(token)
      setStep('pay')
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Could not start checkout')
    } finally {
      setStartPayLoading(false)
    }
  }

  function resetPayFlow() {
    setStep('pick')
    setClientSecret(null)
    setPayAccessToken(null)
    setPayError(null)
  }

  function handlePaid(newBalance: number) {
    if (!selected) return
    const bundle = selected
    setSuccess(bundle)
    setStep('success')
    setClientSecret(null)
    setPayAccessToken(null)
    window.setTimeout(() => {
      onPurchase(bundle.tokens, newBalance)
      onClose()
    }, 1200)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'rgba(8,12,28,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        width: 'min(520px,92vw)',
        maxHeight: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0, padding: '28px 28px 0 28px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#F0A500', display: 'flex', alignItems: 'center', gap: 8 }}>
              {step === 'pay' ? 'Complete payment' : 'Get Tokens'}
              <TokenSVG size={22} />
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Each game costs {TOKENS_PER_GAME} tokens. Current balance:
              {' '}
              <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>{currentBalance}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, fontSize: 16, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '22px 28px 28px 28px',
        }}>

        {bundlesLoading && (
          <div role="status" aria-busy="true" aria-label="Loading token packs" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {Array.from({ length: BUNDLE_SKELETON_COUNT }, (_, i) => (
              <BundleCardSkeleton key={i} staggerIndex={i} />
            ))}
          </div>
        )}
        {!bundlesLoading && bundlesError && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--red)', textAlign: 'center', padding: 16 }}>{bundlesError}</div>
        )}

        {!bundlesLoading && !bundlesError && step === 'pick' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {sortedBundles.map(b => {
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

            {payError && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--red)', marginBottom: 12, textAlign: 'center' }}>{payError}</div>
            )}

            <button type="button" onClick={startCheckout} disabled={!selected || startPayLoading || sortedBundles.length === 0}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: selected ? 'linear-gradient(135deg,#F0A500,#C07A00)' : 'rgba(255,255,255,0.05)', color: selected ? '#fff' : 'var(--text-faint)', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: selected ? 'none' : '1px solid rgba(255,255,255,0.08)', boxShadow: selected ? '0 4px 18px rgba(240,165,0,0.35)' : 'none', transition: 'all 0.2s ease', opacity: !selected || startPayLoading ? 0.38 : 1 }}>
              {startPayLoading ? 'PREPARING CHECKOUT...' : (selected ? `BUY ${selected.tokens} TOKENS FOR $${selected.current_price.toFixed(2)}` : 'SELECT A BUNDLE')}
            </button>
          </>
        )}

        {!bundlesLoading && !bundlesError && step === 'pay' && clientSecret && payAccessToken && stripePromise && selected && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: '#F0A500',
                  colorBackground: '#080c1c',
                  colorText: '#EEF2FF',
                  colorDanger: '#FF4D6A',
                  borderRadius: '10px',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                },
              },
            }}
          >
            <div style={{ marginBottom: 12, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-muted)' }}>
              {selected.name} · {selected.tokens} tokens · ${selected.current_price.toFixed(2)}
            </div>
            <PaymentStepBody
              accessToken={payAccessToken}
              startingBalance={currentBalance}
              tokensToAdd={selected.tokens}
              onCancel={resetPayFlow}
              onPaid={handlePaid}
            />
          </Elements>
        )}

        {!bundlesLoading && !bundlesError && step === 'success' && success && (
          <div style={{ textAlign: 'center', padding: '14px', borderRadius: 12, background: 'rgba(15,217,138,0.1)', border: '1px solid rgba(15,217,138,0.3)', fontFamily: 'var(--font-display)', fontSize: 14, color: '#0FD98A', letterSpacing: '0.06em' }}>
            ✓ {success.tokens} TOKENS ADDED!
          </div>
        )}

        {step === 'pick' && (
          <div style={{ textAlign: 'center', marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-faint)' }}>
            Secure checkout with Stripe
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
