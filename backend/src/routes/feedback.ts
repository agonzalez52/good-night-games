import { Hono } from 'hono'
import { prisma } from '../lib/prisma'
import { feedbackSchema } from '../schemas/zod'
import { requireAuth, AuthVariables } from '../middleware/auth'

const feedback = new Hono<{ Variables: AuthVariables }>()

// POST /api/feedback
// Auth optional — stores user_id if present, null if not
feedback.post('/', async (c) => {
  try {
    // Try to get userId from auth header if present — don't require it
    let userId: string | null = null
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await client.auth.getUser(token)
      userId = user?.id ?? null
    }

    const body = await c.req.json()
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    await prisma.feedback.create({
      data: {
        user_id: userId,
        game_id: parsed.data.game_id ?? null,
        category: parsed.data.category,
        message: parsed.data.message,
      },
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    console.error('POST /api/feedback error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default feedback