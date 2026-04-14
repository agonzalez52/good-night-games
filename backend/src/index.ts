import { createAdaptorServer } from '@hono/node-server'
import type { AddressInfo } from 'node:net'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { stagingOriginGuard } from './middleware/staging-origin-guard'
import tokenBundles from './routes/token-bundles'
import tokens, { handleTokensStripeWebhook } from './routes/tokens'
import auth from './routes/auth'
import referrals from './routes/referrals'
import feedback from './routes/feedback'
import surveyPacks from './routes/survey-showdown/survey-packs'
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
app.use('*', stagingOriginGuard)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Stripe tokens webhook — raw body for signature verification; register before any global JSON body parser
app.post('/api/tokens/webhook', handleTokensStripeWebhook)

// Product-level routes
app.route('/api/tokens/bundles', tokenBundles)
app.route('/api/tokens', tokens)
app.route('/api/auth', auth)
app.route('/api/referrals', referrals)
app.route('/api/feedback', feedback)

// Survey Showdown routes
app.route('/api/survey-showdown/packs', surveyPacks)
app.route('/api/survey-showdown/custom-surveys', customSurveys)
app.route('/api/survey-showdown/judge', judge)
app.route('/api/survey-showdown/history', history)

const port = Number(process.env.PORT) || 3001
const server = createAdaptorServer({ fetch: app.fetch })

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code !== 'EADDRINUSE') throw err
  console.error(
    `Port ${port} is already in use. Stop the other process or set PORT to a free port (for example PORT=3002).`,
  )
  console.error(`Windows: netstat -ano | findstr :${port}`)
  process.exit(1)
})

server.listen(port, () => {
  const addr = server.address()
  const boundPort =
    typeof addr === 'object' && addr !== null ? (addr as AddressInfo).port : port
  console.log(`Server listening on http://localhost:${boundPort}`)
})