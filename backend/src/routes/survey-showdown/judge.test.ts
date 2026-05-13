import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const authState = vi.hoisted(() => ({ userId: null as string | null }))

const prismaMock = vi.hoisted(() => ({
  judge_cache: {
    findMany: vi.fn(),
    count: vi.fn(),
    createMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

const anthropicCreate = vi.fn()

vi.mock('../../middleware/auth', () => ({
  optionalAuth: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    if (authState.userId) c.set('userId', authState.userId)
    await next()
  },
}))

vi.mock('../../middleware/rateLimit', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  },
}))

vi.mock('../../lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('../../lib/anthropic', () => ({
  anthropic: {
    messages: {
      create: (...args: unknown[]) => anthropicCreate(...args),
    },
  },
}))

import judge from './judge'
import {
  flushJudgeBackgroundJobsForTests,
  resetJudgeBackgroundJobChainForTests,
  setJudgeBackgroundQueueForTests,
} from './judge-background'

const makeApp = (): Hono => {
  const app = new Hono()
  app.route('/api/survey-showdown/judge', judge)
  return app
}

const flushJudgeBackground = (): Promise<void> => flushJudgeBackgroundJobsForTests()

const baseBody = {
  input: 'wrong guess',
  questionText: 'Name something you take to the beach.',
  answerIds: ['ans-1', 'ans-2'],
  revealedIndices: [] as number[],
  answers: [
    { answer: 'Towel', points: 40 },
    { answer: 'Sunscreen', points: 35 },
  ],
}

