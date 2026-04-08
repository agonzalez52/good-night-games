import { Hono } from 'hono'
import Stripe from 'stripe'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { stripe } from '../lib/stripe'
import { spendTokensSchema, tokenPurchaseSchema } from '../schemas/zod'

const TOKENS_PER_GAME = 2

const tokens = new Hono<{ Variables: AuthVariables }>()

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
// Deducts TOKENS_PER_GAME from the user's balance
// Rejects with 402 if insufficient
tokens.post('/spend', requireAuth, async (c) => {
  const userId = c.get('userId')
  try {
    const body = await c.req.json()
    const parsed = spendTokensSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const record = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
    const balance = record?.balance ?? 0

    if (balance < TOKENS_PER_GAME) {
      return c.json({ error: 'Insufficient tokens' }, 402)
    }

    const updated = await prisma.user_tokens.upsert({
      where: { user_id: userId },
      update: {
        balance: { decrement: TOKENS_PER_GAME },
        lifetime_spent: { increment: TOKENS_PER_GAME },
      },
      create: {
        user_id: userId,
        balance: 0,
        lifetime_purchased: 0,
        lifetime_spent: TOKENS_PER_GAME,
      },
    })

    return c.json({ balance: updated.balance })
  } catch (error) {
    console.error('POST /api/tokens/spend error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/tokens/purchase
// Creates a Stripe Checkout Session and a PENDING purchases row
tokens.post('/purchase', requireAuth, async (c) => {
  const userId = c.get('userId')
  const frontendUrl = process.env.FRONTEND_URL
  if (frontendUrl == null || frontendUrl.trim() === '') {
    console.error('POST /api/tokens/purchase: FRONTEND_URL is not set')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  try {
    const body = await c.req.json()
    const parsed = tokenPurchaseSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const { packageId } = parsed.data
    const bundle = await prisma.token_bundles.findFirst({
      where: { id: packageId, is_active: true },
    })
    if (!bundle) {
      return c.json({ error: 'Package not found or inactive' }, 404)
    }

    const amountPaidCents = Math.round(Number(bundle.current_price) * 100)

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: bundle.stripe_price_id, quantity: 1 }],
        client_reference_id: userId,
        metadata: { packageId, userId },
        success_url: `${frontendUrl}/tokens?success=true`,
        cancel_url: `${frontendUrl}/tokens?cancelled=true`,
      })
    } catch (err) {
      if (err instanceof Stripe.errors.StripeError) {
        console.error('POST /api/tokens/purchase Stripe error:', err.message)
        return c.json({ error: err.message }, 500)
      }
      throw err
    }

    if (session.url == null) {
      console.error('POST /api/tokens/purchase: Checkout Session missing url', session.id)
      return c.json({ error: 'Could not create checkout session' }, 500)
    }

    await prisma.purchases.create({
      data: {
        user_id: userId,
        stripe_payment_id: session.id,
        bundle_id: bundle.id,
        tokens_purchased: bundle.tokens,
        amount_paid_cents: amountPaidCents,
        status: 'PENDING',
      },
    })

    return c.json({ checkoutUrl: session.url })
  } catch (error) {
    console.error('POST /api/tokens/purchase error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default tokens