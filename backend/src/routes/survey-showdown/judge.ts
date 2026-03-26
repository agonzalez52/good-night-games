import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rateLimit'
import { prisma } from '../../lib/prisma'
import { anthropic } from '../../lib/anthropic'
import { judgeSchema } from '../../schemas/zod'

const GAME_ID = 'survey_showdown'

const judge = new Hono<{ Variables: AuthVariables }>()

judge.post(
  '/',
  requireAuth,
  rateLimit(60, 60 * 1000), // 60 requests per minute
  async (c) => {
    try {
      const body = await c.req.json()
      const parsed = judgeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

      const { input, surveyId, answers } = parsed.data
      const normalizedInput = input.toLowerCase().trim()

      // Check cache first
      const cached = await prisma.judge_cache.findUnique({
        where: {
          game_id_input_text_survey_id: {
            game_id: GAME_ID,
            input_text: normalizedInput,
            survey_id: surveyId,
          },
        },
      })

      if (cached) {
        return c.json({
          isMatch: cached.is_match,
          matchedAnswer: cached.matched_answer ?? null,
        })
      }

      // Cache miss — call Haiku
      const candidateList = answers
        .map((a, i) => `${i}: "${a.text}"`)
        .join('\n')

      const prompt = `You are judging a Survey Showdown game. The player answered: "${input}"

The survey answers on the board are:
${candidateList}

Does the player's answer match any of the survey answers in meaning? Consider synonyms, common phrases, and reasonable equivalents.

Reply with ONLY the number of the matching answer index, or "none" if there is no match. No explanation.`

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      })

      const reply = (message.content[0].type === 'text' ? message.content[0].text : '')
        .trim()
        .toLowerCase()

      const isMatch = reply !== 'none' && reply !== '' && !isNaN(parseInt(reply))
      const matchedIndex = isMatch ? parseInt(reply) : null
      const matchedAnswer = matchedIndex !== null ? (answers[matchedIndex]?.text ?? null) : null

      // Store in cache
      await prisma.judge_cache.create({
        data: {
          game_id: GAME_ID,
          input_text: normalizedInput,
          survey_id: surveyId,
          matched_answer: matchedAnswer,
          is_match: isMatch,
        },
      })

      return c.json({ isMatch, matchedAnswer })
    } catch (error) {
      console.error('POST /api/survey-showdown/judge error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export default judge