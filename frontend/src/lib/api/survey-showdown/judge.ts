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

interface JudgeResponse {
  isMatch?: boolean
  matchedAnswer?: string | null
  matchedIndex?: number | null
}

/** POST /api/survey-showdown/judge — backend handles judge_cache and rate limits */
export async function postJudge(
  token: string,
  questionText: string,
  input: string,
  answerIds: string[],
  answers: JudgeAnswerRow[],
  revealedIndices: number[]
): Promise<number | null> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  const data = (await res.json()) as JudgeResponse
  if (typeof data.matchedIndex === 'number' && !Number.isNaN(data.matchedIndex)) return data.matchedIndex
  return null
}
