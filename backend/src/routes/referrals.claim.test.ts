import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { ReferralStatus } from '@prisma/client'
import {
  getMaxReferrals,
  getReferralTokens,
  resetMaxReferralsCacheForTests,
  resetReferralTokensCacheForTests,
} from '../lib/config'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    users: {
      findUnique: vi.fn(),
    },
    referrals: {
      findFirst: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    user_tokens: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('../middleware/auth', () => ({
  requireAuth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'referred_user')
    await next()
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: prismaMock,
}))

import referralRoutes from './referrals'

interface ReferralState {
  status: ReferralStatus
  referredBalance: number
  referrerBalance: number
  purchases: number
  claimTransitions: number
  referrerClaimedCount: number
}

const makeApp = (): Hono => {
  const app = new Hono()
  app.route('/api/referrals', referralRoutes)
  return app
}

const wireReferralMocks = (state: ReferralState): void => {
  const referralTokens = getReferralTokens()

  prismaMock.referrals.findFirst.mockImplementation(async () => {
    if (state.status !== ReferralStatus.PENDING) return null
    return { id: 'ref_1', referrer_id: 'referrer_user', referred_id: 'referred_user', status: ReferralStatus.PENDING }
  })

  prismaMock.referrals.count.mockImplementation(async () => state.referrerClaimedCount)
  prismaMock.user_tokens.findUnique.mockImplementation(async () => ({ balance: state.referredBalance }))

  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      referrals: {
        updateMany: vi.fn().mockImplementation(async ({ where }: { where: { status: ReferralStatus } }) => {
          if (state.status !== where.status) return { count: 0 }
          state.status = ReferralStatus.CLAIMED
          state.claimTransitions += 1
          return { count: 1 }
        }),
        findUnique: vi.fn().mockImplementation(async () => ({
          status: state.status,
          referred_id: 'referred_user',
        })),
      },
      user_tokens: {
        findUnique: vi.fn().mockImplementation(async () => ({ balance: state.referredBalance })),
        upsert: vi.fn().mockImplementation(async ({ where }: { where: { user_id: string } }) => {
          if (where.user_id === 'referred_user') state.referredBalance += referralTokens
          if (where.user_id === 'referrer_user') state.referrerBalance += referralTokens
          return { balance: state.referredBalance }
        }),
      },
      purchases: {
        create: vi.fn().mockImplementation(async () => {
          state.purchases += 1
        }),
      },
    }
    return fn(tx)
  })
}

describe('POST /api/referrals/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetReferralTokensCacheForTests()
    resetMaxReferralsCacheForTests()
    delete process.env.REFERRAL_TOKENS
    delete process.env.MAX_REFERRALS
  })

  it('awards referral tokens once and returns idempotent response on repeat claim', async () => {
    const referralTokens = getReferralTokens()
    const state: ReferralState = {
      status: ReferralStatus.PENDING,
      referredBalance: 0,
      referrerBalance: 0,
      purchases: 0,
      claimTransitions: 0,
      referrerClaimedCount: 0,
    }
    wireReferralMocks(state)
    const app = makeApp()

    const first = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toEqual({
      success: true,
      referralClaimed: true,
      balance: referralTokens,
    })

    const second = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({
      success: true,
      referralClaimed: false,
      balance: referralTokens,
    })

    expect(state.referredBalance).toBe(referralTokens)
    expect(state.referrerBalance).toBe(referralTokens)
    expect(state.purchases).toBe(2)
    expect(state.status).toBe(ReferralStatus.CLAIMED)
    expect(state.claimTransitions).toBe(1)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('awards tokens from REFERRAL_TOKENS env', async () => {
    process.env.REFERRAL_TOKENS = '5'
    resetReferralTokensCacheForTests()

    const referralTokens = getReferralTokens()
    expect(referralTokens).toBe(5)

    const state: ReferralState = {
      status: ReferralStatus.PENDING,
      referredBalance: 0,
      referrerBalance: 0,
      purchases: 0,
      claimTransitions: 0,
      referrerClaimedCount: 0,
    }
    wireReferralMocks(state)
    const app = makeApp()

    const res = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      referralClaimed: true,
      balance: 5,
    })
    expect(state.referredBalance).toBe(5)
    expect(state.referrerBalance).toBe(5)
  })

  it('does not claim when referrer is at MAX_REFERRALS cap', async () => {
    process.env.MAX_REFERRALS = '2'
    resetMaxReferralsCacheForTests()
    expect(getMaxReferrals()).toBe(2)

    const state: ReferralState = {
      status: ReferralStatus.PENDING,
      referredBalance: 10,
      referrerBalance: 0,
      purchases: 0,
      claimTransitions: 0,
      referrerClaimedCount: 2,
    }
    wireReferralMocks(state)
    const app = makeApp()

    const res = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      referralClaimed: false,
      balance: 10,
    })
    expect(state.referredBalance).toBe(10)
    expect(state.referrerBalance).toBe(0)
    expect(state.purchases).toBe(0)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('GET /api/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMaxReferralsCacheForTests()
    delete process.env.MAX_REFERRALS
    prismaMock.users.findUnique.mockResolvedValue({ referral_code: 'ABC123' })
    prismaMock.referrals.count.mockResolvedValue(0)
  })

  it('returns max from env-backed config', async () => {
    process.env.MAX_REFERRALS = '7'
    resetMaxReferralsCacheForTests()

    const app = makeApp()
    const res = await app.request('/api/referrals')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      referralCode: 'ABC123',
      claimed: 0,
      pending: 0,
      max: 7,
    })
    expect(getMaxReferrals()).toBe(7)
  })

  it('defaults max to 3 when env is unset', async () => {
    const app = makeApp()
    const res = await app.request('/api/referrals')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ max: 3 })
  })
})
