import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TOKENS_PER_GAME,
  SURVEY_SHOWDOWN_GAME_ID,
  getGameConfig,
  getProductConfig,
  getTokensPerGame,
} from './config'

describe('getGameConfig', () => {
  const games = {
    survey_showdown: {
      name: 'Survey Showdown',
      tokensPerGame: 2,
      isActive: true,
    },
    word_blitz: {
      name: 'Word Blitz',
      tokensPerGame: 3,
      isActive: false,
    },
  }

  it('returns active game config', () => {
    expect(getGameConfig(games, SURVEY_SHOWDOWN_GAME_ID)).toEqual(games.survey_showdown)
  })

  it('returns null for inactive games', () => {
    expect(getGameConfig(games, 'word_blitz')).toBeNull()
  })

  it('returns null for unknown game_id', () => {
    expect(getGameConfig(games, 'unknown_game')).toBeNull()
  })
})

describe('getTokensPerGame', () => {
  const games = {
    survey_showdown: {
      name: 'Survey Showdown',
      tokensPerGame: 5,
      isActive: true,
    },
    word_blitz: {
      name: 'Word Blitz',
      tokensPerGame: 3,
      isActive: false,
    },
  }

  it('returns DB-configured cost for active games', () => {
    expect(getTokensPerGame(games, SURVEY_SHOWDOWN_GAME_ID)).toBe(5)
  })

  it('uses fallback when game is missing', () => {
    expect(getTokensPerGame({}, SURVEY_SHOWDOWN_GAME_ID)).toBe(DEFAULT_TOKENS_PER_GAME)
  })

  it('uses fallback when game is inactive', () => {
    expect(getTokensPerGame(games, 'word_blitz')).toBe(DEFAULT_TOKENS_PER_GAME)
  })

  it('honors custom fallback', () => {
    expect(getTokensPerGame({}, 'other', 7)).toBe(7)
  })
})

describe('getProductConfig', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://api.test')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('parses signupBonusTokens and games from GET /api/config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          signupBonusTokens: 7,
          games: {
            survey_showdown: {
              name: 'Survey Showdown',
              tokensPerGame: 2,
              isActive: true,
            },
          },
        }),
      }),
    )

    const { getProductConfig: loadConfig } = await import('./config')
    const config = await loadConfig()

    expect(config.signupBonusTokens).toBe(7)
    expect(config.games.survey_showdown).toEqual({
      name: 'Survey Showdown',
      tokensPerGame: 2,
      isActive: true,
    })
    expect(getTokensPerGame(config.games, SURVEY_SHOWDOWN_GAME_ID)).toBe(2)
  })

  it('falls back when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false }),
    )

    const { getProductConfig: loadConfig } = await import('./config')
    const config = await loadConfig()

    expect(config.signupBonusTokens).toBe(4)
    expect(config.games).toEqual({})
    expect(getTokensPerGame(config.games, SURVEY_SHOWDOWN_GAME_ID)).toBe(
      DEFAULT_TOKENS_PER_GAME,
    )
  })

  it('skips invalid game entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          signupBonusTokens: 4,
          games: {
            bad: { name: '', tokensPerGame: 0, isActive: true },
            survey_showdown: {
              name: 'Survey Showdown',
              tokensPerGame: 2,
              isActive: true,
            },
          },
        }),
      }),
    )

    const { getProductConfig: loadConfig } = await import('./config')
    const config = await loadConfig()

    expect(Object.keys(config.games)).toEqual(['survey_showdown'])
  })
})
