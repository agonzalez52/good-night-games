import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Handles OAuth (Google), magic links, and password recovery: Supabase redirects here
// with ?code= (PKCE). We exchange for a session, then redirect to `next` (default: game).
// Recovery emails must use redirectTo pointing here — never the home URL, or the root
// page's redirect would drop ?code= and leave the user logged out.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/survey-showdown'
  const ref = searchParams.get('ref')
  const verifySignup = searchParams.get('verify_signup')
  const challenge = searchParams.get('challenge')?.trim()
  const buildNextRedirect = (): URL => {
    const redirectUrl = new URL(next, origin)
    if (verifySignup === '1' && challenge) {
      redirectUrl.searchParams.set('verify_signup', '1')
      redirectUrl.searchParams.set('challenge', challenge)
    }
    return redirectUrl
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const refParam = ref?.trim()
      if (refParam) {
        const normalized = refParam.toUpperCase()
        await supabase.auth.updateUser({ data: { referral_code: normalized } })
      }
      return NextResponse.redirect(buildNextRedirect().toString())
    }
  }

  // Magic-link verification callbacks can arrive without PKCE `code`.
  // Preserve verification params so the client can confirm challenge.
  if (verifySignup === '1' && challenge) {
    return NextResponse.redirect(buildNextRedirect().toString())
  }

  // Auth failed — redirect to game with error param so the app can surface a message
  return NextResponse.redirect(`${origin}/survey-showdown?error=auth_failed`)
}
