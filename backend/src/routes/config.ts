import { Hono } from 'hono'
import { getSignupBonusTokens } from '../lib/config'

const config = new Hono()

// GET /api/config
// Public — no auth required
config.get('/', (c) => {
  return c.json({ signupBonusTokens: getSignupBonusTokens() })
})

export default config
