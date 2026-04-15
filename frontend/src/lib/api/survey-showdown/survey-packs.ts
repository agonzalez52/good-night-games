import type { SurveyPack, SurveyQuestion } from '@/lib/constants'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

/** Shared fields on survey pack rows from GET /api/survey-showdown/packs (`created_at` is an ISO string over JSON). */
export type SurveyPackApiBase = {
  id: string
  name: string
  description: string
  is_free: boolean
  is_active: boolean
  created_at: string
}

/** Free packs in the list response include inline questions (same shape as `SurveyQuestion` in app code). */
export type SurveyPackFreeListItem = SurveyPackApiBase & { questions: SurveyQuestion[] }

/** Premium packs omit `questions` in the list; `question_count` is for setup UI before GET .../questions. */
export type SurveyPackPremiumListItem = SurveyPackApiBase & { question_count: number }

export type GetPacksResponse = {
  free: SurveyPackFreeListItem[]
  premium: SurveyPackPremiumListItem[]
}

export type GetPackQuestionsResponse = { questions: SurveyQuestion[] }

/** Public catalog; safe to reuse briefly to avoid duplicate requests (Strict Mode + remounts). */
const PACKS_CACHE_TTL_MS = 120_000

let packsCache: { expiresAt: number; data: GetPacksResponse } | null = null
let packsInflight: Promise<GetPacksResponse> | null = null

/** GET /api/survey-showdown/packs — public; premium entries have no `questions` in the list (deduped in-flight + short memory cache). */
export async function getPacks(): Promise<GetPacksResponse> {
  const now = Date.now()
  if (packsCache && packsCache.expiresAt > now)
    return packsCache.data
  if (packsInflight) return packsInflight

  packsInflight = (async () => {
    const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs`)
    if (!res.ok) throw new Error('Failed to fetch packs')
    return (await res.json()) as GetPacksResponse
  })()
    .then(data => {
      packsCache = { expiresAt: Date.now() + PACKS_CACHE_TTL_MS, data }
      return data
    })
    .finally(() => {
      packsInflight = null
    })

  return packsInflight
}

/** GET /api/survey-showdown/packs/:id/questions — auth required; call after token spend confirmed. */
export async function getPackQuestions(packId: string, token: string): Promise<GetPackQuestionsResponse> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs/${packId}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch pack questions')
  return (await res.json()) as GetPackQuestionsResponse
}

/** Merge GET /packs response with cached premium `questions` for `resolvePackQuestions` / game logic. */
export function mergeSurveyPacksForGame(
  free: SurveyPackFreeListItem[],
  premium: SurveyPackPremiumListItem[],
  premiumQuestionsById: Record<string, SurveyQuestion[]>
): SurveyPack[] {
  const fromFree: SurveyPack[] = free.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    is_free: true,
    questions: p.questions,
  }))
  const fromPremium: SurveyPack[] = premium.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    is_free: false,
    questions: premiumQuestionsById[p.id] ?? [],
  }))
  return [...fromFree, ...fromPremium]
}
