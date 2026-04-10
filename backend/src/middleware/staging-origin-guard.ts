import type { MiddlewareHandler } from 'hono'

function isEnforceEnabled(): boolean {
  const v = process.env.STAGING_ENFORCE_ORIGIN?.trim().toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Normalizes to a string comparable to `request.headers.get('Origin')` after URL parsing
 * (scheme + host + port, no path, default ports dropped).
 */
export function normalizeOriginString(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/** Builds a set of allowed browser origins (exact match after normalization). */
export function buildAllowedOriginsSet(): Set<string> {
  const out = new Set<string>()
  const list = process.env.ALLOWED_ORIGINS?.trim()

  if (list) {
    for (const part of list.split(',')) {
      const o = normalizeOriginString(part)
      if (o) out.add(o)
    }
    return out
  }

  const single = process.env.FRONTEND_URL?.trim()
  if (single) {
    const o = normalizeOriginString(single)
    if (o) out.add(o)
  }
  return out
}

function shouldBypassGuard(c: { req: { method: string; path: string } }): boolean {
  if (c.req.method === 'OPTIONS') return true
  if (c.req.path === '/health' && c.req.method === 'GET') return true
  if (c.req.path === '/api/tokens/webhook' && c.req.method === 'POST') return true
  return false
}

/**
 * When `STAGING_ENFORCE_ORIGIN` is true, only requests whose `Origin` header matches an
 * entry in `ALLOWED_ORIGINS` (comma-separated) or the normalized `FRONTEND_URL` are allowed.
 * Disabled when the flag is unset/false — normal production behavior.
 */
export const stagingOriginGuard: MiddlewareHandler = async (c, next) => {
  if (!isEnforceEnabled()) return next()

  if (shouldBypassGuard(c)) return next()

  const allowed = buildAllowedOriginsSet()
  if (allowed.size === 0) {
    console.warn(
      '[stagingOriginGuard] STAGING_ENFORCE_ORIGIN is enabled but no valid origins were parsed from ALLOWED_ORIGINS or FRONTEND_URL',
    )
    return c.text('Forbidden', 403)
  }

  const rawOrigin = c.req.header('Origin')
  if (!rawOrigin) {
    return c.text('Forbidden', 403)
  }

  const requestOrigin = normalizeOriginString(rawOrigin)
  if (!requestOrigin || !allowed.has(requestOrigin)) {
    return c.text('Forbidden', 403)
  }

  await next()
}
