import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { mapQuestionsToRounds } from './map-survey-rounds'

const packs = new Hono<{ Variables: AuthVariables }>()

const packListInclude = {
  questions: {
    orderBy: { display_order: 'asc' as const },
    include: {
      answers: { orderBy: { display_order: 'asc' as const } },
    },
  },
} satisfies Prisma.survey_packsInclude

// GET /api/survey-showdown/packs
// Public — no auth required for free packs
// Returns { free: Pack[], premium: Pack[] }
packs.get('/', async (c) => {
  try {
    const allPacks = await prisma.survey_packs.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
      include: packListInclude,
    })

    const freePacks = allPacks
      .filter((p) => p.is_free)
      .map(({ questions, ...rest }) => ({
        ...rest,
        rounds: mapQuestionsToRounds(questions),
      }))

    const premiumPacks = allPacks
      .filter((p) => !p.is_free)
      .map(({ questions: _questions, ...rest }) => rest)

    return c.json({
      free: freePacks,
      premium: premiumPacks,
    })
  } catch (error) {
    console.error('GET /api/survey-showdown/packs error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/survey-showdown/packs/:id/rounds
// Protected — only callable after tokens have been spent
// Returns the rounds for a single pack
packs.get('/:id/rounds', requireAuth, async (c) => {
  const id = c.req.param('id')
  try {
    const pack = await prisma.survey_packs.findUnique({
      where: { id },
      include: packListInclude,
    })
    if (!pack || !pack.is_active) return c.json({ error: 'Pack not found' }, 404)
    return c.json({ rounds: mapQuestionsToRounds(pack.questions) })
  } catch (error) {
    console.error('GET /api/survey-showdown/packs/:id/rounds error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default packs
