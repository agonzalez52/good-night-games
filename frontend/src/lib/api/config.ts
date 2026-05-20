const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

/** Matches backend default when SIGNUP_BONUS_TOKENS is unset. */
export const DEFAULT_SIGNUP_BONUS_TOKENS = 4

export interface ProductConfig {
  signupBonusTokens: number
}

const PRODUCT_CONFIG_CACHE_TTL_MS = 120_000

let productConfigCache: { expiresAt: number; data: ProductConfig } | null = null
let productConfigInflight: Promise<ProductConfig> | null = null

function parseProductConfig(raw: unknown): ProductConfig {
  if (!raw || typeof raw !== 'object') {
    return { signupBonusTokens: DEFAULT_SIGNUP_BONUS_TOKENS }
  }
  const n = Number((raw as Record<string, unknown>).signupBonusTokens)
  return {
    signupBonusTokens:
      Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_SIGNUP_BONUS_TOKENS,
  }
}

/** GET /api/config — public (deduped in-flight + short memory cache). */
export async function getProductConfig(): Promise<ProductConfig> {
  const now = Date.now()
  if (productConfigCache && productConfigCache.expiresAt > now) {
    return productConfigCache.data
  }
  if (productConfigInflight) return productConfigInflight

  productConfigInflight = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/config`)
      if (!res.ok) throw new Error('Failed to fetch config')
      const data = parseProductConfig(await res.json())
      productConfigCache = { expiresAt: Date.now() + PRODUCT_CONFIG_CACHE_TTL_MS, data }
      return data
    } catch {
      return { signupBonusTokens: DEFAULT_SIGNUP_BONUS_TOKENS }
    } finally {
      productConfigInflight = null
    }
  })()

  return productConfigInflight
}
