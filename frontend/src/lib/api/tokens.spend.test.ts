import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SURVEY_SHOWDOWN_GAME_ID } from './config'

describe('spendTokens', () => {
  let spendTokens: typeof import('./tokens').spendTokens

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://api.test')
    ;({ spendTokens } = await import('./tokens'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          balance: 3,
          tokensSpent: 2,
          gameId: SURVEY_SHOWDOWN_GAME_ID,
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('POSTs game_id only (server resolves cost from game_config)', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const result = await spendTokens('jwt-1', SURVEY_SHOWDOWN_GAME_ID)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/api/tokens/spend')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-1',
    })
    expect(JSON.parse(init.body as string)).toEqual({
      game_id: SURVEY_SHOWDOWN_GAME_ID,
    })
    expect(result).toEqual({
      balance: 3,
      tokensSpent: 2,
      gameId: SURVEY_SHOWDOWN_GAME_ID,
    })
  })

  it('does not send client-authoritative amount', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    await spendTokens('jwt-1', SURVEY_SHOWDOWN_GAME_ID)

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>
    expect(body).not.toHaveProperty('amount')
  })

  it('throws when spend fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false }),
    )
    ;({ spendTokens } = await import('./tokens'))

    await expect(spendTokens('jwt-1', SURVEY_SHOWDOWN_GAME_ID)).rejects.toThrow(
      'Failed to spend tokens',
    )
  })
})
