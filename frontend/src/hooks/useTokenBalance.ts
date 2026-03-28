'use client'

// Phase 7: implement polling or Supabase realtime subscription to keep
// token balance in sync after Stripe webhook credits tokens.
// For now this is a placeholder — balance is managed directly in SurveyShowdownApp state.

export function useTokenBalance(_userId: string | undefined) {
  // Will return { balance, refresh } in Phase 7
  return { balance: null, refresh: () => {} }
}
