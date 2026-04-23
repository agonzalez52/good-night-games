import type { GameHistoryRecord } from '@/lib/constants'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

/** Matches backend `game_id` for Survey Showdown (GET `?game=` and POST body). */
export const SURVEY_SHOWDOWN_GAME_ID = 'survey_showdown' as const

/** One row from GET /api/survey-showdown/history (JSON: `timestamp` is ISO string). */
export type SurveyShowdownHistoryGetRow = {
  id: string
  timestamp: string
  team1: string
  team2: string
  rounds: number
  pack: string
  winner: string
  score1: number
  score2: number
}

export function mapGetHistoryRowToRecord(row: SurveyShowdownHistoryGetRow): GameHistoryRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    team1: row.team1,
    team2: row.team2,
    rounds: row.rounds,
    pack: row.pack,
    winner: row.winner,
    score1: row.score1,
    score2: row.score2,
  }
}

/** Body for POST /api/survey-showdown/history — `game_id` is set server-side from {@link SURVEY_SHOWDOWN_GAME_ID}. */
export type SaveGameHistoryInput = {
  team1: string
  team2: string
  rounds: number
  pack: string
  winner: string
  score1: number
  score2: number
}

/** 201 body from POST /api/survey-showdown/history — `session` is the canonical id/time for the new row. */
export type SaveGameHistoryResponse = {
  session: {
    id: string
    timestamp: string
    user_id: string
    game_id: string
    completed: boolean
  }
  showdownSession: {
    id: string
    session_id: string
    team1: string
    team2: string
    rounds: number
    pack: string
    winner: string
    score1: number
    score2: number
  }
}

// POST /api/survey-showdown/history — call after a completed game (signed-in)
export async function saveGameHistory(
  token: string,
  input: SaveGameHistoryInput
): Promise<SaveGameHistoryResponse> {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...input, game_id: SURVEY_SHOWDOWN_GAME_ID }),
  })
  if (!res.ok) throw new Error('Failed to save game history')
  return res.json() as Promise<SaveGameHistoryResponse>
}

// GET /api/survey-showdown/history?game=…
export async function getGameHistory(token: string): Promise<GameHistoryRecord[]> {
  const params = new URLSearchParams({ game: SURVEY_SHOWDOWN_GAME_ID })
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch game history')
  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Invalid game history response')
  return (data as SurveyShowdownHistoryGetRow[]).map(mapGetHistoryRowToRecord)
}
