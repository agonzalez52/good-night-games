'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAccessToken, getTokenBalance } from '@/lib/api/tokens'

function balanceFromChangePayload(payload: { new?: Record<string, unknown> }): number | null {
  const row = payload.new
  if (!row || typeof row.balance !== 'number' || !Number.isFinite(row.balance)) return null
  return row.balance
}

/**
 * Keeps app token balance aligned with Postgres after server-side updates (e.g. Stripe webhook).
 * Uses Supabase Realtime on `user_tokens`; refetches on tab visibility and exposes `refresh` for manual sync.
 * Ensure `user_tokens` is in the `supabase_realtime` publication and RLS allows the user to read their row.
 */
export function useTokenBalance(
  userId: string | undefined,
  onBalanceChange: (balance: number) => void,
): { refresh: () => Promise<void> } {
  const onBalanceRef = useRef(onBalanceChange)

  useEffect(() => {
    onBalanceRef.current = onBalanceChange
  }, [onBalanceChange])

  const refresh = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const balance = await getTokenBalance(token)
      onBalanceRef.current(balance)
    } catch {
      /* ignore transient errors */
    }
  }, [])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    const applyPayload = (payload: { new?: Record<string, unknown> }) => {
      const next = balanceFromChangePayload(payload)
      if (next !== null) onBalanceRef.current(next)
    }

    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`user_tokens:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_tokens',
          filter,
        },
        applyPayload,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_tokens',
          filter,
        },
        applyPayload,
      )
      .subscribe()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  return { refresh }
}
