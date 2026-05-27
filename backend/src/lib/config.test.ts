import { describe, it, expect, beforeEach } from 'vitest'
import {
  getMaxReferrals,
  getReferralTokens,
  getSignupBonusTokens,
  resetMaxReferralsCacheForTests,
  resetReferralTokensCacheForTests,
  resetSignupBonusTokensCacheForTests,
} from './config'

describe('config env parsing', () => {
  beforeEach(() => {
    resetSignupBonusTokensCacheForTests()
    resetReferralTokensCacheForTests()
    resetMaxReferralsCacheForTests()
    delete process.env.SIGNUP_BONUS_TOKENS
    delete process.env.REFERRAL_TOKENS
    delete process.env.MAX_REFERRALS
  })

  describe('getReferralTokens', () => {
    it('defaults to 2 when env is unset', () => {
      expect(getReferralTokens()).toBe(2)
    })

    it('reads REFERRAL_TOKENS from env', () => {
      process.env.REFERRAL_TOKENS = '5'
      resetReferralTokensCacheForTests()
      expect(getReferralTokens()).toBe(5)
    })

    it('falls back to 2 for invalid env values', () => {
      for (const invalid of ['', '  ', '0', '-1', 'abc', '2.5']) {
        process.env.REFERRAL_TOKENS = invalid
        resetReferralTokensCacheForTests()
        expect(getReferralTokens()).toBe(2)
      }
    })
  })

  describe('getMaxReferrals', () => {
    it('defaults to 3 when env is unset', () => {
      expect(getMaxReferrals()).toBe(3)
    })

    it('reads MAX_REFERRALS from env', () => {
      process.env.MAX_REFERRALS = '10'
      resetMaxReferralsCacheForTests()
      expect(getMaxReferrals()).toBe(10)
    })

    it('falls back to 3 for invalid env values', () => {
      for (const invalid of ['', '  ', '0', '-1', 'abc', '3.5']) {
        process.env.MAX_REFERRALS = invalid
        resetMaxReferralsCacheForTests()
        expect(getMaxReferrals()).toBe(3)
      }
    })
  })

  describe('getSignupBonusTokens', () => {
    it('falls back to 4 for invalid env values', () => {
      process.env.SIGNUP_BONUS_TOKENS = 'not-a-number'
      resetSignupBonusTokensCacheForTests()
      expect(getSignupBonusTokens()).toBe(4)
    })
  })
})
