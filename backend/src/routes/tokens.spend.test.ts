import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    game_config: {
      findFirst: vi.fn(),
    },
    user_tokens: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../lib/stripe', () => ({
  stripe: {},
}))

vi.mock('../middleware/auth', () => ({
  requireAuth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user_1')
    await next()
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}))

import tokens from './tokens'

const surveyShowdownConfig = {
  game_id: 'survey_showdown',
  game_name: 'Survey Showdown',
  tokens_per_game: 2,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
}

describe('POST /api/tokens/spend', () => {
  const app = new Hono()
  app.route('/api/tokens', tokens)

  beforeEach(() => {
    prismaMock.game_config.findFirst.mockReset()
    prismaMock.user_tokens.findUnique.mockReset()
    prismaMock.user_tokens.upsert.mockReset()
    prismaMock.game_config.findFirst.mockResolvedValue(surveyShowdownConfig)
    prismaMock.user_tokens.findUnique.mockResolvedValue({ balance: 5 })
    prismaMock.user_tokens.upsert.mockResolvedValue({ balance: 3 })
  })

  it('deducts tokens_per_game for a valid active game_id', async () => {
    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'survey_showdown' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      balance: 3,
      tokensSpent: 2,
      gameId: 'survey_showdown',
    })
    expect(prismaMock.game_config.findFirst).toHaveBeenCalledWith({
      where: { game_id: 'survey_showdown', is_active: true },
    })
    expect(prismaMock.user_tokens.upsert).toHaveBeenCalledWith({
      where: { user_id: 'user_1' },
      update: {
        balance: { decrement: 2 },
        lifetime_spent: { increment: 2 },
      },
      create: {
        user_id: 'user_1',
        balance: 0,
        lifetime_purchased: 0,
        lifetime_spent: 2,
      },
    })
  })

  it('uses dynamic cost from game_config', async () => {
    prismaMock.game_config.findFirst.mockResolvedValue({
      ...surveyShowdownConfig,
      tokens_per_game: 3,
    })
    prismaMock.user_tokens.findUnique.mockResolvedValue({ balance: 5 })
    prismaMock.user_tokens.upsert.mockResolvedValue({ balance: 2 })

    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'survey_showdown' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      balance: 2,
      tokensSpent: 3,
      gameId: 'survey_showdown',
    })
    expect(prismaMock.user_tokens.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          balance: { decrement: 3 },
          lifetime_spent: { increment: 3 },
        },
      })
    )
  })

  it('returns 404 when game_id is unknown or inactive', async () => {
    prismaMock.game_config.findFirst.mockResolvedValue(null)

    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'unknown_game' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Game not found or inactive' })
    expect(prismaMock.user_tokens.upsert).not.toHaveBeenCalled()
  })

  it('returns 402 when balance is below tokens_per_game', async () => {
    prismaMock.user_tokens.findUnique.mockResolvedValue({ balance: 1 })

    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'survey_showdown' }),
    })

    expect(res.status).toBe(402)
    expect(await res.json()).toEqual({ error: 'Insufficient tokens' })
    expect(prismaMock.user_tokens.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when game_id is missing', async () => {
    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 2 }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
    expect(prismaMock.game_config.findFirst).not.toHaveBeenCalled()
  })

  it('returns 400 when game_id is empty', async () => {
    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: '' }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid request' })
    expect(prismaMock.game_config.findFirst).not.toHaveBeenCalled()
  })

  it('deducts when balance equals tokens_per_game exactly', async () => {
    prismaMock.user_tokens.findUnique.mockResolvedValue({ balance: 2 })
    prismaMock.user_tokens.upsert.mockResolvedValue({ balance: 0 })

    const res = await app.request('/api/tokens/spend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'survey_showdown' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      balance: 0,
      tokensSpent: 2,
      gameId: 'survey_showdown',
    })
  })
})
