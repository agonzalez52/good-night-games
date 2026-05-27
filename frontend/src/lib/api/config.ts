const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

/** Matches backend default when SIGNUP_BONUS_TOKENS is unset. */
export const DEFAULT_SIGNUP_BONUS_TOKENS = 4

/** Matches backend default when REFERRAL_TOKENS is unset. */
export const DEFAULT_REFERRAL_TOKENS = 2

/** Matches backend default when MAX_REFERRALS is unset. */
export const DEFAULT_MAX_REFERRALS = 3

/** Fallback when game config is not yet loaded or missing from GET /api/config. */
export const DEFAULT_TOKENS_PER_GAME = 2

export const SURVEY_SHOWDOWN_GAME_ID = 'survey_showdown' as const

export interface GameConfigPayload {
  name: string
  tokensPerGame: number
  isActive: boolean
}

export interface ProductConfig {
  signupBonusTokens: number
  referralTokens: number
  maxReferrals: number
  games: Record<string, GameConfigPayload>
}

const PRODUCT_CONFIG_CACHE_TTL_MS = 120_000

let productConfigCache: { expiresAt: number; data: ProductConfig } | null = null
let productConfigInflight: Promise<ProductConfig> | null = null

function parseGameConfigEntry(raw: unknown): GameConfigPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const tokensPerGame = Number(o.tokensPerGame)
  if (!name || !Number.isFinite(tokensPerGame) || tokensPerGame <= 0) return null
  return {
    name,
    tokensPerGame: Math.floor(tokensPerGame),
    isActive: o.isActive === true,
  }
}

function parseGames(raw: unknown): Record<string, GameConfigPayload> {
  if (!raw || typeof raw !== 'object') return {}
  const games: Record<string, GameConfigPayload> = {}
  for (const [gameId, entry] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseGameConfigEntry(entry)
    if (parsed) games[gameId] = parsed
  }
  return games
}

function parsePositiveInt(raw: unknown, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function parseProductConfig(raw: unknown): ProductConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      signupBonusTokens: DEFAULT_SIGNUP_BONUS_TOKENS,
      referralTokens: DEFAULT_REFERRAL_TOKENS,
      maxReferrals: DEFAULT_MAX_REFERRALS,
      games: {},
    }
  }
  const o = raw as Record<string, unknown>
  return {
    signupBonusTokens: parsePositiveInt(o.signupBonusTokens, DEFAULT_SIGNUP_BONUS_TOKENS),
    referralTokens: parsePositiveInt(o.referralTokens, DEFAULT_REFERRAL_TOKENS),
    maxReferrals: parsePositiveInt(o.maxReferrals, DEFAULT_MAX_REFERRALS),
    games: parseGames(o.games),
  }
}

/** Active game row from GET /api/config, or null if missing/inactive. */
export function getGameConfig(
  games: Record<string, GameConfigPayload>,
  gameId: string
): GameConfigPayload | null {
  const cfg = games[gameId]
  if (!cfg?.isActive) return null
  return cfg
}

/** Token cost for a game; uses DEFAULT_TOKENS_PER_GAME until config loads or on miss. */
export function getTokensPerGame(
  games: Record<string, GameConfigPayload>,
  gameId: string,
  fallback = DEFAULT_TOKENS_PER_GAME
): number {
  return getGameConfig(games, gameId)?.tokensPerGame ?? fallback
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
      return {
        signupBonusTokens: DEFAULT_SIGNUP_BONUS_TOKENS,
        referralTokens: DEFAULT_REFERRAL_TOKENS,
        maxReferrals: DEFAULT_MAX_REFERRALS,
        games: {},
      }
    } finally {
      productConfigInflight = null
    }
  })()

  return productConfigInflight
}
