import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { feedbackSchema } from '../schemas/zod'
import { requireAuth, AuthVariables } from '../middleware/auth'

const feedback = new Hono<{ Variables: AuthVariables }>()

// POST /api/feedback — requires valid Authorization: Bearer
feedback.post('/', requireAuth, async (c) => {
  try {
    const userId = c.get('userId')

    const body = await c.req.json()
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    await prisma.feedback.create({
      data: {
        user_id: userId,
        game_id: parsed.data.game_id ?? null,
        category: parsed.data.category,
        message: parsed.data.message,
        status: 'OPEN',
        notes: '',
      },
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    console.error('POST /api/feedback error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default feedback
