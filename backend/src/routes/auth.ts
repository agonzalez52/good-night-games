import { Hono } from 'hono'
import { Prisma, ReferralStatus } from '@prisma/client'
import { createHash, randomBytes } from 'node:crypto'
import { requireAuth, AuthVariables } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { sendEmail } from '../lib/email'
import { supabaseAdmin } from '../lib/supabase'
import { confirmSignupVerificationSchema, signupProviderHintSchema } from '../schemas/zod'

const FREE_SIGNUP_TOKENS = 4
/** Not a Stripe id — purchase row for analytics; one row per user via atomic claim below. */
const SIGNUP_BONUS_BUNDLE_ID = 'email_verification_bonus'
const SIGNUP_VERIFY_NEXT_PATH = '/survey-showdown'
const SIGNUP_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const SIGNUP_VERIFICATION_EMAIL_TEMPLATE_ID = '6cedbceb-8deb-416b-aa85-6c537d5e0696'
const SIGNUP_VERIFICATION_APP_NAME = 'Survey Showdown'
const SIGNUP_VERIFICATION_TOKEN_COUNT = '4'

const auth = new Hono<{ Variables: AuthVariables }>()

async function getUserTokenBalance(userId: string): Promise<number> {
  const tokenRecord = await prisma.user_tokens.findUnique({ where: { user_id: userId } })
  return tokenRecord?.balance ?? 0
}

function getFrontendBaseUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim()
  return configured && configured.length > 0 ? configured : 'http://localhost:3000'
}

function createSignupChallengeToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashSignupChallenge(challenge: string): string {
  return createHash('sha256').update(challenge).digest('hex')
}

function buildSignupVerificationRedirect(challenge: string): string {
  const callbackUrl = new URL('/auth/callback', getFrontendBaseUrl())
  callbackUrl.searchParams.set('next', SIGNUP_VERIFY_NEXT_PATH)
  callbackUrl.searchParams.set('verify_signup', '1')
  callbackUrl.searchParams.set('challenge', challenge)
  return callbackUrl.toString()
}

async function createSignupVerificationMagicLink(email: string, challenge: string): Promise<string> {
  const redirectTo = buildSignupVerificationRedirect(challenge)
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (error) {
    throw new Error(`Could not generate signup verification magic link: ${error.message}`)
  }

  const actionLink = data.properties?.action_link?.trim()
  if (!actionLink) {
    throw new Error('Could not generate signup verification magic link: missing action link')
  }

  return actionLink
}

