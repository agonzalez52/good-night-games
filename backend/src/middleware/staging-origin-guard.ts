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

/**
 * Local dev: browsers treat `localhost` and `127.0.0.1` as different origins.
 * If either is configured, allow the other with the same scheme and port.
 */
function addLoopbackAlternates(origins: Set<string>): void {
  for (const o of [...origins]) {
    try {
      const u = new URL(o)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
      const twin = new URL(u.href)
      if (u.hostname === 'localhost') twin.hostname = '127.0.0.1'
      else if (u.hostname === '127.0.0.1') twin.hostname = 'localhost'
      else continue
      origins.add(twin.origin)
    } catch {
      /* skip invalid */
    }
  }
}

/**
 * Union of normalized `ALLOWED_ORIGINS` (comma-separated) and `FRONTEND_URL` when set.
 * Extra deployment URLs go in ALLOWED_ORIGINS; FRONTEND_URL still applies (e.g. local dev
 * alongside a Vercel preview origin).
 */
export function buildAllowedOriginsSet(): Set<string> {
  const out = new Set<string>()
  const list = process.env.ALLOWED_ORIGINS?.trim()

  if (list) {
    for (const part of list.split(',')) {
      const o = normalizeOriginString(part)
      if (o) out.add(o)
    }
  }

  const single = process.env.FRONTEND_URL?.trim()
  if (single) {
    const o = normalizeOriginString(single)
    if (o) out.add(o)
  }

  addLoopbackAlternates(out)
  return out
}

function resolveBrowserOrigin(c: {
  req: { header: (name: string) => string | undefined }
}): string | null {
  const rawOrigin = c.req.header('Origin')
  if (rawOrigin) return normalizeOriginString(rawOrigin)
  const referer = c.req.header('Referer')
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

function shouldBypassGuard(c: { req: { method: string; path: string } }): boolean {
  if (c.req.method === 'OPTIONS') return true
  if (c.req.path === '/health' && c.req.method === 'GET') return true
  if (c.req.path === '/api/tokens/webhook' && c.req.method === 'POST') return true
  return false
}

/**
 * When `STAGING_ENFORCE_ORIGIN` is true, only requests whose browser origin matches an
 * entry in the union of `ALLOWED_ORIGINS` (comma-separated) and normalized `FRONTEND_URL`.
 * Uses `Origin`, or `Referer` when `Origin` is omitted. Localhost loopback aliases are paired
 * (`localhost` ↔ `127.0.0.1`, same port). Disabled when the flag is unset/false.
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

  const requestOrigin = resolveBrowserOrigin(c)
  if (!requestOrigin || !allowed.has(requestOrigin)) {
    return c.text('Forbidden', 403)
  }

  await next()
}
