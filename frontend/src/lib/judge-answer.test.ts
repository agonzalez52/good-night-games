import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JUDGE_RESPONSE_STATUS } from '@/lib/api/survey-showdown/judge-contract'
import { judgeAnswer } from '@/lib/constants'

const postJudgeMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/survey-showdown/judge', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/survey-showdown/judge')>(
    '@/lib/api/survey-showdown/judge',
  )
  return {
    ...actual,
    postJudge: postJudgeMock,
  }
})

const answers = [
  { id: 'id-a', answer: 'Alpha', points: 10 },
  { id: 'id-b', answer: 'Beta', points: 5 },
]

describe('judgeAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postJudgeMock.mockResolvedValue({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.PENDING_AI,
    })
  })

  it('short-circuits on client exact match without calling the server', async () => {
    const out = await judgeAnswer('Q', '  beta ', answers, [], async () => null)
    expect(out).toEqual({ matchedIndex: 1 })
    expect(postJudgeMock).not.toHaveBeenCalled()
  })

  it('treats guest pending_ai as immediate miss for gameplay (matchedIndex null, status preserved)', async () => {
    const out = await judgeAnswer('Q', 'gamma', answers, [], async () => null)
    expect(out).toEqual({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.PENDING_AI,
    })
    expect(postJudgeMock).toHaveBeenCalledTimes(1)
  })

  it('treats authed final_miss like a resolved miss', async () => {
    postJudgeMock.mockResolvedValueOnce({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.FINAL_MISS,
    })
    const out = await judgeAnswer('Q', 'gamma', answers, [], async () => 'session')
    expect(out).toEqual({
      matchedIndex: null,
      serverStatus: JUDGE_RESPONSE_STATUS.FINAL_MISS,
    })
  })

  it('returns matchedIndex null when answer ids are missing', async () => {
    const bad = [{ id: '', answer: 'Alpha', points: 1 }]
    const out = await judgeAnswer('Q', 'gamma', bad, [], async () => null)
    expect(out).toEqual({ matchedIndex: null })
    expect(postJudgeMock).not.toHaveBeenCalled()
  })

  it('returns matchedIndex null when postJudge fails', async () => {
    postJudgeMock.mockResolvedValueOnce(null)
    const out = await judgeAnswer('Q', 'gamma', answers, [], async () => null)
    expect(out).toEqual({ matchedIndex: null })
  })
})
