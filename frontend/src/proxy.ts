import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Optional staging lock: set `STAGING_PASSWORD` on the frontend host (build + runtime).
 * Browser shows the native Basic prompt; credentials apply to this origin only.
 * Does not protect a separate API origin — use network rules or backend auth there if needed.
 */
export function proxy(request: NextRequest) {
  const password = process.env.STAGING_PASSWORD
  if (!password) return NextResponse.next()

  const user = process.env.STAGING_BASIC_USER ?? 'staging'
  const auth = request.headers.get('authorization')
  const expected = `Basic ${btoa(`${user}:${password}`)}`

  if (auth !== expected) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Staging"' },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
