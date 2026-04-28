import { z } from 'zod'

const CUSTOM_SURVEY_QUESTION_MAX_LENGTH = 200
const CUSTOM_SURVEY_ANSWER_MAX_LENGTH = 100

export const spendTokensSchema = z.object({
  amount: z.number().int().positive(),
})

/** POST /api/tokens/purchase — `bundleId` is token_bundles.id */
export const tokenPurchaseSchema = z.object({
  bundleId: z.string().uuid(),
})

const customSurveyAnswer = z.object({
  answer: z.string().min(1).max(CUSTOM_SURVEY_ANSWER_MAX_LENGTH),
  points: z.coerce.number().int().min(1).max(100),
})

/** Optional display title: null / omit / empty / whitespace → null; max 100 on non-empty trimmed text. */
const optionalCustomSurveyName = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === '') return null
    if (typeof v !== 'string') return v
    const t = v.trim()
    return t.length === 0 ? null : t
  },
  z.union([z.null(), z.string().max(100)])
)

/** Single face-off line + 2–8 answers; one row in `su_custom_surveys` */
export const createCustomSurveyBodySchema = z.object({
  name: optionalCustomSurveyName,
  /** Empty string (common from HTML forms) is coerced to null so it does not fail the UUID check. */
  collectionId: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().uuid().nullable().optional()
  ),
  question: z.string().min(1).max(CUSTOM_SURVEY_QUESTION_MAX_LENGTH),
  answers: z.array(customSurveyAnswer).min(2).max(8),
})

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
})

/** PATCH /api/survey-showdown/custom-surveys/:id/collection — move to folder or null (uncategorized) */
export const updateSurveyCollectionBodySchema = z.object({
  collectionId: z.preprocess(
    (v) => (v === '' ? null : v),
    z.union([z.string().uuid(), z.null()])
  ),
})

export const judgeSchema = z.object({
  input: z.string().min(1).max(200),
  /** Per-slot ids: DB `su_survey_answers.id` or custom deterministic QA hash; same order as `answers`. */
  answerIds: z.array(z.string().min(1).max(200)).min(1).max(16),
  /** Original board indices already revealed; model may only match hidden slots */
  revealedIndices: z.array(z.number().int().min(0)).default([]),
  answers: z.array(z.object({
    answer: z.string(),
    points: z.number(),
  })),
})

export const feedbackSchema = z.object({
  category: z.enum(['Bug Report', 'Feature Request', 'General']),
  message: z.string().min(1).max(1000),
  game_id: z.string().optional(),
})

export const historySchema = z.object({
  game_id: z.string(),
  team1: z.string(),
  team2: z.string(),
  rounds: z.number().int().positive(),
  pack: z.string(),
  winner: z.string(),
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
})

/** POST /api/auth/signup-provider-hint — Turnstile or fresh session JWT; used after signUp when client identities are empty. */
export const signupProviderHintSchema = z.object({
  email: z.string().email().max(320),
  /** Required unless Authorization bears a Supabase JWT for this user (see supabaseUserId + email match). */
  turnstileToken: z.string().min(1).max(4096).optional(),
  /** When using Bearer token, must match JWT sub so we do not rely on client email matching alone. */
  supabaseUserId: z.string().uuid().optional(),
})

/** POST /api/auth/confirm-signup-verification */
export const confirmSignupVerificationSchema = z.object({
  challenge: z.string().min(24).max(256),
})
