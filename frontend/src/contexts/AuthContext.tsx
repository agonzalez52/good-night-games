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
import {
  claimReferral,
  getReferralData,
  type ReferralDataResponse,
} from '@/lib/api/referrals'
import { getTokenBundles } from '@/lib/api/tokens'
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
  /** GET /api/referrals snapshot for `currentUser.id`; null if missing or user switched. */
  referralSnapshot: ReferralDataResponse | null
  revalidateReferralSnapshot: () => Promise<void>
  updateTokenBalance: (newBalance: number) => void
  markEmailVerified: () => void
  signOut: () => Promise<void>
  setAuthUser: (user: CurrentUser | null) => void
  patchUser: (updater: (u: CurrentUser) => CurrentUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function parseReferralPayload(raw: unknown): ReferralDataResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    typeof o.referralCode !== 'string' ||
    typeof o.claimed !== 'number' ||
    typeof o.pending !== 'number' ||
    typeof o.max !== 'number'
  ) {
    return null
  }
  return {
    referralCode: o.referralCode,
    claimed: o.claimed,
    pending: o.pending,
    max: o.max,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [referralCache, setReferralCache] = useState<{
    userId: string
    data: ReferralDataResponse
  } | null>(null)
  /** Collapses concurrent POST /verify-email (INITIAL_SESSION + Strict Mode, etc.). Resolves to response ok. */
  const verifyEmailInFlight = useRef<Promise<boolean> | null>(null)

  /**
   * Uses the session passed in — never call supabase.auth.getSession() from inside
   * onAuthStateChange (async callbacks run under GoTrue's lock; getSession there can deadlock).
   */
  const fetchUserProfile = useCallback(
    async (
      session: Session,
    ): Promise<{ user: CurrentUser | null; referral: ReferralDataResponse | null }> => {
      const authUser = session.user
      if (!authUser || !session.access_token) return { user: null, referral: null }

      const headers = { Authorization: `Bearer ${session.access_token}` }
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

      const [profileRes, tokenRes, referralRes] = await Promise.all([
        fetch(`${backendUrl}/api/auth/me`, { headers }),
        fetch(`${backendUrl}/api/tokens/balance`, { headers }),
        fetch(`${backendUrl}/api/referrals`, { headers }),
      ])

      if (!profileRes.ok || !tokenRes.ok) return { user: null, referral: null }

      const profile = await profileRes.json()
      const tokens = await tokenRes.json()

      let referral: ReferralDataResponse | null = null
      if (referralRes.ok) {
        try {
          referral = parseReferralPayload(await referralRes.json())
        } catch {
          referral = null
        }
      }

      return {
        user: {
          id: authUser.id,
          email: authUser.email ?? '',
          username: profile.username ?? authUser.email?.split('@')[0] ?? 'player',
          tokenBalance: tokens.balance ?? 0,
          emailVerified: profile.email_verified ?? false,
          referralsClaimed: profile.referrals_claimed ?? 0,
        },
        referral,
      }
    },
    [],
  )

  const updateTokenBalance = useCallback((newBalance: number) => {
    setCurrentUser(u => (u ? { ...u, tokenBalance: newBalance } : u))
  }, [])

  const revalidateReferralSnapshot = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    const uid = session?.user?.id
    if (!token || !uid) return
    try {
      const data = await getReferralData(token)
      setReferralCache({ userId: uid, data })
    } catch {
      // leave existing cache; modal may show stale-while-revalidate
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
            setReferralCache(null)
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
              // After password / magic sign-in, `loading` was already false from the logged-out
              // initial session — keep it true until /me + /balance return so the header never
              // flashes logged-out chrome (INITIAL_SESSION already starts with loading === true).
              if (event === 'SIGNED_IN') {
                setLoading(true)
              }
              const sessionUserId = session?.user?.id
              if (sessionUserId) {
                setReferralCache(prev => (prev && prev.userId !== sessionUserId ? null : prev))
              }
              const runVerifyEmail =
                session.user.email_confirmed_at &&
                session.access_token &&
                (event === 'SIGNED_IN' ||
                  event === 'USER_UPDATED' ||
                  event === 'INITIAL_SESSION')
              if (runVerifyEmail) {
                verifyEmailInFlight.current ??= (async () => {
                  try {
                    const res = await fetch(`${backendUrl}/api/auth/verify-email`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    return res.ok
                  } finally {
                    verifyEmailInFlight.current = null
                  }
                })()
                const verifyOk = await verifyEmailInFlight.current
                if (verifyOk && session.access_token) {
                  try {
                    const claimResult = await claimReferral(session.access_token)
                    if (claimResult.success) updateTokenBalance(claimResult.balance)
                  } catch {
                    // Referral claim must not block profile sync (network / 5xx / malformed body only).
                  }
                }
              }
              const { user: profile, referral: referralPayload } = await fetchUserProfile(session)
              if (!cancelled) {
                setCurrentUser(profile)
                if (profile && referralPayload) {
                  setReferralCache({ userId: profile.id, data: referralPayload })
                } else if (profile) {
                  setReferralCache(null)
                } else {
                  setReferralCache(null)
                }
                if (profile) void getTokenBundles().catch(() => {})
              }
            } finally {
              if (!cancelled) {
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
  }, [fetchUserProfile, revalidateReferralSnapshot, updateTokenBalance])

  useTokenBalance(currentUser?.id, updateTokenBalance)

  const markEmailVerified = useCallback(() => {
    setCurrentUser(u => (u ? { ...u, emailVerified: true } : u))
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setCurrentUser(null)
    setReferralCache(null)
  }, [])

  /** Signup (pre-verify) or mock auth — session listener may overwrite with server profile after sync. */
  const setAuthUser = useCallback((user: CurrentUser | null) => {
    setCurrentUser(user)
  }, [])

  const patchUser = useCallback((updater: (u: CurrentUser) => CurrentUser) => {
    setCurrentUser(u => (u ? updater(u) : u))
  }, [])

  const referralSnapshot = useMemo((): ReferralDataResponse | null => {
    if (!referralCache || !currentUser || referralCache.userId !== currentUser.id) return null
    return referralCache.data
  }, [referralCache, currentUser?.id])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      referralSnapshot,
      revalidateReferralSnapshot,
      updateTokenBalance,
      markEmailVerified,
      signOut,
      setAuthUser,
      patchUser,
    }),
    [
      currentUser,
      loading,
      referralSnapshot,
      revalidateReferralSnapshot,
      updateTokenBalance,
      markEmailVerified,
      signOut,
      setAuthUser,
      patchUser,
    ],
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
