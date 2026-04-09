import { createClient } from '@/lib/supabase/client'

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

const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms) })

export interface TokenBundle {
  id: string
  name: string
  tokens: number
  base_price: number
  current_price: number
  stripe_price_id: string
  is_most_popular: boolean
  is_active: boolean
}

function normalizeBundle(row: Record<string, unknown>): TokenBundle {
  return {
    id: String(row.id),
    name: String(row.name),
    tokens: Number(row.tokens),
    base_price: Number(row.base_price),
    current_price: Number(row.current_price),
    stripe_price_id: String(row.stripe_price_id),
    is_most_popular: Boolean(row.is_most_popular),
    is_active: Boolean(row.is_active),
  }
}

/** Public catalog; safe to reuse briefly to avoid duplicate requests (Strict Mode + reopen modal). */
const TOKEN_BUNDLES_CACHE_TTL_MS = 120_000

let tokenBundlesCache: { expiresAt: number; data: TokenBundle[] } | null = null
let tokenBundlesInflight: Promise<TokenBundle[]> | null = null

// GET /api/tokens/bundles — public (deduped in-flight + short memory cache)
export async function getTokenBundles(): Promise<TokenBundle[]> {
  const now = Date.now()
  if (tokenBundlesCache && tokenBundlesCache.expiresAt > now)
    return tokenBundlesCache.data
  if (tokenBundlesInflight) return tokenBundlesInflight

  tokenBundlesInflight = (async () => {
    const res = await fetch(`${BACKEND_URL}/api/tokens/bundles`)
    if (!res.ok) throw new Error('Failed to fetch bundles')
    const rows: Record<string, unknown>[] = await res.json()
    return rows.map(normalizeBundle)
  })()
    .then(data => {
      tokenBundlesCache = { expiresAt: Date.now() + TOKEN_BUNDLES_CACHE_TTL_MS, data }
      return data
    })
    .finally(() => {
      tokenBundlesInflight = null
    })

  return tokenBundlesInflight
}

// GET /api/tokens/balance
export async function getTokenBalance(token: string): Promise<number> {
  const res = await authedFetch('/api/tokens/balance', token)
  if (!res.ok) throw new Error('Failed to fetch balance')
  const data = await res.json()
  return data.balance
}

/** Poll until balance reaches at least `atLeast` (e.g. after Stripe webhook credits tokens). */
export async function pollTokenBalanceAtLeast(
  accessToken: string,
  atLeast: number,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<number> {
  const maxAttempts = options?.maxAttempts ?? 30
  const intervalMs = options?.intervalMs ?? 1000
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const balance = await getTokenBalance(accessToken)
    if (balance >= atLeast) return balance
    await sleep(intervalMs)
  }
  throw new Error('Timed out waiting for token balance to update')
}

/** Uses the current Supabase session access token (no args). */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ?? null
}

// POST /api/tokens/spend
export async function spendTokens(token: string, amount: number) {
  const res = await authedFetch('/api/tokens/spend', token, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
  if (!res.ok) throw new Error('Failed to spend tokens')
  return res.json()
}

// POST /api/tokens/purchase — returns { clientSecret } for Stripe PaymentElement
export async function createPurchaseIntent(accessToken: string, bundleId: string): Promise<{ clientSecret: string }> {
  const res = await authedFetch('/api/tokens/purchase', accessToken, {
    method: 'POST',
    body: JSON.stringify({ bundleId }),
  })
  if (!res.ok) {
    let message = 'Failed to create purchase'
    try {
      const body = await res.json()
      if (body?.error && typeof body.error === 'string') message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.json()
}
