import type { Round } from '@/lib/constants'

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

/** Free packs in the list response include inline rounds (same shape as `Round` in app code). */
export type SurveyPackFreeListItem = SurveyPackApiBase & { rounds: Round[] }

/** Premium packs in the list response omit rounds; load with `getPackRounds` after spending tokens. */
export type SurveyPackPremiumListItem = SurveyPackApiBase

export type GetPacksResponse = {
  free: SurveyPackFreeListItem[]
  premium: SurveyPackPremiumListItem[]
}

export type GetPackRoundsResponse = { rounds: Round[] }

/** GET /api/survey-showdown/packs — public; premium entries have no `rounds` in the list. */
export async function getPacks(): Promise<GetPacksResponse> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs`)
  if (!res.ok) throw new Error('Failed to fetch packs')
  return (await res.json()) as GetPacksResponse
}

/** GET /api/survey-showdown/packs/:id/rounds — auth required; call after token spend confirmed. */
export async function getPackRounds(packId: string, token: string): Promise<GetPackRoundsResponse> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs/${packId}/rounds`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch pack rounds')
  return (await res.json()) as GetPackRoundsResponse
}
