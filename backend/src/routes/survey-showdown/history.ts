import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { historySchema } from '../../schemas/zod'

const MAX_HISTORY = 50

const history = new Hono<{ Variables: AuthVariables }>()

history.use('/*', requireAuth)

// POST /api/survey-showdown/history
// Creates a game_sessions record + survey_showdown_sessions record
// Enforces 50-record rolling window per user per game_id
history.post('/', async (c) => {
  const userId = c.get('userId')
  try {
    const body = await c.req.json()
    const parsed = historySchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const { game_id, team1, team2, rounds, pack, winner, score1, score2 } = parsed.data

    // Create both records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.game_sessions.create({
        data: { user_id: userId, game_id, completed: true },
      })

      const showdownSession = await tx.survey_showdown_sessions.create({
        data: { session_id: session.id, team1, team2, rounds, pack, winner, score1, score2 },
      })

      return { session, showdownSession }
    })

    // Enforce rolling 50-record window — delete oldest if over limit
    const allSessions = await prisma.game_sessions.findMany({
      where: { user_id: userId, game_id },
      orderBy: { timestamp: 'desc' },
      select: { id: true },
    })

    if (allSessions.length > MAX_HISTORY) {
      const toDelete = allSessions.slice(MAX_HISTORY).map(s => s.id)
      await prisma.game_sessions.deleteMany({ where: { id: { in: toDelete } } })
    }

    return c.json(result, 201)
  } catch (error) {
    console.error('POST /api/survey-showdown/history error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/survey-showdown/history?game=survey_showdown
// Returns the user's game history, newest first, max 50
history.get('/', async (c) => {
  const userId = c.get('userId')
  const gameId = c.req.query('game')

  if (!gameId) return c.json({ error: 'game query param is required' }, 400)

  try {
    const sessions = await prisma.game_sessions.findMany({
      where: { user_id: userId, game_id: gameId, completed: true },
      orderBy: { timestamp: 'desc' },
      take: MAX_HISTORY,
    })

    const sessionIds = sessions.map(s => s.id)
    const showdownSessions = await prisma.survey_showdown_sessions.findMany({
      where: { session_id: { in: sessionIds } },
    })

    // Join the two tables
    const sessionMap = new Map(showdownSessions.map(s => [s.session_id, s]))
    const history = sessions
      .map(s => {
        const detail = sessionMap.get(s.id)
        if (!detail) return null
        return {
          id: s.id,
          timestamp: s.timestamp,
          team1: detail.team1,
          team2: detail.team2,
          rounds: detail.rounds,
          pack: detail.pack,
          winner: detail.winner,
          score1: detail.score1,
          score2: detail.score2,
        }
      })
      .filter(Boolean)

    return c.json(history)
  } catch (error) {
    console.error('GET /api/survey-showdown/history error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default history