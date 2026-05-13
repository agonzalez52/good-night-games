import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JUDGE_RESPONSE_STATUS } from '@/lib/api/survey-showdown/judge-contract'

describe('postJudge', () => {
  let postJudge: typeof import('./judge').postJudge

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_BACKEND_URL', 'http://api.test')
    ;({ postJudge } = await import('./judge'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
          isMatch: false,
          matchedIndex: null,
          matchedAnswer: null,
        }),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends Bearer token when token is non-null', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    await postJudge('jwt-1', 'Q?', 'guess', ['a1'], [{ id: 'a1', answer: 'One', points: 10 }], [])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://api.test/api/survey-showdown/judge')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer jwt-1',
    })
  })

  it('omits Authorization for guests', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    await postJudge(null, 'Q?', 'guess', ['a1'], [{ id: 'a1', answer: 'One', points: 10 }], [])

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('returns matchedIndex only for final_match', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
        isMatch: true,
        matchedIndex: 0,
        matchedAnswer: 'Towel',
      }),
    })

    await expect(
      postJudge(null, 'Beach', 'towel', ['x'], [{ id: 'x', answer: 'Towel', points: 5 }], []),
    ).resolves.toEqual({
      matchedIndex: 0,
      serverStatus: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
    })
  })

  it('maps pending_ai to null matchedIndex with serverStatus', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: JUDGE_RESPONSE_STATUS.PENDING_AI,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    })

    await expect(
      postJudge(null, 'Beach', 'odd', ['x', 'y'], [
        { id: 'x', answer: 'A', points: 1 },
        { id: 'y', answer: 'B', points: 1 },
      ], []),
    ).resolves.toEqual({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.PENDING_AI,
    })
  })

  it('maps final_miss to null matchedIndex', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    })

    await expect(
      postJudge('tok', 'Beach', 'nope', ['x'], [{ id: 'x', answer: 'A', points: 1 }], []),
    ).resolves.toEqual({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.FINAL_MISS,
    })
  })

  it('returns null when response is not ok', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    await expect(postJudge(null, 'Q', 'x', ['a'], [{ id: 'a', answer: 'A', points: 1 }], [])).resolves.toBeNull()
  })

  it('returns null when JSON is not a valid judge contract (e.g. contradictory miss shape)', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'unknown_status',
        isMatch: false,
        matchedIndex: 0,
        matchedAnswer: null,
      }),
    })

    await expect(postJudge(null, 'Q', 'x', ['a'], [{ id: 'a', answer: 'A', points: 1 }], [])).resolves.toBeNull()
  })
})
