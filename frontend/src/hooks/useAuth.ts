'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { CurrentUser } from '@/lib/constants'

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchUserProfile(authUser: User): Promise<CurrentUser | null> {
    const supabase = createClient()
    const session = (await supabase.auth.getSession()).data.session
    if (!session) return null

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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user)
        setCurrentUser(profile)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await fetchUserProfile(session.user)
          setCurrentUser(profile)
        }
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
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

  return { currentUser, loading, updateTokenBalance, markEmailVerified, signOut }
}
