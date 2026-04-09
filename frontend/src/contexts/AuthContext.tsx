'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUser } from '@/lib/constants'
import { useTokenBalance } from '@/hooks/useTokenBalance'

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

export type AuthContextValue = {
  currentUser: CurrentUser | null
  loading: boolean
  updateTokenBalance: (newBalance: number) => void
  markEmailVerified: () => void
  signOut: () => Promise<void>
  setAuthUser: (user: CurrentUser | null) => void
  patchUser: (updater: (u: CurrentUser) => CurrentUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  /** Collapses concurrent POST /verify-email (INITIAL_SESSION + Strict Mode, etc.). */
  const verifyEmailInFlight = useRef<Promise<void> | null>(null)

  /**
   * Uses the session passed in — never call supabase.auth.getSession() from inside
   * onAuthStateChange (async callbacks run under GoTrue's lock; getSession there can deadlock).
   */
  const fetchUserProfile = useCallback(async (session: Session): Promise<CurrentUser | null> => {
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
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
    let cancelled = false
    let subscription: { unsubscribe: () => void } | null = null

    void (async () => {
      await consumeImplicitGrantHash(supabase)
      if (cancelled) return

      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          // Signed-out initial load: safe to show logged-out UI immediately.
          // With a session, keep loading true until /me + /balance complete so the header never flashes "logged out".
          if (event === 'INITIAL_SESSION' && !session?.user) {
            setLoading(false)
          }
          if (event === 'SIGNED_OUT') {
            verifyEmailInFlight.current = null
            setCurrentUser(null)
            setLoading(false)
            return
          }
          // Token refresh only extends the JWT; profile/balance are unchanged — skip extra /me + /balance.
          const shouldSyncProfile =
            session?.user &&
            (event === 'SIGNED_IN' ||
              event === 'INITIAL_SESSION' ||
              event === 'USER_UPDATED')
          if (!shouldSyncProfile || !session?.user) return

          void (async () => {
            try {
              const runVerifyEmail =
                session.user.email_confirmed_at &&
                session.access_token &&
                (event === 'SIGNED_IN' ||
                  event === 'USER_UPDATED' ||
                  event === 'INITIAL_SESSION')
              if (runVerifyEmail) {
                verifyEmailInFlight.current ??= (async () => {
                  try {
                    await fetch(`${backendUrl}/api/auth/verify-email`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                  } finally {
                    verifyEmailInFlight.current = null
                  }
                })()
                await verifyEmailInFlight.current
              }
              const profile = await fetchUserProfile(session)
              if (!cancelled) setCurrentUser(profile)
            } finally {
              if (!cancelled && event === 'INITIAL_SESSION') {
                setLoading(false)
              }
            }
          })()
        }
      )
      if (cancelled) {
        sub.unsubscribe()
        return
      }
      subscription = sub
    })()

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [fetchUserProfile])

  const updateTokenBalance = useCallback((newBalance: number) => {
    setCurrentUser(u => (u ? { ...u, tokenBalance: newBalance } : u))
  }, [])

  useTokenBalance(currentUser?.id, updateTokenBalance)

  const markEmailVerified = useCallback(() => {
    setCurrentUser(u => (u ? { ...u, emailVerified: true } : u))
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setCurrentUser(null)
  }, [])

  /** Signup (pre-verify) or mock auth — session listener may overwrite with server profile after sync. */
  const setAuthUser = useCallback((user: CurrentUser | null) => {
    setCurrentUser(user)
  }, [])

  const patchUser = useCallback((updater: (u: CurrentUser) => CurrentUser) => {
    setCurrentUser(u => (u ? updater(u) : u))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      updateTokenBalance,
      markEmailVerified,
      signOut,
      setAuthUser,
      patchUser,
    }),
    [
      currentUser,
      loading,
      updateTokenBalance,
      markEmailVerified,
      signOut,
      setAuthUser,
      patchUser,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
