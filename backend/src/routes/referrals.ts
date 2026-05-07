import { Hono } from 'hono'
import { ReferralStatus } from '@prisma/client'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const MAX_REFERRALS = 3
const REFERRAL_TOKENS = 2
/** Synthetic bundle id for analytics — parallel to `email_verification_bonus` in auth routes. */
const REFERRAL_CLAIM_BUNDLE_ID = 'referral_claim_bonus'

const referrals = new Hono<{ Variables: AuthVariables }>()

referrals.use('/*', requireAuth)

async function getUserTokenBalance(userId: string): Promise<number> {
  const row = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
  return row?.balance ?? 0
}

// GET /api/referrals
// Returns the user's referral code and claim counts
referrals.get('/', async (c) => {
  const userId = c.get('userId')
  try {
    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)

    const claimed = await prisma.referrals.count({
      where: { referrer_id: userId, status: ReferralStatus.CLAIMED },
    })
    const pending = await prisma.referrals.count({
      where: { referrer_id: userId, status: ReferralStatus.PENDING },
    })

    return c.json({
      referralCode: user.referral_code,
      claimed,
      pending,
      max: MAX_REFERRALS,
    })
  } catch (error) {
    console.error('GET /api/referrals error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/referrals/claim
// Marks a referral as claimed and awards tokens to referrer and referred user; mirrors verify-email purchase rows.
// No pending / already claimed / referrer at cap: always 200 { success, referralClaimed, balance } (never 404).
referrals.post('/claim', async (c) => {
  const userId = c.get('userId')
  try {
    // Find pending referral where this user is the referred party
    const referral = await prisma.referrals.findFirst({
      where: { referred_id: userId, status: ReferralStatus.PENDING },
    })

    if (!referral) {
      const balance = await getUserTokenBalance(userId)
      return c.json({ success: true, referralClaimed: false, balance })
    }

    // Check referrer hasn't hit the cap
    const claimedCount = await prisma.referrals.count({
      where: { referrer_id: referral.referrer_id, status: ReferralStatus.CLAIMED },
    })

    if (claimedCount >= MAX_REFERRALS) {
      const balance = await getUserTokenBalance(userId)
      return c.json({ success: true, referralClaimed: false, balance })
    }

    const result = await prisma.$transaction(async (tx) => {
      const markClaimed = await tx.referrals.updateMany({
        where: { id: referral.id, referred_id: userId, status: ReferralStatus.PENDING },
        data: { status: ReferralStatus.CLAIMED, claimed_at: new Date() },
      })

      if (markClaimed.count === 0) {
        const row = await tx.referrals.findUnique({ where: { id: referral.id } })
        if (
          row?.status === ReferralStatus.CLAIMED &&
          row?.referred_id === userId
        ) {
          const tokenRecord = await tx.user_tokens.findUnique({ where: { user_id: userId } })
          return {
            ok: true as const,
            referralClaimed: false as const,
            balance: tokenRecord?.balance ?? 0,
          }
        }
        return { ok: false as const }
      }

      await tx.user_tokens.upsert({
        where: { user_id: referral.referrer_id },
        update: {
          balance: { increment: REFERRAL_TOKENS },
          lifetime_purchased: { increment: REFERRAL_TOKENS },
        },
        create: {
          user_id: referral.referrer_id,
          balance: REFERRAL_TOKENS,
          lifetime_purchased: REFERRAL_TOKENS,
          lifetime_spent: 0,
        },
      })

      const referredTokens = await tx.user_tokens.upsert({
        where: { user_id: userId },
        update: {
          balance: { increment: REFERRAL_TOKENS },
          lifetime_purchased: { increment: REFERRAL_TOKENS },
        },
        create: {
          user_id: userId,
          balance: REFERRAL_TOKENS,
          lifetime_purchased: REFERRAL_TOKENS,
          lifetime_spent: 0,
        },
      })

      await tx.purchases.create({
        data: {
          user_id: referral.referrer_id,
          stripe_checkout_session_id: `referral_claim:${referral.id}:referrer`,
          stripe_payment_intent_id: null,
          bundle_id: REFERRAL_CLAIM_BUNDLE_ID,
          tokens_purchased: REFERRAL_TOKENS,
          amount_paid_cents: 0,
          status: 'COMPLETED',
        },
      })

      await tx.purchases.create({
        data: {
          user_id: userId,
          stripe_checkout_session_id: `referral_claim:${referral.id}:referred`,
          stripe_payment_intent_id: null,
          bundle_id: REFERRAL_CLAIM_BUNDLE_ID,
          tokens_purchased: REFERRAL_TOKENS,
          amount_paid_cents: 0,
          status: 'COMPLETED',
        },
      })

      return {
        ok: true as const,
        referralClaimed: true as const,
        balance: referredTokens.balance,
      }
    })

    if (!result.ok) {
      const balance = await getUserTokenBalance(userId)
      return c.json({ success: true, referralClaimed: false, balance })
    }

    return c.json({
      success: true,
      referralClaimed: result.referralClaimed,
      balance: result.balance,
    })
  } catch (error) {
    console.error('POST /api/referrals/claim error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default referrals