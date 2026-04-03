'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUser } from '@/lib/constants'

/**
 * Email confirmation links use an implicit-style hash (#access_token=…).
 * @supabase/ssr's browser client forces flowType "pkce", so GoTrue rejects that URL
 * during init ("Not a valid PKCE flow url") and never stores a session.
 * We parse the hash and call setSession, which works with PKCE and emits SIGNED_IN.
 */
async function consumeImplicitGrantHash(supabase: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') return
  const raw = window.location.hash
  if (!raw || raw.length < 2) return
  const params = new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return

  const url = new URL(window.location.href)
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * Uses the session passed in — never call supabase.auth.getSession() from inside
   * onAuthStateChange (async callbacks run under GoTrue's lock; getSession there can deadlock).
   */
  async function fetchUserProfile(session: Session): Promise<CurrentUser | null> {
    const authUser = session.user
    if (!authUser || !session.access_token) return null

    const headers = { Authorization: `Bearer ${session.access_token}` }
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

    const [profileRes, tokenRes] = await Promise.all([
      fetch(`${backendUrl}/api/auth/me`, { headers }),
      fetch(`${backendUrl}/api/tokens/balance`, { headers }),
    ])

    if (!profileRes.ok || !tokenRes.ok) return null

    const profile = await profileRes.json()
    const tokens = await tokenRes.json()

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      username: profile.username ?? authUser.email?.split('@')[0] ?? 'player',
      tokenBalance: tokens.balance ?? 0,
      emailVerified: profile.email_verified ?? false,
      referralsClaimed: profile.referrals_claimed ?? 0,
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
    let cancelled = false

    void (async () => {
      await consumeImplicitGrantHash(supabase)
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session?.user) {
        const profile = await fetchUserProfile(session)
        if (!cancelled) setCurrentUser(profile)
      }
      if (!cancelled) setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null)
          return
        }
        const shouldSyncProfile =
          session?.user &&
          (event === 'SIGNED_IN' ||
            event === 'INITIAL_SESSION' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED')
        if (!shouldSyncProfile || !session?.user) return

        void (async () => {
          const runVerifyEmail =
            session.user.email_confirmed_at &&
            session.access_token &&
            (event === 'SIGNED_IN' ||
              event === 'USER_UPDATED' ||
              event === 'INITIAL_SESSION')
          if (runVerifyEmail) {
            await fetch(`${backendUrl}/api/auth/verify-email`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
          }
          const profile = await fetchUserProfile(session)
          if (!cancelled) setCurrentUser(profile)
        })()
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  function updateTokenBalance(newBalance: number) {
    setCurrentUser(u => u ? { ...u, tokenBalance: newBalance } : u)
  }

  function markEmailVerified() {
    setCurrentUser(u => u ? { ...u, emailVerified: true } : u)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setCurrentUser(null)
  }

  /** Signup (pre-verify) or mock auth — session listener may overwrite with server profile after sync. */
  function setAuthUser(user: CurrentUser | null) {
    setCurrentUser(user)
  }

  function patchUser(updater: (u: CurrentUser) => CurrentUser) {
    setCurrentUser(u => (u ? updater(u) : u))
  }

  return { currentUser, loading, updateTokenBalance, markEmailVerified, signOut, setAuthUser, patchUser }
}
