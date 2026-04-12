import { z } from 'zod'

export const spendTokensSchema = z.object({
  amount: z.number().int().positive(),
})

/** POST /api/tokens/purchase — `bundleId` is token_bundles.id */
export const tokenPurchaseSchema = z.object({
  bundleId: z.string().uuid(),
})

export const createSurveySchema = z.object({
  name: z.string().min(1).max(100),
  collectionId: z.string().uuid().nullable().optional(),
  questions: z.array(z.object({
    question: z.string().min(1),
    answers: z.array(z.object({
      answer: z.string().min(1),
      points: z.number().int().min(1).max(100),
    })).min(2).max(8),
  })).min(1),
})

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
})

export const judgeSchema = z.object({
  input: z.string().min(1).max(200),
  /** Per-slot ids: DB `survey_answers.id` or custom deterministic QA hash; same order as `answers`. */
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
  message: z.string().min(1).max(2000),
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