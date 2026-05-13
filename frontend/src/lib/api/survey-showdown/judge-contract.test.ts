import { describe, expect, it } from 'vitest'
import {
  JUDGE_RESPONSE_STATUS,
  normalizeJudgeOkResponse,
} from '@/lib/api/survey-showdown/judge-contract'

describe('normalizeJudgeOkResponse', () => {
  it('accepts final_match with status', () => {
    expect(
      normalizeJudgeOkResponse({
        status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
        isMatch: true,
        matchedIndex: 2,
        matchedAnswer: 'Ice cream',
      }),
    ).toEqual({
      status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
      isMatch: true,
      matchedIndex: 2,
      matchedAnswer: 'Ice cream',
    })
  })

  it('accepts final_miss with status', () => {
    expect(
      normalizeJudgeOkResponse({
        status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    ).toEqual({
      status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
      isMatch: false,
      matchedIndex: null,
      matchedAnswer: null,
    })
  })

  it('accepts pending_ai for guest staged responses', () => {
    expect(
      normalizeJudgeOkResponse({
        status: JUDGE_RESPONSE_STATUS.PENDING_AI,
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    ).toEqual({
      status: JUDGE_RESPONSE_STATUS.PENDING_AI,
      isMatch: false,
      matchedIndex: null,
      matchedAnswer: null,
    })
  })

  it('returns null when status contradicts fields', () => {
    expect(
      normalizeJudgeOkResponse({
        status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
        isMatch: true,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    ).toBeNull()
    expect(
      normalizeJudgeOkResponse({
        status: JUDGE_RESPONSE_STATUS.PENDING_AI,
        isMatch: false,
        matchedIndex: 0,
        matchedAnswer: null,
      }),
    ).toBeNull()
  })

  it('maps legacy final_match bodies without status', () => {
    expect(
      normalizeJudgeOkResponse({
        isMatch: true,
        matchedIndex: 1,
        matchedAnswer: 'Kite',
      }),
    ).toEqual({
      status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
      isMatch: true,
      matchedIndex: 1,
      matchedAnswer: 'Kite',
    })
  })

  it('maps legacy final_miss bodies without status', () => {
    expect(
      normalizeJudgeOkResponse({
        isMatch: false,
        matchedIndex: null,
        matchedAnswer: null,
      }),
    ).toEqual({
      status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
      isMatch: false,
      matchedIndex: null,
      matchedAnswer: null,
    })
  })

  it('returns null for invalid payloads', () => {
    expect(normalizeJudgeOkResponse(null)).toBeNull()
    expect(normalizeJudgeOkResponse('x')).toBeNull()
    expect(normalizeJudgeOkResponse([])).toBeNull()
  })
})
