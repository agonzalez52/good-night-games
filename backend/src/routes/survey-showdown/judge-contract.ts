/**
 * POST /api/survey-showdown/judge — API contract (request validation + response shape).
 *
 * The route handler emits {@link JudgeApiResponseBody} (includes `status`). Clients may
 * still use {@link parseJudgeResponseFromJson} for backward compatibility with cached
 * or proxied legacy bodies.
 */
import { z } from 'zod'
import { judgeSchema } from '../../schemas/zod'

/** Re-exported request body schema (Zod). Same fields as `judgeSchema` in `schemas/zod.ts`. */
export const judgeApiRequestSchema = judgeSchema

export type JudgeApiRequestBody = z.infer<typeof judgeApiRequestSchema>

/**
 * Explicit verdict lifecycle for the judge endpoint.
 *
 * - **final_match** — Server resolved a hit (exact match, positive cache, or completed AI
 *   for signed-in users). `matchedIndex` is the board index; `matchedAnswer` is the reveal text.
 * - **final_miss** — Server resolved a miss with no further AI work that affects this response
 *   (e.g. negative cache saturation, AI concluded miss, or no hidden answers). Safe to treat as
 *   a permanent miss for this turn.
 * - **pending_ai** — Guest-only: exact match and cache did not hit; AI may still run in the
 *   background. Clients MUST treat this as an immediate miss for gameplay (same indices as
 *   `final_miss`); they MUST NOT wait on or apply a late AI result to UI.
 */
export const JUDGE_RESPONSE_STATUS = {
  FINAL_MATCH: 'final_match',
  FINAL_MISS: 'final_miss',
  PENDING_AI: 'pending_ai',
} as const

export type JudgeResponseStatus = (typeof JUDGE_RESPONSE_STATUS)[keyof typeof JUDGE_RESPONSE_STATUS]

const judgeResponseFinalMatch = z.object({
  status: z.literal(JUDGE_RESPONSE_STATUS.FINAL_MATCH),
  /** Kept for backward compatibility; always true for this status. */
  isMatch: z.literal(true),
  matchedIndex: z.number().int().min(0),
  matchedAnswer: z.string(),
})

const judgeResponseFinalMiss = z.object({
  status: z.literal(JUDGE_RESPONSE_STATUS.FINAL_MISS),
  isMatch: z.literal(false),
  matchedIndex: z.null(),
  matchedAnswer: z.null(),
})

const judgeResponsePendingAi = z.object({
  status: z.literal(JUDGE_RESPONSE_STATUS.PENDING_AI),
  isMatch: z.literal(false),
  matchedIndex: z.null(),
  matchedAnswer: z.null(),
})

/**
 * Canonical JSON body for a 200 OK judge response after the staged-outcome refactor.
 * Discriminates on `status`; `isMatch` mirrors match vs miss for older clients.
 */
export const judgeApiResponseBodySchema = z.discriminatedUnion('status', [
  judgeResponseFinalMatch,
  judgeResponseFinalMiss,
  judgeResponsePendingAi,
])

export type JudgeApiResponseBody = z.infer<typeof judgeApiResponseBodySchema>

/**
 * Pre-refactor response shape (still returned by the handler until migrated).
 * No `status` field — clients cannot distinguish `pending_ai` from `final_miss`.
 */
export const judgeLegacyOkResponseSchema = z.object({
  isMatch: z.boolean(),
  matchedAnswer: z.string().nullable(),
  matchedIndex: z.number().int().min(0).nullable(),
})

export type JudgeLegacyOkResponseBody = z.infer<typeof judgeLegacyOkResponseSchema>

export type JudgeOkResponseBody = JudgeApiResponseBody | JudgeLegacyOkResponseBody

/**
 * Normalizes a successful JSON body toward the new discriminated shape.
 * Prefer {@link judgeApiResponseBodySchema} when `status` is present so `pending_ai` is preserved.
 * Legacy: `isMatch === true` with numeric `matchedIndex` → `final_match`; else → `final_miss`.
 */
export const parseJudgeResponseFromJson = (value: unknown): JudgeApiResponseBody | null => {
  const canonical = judgeApiResponseBodySchema.safeParse(value)
  if (canonical.success) return canonical.data

  const legacy = judgeLegacyOkResponseSchema.safeParse(value)
  if (!legacy.success) return null

  const { isMatch, matchedAnswer, matchedIndex } = legacy.data
  if (isMatch && typeof matchedIndex === 'number' && matchedAnswer !== null) {
    return {
      status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
      isMatch: true,
      matchedIndex,
      matchedAnswer,
    }
  }
  return {
    status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
    isMatch: false,
    matchedIndex: null,
    matchedAnswer: null,
  }
}
