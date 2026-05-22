import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  getSignupBonusTokens,
  resetSignupBonusTokensCacheForTests,
} from '../lib/config'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    game_config: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}))

import config from './config'

const surveyShowdownRow = {
  game_id: 'survey_showdown',
  game_name: 'Survey Showdown',
  tokens_per_game: 2,
  is_active: true,
  created_at: new Date('2026-05-21T12:00:00.000Z'),
  updated_at: new Date('2026-05-21T12:00:00.000Z'),
}

describe('GET /api/config', () => {
  const app = new Hono()
  app.route('/api/config', config)

  beforeEach(() => {
    resetSignupBonusTokensCacheForTests()
    delete process.env.SIGNUP_BONUS_TOKENS
    prismaMock.game_config.findMany.mockReset()
    prismaMock.game_config.findMany.mockResolvedValue([surveyShowdownRow])
  })

  it('returns signupBonusTokens from env-backed config', async () => {
    process.env.SIGNUP_BONUS_TOKENS = '7'
    resetSignupBonusTokensCacheForTests()

    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signupBonusTokens: 7,
      games: {
        survey_showdown: {
          name: 'Survey Showdown',
          tokensPerGame: 2,
          isActive: true,
        },
      },
    })
    expect(getSignupBonusTokens()).toBe(7)
  })

  it('defaults signupBonusTokens to 4 when env is unset', async () => {
    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signupBonusTokens: 4,
      games: {
        survey_showdown: {
          name: 'Survey Showdown',
          tokensPerGame: 2,
          isActive: true,
        },
      },
    })
  })

  it('returns games keyed by game_id from DB', async () => {
    prismaMock.game_config.findMany.mockResolvedValue([
      surveyShowdownRow,
      {
        game_id: 'word_blitz',
        game_name: 'Word Blitz',
        tokens_per_game: 3,
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ])

    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      signupBonusTokens: 4,
      games: {
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
      },
    })
    expect(prismaMock.game_config.findMany).toHaveBeenCalledWith({
      orderBy: { game_id: 'asc' },
    })
  })

  it('returns empty games when no rows exist', async () => {
    prismaMock.game_config.findMany.mockResolvedValue([])

    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signupBonusTokens: 4, games: {} })
  })

  it('returns 500 when game config lookup fails', async () => {
    prismaMock.game_config.findMany.mockRejectedValue(new Error('db down'))

    const res = await app.request('/api/config')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Internal server error' })
  })
})
