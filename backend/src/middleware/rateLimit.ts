import { createMiddleware } from 'hono/factory'

// In-memory store — resets on server restart
// Phase 10: replace with Redis if needed for multi-instance deployments
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export const rateLimit = (maxRequests: number, windowMs: number) =>
  createMiddleware(async (c, next) => {
    const userId = c.get('userId') as string | undefined
    const ip = c.req.header('x-forwarded-for') || 'unknown'
    const key = userId || ip
    const now = Date.now()

    const entry = requestCounts.get(key)

    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs })
      await next()
      return
    }

    if (entry.count >= maxRequests) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    entry.count++
    await next()
  })