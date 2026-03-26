import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const FREE_SIGNUP_TOKENS = 4

const auth = new Hono<{ Variables: AuthVariables }>()

// POST /api/auth/verify-email
// Called after email verification — credits 4 free tokens once
// Idempotent: safe to call multiple times, only credits once
auth.post('/verify-email', requireAuth, async (c) => {
  const userId = c.get('userId')
  try {
    const user = await prisma.users.findUnique({ where: { id: userId } })

    if (!user) return c.json({ error: 'User not found' }, 404)

    // Already credited — idempotent, return current balance
    if (user.signup_tokens_credited) {
      const tokenRecord = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
      return c.json({ balance: tokenRecord?.balance ?? 0, alreadyCredited: true })
    }

    // Credit tokens and mark as credited in a transaction
    const [updated] = await prisma.$transaction([
      prisma.user_tokens.upsert({
        where: { user_id: userId },
        update: {
          balance: { increment: FREE_SIGNUP_TOKENS },
          lifetime_purchased: { increment: FREE_SIGNUP_TOKENS },
        },
        create: {
          user_id: userId,
          balance: FREE_SIGNUP_TOKENS,
          lifetime_purchased: FREE_SIGNUP_TOKENS,
          lifetime_spent: 0,
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: { signup_tokens_credited: true },
      }),
    ])

    return c.json({ balance: updated.balance, alreadyCredited: false })
  } catch (error) {
    console.error('POST /api/auth/verify-email error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default auth