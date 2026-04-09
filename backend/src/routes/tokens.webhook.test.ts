import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type Stripe from 'stripe'

const {
  mockConstructEvent,
  mockTransaction,
  mockPurchasesUpdateMany,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockTransaction: vi.fn(),
  mockPurchasesUpdateMany: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

vi.mock('../lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    purchases: {
      updateMany: mockPurchasesUpdateMany,
    },
  },
}))

import { handleTokensStripeWebhook } from './tokens'

function minimalCheckoutSessionCompletedEvent(sessionId: string): Stripe.Event {
  return {
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: {
      object: { id: sessionId } as Stripe.Checkout.Session,
    },
  } as Stripe.Event
}

function minimalCheckoutSessionExpiredEvent(sessionId: string): Stripe.Event {
  return {
    id: 'evt_test_2',
    type: 'checkout.session.expired',
    data: {
      object: { id: sessionId } as Stripe.Checkout.Session,
    },
  } as Stripe.Event
}

async function postWebhook(body: string | Uint8Array, stripeSignature = 'v1,testsig') {
  const app = new Hono()
  app.post('/api/tokens/webhook', handleTokensStripeWebhook)
  return app.request('/api/tokens/webhook', {
    method: 'POST',
    headers: {
      'stripe-signature': stripeSignature,
      'content-type': 'application/json',
    },
    body,
  })
}

describe('handleTokensStripeWebhook', () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
    vi.clearAllMocks()
    mockPurchasesUpdateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret
    vi.restoreAllMocks()
  })

  it('credits tokens and marks purchase COMPLETED on valid signature and checkout.session.completed', async () => {
    const sessionId = 'cs_test_completed_1'
    mockConstructEvent.mockReturnValue(minimalCheckoutSessionCompletedEvent(sessionId))

    const purchase = {
      id: 'pur_1',
      user_id: 'user_1',
      tokens_purchased: 10,
    }

    const purchasesUpdate = vi.fn().mockResolvedValue({})
    const userTokensUpsert = vi.fn().mockResolvedValue({})

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        purchases: {
          findFirst: vi.fn().mockResolvedValue(purchase),
          update: purchasesUpdate,
        },
        user_tokens: {
          upsert: userTokensUpsert,
        },
      })
    })

    const res = await postWebhook('{"id":"evt"}')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })

    expect(mockConstructEvent).toHaveBeenCalledOnce()
    expect(purchasesUpdate).toHaveBeenCalledWith({
      where: { id: purchase.id },
      data: { status: 'COMPLETED' },
    })
    expect(userTokensUpsert).toHaveBeenCalledWith({
      where: { user_id: purchase.user_id },
      update: {
        balance: { increment: purchase.tokens_purchased },
        lifetime_purchased: { increment: purchase.tokens_purchased },
      },
      create: {
        user_id: purchase.user_id,
        balance: purchase.tokens_purchased,
        lifetime_purchased: purchase.tokens_purchased,
      },
    })
  })

  it('returns 400 when Stripe signature verification fails', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })

    const res = await postWebhook('{}')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('signatures')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(mockPurchasesUpdateMany).not.toHaveBeenCalled()
  })

  it('marks purchase FAILED on checkout.session.expired', async () => {
    const sessionId = 'cs_test_expired_1'
    mockConstructEvent.mockReturnValue(minimalCheckoutSessionExpiredEvent(sessionId))

    const res = await postWebhook('{}')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })

    expect(mockPurchasesUpdateMany).toHaveBeenCalledWith({
      where: {
        stripe_checkout_session_id: sessionId,
        status: 'PENDING',
      },
      data: { status: 'FAILED' },
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('returns 200 when checkout.session.completed has no PENDING purchase (idempotent)', async () => {
    const sessionId = 'cs_unknown_session'
    mockConstructEvent.mockReturnValue(minimalCheckoutSessionCompletedEvent(sessionId))

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        purchases: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        user_tokens: {
          upsert: vi.fn(),
        },
      })
    })

    const res = await postWebhook('{}')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ received: true })

    expect(infoSpy).toHaveBeenCalledWith(
      'No PENDING purchase for session; skipping credit',
      { sessionId },
    )

    infoSpy.mockRestore()
  })

  it('returns 500 when the DB transaction fails and does not leave a completed credit path', async () => {
    const sessionId = 'cs_test_fail_tx'
    mockConstructEvent.mockReturnValue(minimalCheckoutSessionCompletedEvent(sessionId))

    const purchasesUpdate = vi.fn().mockResolvedValue({})
    const userTokensUpsert = vi.fn().mockRejectedValue(new Error('upsert failed'))

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        purchases: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'pur_fail',
            user_id: 'user_fail',
            tokens_purchased: 5,
          }),
          update: purchasesUpdate,
        },
        user_tokens: {
          upsert: userTokensUpsert,
        },
      })
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await postWebhook('{}')
    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({ error: 'Internal server error' })

    // Handler attempted the transactional path; failure surfaces as 500. With real Prisma,
    // a failure after purchases.update inside $transaction rolls back — no partial commit.
    expect(purchasesUpdate).toHaveBeenCalled()
    expect(userTokensUpsert).toHaveBeenCalled()

    errorSpy.mockRestore()
  })
})
