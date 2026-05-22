import { useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  DEFAULT_TOKENS_PER_GAME,
  SURVEY_SHOWDOWN_GAME_ID,
  getGameConfig,
  getTokensPerGame,
  type GameConfigPayload,
} from '@/lib/api/config'

/** Product-level config from GET /api/config (loaded in AuthProvider). */
export function useProductConfig() {
  const { signupBonusTokens, games } = useAuth()

  const getGame = useCallback(
    (gameId: string): GameConfigPayload | null => getGameConfig(games, gameId),
    [games]
  )

  const getTokensPerGameFor = useCallback(
    (gameId: string, fallback = DEFAULT_TOKENS_PER_GAME): number =>
      getTokensPerGame(games, gameId, fallback),
    [games]
  )

  const surveyShowdownTokensPerGame = getTokensPerGame(
    games,
    SURVEY_SHOWDOWN_GAME_ID
  )

  return {
    signupBonusTokens,
    games,
    getGame,
    getTokensPerGame: getTokensPerGameFor,
    surveyShowdownTokensPerGame,
    surveyShowdownGameId: SURVEY_SHOWDOWN_GAME_ID,
  }
}
