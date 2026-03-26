import { Hono } from 'hono'
import { prisma } from '../../lib/prisma'
import { requireAuth, AuthVariables } from '../../middleware/auth'

const packs = new Hono<{ Variables: AuthVariables }>()

// GET /api/survey-showdown/packs
// Public — no auth required for free packs
// Returns { free: Pack[], premium: Pack[] }
packs.get('/', async (c) => {
  try {
    const allPacks = await prisma.survey_packs.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
    })

    const freePacks = allPacks.filter(p => p.is_free)
    const premiumPacks = allPacks.filter(p => !p.is_free)

    // Strip rounds from premium packs — rounds are fetched separately
    // when a token spend is confirmed, not before
    const premiumPacksStripped = premiumPacks.map(({ rounds: _, ...rest }) => rest)

    return c.json({
      free: freePacks,
      premium: premiumPacksStripped,
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
    const pack = await prisma.survey_packs.findUnique({ where: { id } })
    if (!pack || !pack.is_active) return c.json({ error: 'Pack not found' }, 404)
    return c.json({ rounds: pack.rounds })
  } catch (error) {
    console.error('GET /api/survey-showdown/packs/:id/rounds error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default packs