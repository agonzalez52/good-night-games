import { useAuth } from '@/hooks/useAuth'

/** Product-level config from GET /api/config (loaded in AuthProvider). */
export function useProductConfig() {
  const { signupBonusTokens } = useAuth()
  return { signupBonusTokens }
}
