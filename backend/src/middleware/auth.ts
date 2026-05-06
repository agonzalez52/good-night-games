import { createMiddleware } from 'hono/factory'
import { supabaseAdmin } from '../lib/supabase'

export type AuthVariables = {
  userId: string
}

/** Sets `userId` from a valid Bearer JWT, or leaves it unset when missing/invalid (route continues). */
export type OptionalAuthVariables = {
  userId: string | undefined
}

export const optionalAuth = createMiddleware<{ Variables: OptionalAuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      await next()
      return
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      await next()
      return
    }

    c.set('userId', user.id)
    await next()
  }
)

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('userId', user.id)
    await next()
  }
)