import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rateLimit'
import { prisma } from '../../lib/prisma'
import { anthropic } from '../../lib/anthropic'
import { judgeSchema } from '../../schemas/zod'

const GAME_ID = 'survey_showdown'

const judge = new Hono<{ Variables: AuthVariables }>()

function resolveCachedIndex(
  answers: { answer: string; points: number }[],
  answerIds: string[],
  revealed: Set<number>,
  cached: { matched_answer: string | null; is_match: boolean; survey_answer_id: string }
): number | null {
  if (!cached.is_match) return null
  for (let i = 0; i < answers.length; i++) {
    if (revealed.has(i)) continue
    if (answerIds[i] === cached.survey_answer_id) return i
  }
  const matchedAnswer = cached.matched_answer
  if (!matchedAnswer) return null
  for (let i = 0; i < answers.length; i++) {
    if (revealed.has(i)) continue
    if (answers[i].answer === matchedAnswer) return i
  }
  return null
}

judge.post(
  '/',
  requireAuth,
  rateLimit(60, 60 * 1000), // 60 requests per minute
  async (c) => {
    try {
      const body = await c.req.json()
      const parsed = judgeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

      const { input, answerIds, answers, revealedIndices } = parsed.data
      if (answerIds.length !== answers.length) {
        return c.json({ error: 'answerIds must align with answers' }, 400)
      }
      const normalizedInput = input.toLowerCase().trim()
      const revealed = new Set(revealedIndices)
      const hiddenAnswerIds = answerIds.filter((_, i) => !revealed.has(i))
      const hiddenAnswerIdsUnique = [...new Set(hiddenAnswerIds)]

      const candidates = answers
        .map((a, i) => ({ i, text: a.answer }))
        .filter(({ i }) => !revealed.has(i))

      if (candidates.length === 0) {
        return c.json({ isMatch: false, matchedAnswer: null, matchedIndex: null })
      }

      if (hiddenAnswerIds.length > 0) {
        const cachedRows = await prisma.judge_cache.findMany({
          where: {
            game_id: GAME_ID,
            input_text: normalizedInput,
            survey_answer_id: { in: hiddenAnswerIds },
            is_match: true,
          },
        })
        for (const cached of cachedRows) {
          const matchedIndex = resolveCachedIndex(answers, answerIds, revealed, cached)
          if (matchedIndex !== null) {
            return c.json({
              isMatch: true,
              matchedAnswer: cached.matched_answer ?? null,
              matchedIndex,
            })
          }
        }
      }

      if (hiddenAnswerIdsUnique.length > 0) {
        const negativeCached = await prisma.judge_cache.count({
          where: {
            game_id: GAME_ID,
            input_text: normalizedInput,
            survey_answer_id: { in: hiddenAnswerIdsUnique },
            is_match: false,
          },
        })
        if (negativeCached === hiddenAnswerIdsUnique.length) {
          return c.json({ isMatch: false, matchedAnswer: null, matchedIndex: null })
        }
      }

      const candidateList = candidates.map(({ i, text }) => `${i}: "${text}"`).join('\n')

      const prompt = `You are judging a Survey Showdown game. The player answered: "${input}"

The survey answers still hidden on the board are (index: text):
${candidateList}

Does the player's answer match any of these in meaning? Consider synonyms, common phrases, and reasonable equivalents.

Reply with ONLY the number of the matching answer index from the list above, or "none" if there is no match. No explanation.`

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      })

      const reply = (message.content[0].type === 'text' ? message.content[0].text : '')
        .trim()
        .toLowerCase()

      let matchedIndex: number | null = null
      if (reply !== 'none' && reply !== '') {
        const parsedIdx = parseInt(reply, 10)
        if (
          !Number.isNaN(parsedIdx) &&
          Number.isInteger(parsedIdx) &&
          parsedIdx >= 0 &&
          parsedIdx < answers.length &&
          !revealed.has(parsedIdx) &&
          candidates.some(c => c.i === parsedIdx)
        ) {
          matchedIndex = parsedIdx
        }
      }

      const isMatch = matchedIndex !== null
      const matchedAnswer = matchedIndex !== null ? answers[matchedIndex].answer : null
      if (isMatch && matchedIndex !== null) {
        const surveyAnswerId = answerIds[matchedIndex]!
        await prisma.judge_cache.upsert({
          where: {
            game_id_input_text_survey_answer_id: {
              game_id: GAME_ID,
              input_text: normalizedInput,
              survey_answer_id: surveyAnswerId,
            },
          },
          create: {
            game_id: GAME_ID,
            input_text: normalizedInput,
            survey_answer_id: surveyAnswerId,
            matched_answer: matchedAnswer,
            is_match: true,
          },
          update: {
            matched_answer: matchedAnswer,
            is_match: true,
          },
        })
      } else if (hiddenAnswerIdsUnique.length > 0) {
        await prisma.judge_cache.createMany({
          data: hiddenAnswerIdsUnique.map((survey_answer_id) => ({
            game_id: GAME_ID,
            input_text: normalizedInput,
            survey_answer_id,
            matched_answer: null,
            is_match: false,
          })),
          skipDuplicates: true,
        })
      }

      return c.json({ isMatch, matchedAnswer, matchedIndex })
    } catch (error) {
      console.error('POST /api/survey-showdown/judge error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export default judge
