import { createHash } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const { prismaMock, supabaseAuthMock, sendEmailMock } = vi.hoisted(() => ({
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
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  supabaseAuthMock: {
    admin: {
      generateLink: vi.fn(),
    },
    getUser: vi.fn(),
  },
  sendEmailMock: vi.fn(),
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

vi.mock('../lib/email', () => ({
  sendEmail: sendEmailMock,
}))

import authRoutes from './auth'

const FREE_SIGNUP_TOKENS = 4
const SIGNUP_BONUS_BUNDLE_ID = 'email_verification_bonus'
const REFERRAL_CLAIM_BUNDLE_ID = 'referral_claim_bonus'

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

describe('POST /api/auth/send-signup-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends callback link preserving verify_signup and challenge params', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      email: 'player@example.com',
      email_verified: false,
      signup_tokens_credited: false,
    })
    prismaMock.signup_verification_challenges.create.mockResolvedValue({ id: 'challenge_1' })
    prismaMock.signup_verification_challenges.deleteMany.mockResolvedValue({ count: 0 })
    supabaseAuthMock.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link:
            'https://example-project.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=' +
            encodeURIComponent(
              'http://localhost:3000/auth/callback?next=%2Fsurvey-showdown&verify_signup=1&challenge=test_challenge',
            ),
        },
      },
      error: null,
    })
    sendEmailMock.mockResolvedValue(undefined)

    const app = makeApp()
    const res = await app.request('/api/auth/send-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      sent: true,
      alreadyVerified: false,
      alreadyCredited: false,
    })

    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      templateId?: string
      variables?: { APP_NAME?: string; TOKEN_COUNT?: string; VERIFY_URL?: string }
    }
    expect(payload.templateId).toBe('6cedbceb-8deb-416b-aa85-6c537d5e0696')
    expect(payload.variables?.APP_NAME).toBe('Survey Showdown')
    expect(payload.variables?.TOKEN_COUNT).toBe('4')
    expect(payload.variables?.VERIFY_URL).toBeTruthy()

    const verifyUrl = new URL(payload.variables!.VERIFY_URL!)
    expect(verifyUrl.pathname).toBe('/auth/v1/verify')
    const redirectTo = verifyUrl.searchParams.get('redirect_to')
    expect(redirectTo).toBeTruthy()
    const callbackUrl = new URL(redirectTo!)
    expect(callbackUrl.pathname).toBe('/auth/callback')
    expect(callbackUrl.searchParams.get('next')).toBe('/survey-showdown')
    expect(callbackUrl.searchParams.get('verify_signup')).toBe('1')
    expect(callbackUrl.searchParams.get('challenge')?.length ?? 0).toBeGreaterThanOrEqual(10)
  })

  it('rolls back fresh challenge when email send fails', async () => {
    const generatedActionLink = 'https://example-project.supabase.co/auth/v1/verify?token=abc&type=magiclink'
    prismaMock.users.findUnique.mockResolvedValue({
      email: 'player@example.com',
      email_verified: false,
      signup_tokens_credited: false,
    })
    prismaMock.signup_verification_challenges.create.mockResolvedValue({ id: 'challenge_1' })
    prismaMock.signup_verification_challenges.deleteMany.mockResolvedValue({ count: 1 })
    supabaseAuthMock.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: generatedActionLink,
        },
      },
      error: null,
    })
    sendEmailMock.mockRejectedValue(new Error('provider unavailable'))

    const app = makeApp()
    const res = await app.request('/api/auth/send-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Could not send verification email',
      errorCode: 'SIGNUP_VERIFICATION_PROVIDER_TEMPORARY',
      errorCategory: 'PROVIDER_TEMPORARY',
      message: expect.stringContaining('temporarily unavailable'),
    })

    expect(prismaMock.signup_verification_challenges.create).toHaveBeenCalledTimes(1)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const payload = sendEmailMock.mock.calls[0]?.[0] as {
      templateId?: string
      variables?: { APP_NAME?: string; TOKEN_COUNT?: string; VERIFY_URL?: string }
    }
    expect(payload.templateId).toBe('6cedbceb-8deb-416b-aa85-6c537d5e0696')
    expect(payload.variables).toMatchObject({
      APP_NAME: 'Survey Showdown',
      TOKEN_COUNT: '4',
      VERIFY_URL: generatedActionLink,
    })
    expect(prismaMock.signup_verification_challenges.deleteMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.signup_verification_challenges.deleteMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user_1',
        token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        used_at: null,
      },
    })
  })

  it('returns stable rate-limited contract when provider reports throttling', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      email: 'player@example.com',
      email_verified: false,
      signup_tokens_credited: false,
    })
    prismaMock.signup_verification_challenges.create.mockResolvedValue({ id: 'challenge_1' })
    prismaMock.signup_verification_challenges.deleteMany.mockResolvedValue({ count: 1 })
    supabaseAuthMock.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example-project.supabase.co/auth/v1/verify?token=abc&type=magiclink',
        },
      },
      error: null,
    })
    sendEmailMock.mockRejectedValue(new Error('Resend API rate limit exceeded (429)'))

    const app = makeApp()
    const res = await app.request('/api/auth/send-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Could not send verification email',
      errorCode: 'SIGNUP_VERIFICATION_RATE_LIMITED',
      errorCategory: 'RATE_LIMITED',
      message: expect.stringContaining('rate limited'),
    })
    expect(prismaMock.signup_verification_challenges.deleteMany).toHaveBeenCalledTimes(1)
  })

  it('returns stable disposable-domain contract when provider rejects disposable inboxes', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      email: 'player@example.com',
      email_verified: false,
      signup_tokens_credited: false,
    })
    prismaMock.signup_verification_challenges.create.mockResolvedValue({ id: 'challenge_1' })
    prismaMock.signup_verification_challenges.deleteMany.mockResolvedValue({ count: 1 })
    supabaseAuthMock.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example-project.supabase.co/auth/v1/verify?token=abc&type=magiclink',
        },
      },
      error: null,
    })
    sendEmailMock.mockRejectedValue(
      new Error('Verification blocked for disposable inbox domain: mailinator.com'),
    )

    const app = makeApp()
    const res = await app.request('/api/auth/send-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Could not send verification email',
      errorCode: 'SIGNUP_VERIFICATION_DISPOSABLE_DOMAIN',
      errorCategory: 'DISPOSABLE_DOMAIN',
      message: expect.stringContaining('not supported'),
    })
    expect(prismaMock.signup_verification_challenges.deleteMany).toHaveBeenCalledTimes(1)
  })

  it('returns stable unknown contract for unclassified failures', async () => {
    prismaMock.users.findUnique.mockResolvedValue({
      email: 'player@example.com',
      email_verified: false,
      signup_tokens_credited: false,
    })
    prismaMock.signup_verification_challenges.create.mockResolvedValue({ id: 'challenge_1' })
    prismaMock.signup_verification_challenges.deleteMany.mockResolvedValue({ count: 1 })
    supabaseAuthMock.admin.generateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://example-project.supabase.co/auth/v1/verify?token=abc&type=magiclink',
        },
      },
      error: null,
    })
    sendEmailMock.mockRejectedValue(new Error('totally-unmapped-provider-signal'))

    const app = makeApp()
    const res = await app.request('/api/auth/send-signup-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toMatchObject({
      error: 'Could not send verification email',
      errorCode: 'SIGNUP_VERIFICATION_UNKNOWN',
      errorCategory: 'UNKNOWN',
      message: expect.stringContaining('right now'),
    })
  })
})

