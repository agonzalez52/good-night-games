import { Hono } from 'hono'
import { Prisma, ReferralStatus } from '@prisma/client'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { supabaseAdmin } from '../lib/supabase'
import { signupProviderHintSchema } from '../schemas/zod'

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
          stripe_checkout_session_id: `email_verification:${userId}`,
          stripe_payment_intent_id: null,
          bundle_id: SIGNUP_BONUS_BUNDLE_ID,
          tokens_purchased: FREE_SIGNUP_TOKENS,
          amount_paid_cents: 0,
          status: 'COMPLETED'
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
    where: { referrer_id: userId, status: ReferralStatus.CLAIMED },
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

/**
 * Test Turnstile widgets emit response tokens containing this marker.
 * They only pass siteverify with the matching test secret — production secrets always fail.
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TURNSTILE_DUMMY_TOKEN_MARKER = '.DUMMY.TOKEN.'
/** "Always passes" test secret; pair with test sitekeys only (e.g. 1x00000000000000000000AA). */
const TURNSTILE_TEST_SECRET_ALWAYS_PASS = '1x0000000000000000000000000000000AA'

/** Cloudflare Turnstile siteverify response (subset). */
type TurnstileSiteverifyBody = { success?: boolean; 'error-codes'?: string[] }

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return false

  const params = new URLSearchParams()
  params.set('secret', secret)
  params.set('response', token.trim())

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = (await res.json()) as TurnstileSiteverifyBody
  if (data.success === true) return true
  const codes = data['error-codes']
  if (codes?.length) console.warn('Turnstile siteverify:', codes.join(', '))
  return false
}

function appMetaIndicatesGoogle(meta: unknown): boolean {
  if (meta == null || typeof meta !== 'object') return false
  const m = meta as Record<string, unknown>
  if (m.provider === 'google') return true
  const providers = m.providers
  return Array.isArray(providers) && providers.some(p => p === 'google')
}

/** True if this email already has a Google-linked auth user (signUp often omits identities in the JSON response). */
async function emailHasGoogleAuthUser(emailNormalized: string): Promise<boolean> {
  const profile = await prisma.users.findUnique({
    where: { email: emailNormalized },
    select: { auth_provider: true, google_id: true },
  })
  if (profile?.auth_provider === 'google' || profile?.google_id != null) return true

  try {
    const rows = await prisma.$queryRaw<{ raw_app_meta_data: unknown }[]>(
      Prisma.sql`SELECT raw_app_meta_data FROM auth.users WHERE lower(email) = lower(${emailNormalized})`
    )
    return rows.some(r => appMetaIndicatesGoogle(r.raw_app_meta_data))
  } catch {
    return false
  }
}

// POST /api/auth/signup-provider-hint
// After email signUp, Supabase may return identities: [] while the account is Google-first.
// Auth: Bearer JWT for the same email (preferred — Turnstile tokens are single-use if Supabase signUp verified captcha), or Turnstile.
auth.post('/signup-provider-hint', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = signupProviderHintSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }
    const { email, turnstileToken, supabaseUserId } = parsed.data
    const normalized = email.trim().toLowerCase()

    const authHeader = c.req.header('Authorization')
    const jwt = authHeader?.replace(/^Bearer\s+/i, '')?.trim() ?? ''
    let trustedBySession = false
    let authUserFromJwt: { id: string; email?: string | null } | null = null
    if (jwt) {
      const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
      if (!authErr && authUser?.id) {
        authUserFromJwt = authUser
        if (supabaseUserId && authUser.id === supabaseUserId) trustedBySession = true
        if (!trustedBySession && authUser.email?.trim().toLowerCase() === normalized) trustedBySession = true
      }
    }

    if (!trustedBySession) {
      if (!turnstileToken?.trim()) {
        return c.json({ error: 'Captcha verification required' }, 400)
      }
      const trimmedToken = turnstileToken.trim()
      const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? ''
      if (trimmedToken.includes(TURNSTILE_DUMMY_TOKEN_MARKER)) {
        if (!secret) {
          return c.json(
            {
              error: 'Turnstile configuration mismatch',
              details:
                `The widget returned a Cloudflare test (dummy) token. Set TURNSTILE_SECRET_KEY to the test secret ${TURNSTILE_TEST_SECRET_ALWAYS_PASS} in backend/.env, or use production site + secret keys in both apps.`,
            },
            503,
          )
        }
        if (secret !== TURNSTILE_TEST_SECRET_ALWAYS_PASS) {
          return c.json(
            {
              error: 'Turnstile configuration mismatch',
              details:
                `Dummy tokens from Turnstile test sitekeys only validate with TURNSTILE_SECRET_KEY=${TURNSTILE_TEST_SECRET_ALWAYS_PASS}. Your backend secret is a different key (e.g. production). Use matching production NEXT_PUBLIC_TURNSTILE_SITE_KEY + secret, or use test keys on both sides.`,
            },
            400,
          )
        }
      }
      const captchaOk = await verifyTurnstile(trimmedToken)
      if (!captchaOk) {
        if (!secret) {
          return c.json({ error: 'Server misconfiguration: missing TURNSTILE_SECRET_KEY' }, 503)
        }
        return c.json({ error: 'Captcha verification failed' }, 400)
      }
    }

    const lookupEmail =
      trustedBySession && authUserFromJwt?.email?.trim()
        ? authUserFromJwt.email.trim().toLowerCase()
        : normalized
    const hasGoogleProvider = await emailHasGoogleAuthUser(lookupEmail)
    return c.json({ has_google_provider: hasGoogleProvider })
  } catch (error) {
    console.error('POST /api/auth/signup-provider-hint error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default auth