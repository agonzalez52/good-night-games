// Phase 6+: implement these as backend endpoints are wired

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// GET /api/survey-showdown/packs — public; premium rounds stripped
export async function getPacks() {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs`)
  if (!res.ok) throw new Error('Failed to fetch packs')
  return res.json()
}

// GET /api/survey-showdown/packs/:id/rounds — auth required; call after token spend confirmed
export async function getPackRounds(packId: string, token: string) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/packs/${packId}/rounds`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch pack rounds')
  return res.json()
}
