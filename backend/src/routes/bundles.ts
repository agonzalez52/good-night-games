import { Hono } from 'hono'
import { prisma } from '../lib/prisma'

const bundles = new Hono()

// GET /api/tokens/bundles
// Public — no auth required
// Returns active bundles sorted by base_price ASC
bundles.get('/', async (c) => {
  try {
    const rows = await prisma.token_bundles.findMany({
      where: { is_active: true },
      orderBy: { base_price: 'asc' },
    })
    return c.json(rows)
  } catch (error) {
    console.error('GET /api/tokens/bundles error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default bundles