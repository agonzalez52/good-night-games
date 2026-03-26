import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { spendTokensSchema } from '../schemas/zod'

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

export default tokens