describe('POST /api/survey-showdown/judge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.userId = null
    resetJudgeBackgroundJobChainForTests()
    setJudgeBackgroundQueueForTests(null)
    prismaMock.judge_cache.findMany.mockResolvedValue([])
    prismaMock.judge_cache.count.mockResolvedValue(0)
    prismaMock.judge_cache.createMany.mockResolvedValue({ count: 2 })
    prismaMock.judge_cache.findFirst.mockResolvedValue(null)
    prismaMock.judge_cache.create.mockResolvedValue({})
    prismaMock.judge_cache.update.mockResolvedValue({})
    anthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            match: false,
            index: null,
            confidence: 0.2,
            matchType: 'none',
          }),
        },
      ],
    })
  })

  it('returns pending_ai for a guest cache miss without calling the model synchronously', async () => {
    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'pending_ai',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()

    await flushJudgeBackground()

    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
  })

  it('does not insert negative judge_cache rows when background AI returns a miss for a guest', async () => {
    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })
    expect(res.status).toBe(200)
    await flushJudgeBackground()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
  })

  it('inserts negative judge_cache rows after flush when the model returns a miss and the user is signed in', async () => {
    authState.userId = 'user-uuid-1'
    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_miss',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()

    await flushJudgeBackground()

    expect(prismaMock.judge_cache.createMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.createMany).toHaveBeenCalledWith({
      data: [
        {
          game_id: 'survey_showdown',
          user_id: 'user-uuid-1',
          input_text: 'wrong guess',
          survey_answer_id: 'ans-1',
          matched_answer: null,
          is_match: false,
        },
        {
          game_id: 'survey_showdown',
          user_id: 'user-uuid-1',
          input_text: 'wrong guess',
          survey_answer_id: 'ans-2',
          matched_answer: null,
          is_match: false,
        },
      ],
      skipDuplicates: true,
    })
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
  })

  it('returns a positive cache hit for a guest without calling the model', async () => {
    prismaMock.judge_cache.findMany.mockResolvedValue([
      {
        matched_answer: 'Towel',
        is_match: true,
        survey_answer_id: 'ans-1',
      },
    ])

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Towel',
      matchedIndex: 0,
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
  })

  it('returns a positive cache hit for a signed-in user without calling the model', async () => {
    authState.userId = 'user-uuid-2'
    prismaMock.judge_cache.findMany.mockResolvedValue([
      {
        matched_answer: 'Sunscreen',
        is_match: true,
        survey_answer_id: 'ans-2',
      },
    ])

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Sunscreen',
      matchedIndex: 1,
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
  })

  it('short-circuits a signed-in miss when negative cache already covers every hidden answer id', async () => {
    authState.userId = 'user-uuid-neg'
    prismaMock.judge_cache.count.mockResolvedValue(2)

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_miss',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(prismaMock.judge_cache.count).toHaveBeenCalledWith({
      where: {
        game_id: 'survey_showdown',
        user_id: 'user-uuid-neg',
        input_text: 'wrong guess',
        survey_answer_id: { in: ['ans-1', 'ans-2'] },
        is_match: false,
      },
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
  })

  it('returns final_miss for a guest when negative cache is saturated without enqueueing AI', async () => {
    prismaMock.judge_cache.count.mockResolvedValue(2)

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_miss',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(anthropicCreate).not.toHaveBeenCalled()
    await flushJudgeBackground()
    expect(anthropicCreate).not.toHaveBeenCalled()
  })

  it('returns final_match from server-side exact match without cache or model calls', async () => {
    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...baseBody,
        input: '  ToWeL ',
      }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Towel',
      matchedIndex: 0,
    })
    expect(prismaMock.judge_cache.findMany).not.toHaveBeenCalled()
    expect(anthropicCreate).not.toHaveBeenCalled()
  })

  it('persists a positive judge_cache row after flush when background AI returns a match for a guest', async () => {
    anthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            match: true,
            index: 0,
            confidence: 0.92,
            matchType: 'exact',
          }),
        },
      ],
    })

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'pending_ai',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()

    await flushJudgeBackground()

    expect(prismaMock.judge_cache.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.findFirst).toHaveBeenCalledWith({
      where: {
        game_id: 'survey_showdown',
        input_text: 'wrong guess',
        survey_answer_id: 'ans-1',
      },
    })
    expect(prismaMock.judge_cache.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.create).toHaveBeenCalledWith({
      data: {
        game_id: 'survey_showdown',
        user_id: null,
        input_text: 'wrong guess',
        survey_answer_id: 'ans-1',
        matched_answer: 'Towel',
        is_match: true,
      },
    })
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
  })

  it('persists a positive judge_cache row after flush when the model returns a match for a signed-in user', async () => {
    authState.userId = 'user-uuid-hit'
    anthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            match: true,
            index: 1,
            confidence: 0.88,
            matchType: 'synonym',
          }),
        },
      ],
    })

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Sunscreen',
      matchedIndex: 1,
    })
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()

    await flushJudgeBackground()

    expect(prismaMock.judge_cache.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.findFirst).toHaveBeenCalledWith({
      where: {
        game_id: 'survey_showdown',
        input_text: 'wrong guess',
        survey_answer_id: 'ans-2',
      },
    })
    expect(prismaMock.judge_cache.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.create).toHaveBeenCalledWith({
      data: {
        game_id: 'survey_showdown',
        user_id: 'user-uuid-hit',
        input_text: 'wrong guess',
        survey_answer_id: 'ans-2',
        matched_answer: 'Sunscreen',
        is_match: true,
      },
    })
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
  })

  it('returns final_miss for an authed user when the model throws, without enqueueing cache persistence', async () => {
    authState.userId = 'user-ai-fail'
    anthropicCreate.mockRejectedValue(new Error('upstream unavailable'))

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_miss',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()

    await flushJudgeBackground()
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
  })

  it('deduplicates positive cache persistence across users by global key', async () => {
    authState.userId = 'user-uuid-hit-2'
    anthropicCreate.mockResolvedValue({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            match: true,
            index: 1,
            confidence: 0.91,
            matchType: 'synonym',
          }),
        },
      ],
    })
    prismaMock.judge_cache.findFirst.mockResolvedValue({
      id: 'cache-existing-other-user',
      game_id: 'survey_showdown',
      user_id: 'different-user',
      input_text: 'wrong guess',
      survey_answer_id: 'ans-2',
      matched_answer: 'Sunblock',
      is_match: true,
    })

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Sunscreen',
      matchedIndex: 1,
    })

    await flushJudgeBackground()

    expect(prismaMock.judge_cache.findFirst).toHaveBeenCalledWith({
      where: {
        game_id: 'survey_showdown',
        input_text: 'wrong guess',
        survey_answer_id: 'ans-2',
      },
    })
    expect(prismaMock.judge_cache.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.update).toHaveBeenCalledWith({
      where: { id: 'cache-existing-other-user' },
      data: {
        matched_answer: 'Sunscreen',
        is_match: true,
      },
    })
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
  })

  it('does not write judge_cache when guest background AI throws', async () => {
    anthropicCreate.mockRejectedValue(new Error('rate limited'))

    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'pending_ai',
      isMatch: false,
      matchedAnswer: null,
      matchedIndex: null,
    })
    expect(anthropicCreate).not.toHaveBeenCalled()

    await flushJudgeBackground()
    expect(anthropicCreate).toHaveBeenCalledTimes(1)
    expect(prismaMock.judge_cache.createMany).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.create).not.toHaveBeenCalled()
    expect(prismaMock.judge_cache.update).not.toHaveBeenCalled()
  })

  it('does not call the model for a guest when exact match hits a hidden answer after partial reveals', async () => {
    const app = makeApp()
    const res = await app.request('/api/survey-showdown/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'sunscreen',
        questionText: 'Beach items',
        answerIds: ['ans-1', 'ans-2'],
        revealedIndices: [0],
        answers: [
          { answer: 'Towel', points: 40 },
          { answer: 'Sunscreen', points: 35 },
        ],
      }),
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: 'final_match',
      isMatch: true,
      matchedAnswer: 'Sunscreen',
      matchedIndex: 1,
    })
    expect(prismaMock.judge_cache.findMany).not.toHaveBeenCalled()
    expect(anthropicCreate).not.toHaveBeenCalled()
  })
})