describe('POST /api/auth/confirm-oauth-signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const wireGoogleOauthBonusMocks = () => {
    prismaMock.users.findUnique.mockResolvedValue({ id: 'user_1' })
    supabaseAuthMock.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_1',
          app_metadata: { provider: 'google', providers: ['google'] },
          identities: [{ provider: 'google' }],
        },
      },
      error: null,
    })

    const state = {
      isEmailVerified: false,
      isSignupTokensCredited: false,
      balance: 0,
      purchases: 0,
      purchaseBundleIds: [] as string[],
    }

    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        users: {
          updateMany: vi.fn().mockImplementation(async ({ where, data }: { where: { email_verified?: boolean; signup_tokens_credited?: boolean }; data: { email_verified?: boolean; signup_tokens_credited?: boolean } }) => {
            if (where.email_verified === false && state.isEmailVerified === false && data.email_verified === true) {
              state.isEmailVerified = true
              return { count: 1 }
            }
            if (where.signup_tokens_credited === false && state.isSignupTokensCredited === false && data.signup_tokens_credited === true) {
              state.isSignupTokensCredited = true
              return { count: 1 }
            }
            return { count: 0 }
          }),
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
          create: vi.fn().mockImplementation(async ({ data }: { data: { bundle_id: string } }) => {
            state.purchases += 1
            state.purchaseBundleIds.push(data.bundle_id)
          }),
        },
      }
      return fn(tx)
    })

    return state
  }

  it('credits on first Google OAuth signup confirmation', async () => {
    const state = wireGoogleOauthBonusMocks()

    const app = makeApp()
    const first = await app.request('/api/auth/confirm-oauth-signup', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
    })

    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      success: true,
      verified: true,
      alreadyCredited: false,
      email_verified: true,
      balance: FREE_SIGNUP_TOKENS,
    })
    expect(state.balance).toBe(FREE_SIGNUP_TOKENS)
    expect(state.isEmailVerified).toBe(true)
    expect(state.isSignupTokensCredited).toBe(true)
    expect(state.purchases).toBe(1)
    expect(state.purchaseBundleIds).toEqual([SIGNUP_BONUS_BUNDLE_ID])
    expect(state.purchaseBundleIds).not.toContain(REFERRAL_CLAIM_BUNDLE_ID)
  })

  it('is idempotent on repeated Google OAuth signup confirmation', async () => {
    const state = wireGoogleOauthBonusMocks()

    const app = makeApp()

    const first = await app.request('/api/auth/confirm-oauth-signup', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
    })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      success: true,
      verified: true,
      alreadyCredited: false,
      email_verified: true,
      balance: FREE_SIGNUP_TOKENS,
    })

    const second = await app.request('/api/auth/confirm-oauth-signup', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
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
    expect(state.isEmailVerified).toBe(true)
    expect(state.isSignupTokensCredited).toBe(true)
    expect(state.purchases).toBe(1)
  })

  it('rejects non-Google auth users', async () => {
    supabaseAuthMock.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user_1',
          app_metadata: { provider: 'email' },
          identities: [{ provider: 'email' }],
        },
      },
      error: null,
    })

    const app = makeApp()
    const res = await app.request('/api/auth/confirm-oauth-signup', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-jwt' },
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'OAuth provider is not Google' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
