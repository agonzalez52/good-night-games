import {
  JUDGE_RESPONSE_STATUS,
  normalizeJudgeOkResponse,
  type JudgeAnswerOutcome,
} from '@/lib/api/survey-showdown/judge-contract'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

interface JudgeAnswerRow {
  id: string
  answer: string
  points: number
}

function djb2Hash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

/** Deterministic id for custom-survey slots (question + answer text), aligned with gameplay / judge_cache. */
export function customSurveyAnswerId(question: string, answer: string): string {
  const q = question.trim()
  const a = answer.trim()
  return `ss:qa:${djb2Hash(`${q}\u001f${a}`)}`
}

/** POST /api/survey-showdown/judge — backend handles judge_cache and rate limits. Contract: `./judge-contract`. */
export async function postJudge(
  token: string | null,
  questionText: string,
  input: string,
  answerIds: string[],
  answers: JudgeAnswerRow[],
  revealedIndices: number[]
): Promise<JudgeAnswerOutcome | null> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/judge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      questionText,
      input,
      answerIds,
      revealedIndices,
      answers: answers.map(a => ({
        answer: a.answer.trim(),
        points: a.points,
      })),
    }),
  })
  if (!res.ok) return null
  const body = normalizeJudgeOkResponse(await res.json())
  if (!body) return null
  return {
    matchedIndex: body.status === JUDGE_RESPONSE_STATUS.FINAL_MATCH ? body.matchedIndex : null,
    serverStatus: body.status,
  }
}
