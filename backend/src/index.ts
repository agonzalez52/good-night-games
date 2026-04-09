import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import bundles from './routes/bundles'
import tokens, { handleTokensStripeWebhook } from './routes/tokens'
import auth from './routes/auth'
import referrals from './routes/referrals'
import feedback from './routes/feedback'
import packs from './routes/survey-showdown/packs'
import customSurveys from './routes/survey-showdown/custom-surveys'
import judge from './routes/survey-showdown/judge'
import history from './routes/survey-showdown/history'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Stripe tokens webhook — raw body for signature verification; register before any global JSON body parser
app.post('/api/tokens/webhook', handleTokensStripeWebhook)

// Product-level routes
app.route('/api/tokens/bundles', bundles)
app.route('/api/tokens', tokens)
app.route('/api/auth', auth)
app.route('/api/referrals', referrals)
app.route('/api/feedback', feedback)

// Survey Showdown routes
app.route('/api/survey-showdown/packs', packs)
app.route('/api/survey-showdown/custom-surveys', customSurveys)
app.route('/api/survey-showdown/judge', judge)
app.route('/api/survey-showdown/history', history)

const port = Number(process.env.PORT) || 3001
console.log(`Server running on port ${port}`)

serve({ fetch: app.fetch, port })