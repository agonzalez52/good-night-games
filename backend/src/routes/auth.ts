import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { supabaseAdmin } from '../lib/supabase'

const FREE_SIGNUP_TOKENS = 4
/** Not a Stripe id — purchase row for analytics; one row per user via atomic claim below. */
const SIGNUP_BONUS_BUNDLE_ID = 'email_verification_bonus'

const auth = new Hono<{ Variables: AuthVariables }>()

// POST /api/auth/verify-email
// Syncs public.users.email_verified from Supabase; credits 4 free tokens once after verify.
// Idempotent: safe to call multiple times.
auth.post('/verify-email', requireAuth, async (c) => {
  const userId = c.get('userId')
  const authHeader = c.req.header('Authorization')
  const jwt = authHeader?.replace(/^Bearer\s+/i, '') ?? ''

  const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
  if (authErr || !authUser) return c.json({ error: 'Unauthorized' }, 401)

  const supabaseEmailVerified = Boolean(authUser.email_confirmed_at)

  try {
    const user = await prisma.users.findUnique({ where: { id: userId } })

    if (!user) return c.json({ error: 'User not found' }, 404)

    if (supabaseEmailVerified && !user.email_verified) {
      await prisma.users.update({
        where: { id: userId },
        data: { email_verified: true },
      })
    }

    if (!supabaseEmailVerified) {
      const tokenRecord = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
      return c.json({
        balance: tokenRecord?.balance ?? 0,
        alreadyCredited: user.signup_tokens_credited,
        email_verified: user.email_verified,
      })
    }

    // Already credited — idempotent, return current balance
    if (user.signup_tokens_credited) {
      const tokenRecord = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
      return c.json({
        balance: tokenRecord?.balance ?? 0,
        alreadyCredited: true,
        email_verified: true,
      })
    }

    // Claim signup bonus exactly once: concurrent verify-email calls (e.g. INITIAL_SESSION +
    // SIGNED_IN + USER_UPDATED) must not each increment — only the first updateMany wins.
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.users.updateMany({
        where: { id: userId, signup_tokens_credited: false },
        data: { signup_tokens_credited: true, email_verified: true },
      })
      if (claimed.count === 0) {
        const tokenRecord = await tx.user_tokens.findUnique({ where: { user_id: userId } })
        return { credited: false as const, balance: tokenRecord?.balance ?? 0 }
      }
      const updated = await tx.user_tokens.upsert({
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
      })
      await tx.purchases.create({
        data: {
          user_id: userId,
          stripe_payment_id: `email_verification:${userId}`,
          bundle_id: SIGNUP_BONUS_BUNDLE_ID,
          tokens_purchased: FREE_SIGNUP_TOKENS,
          amount_paid_cents: 0,
        },
      })
      return { credited: true as const, balance: updated.balance }
    })

    return c.json({
      balance: result.balance,
      alreadyCredited: !result.credited,
      email_verified: true,
    })
  } catch (error) {
    console.error('POST /api/auth/verify-email error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/auth/me — returns the public.users row for the authenticated user
auth.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId') // set by requireAuth middleware
  
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      email_verified: true,
      referral_code: true,
    }
  })
  
  if (!user) return c.json({ error: 'User not found' }, 404)
  
  // Count claimed referrals for this user
  const referralsClaimed = await prisma.referrals.count({
    where: { referrer_id: userId, status: 'claimed' }
  })
  
  return c.json({
    id: user.id,
    email: user.email,
    username: user.username,
    email_verified: user.email_verified,
    referral_code: user.referral_code,
    referrals_claimed: referralsClaimed,
  })
})

/** Cloudflare Turnstile siteverify JSON body (subset). */
type TurnstileSiteverifyBody = { success?: boolean }

async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  })
  const data = (await res.json()) as TurnstileSiteverifyBody
  return data.success === true
}

export default auth