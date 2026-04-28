import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { ReferralStatus } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
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
}

const makeApp = (): Hono => {
  const app = new Hono()
  app.route('/api/referrals', referralRoutes)
  return app
}

const wireReferralMocks = (state: ReferralState): void => {
  prismaMock.referrals.findFirst.mockImplementation(async () => {
    if (state.status !== ReferralStatus.PENDING) return null
    return { id: 'ref_1', referrer_id: 'referrer_user', referred_id: 'referred_user', status: ReferralStatus.PENDING }
  })

  prismaMock.referrals.count.mockImplementation(async () => 0)
  prismaMock.user_tokens.findUnique.mockImplementation(async () => ({ balance: state.referredBalance }))

  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      referrals: {
        updateMany: vi.fn().mockImplementation(async ({ where }: { where: { status: ReferralStatus } }) => {
          if (state.status !== where.status) return { count: 0 }
          state.status = ReferralStatus.CLAIMED
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
          if (where.user_id === 'referred_user') state.referredBalance += 2
          if (where.user_id === 'referrer_user') state.referrerBalance += 2
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
  })

  it('awards referral tokens once and returns idempotent response on repeat claim', async () => {
    const state: ReferralState = {
      status: ReferralStatus.PENDING,
      referredBalance: 0,
      referrerBalance: 0,
      purchases: 0,
    }
    wireReferralMocks(state)
    const app = makeApp()

    const first = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toEqual({
      success: true,
      referralClaimed: true,
      balance: 2,
    })

    const second = await app.request('/api/referrals/claim', { method: 'POST' })
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({
      success: true,
      referralClaimed: false,
      balance: 2,
    })

    expect(state.referredBalance).toBe(2)
    expect(state.referrerBalance).toBe(2)
    expect(state.purchases).toBe(2)
    expect(state.status).toBe(ReferralStatus.CLAIMED)
  })
})