async function claimSignupVerificationBonus(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ credited: boolean; balance: number }> {
  await tx.users.updateMany({
    where: { id: userId, email_verified: false },
    data: { email_verified: true },
  })

  const claimed = await tx.users.updateMany({
    where: { id: userId, signup_tokens_credited: false },
    data: { signup_tokens_credited: true },
  })

  if (claimed.count === 0) {
    const tokenRecord = await tx.user_tokens.findUnique({ where: { user_id: userId } })
    return { credited: false, balance: tokenRecord?.balance ?? 0 }
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

  return { credited: true, balance: updated.balance }
}

// POST /api/auth/verify-email
// Deprecated compatibility route for legacy callers.
auth.post('/verify-email', requireAuth, async (c) => {
  const userId = c.get('userId')

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        email_verified: true,
        signup_tokens_credited: true,
      },
    })

    if (!user) return c.json({ error: 'User not found' }, 404)

    const balance = await getUserTokenBalance(userId)

    return c.json({
      balance,
      alreadyCredited: user.signup_tokens_credited,
      email_verified: user.email_verified,
      deprecated: true,
    })
  } catch (error) {
    console.error('POST /api/auth/verify-email error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/auth/send-signup-verification
// Creates a one-time challenge and dispatches verification email to authenticated user.
auth.post('/send-signup-verification', requireAuth, async (c) => {
  const userId = c.get('userId')

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        email: true,
        email_verified: true,
        signup_tokens_credited: true,
      },
    })
    if (!user) return c.json({ error: 'User not found' }, 404)

    if (user.email_verified && user.signup_tokens_credited) {
      const balance = await getUserTokenBalance(userId)
      return c.json({
        success: true,
        sent: false,
        alreadyVerified: true,
        alreadyCredited: true,
        balance,
      })
    }

    const challenge = createSignupChallengeToken()
    const tokenHash = hashSignupChallenge(challenge)
    const expiresAt = new Date(Date.now() + SIGNUP_VERIFICATION_TTL_MS)

    await prisma.signup_verification_challenges.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    })

    let verificationUrl = ''
    try {
      verificationUrl = await createSignupVerificationMagicLink(user.email, challenge)
      await sendEmail({
        to: user.email,
        templateId: SIGNUP_VERIFICATION_EMAIL_TEMPLATE_ID,
        variables: {
          APP_NAME: SIGNUP_VERIFICATION_APP_NAME,
          TOKEN_COUNT: SIGNUP_VERIFICATION_TOKEN_COUNT,
          VERIFY_URL: verificationUrl,
        },
      })
    } catch (sendError) {
      await prisma.signup_verification_challenges.deleteMany({
        where: { user_id: userId, token_hash: tokenHash, used_at: null },
      })
      console.error('POST /api/auth/send-signup-verification send error:', sendError)
      return c.json({ error: 'Could not send verification email' }, 502)
    }

    return c.json({
      success: true,
      sent: true,
      alreadyVerified: user.email_verified,
      alreadyCredited: user.signup_tokens_credited,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('POST /api/auth/send-signup-verification error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/auth/confirm-signup-verification
// Validates one-time challenge and credits signup tokens exactly once.
auth.post('/confirm-signup-verification', requireAuth, async (c) => {
  const userId = c.get('userId')

  try {
    const body = await c.req.json()
    const parsed = confirmSignupVerificationSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) return c.json({ error: 'User not found' }, 404)

    const now = new Date()
    const tokenHash = hashSignupChallenge(parsed.data.challenge.trim())
    const result = await prisma.$transaction(async (tx) => {
      const challenge = await tx.signup_verification_challenges.findFirst({
        where: {
          user_id: userId,
          token_hash: tokenHash,
        },
      })

      if (!challenge) return { status: 'invalid' as const }
      if (challenge.expires_at <= now) return { status: 'expired' as const }

      if (challenge.used_at) {
        const [profile, tokenRecord] = await Promise.all([
          tx.users.findUnique({
            where: { id: userId },
            select: { email_verified: true, signup_tokens_credited: true },
          }),
          tx.user_tokens.findUnique({ where: { user_id: userId } }),
        ])
        return {
          status: 'already-used' as const,
          balance: tokenRecord?.balance ?? 0,
          alreadyCredited: profile?.signup_tokens_credited ?? false,
          emailVerified: profile?.email_verified ?? false,
        }
      }

      const markedUsed = await tx.signup_verification_challenges.updateMany({
        where: {
          id: challenge.id,
          user_id: userId,
          used_at: null,
          expires_at: { gt: now },
        },
        data: { used_at: now },
      })

      if (markedUsed.count === 0) {
        const tokenRecord = await tx.user_tokens.findUnique({ where: { user_id: userId } })
        const profile = await tx.users.findUnique({
          where: { id: userId },
          select: { email_verified: true, signup_tokens_credited: true },
        })
        return {
          status: 'already-used' as const,
          balance: tokenRecord?.balance ?? 0,
          alreadyCredited: profile?.signup_tokens_credited ?? false,
          emailVerified: profile?.email_verified ?? false,
        }
      }

      const bonus = await claimSignupVerificationBonus(tx, userId)
      return {
        status: 'confirmed' as const,
        balance: bonus.balance,
        alreadyCredited: !bonus.credited,
        emailVerified: true,
      }
    })

    if (result.status === 'invalid') {
      return c.json({ error: 'Invalid verification challenge' }, 400)
    }
    if (result.status === 'expired') {
      return c.json({ error: 'Verification challenge expired' }, 400)
    }

    return c.json({
      success: true,
      verified: true,
      alreadyCredited: result.alreadyCredited,
      email_verified: result.emailVerified,
      balance: result.balance,
    })
  } catch (error) {
    console.error('POST /api/auth/confirm-signup-verification error:', error)
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

function supabaseUserIndicatesGoogle(user: {
  app_metadata?: unknown
  identities?: Array<{ provider?: string | null }> | null
}): boolean {
  if (appMetaIndicatesGoogle(user.app_metadata)) return true
  if (!Array.isArray(user.identities)) return false
  return user.identities.some(identity => identity?.provider === 'google')
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

// POST /api/auth/confirm-oauth-signup
// Confirms Google OAuth signup and grants one-time signup bonus idempotently.
auth.post('/confirm-oauth-signup', requireAuth, async (c) => {
  const userId = c.get('userId')

  try {
    const authHeader = c.req.header('Authorization')
    const jwt = authHeader?.replace(/^Bearer\s+/i, '')?.trim() ?? ''
    if (!jwt) return c.json({ error: 'Unauthorized' }, 401)

    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !authUser || authUser.id !== userId) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    if (!supabaseUserIndicatesGoogle(authUser)) {
      return c.json({ error: 'OAuth provider is not Google' }, 403)
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) return c.json({ error: 'User not found' }, 404)

    const bonus = await prisma.$transaction((tx) => claimSignupVerificationBonus(tx, userId))

    return c.json({
      success: true,
      verified: true,
      alreadyCredited: !bonus.credited,
      email_verified: true,
      balance: bonus.balance,
    })
  } catch (error) {
    console.error('POST /api/auth/confirm-oauth-signup error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default auth