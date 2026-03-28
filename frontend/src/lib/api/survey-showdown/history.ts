// Phase 9: implement game history helpers

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// POST /api/survey-showdown/history — called in handleNewGame after a completed game
export async function saveGameHistory(token: string, record: {
  game_id: string
  team1: string
  team2: string
  rounds: number
  pack: string
  winner: string
  score1: number
  score2: number
}) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(record),
  })
  if (!res.ok) throw new Error('Failed to save game history')
  return res.json()
}

// GET /api/survey-showdown/history?game=survey_showdown
export async function getGameHistory(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/history?game=survey_showdown`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch game history')
  return res.json()
}
