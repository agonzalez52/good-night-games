// Phase 8: implement judge helper — replaces direct Anthropic calls in FaceOffScreen/BoardScreen

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// POST /api/survey-showdown/judge
// Phase 8: replace judgeAnswer() in constants.ts with this fetch helper.
// The backend handles caching (judge_cache table) and rate limiting (60 req/min).
export async function judgeAnswerRemote(
  token: string,
  input: string,
  surveyId: string,
  answers: { text: string; points: number }[]
): Promise<number | null> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/judge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ input, surveyId, answers }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.matchedIndex ?? null
}
