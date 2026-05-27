import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Prisma } from '@prisma/client'
import Stripe from 'stripe'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { stripe } from '../lib/stripe'
import { spendTokensSchema, tokenPurchaseSchema } from '../schemas/zod'

async function creditTokensForPurchase(
  tx: Prisma.TransactionClient,
  purchase: { id: string; user_id: string; tokens_purchased: number },
) {
  await tx.purchases.update({
    where: { id: purchase.id },
    data: { status: 'COMPLETED' },
  })
  await tx.user_tokens.upsert({
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
}

const tokens = new Hono<{ Variables: AuthVariables }>()

/** POST /api/tokens/webhook — mounted in index.ts before `app.route('/api/tokens', …)` so raw body stays intact if global JSON parsers are added. */
export const handleTokensStripeWebhook = async (c: Context) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (webhookSecret == null || webhookSecret.trim() === '') {
    console.error('POST /api/tokens/webhook: STRIPE_WEBHOOK_SECRET is not set')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  const stripeSignature = c.req.header('stripe-signature')
  if (stripeSignature == null || stripeSignature === '') {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400)
  }

  let rawBody: Buffer
  try {
    rawBody = Buffer.from(await c.req.raw.arrayBuffer())
  } catch (error) {
    console.error('POST /api/tokens/webhook: failed to read body', error)
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed'
    console.error('POST /api/tokens/webhook: signature verification failed', message)
    return c.json({ error: message }, 400)
  }

  console.info('Stripe webhook received', { type: event.type, id: event.id })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const sessionId = session.id
        console.info('checkout.session.completed', { sessionId })

        await prisma.$transaction(async (tx) => {
          const purchase = await tx.purchases.findFirst({
            where: {
              stripe_checkout_session_id: sessionId,
              status: 'PENDING',
            },
          })
          if (purchase == null) {
            console.info('No PENDING purchase for session; skipping credit', { sessionId })
            return
          }

          await creditTokensForPurchase(tx, purchase)
        })
        break
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const paymentIntentId = pi.id
        console.info('payment_intent.succeeded', { paymentIntentId })

        await prisma.$transaction(async (tx) => {
          const purchase = await tx.purchases.findFirst({
            where: {
              stripe_payment_intent_id: paymentIntentId,
              status: 'PENDING',
            },
          })
          if (purchase == null) {
            console.info('No PENDING purchase for PaymentIntent; skipping credit', { paymentIntentId })
            return
          }

          await creditTokensForPurchase(tx, purchase)
        })
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        await prisma.purchases.updateMany({
          where: {
            stripe_payment_intent_id: pi.id,
            status: 'PENDING',
          },
          data: { status: 'FAILED' },
        })
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const sessionId = session.id
        console.info('checkout.session.expired', { sessionId })

        await prisma.purchases.updateMany({
          where: {
            stripe_checkout_session_id: sessionId,
            status: 'PENDING',
          },
          data: { status: 'FAILED' },
        })
        break
      }
      default:
        break
    }
  } catch (error) {
    console.error('POST /api/tokens/webhook handler error', {
      type: event.type,
      id: event.id,
      error,
    })
    return c.json({ error: 'Internal server error' }, 500)
  }

  return c.json({ received: true })
}

// GET /api/tokens/balance
// Returns current token balance for the authenticated user
tokens.get('/balance', requireAuth, async (c) => {
  const userId = c.get('userId')
  try {
    const record = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
    return c.json({ balance: record?.balance ?? 0 })
  } catch (error) {
    console.error('GET /api/tokens/balance error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/tokens/spend
// Deducts tokens_per_game for the given game_id from game_config
// Rejects with 402 if insufficient
tokens.post('/spend', requireAuth, async (c) => {
  const userId = c.get('userId')
  try {
    const body = await c.req.json()
    const parsed = spendTokensSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const { game_id } = parsed.data

    const gameConfig = await prisma.game_config.findFirst({
      where: { game_id, is_active: true },
    })
    if (gameConfig == null) {
      return c.json({ error: 'Game not found or inactive' }, 404)
    }

    const cost = gameConfig.tokens_per_game

    const record = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
    const balance = record?.balance ?? 0

    if (balance < cost) {
      return c.json({ error: 'Insufficient tokens' }, 402)
    }

    const updated = await prisma.user_tokens.upsert({
      where: { user_id: userId },
      update: {
        balance: { decrement: cost },
        lifetime_spent: { increment: cost },
      },
      create: {
        user_id: userId,
        balance: 0,
        lifetime_purchased: 0,
        lifetime_spent: cost,
      },
    })

    return c.json({
      balance: updated.balance,
      tokensSpent: cost,
      gameId: game_id,
    })
  } catch (error) {
    console.error('POST /api/tokens/spend error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/tokens/purchase
// Creates a Stripe PaymentIntent and a PENDING purchases row (PaymentElement + confirmPayment on the client)
tokens.post('/purchase', requireAuth, async (c) => {
  const userId = c.get('userId')

  try {
    const body = await c.req.json()
    const parsed = tokenPurchaseSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const { bundleId } = parsed.data
    const bundle = await prisma.token_bundles.findFirst({
      where: { id: bundleId, is_active: true },
    })
    if (!bundle) {
      return c.json({ error: 'Package not found or inactive' }, 404)
    }

    const amountPaidCents = Math.round(Number(bundle.current_price) * 100)

    let paymentIntent: Stripe.PaymentIntent
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountPaidCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          bundleId: bundle.id,
          userId,
          tokens: String(bundle.tokens),
        },
      })
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        console.error('POST /api/tokens/purchase Stripe error:', err.message)
        return c.json({ error: err.message }, 500)
      }
      throw err
    }

    if (paymentIntent.client_secret == null || paymentIntent.client_secret === '') {
      console.error('POST /api/tokens/purchase: PaymentIntent missing client_secret', paymentIntent.id)
      return c.json({ error: 'Could not create payment' }, 500)
    }

    await prisma.purchases.create({
      data: {
        user_id: userId,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: paymentIntent.id,
        bundle_id: bundle.id,
        tokens_purchased: bundle.tokens,
        amount_paid_cents: amountPaidCents,
        status: 'PENDING',
      },
    })

    return c.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('POST /api/tokens/purchase error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default tokens