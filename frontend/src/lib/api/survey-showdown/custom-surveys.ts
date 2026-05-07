import { customSurveyAnswerId } from '@/lib/api/survey-showdown/judge'
import type { CustomCollection, CustomSurvey } from '@/lib/constants'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

const surveyShowdownAuthHeaders = (token: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
})

export interface CustomSurveyApiRow {
  id: string
  user_id: string
  name: string | null
  collection_id: string | null
  question: string
  /** JSONB: `{ answer, points }[]` from the API. */
  answers: unknown
  created_at: string
}

export interface CustomCollectionApiRow {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface GetCustomSurveysResponse {
  surveys: CustomSurvey[]
  collections: CustomCollection[]
}

interface GetCustomSurveysApiResponse {
  surveys: CustomSurveyApiRow[]
  collections: CustomCollectionApiRow[]
}

export interface UpsertCustomSurveyInput {
  name: string | null
  collectionId: string | null
  question: string
  answers: {
    answer: string
    points: number
  }[]
}

export interface UpsertCustomCollectionInput {
  name: string
}

function clampPoints(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(100, Math.trunc(n)))
}

function normalizeAnswersForWrite(answers: UpsertCustomSurveyInput['answers']): { answer: string; points: number }[] {
  return answers.map((a) => ({
    answer: a.answer,
    points: clampPoints(a.points),
  }))
}

/** Real Supabase/DB collection ids are UUIDs. Client temp ids (e.g. c-*) must not be sent or Zod returns 400. */
function isUuidString(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value.trim()
  )
}

function normalizeCollectionIdForApi(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  if (!t) return null
  return isUuidString(t) ? t : null
}

/** Trims; empty or whitespace-only becomes `null` for the API. */
function normalizeNameForApi(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length ? t : null
}

function toSurveyWritePayload(input: UpsertCustomSurveyInput) {
  return {
    name: normalizeNameForApi(input.name),
    collectionId: normalizeCollectionIdForApi(input.collectionId),
    question: input.question,
    answers: normalizeAnswersForWrite(input.answers),
  }
}

function patchCustomSurveyCollectionPayload(collectionId: string | null) {
  return { collectionId: normalizeCollectionIdForApi(collectionId) }
}

function parseApiAnswersForModel(row: CustomSurveyApiRow): { answer: string; points: number }[] {
  if (!Array.isArray(row.answers)) return []
  return row.answers
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const a = entry as { answer?: unknown; points?: unknown }
      const text = String(a.answer ?? '')
      return {
        answer: text,
        points: typeof a.points === 'number' && Number.isFinite(a.points) ? a.points : Number(a.points) || 0,
      }
    })
    .filter((v): v is { answer: string; points: number } => v != null)
}

export function mapCustomSurveyApiRowToModel(row: CustomSurveyApiRow): CustomSurvey {
  const questionText = row.question ?? ''
  const parsed = parseApiAnswersForModel(row)
  return {
    id: row.id,
    name: row.name,
    collectionId: row.collection_id,
    question: questionText,
    answers: parsed.map((a) => ({
      id: customSurveyAnswerId(questionText, a.answer),
      answer: a.answer,
      points: a.points,
    })),
  }
}

export function mapCustomCollectionApiRowToModel(row: CustomCollectionApiRow): CustomCollection {
  return {
    id: row.id,
    name: row.name,
  }
}

async function expectJsonResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (res.ok) return res.json() as Promise<T>
  const text = await res.text()
  if (!text) throw new Error(`${fallbackError} (HTTP ${res.status})`)
  let parsed: { error?: string } | null = null
  try {
    parsed = JSON.parse(text) as { error?: string }
  } catch {
    // body is not JSON
  }
  if (typeof parsed?.error === 'string' && parsed.error) {
    throw new Error(parsed.error)
  }
  throw new Error(
    text.length > 200 ? `${fallbackError} (HTTP ${res.status})` : `${fallbackError} (HTTP ${res.status}): ${text}`
  )
}

export async function getCustomSurveys(token: string): Promise<GetCustomSurveysResponse> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys`, {
    headers: surveyShowdownAuthHeaders(token),
  })
  const data = await expectJsonResponse<GetCustomSurveysApiResponse>(res, 'Failed to fetch custom surveys')
  return {
    surveys: data.surveys.map(mapCustomSurveyApiRowToModel),
    collections: data.collections.map(mapCustomCollectionApiRowToModel),
  }
}

export async function createCustomSurvey(token: string, input: UpsertCustomSurveyInput): Promise<CustomSurvey> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys`, {
    method: 'POST',
    headers: surveyShowdownAuthHeaders(token),
    body: JSON.stringify(toSurveyWritePayload(input)),
  })
  const row = await expectJsonResponse<CustomSurveyApiRow>(res, 'Failed to create survey')
  return mapCustomSurveyApiRowToModel(row)
}

export async function updateCustomSurvey(token: string, id: string, input: UpsertCustomSurveyInput): Promise<CustomSurvey> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/${id}`, {
    method: 'PUT',
    headers: surveyShowdownAuthHeaders(token),
    body: JSON.stringify(toSurveyWritePayload(input)),
  })
  const row = await expectJsonResponse<CustomSurveyApiRow>(res, 'Failed to update survey')
  return mapCustomSurveyApiRowToModel(row)
}

/** Updates only `collection_id` (e.g. drag-and-drop between folders / uncategorized). */
export async function patchCustomSurveyCollection(
  token: string,
  surveyId: string,
  collectionId: string | null
): Promise<CustomSurvey> {
  const res = await fetch(
    `${BACKEND_URL}/api/survey-showdown/custom-surveys/${encodeURIComponent(surveyId)}/collection`,
    {
      method: 'PATCH',
      headers: surveyShowdownAuthHeaders(token),
      body: JSON.stringify(patchCustomSurveyCollectionPayload(collectionId)),
    }
  )
  const row = await expectJsonResponse<CustomSurveyApiRow>(res, 'Failed to move survey')
  return mapCustomSurveyApiRowToModel(row)
}

export async function deleteCustomSurvey(token: string, id: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/${id}`, {
    method: 'DELETE',
    headers: surveyShowdownAuthHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to delete survey')
}

export async function createCustomCollection(token: string, input: UpsertCustomCollectionInput): Promise<CustomCollection> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/collections`, {
    method: 'POST',
    headers: surveyShowdownAuthHeaders(token),
    body: JSON.stringify({ name: input.name }),
  })
  const row = await expectJsonResponse<CustomCollectionApiRow>(res, 'Failed to create collection')
  return mapCustomCollectionApiRowToModel(row)
}

export async function updateCustomCollection(token: string, id: string, input: UpsertCustomCollectionInput): Promise<CustomCollection> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/collections/${id}`, {
    method: 'PUT',
    headers: surveyShowdownAuthHeaders(token),
    body: JSON.stringify({ name: input.name }),
  })
  const row = await expectJsonResponse<CustomCollectionApiRow>(res, 'Failed to update collection')
  return mapCustomCollectionApiRowToModel(row)
}

export async function deleteCustomCollection(token: string, id: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/collections/${id}`, {
    method: 'DELETE',
    headers: surveyShowdownAuthHeaders(token),
  })
  if (!res.ok) throw new Error('Failed to delete collection')
}
