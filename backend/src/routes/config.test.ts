import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import config from './config'
import {
  getSignupBonusTokens,
  resetSignupBonusTokensCacheForTests,
} from '../lib/config'

describe('GET /api/config', () => {
  const app = new Hono()
  app.route('/api/config', config)

  beforeEach(() => {
    resetSignupBonusTokensCacheForTests()
    delete process.env.SIGNUP_BONUS_TOKENS
  })

  it('returns signupBonusTokens from env-backed config', async () => {
    process.env.SIGNUP_BONUS_TOKENS = '7'
    resetSignupBonusTokensCacheForTests()

    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signupBonusTokens: 7 })
    expect(getSignupBonusTokens()).toBe(7)
  })

  it('defaults signupBonusTokens to 4 when env is unset', async () => {
    const res = await app.request('/api/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signupBonusTokens: 4 })
  })
})
