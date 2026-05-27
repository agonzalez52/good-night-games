'use client'

import TokenSVG from '@/components/shared/TokenSVG'

interface SpendConfirmModalProps {
  balance: number
  tokensPerGame: number
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  onBuyMore: () => void
  confirmLoading?: boolean
  errorMessage?: string | null
}

export default function SpendConfirmModal({ balance, tokensPerGame, onConfirm, onCancel, onBuyMore, confirmLoading = false, errorMessage = null }: SpendConfirmModalProps) {
  const insufficient = balance < tokensPerGame

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '28px', width: 'min(380px,96vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)', textAlign: 'center' }}>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>{insufficient ? '😬' : <TokenSVG size={48} />}</div>

        {insufficient ? (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#FF4D6A', marginBottom: 8 }}>Not Enough Tokens</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              You need <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>{tokensPerGame} tokens</span> to start a game but your balance is <span style={{ color: '#FF4D6A', fontFamily: 'var(--font-display)' }}>{balance}</span>.
            </div>
            <button onClick={onBuyMore} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.3)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <TokenSVG size={16} /> GET TOKENS
            </button>
            <button onClick={onCancel} style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>Ready to Play?</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
              This game costs <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>{tokensPerGame} tokens</span>. Your balance after: <span style={{ color: '#F0A500', fontFamily: 'var(--font-display)' }}>{balance - tokensPerGame}</span>.
            </div>
            {errorMessage && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#FF4D6A', marginBottom: 12, lineHeight: 1.5 }}>{errorMessage}</div>
            )}
            <button
              onClick={() => void onConfirm()}
              disabled={confirmLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg,#F0A500,#C07A00)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 15, letterSpacing: '0.08em', border: 'none', boxShadow: '0 4px 18px rgba(240,165,0,0.35)', marginBottom: 10,
                opacity: confirmLoading ? 0.55 : 1, cursor: confirmLoading ? 'wait' : 'pointer',
              }}
            >
              {confirmLoading ? 'LOADING…' : '▶ START GAME'}
            </button>
            <button onClick={onCancel} style={{ width: '100%', padding: '11px', borderRadius: 12, background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}
