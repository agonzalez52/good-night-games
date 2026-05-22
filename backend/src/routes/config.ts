import { Hono } from 'hono'
import { getSignupBonusTokens } from '../lib/config'
import { prisma } from '../lib/prisma'

export interface GameConfigPayload {
  name: string
  tokensPerGame: number
  isActive: boolean
}

export interface ProductConfigResponse {
  signupBonusTokens: number
  games: Record<string, GameConfigPayload>
}

function mapGameConfigRows(
  rows: Array<{
    game_id: string
    game_name: string
    tokens_per_game: number
    is_active: boolean
  }>
): Record<string, GameConfigPayload> {
  return Object.fromEntries(
    rows.map((row) => [
      row.game_id,
      {
        name: row.game_name,
        tokensPerGame: row.tokens_per_game,
        isActive: row.is_active,
      },
    ])
  )
}

const config = new Hono()

// GET /api/config
// Public — no auth required
config.get('/', async (c) => {
  try {
    const rows = await prisma.game_config.findMany({
      orderBy: { game_id: 'asc' },
    })
    return c.json({
      signupBonusTokens: getSignupBonusTokens(),
      games: mapGameConfigRows(rows),
    } satisfies ProductConfigResponse)
  } catch (error) {
    console.error('GET /api/config error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default config
