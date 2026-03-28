// Phase 7: implement these fetch helpers
// Each wraps a backend endpoint with the user's JWT from Supabase session.
// Usage: import { getTokenBalance } from '@/lib/api/tokens'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

async function authedFetch(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
}

// GET /api/tokens/balance
export async function getTokenBalance(token: string): Promise<number> {
  const res = await authedFetch('/api/tokens/balance', token)
  if (!res.ok) throw new Error('Failed to fetch balance')
  const data = await res.json()
  return data.balance
}

// GET /api/tokens/bundles
export async function getTokenBundles(token: string) {
  const res = await authedFetch('/api/tokens/bundles', token)
  if (!res.ok) throw new Error('Failed to fetch bundles')
  return res.json()
}

// POST /api/tokens/spend — Phase 7: call before commitGame for premium packs
export async function spendTokens(token: string, amount: number) {
  const res = await authedFetch('/api/tokens/spend', token, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
  if (!res.ok) throw new Error('Failed to spend tokens')
  return res.json()
}

// POST /api/tokens/purchase — Phase 7: returns { clientSecret } for Stripe
export async function createPurchaseIntent(token: string, bundleId: string) {
  const res = await authedFetch('/api/tokens/purchase', token, {
    method: 'POST',
    body: JSON.stringify({ bundleId }),
  })
  if (!res.ok) throw new Error('Failed to create purchase intent')
  return res.json()
}
