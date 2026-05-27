const DEFAULT_SIGNUP_BONUS_TOKENS = 4
const DEFAULT_REFERRAL_TOKENS = 2
const DEFAULT_MAX_REFERRALS = 3

let signupBonusTokensCache: number | undefined
let referralTokensCache: number | undefined
let maxReferralsCache: number | undefined

function parseSignupBonusTokens(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_SIGNUP_BONUS_TOKENS
  }

  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SIGNUP_BONUS_TOKENS
  }

  return parsed
}

/** Product policy: tokens granted on email verification signup bonus. */
export function getSignupBonusTokens(): number {
  if (signupBonusTokensCache === undefined) {
    signupBonusTokensCache = parseSignupBonusTokens(process.env.SIGNUP_BONUS_TOKENS)
  }
  return signupBonusTokensCache
}

/** Clears cached value so tests can change SIGNUP_BONUS_TOKENS between cases. */
export function resetSignupBonusTokensCacheForTests(): void {
  signupBonusTokensCache = undefined
}

function parseReferralTokens(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_REFERRAL_TOKENS
  }

  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REFERRAL_TOKENS
  }

  return parsed
}

function parseMaxReferrals(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_MAX_REFERRALS
  }

  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_REFERRALS
  }

  return parsed
}

/** Product policy: tokens awarded to referrer and referred user per successful referral claim. */
export function getReferralTokens(): number {
  if (referralTokensCache === undefined) {
    referralTokensCache = parseReferralTokens(process.env.REFERRAL_TOKENS)
  }
  return referralTokensCache
}

/** Product policy: maximum referral claims a referrer can earn. */
export function getMaxReferrals(): number {
  if (maxReferralsCache === undefined) {
    maxReferralsCache = parseMaxReferrals(process.env.MAX_REFERRALS)
  }
  return maxReferralsCache
}

/** Clears cached value so tests can change REFERRAL_TOKENS between cases. */
export function resetReferralTokensCacheForTests(): void {
  referralTokensCache = undefined
}

/** Clears cached value so tests can change MAX_REFERRALS between cases. */
export function resetMaxReferralsCacheForTests(): void {
  maxReferralsCache = undefined
}
