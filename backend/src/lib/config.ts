const DEFAULT_SIGNUP_BONUS_TOKENS = 4

let signupBonusTokensCache: number | undefined

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
