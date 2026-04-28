import { createHash } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const { prismaMock, supabaseAuthMock } = vi.hoisted(() => ({
  prismaMock: {
    users: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user_tokens: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    purchases: {
      create: vi.fn(),
    },
    signup_verification_challenges: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  supabaseAuthMock: {
    signInWithOtp: vi.fn(),
    getUser: vi.fn(),
  },
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

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    auth: supabaseAuthMock,
  },
}))

import authRoutes from './auth'

const FREE_SIGNUP_TOKENS = 4

interface VerificationChallenge {
  id: string
  user_id: string
  token_hash: string
  expires_at: Date
  used_at: Date | null
}

interface VerificationState {
  user: { id: string; email_verified: boolean; signup_tokens_credited: boolean }
  challenge: VerificationChallenge
  balance: number
  purchases: number
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex')

const makeApp = (): Hono => {
  const app = new Hono()
  app.route('/api/auth', authRoutes)
  return app
}

const wireConfirmFlowMocks = (state: VerificationState): void => {
  prismaMock.users.findUnique.mockImplementation(async ({ select }: { select?: { id?: boolean } }) => {
    if (select?.id) return { id: state.user.id }
    return {
      email_verified: state.user.email_verified,
      signup_tokens_credited: state.user.signup_tokens_credited,
    }
  })

  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      signup_verification_challenges: {
        findFirst: vi.fn().mockImplementation(async () => state.challenge),
        updateMany: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string; used_at: null }; data: { used_at: Date } }) => {
          const isMatch = state.challenge.id === where.id && state.challenge.used_at === where.used_at
          if (!isMatch) return { count: 0 }
          state.challenge.used_at = data.used_at
          return { count: 1 }
        }),
      },
      users: {
        updateMany: vi.fn().mockImplementation(async ({ where, data }: { where: { email_verified?: boolean; signup_tokens_credited?: boolean }; data: { email_verified?: boolean; signup_tokens_credited?: boolean } }) => {
          if (where.email_verified === false && state.user.email_verified === false && data.email_verified === true) {
            state.user.email_verified = true
            return { count: 1 }
          }
          if (where.signup_tokens_credited === false && state.user.signup_tokens_credited === false && data.signup_tokens_credited === true) {
            state.user.signup_tokens_credited = true
            return { count: 1 }
          }
          return { count: 0 }
        }),
        findUnique: vi.fn().mockImplementation(async () => ({
          email_verified: state.user.email_verified,
          signup_tokens_credited: state.user.signup_tokens_credited,
        })),
      },
      user_tokens: {
        findUnique: vi.fn().mockImplementation(async () => ({ balance: state.balance })),
        upsert: vi.fn().mockImplementation(async ({ update, create }: { update?: { balance?: { increment?: number } }; create?: { balance: number } }) => {
          const increment = update?.balance?.increment ?? 0
          if (increment > 0) state.balance += increment
          else if (create?.balance != null) state.balance = create.balance
          return { balance: state.balance }
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

describe('POST /api/auth/confirm-signup-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is idempotent when verification link is clicked multiple times', async () => {
    const challenge = 'challenge_token_for_signup_verification_123456'
    const state: VerificationState = {
      user: { id: 'user_1', email_verified: false, signup_tokens_credited: false },
      challenge: {
        id: 'challenge_1',
        user_id: 'user_1',
        token_hash: sha256(challenge),
        expires_at: new Date(Date.now() + 60_000),
        used_at: null,
      },
      balance: 0,
      purchases: 0,
    }

    wireConfirmFlowMocks(state)
    prismaMock.signup_verification_challenges.findFirst.mockImplementation(async ({ where }: { where: { token_hash: string } }) => {
      if (where.token_hash !== state.challenge.token_hash) return null
      return state.challenge
    })

    const app = makeApp()

    const first = await app.request('/api/auth/confirm-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge }),
    })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      success: true,
      verified: true,
      alreadyCredited: false,
      email_verified: true,
      balance: FREE_SIGNUP_TOKENS,
    })

    const second = await app.request('/api/auth/confirm-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge }),
    })
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toMatchObject({
      success: true,
      verified: true,
      alreadyCredited: true,
      email_verified: true,
      balance: FREE_SIGNUP_TOKENS,
    })

    expect(state.balance).toBe(FREE_SIGNUP_TOKENS)
    expect(state.user.email_verified).toBe(true)
    expect(state.user.signup_tokens_credited).toBe(true)
    expect(state.purchases).toBe(1)
  })

  it('returns 400 and does not credit when challenge is expired', async () => {
    const challenge = 'challenge_token_for_signup_verification_123456'
    const state: VerificationState = {
      user: { id: 'user_1', email_verified: false, signup_tokens_credited: false },
      challenge: {
        id: 'challenge_expired',
        user_id: 'user_1',
        token_hash: sha256(challenge),
        expires_at: new Date(Date.now() - 60_000),
        used_at: null,
      },
      balance: 0,
      purchases: 0,
    }

    wireConfirmFlowMocks(state)

    const app = makeApp()
    const res = await app.request('/api/auth/confirm-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Verification challenge expired' })
    expect(state.balance).toBe(0)
    expect(state.purchases).toBe(0)
    expect(state.user.email_verified).toBe(false)
    expect(state.user.signup_tokens_credited).toBe(false)
  })
})
