/**
 * POST /api/survey-showdown/judge — client-side contract mirror.
 *
 * Source of validation schemas lives in the backend (`judge-contract.ts`); this file
 * duplicates the public types and parsing helpers so the Next.js app stays decoupled.
 */

/** @see backend `JUDGE_RESPONSE_STATUS` */
export const JUDGE_RESPONSE_STATUS = {
  FINAL_MATCH: 'final_match',
  FINAL_MISS: 'final_miss',
  PENDING_AI: 'pending_ai',
} as const

export type JudgeResponseStatus = (typeof JUDGE_RESPONSE_STATUS)[keyof typeof JUDGE_RESPONSE_STATUS]

export interface JudgeApiRequestBody {
  input: string
  questionText: string
  /** Per-slot ids aligned with `answers` (DB uuid or custom deterministic id). */
  answerIds: string[]
  /** Board indices already revealed; judge only considers hidden slots. */
  revealedIndices: number[]
  answers: { answer: string; points: number }[]
}

/**
 * Canonical 200 response after refactor. `isMatch` duplicates `status` for legacy consumers.
 */
export type JudgeApiResponseBody =
  | {
      status: typeof JUDGE_RESPONSE_STATUS.FINAL_MATCH
      isMatch: true
      matchedIndex: number
      matchedAnswer: string
    }
  | {
      status: typeof JUDGE_RESPONSE_STATUS.FINAL_MISS
      isMatch: false
      matchedIndex: null
      matchedAnswer: null
    }
  | {
      status: typeof JUDGE_RESPONSE_STATUS.PENDING_AI
      isMatch: false
      matchedIndex: null
      matchedAnswer: null
    }

/** Response shape before `status` was added. */
export interface JudgeLegacyOkResponseBody {
  isMatch: boolean
  matchedAnswer: string | null
  matchedIndex: number | null
}

export type JudgeOkResponseBody = JudgeApiResponseBody | JudgeLegacyOkResponseBody

/** Result of {@link import('./judge').postJudge} or high-level {@link import('@/lib/constants').judgeAnswer}. */
export interface JudgeAnswerOutcome {
  matchedIndex: number | null
  /** Set when the verdict came from POST /judge. Omitted for client-side exact match only. */
  serverStatus?: JudgeResponseStatus
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Maps any successful judge JSON to the new discriminated union when possible.
 * - Bodies with `status` are returned as-is when they satisfy the narrow type.
 * - Legacy bodies infer `final_match` vs `final_miss` only (cannot produce `pending_ai`).
 */
export const normalizeJudgeOkResponse = (value: unknown): JudgeApiResponseBody | null => {
  if (!isRecord(value)) return null

  const status = value.status
  if (status === JUDGE_RESPONSE_STATUS.FINAL_MATCH) {
    if (
      value.isMatch === true &&
      typeof value.matchedIndex === 'number' &&
      typeof value.matchedAnswer === 'string'
    ) {
      return {
        status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
        isMatch: true,
        matchedIndex: value.matchedIndex,
        matchedAnswer: value.matchedAnswer,
      }
    }
    return null
  }
  if (status === JUDGE_RESPONSE_STATUS.FINAL_MISS) {
    if (value.isMatch === false && value.matchedIndex === null && value.matchedAnswer === null) {
      return {
        status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }
    }
    return null
  }
  if (status === JUDGE_RESPONSE_STATUS.PENDING_AI) {
    if (value.isMatch === false && value.matchedIndex === null && value.matchedAnswer === null) {
      return {
        status: JUDGE_RESPONSE_STATUS.PENDING_AI,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }
    }
    return null
  }

  if (typeof value.isMatch !== 'boolean') return null
  if (value.isMatch === true && typeof value.matchedIndex === 'number' && typeof value.matchedAnswer === 'string') {
    return {
      status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
      isMatch: true,
      matchedIndex: value.matchedIndex,
      matchedAnswer: value.matchedAnswer,
    }
  }
  if (
    value.isMatch === false &&
    (value.matchedIndex === null || value.matchedIndex === undefined) &&
    (value.matchedAnswer === null || value.matchedAnswer === undefined)
  ) {
    return {
      status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
      isMatch: false,
      matchedIndex: null,
      matchedAnswer: null,
    }
  }
  return null
}
