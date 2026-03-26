import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const MAX_REFERRALS = 3
const REFERRAL_TOKENS = 2

const referrals = new Hono<{ Variables: AuthVariables }>()

referrals.use('/*', requireAuth)

// GET /api/referrals
// Returns the user's referral code and claim counts
referrals.get('/', async (c) => {
  const userId = c.get('userId')
  try {
    const user = await prisma.users.findUnique({ where: { id: userId } })
    if (!user) return c.json({ error: 'User not found' }, 404)

    const claimed = await prisma.referrals.count({
      where: { referrer_id: userId, status: 'claimed' },
    })
    const pending = await prisma.referrals.count({
      where: { referrer_id: userId, status: 'pending' },
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
// Marks a referral as claimed and awards tokens to the referrer
referrals.post('/claim', async (c) => {
  const userId = c.get('userId')
  try {
    // Find pending referral where this user is the referred party
    const referral = await prisma.referrals.findFirst({
      where: { referred_id: userId, status: 'pending' },
    })

    if (!referral) {
      return c.json({ error: 'No pending referral found' }, 404)
    }

    // Check referrer hasn't hit the cap
    const claimedCount = await prisma.referrals.count({
      where: { referrer_id: referral.referrer_id, status: 'claimed' },
    })

    if (claimedCount >= MAX_REFERRALS) {
      return c.json({ error: 'Referral limit reached' }, 403)
    }

    // Mark as claimed and award tokens in a transaction
    await prisma.$transaction([
      prisma.referrals.update({
        where: { id: referral.id },
        data: { status: 'claimed', claimed_at: new Date() },
      }),
      prisma.user_tokens.upsert({
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
      }),
    ])

    return c.json({ success: true })
  } catch (error) {
    console.error('POST /api/referrals/claim error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default referrals