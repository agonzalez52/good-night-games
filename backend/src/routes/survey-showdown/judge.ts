import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { optionalAuth, OptionalAuthVariables } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rateLimit'
import { prisma } from '../../lib/prisma'
import { anthropic } from '../../lib/anthropic'
import { judgeSchema } from '../../schemas/zod'

const GAME_ID = 'survey_showdown'
const JUDGE_MAX_TOKENS = 96
const MIN_MATCH_CONFIDENCE = 0.75

const judge = new Hono<{ Variables: OptionalAuthVariables }>()

interface JudgeModelResponse {
  match: boolean
  index: number | null
  confidence: number
  matchType: string
}

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

function parseJudgeModelResponse(rawText: string): JudgeModelResponse | null {
  const tryParse = (text: string): JudgeModelResponse | null => {
    try {
      const parsed = JSON.parse(text) as Partial<JudgeModelResponse>
      if (typeof parsed.match !== 'boolean') return null
      if (typeof parsed.confidence !== 'number' || !Number.isFinite(parsed.confidence)) return null
      if (parsed.confidence < 0 || parsed.confidence > 1) return null
      if (typeof parsed.matchType !== 'string' || parsed.matchType.trim() === '') return null
      if (
        parsed.index !== null &&
        parsed.index !== undefined &&
        (!Number.isInteger(parsed.index) || parsed.index < 0)
      ) {
        return null
      }
      return {
        match: parsed.match,
        index: parsed.index ?? null,
        confidence: parsed.confidence,
        matchType: parsed.matchType,
      }
    } catch {
      return null
    }
  }

  const directParse = tryParse(rawText)
  if (directParse) return directParse

  const objectMatch = rawText.match(/\{[\s\S]*\}/)
  if (!objectMatch) return null
  return tryParse(objectMatch[0])
}

judge.post(
  '/',
  optionalAuth,
  rateLimit(60, 60 * 1000), // 60 requests per minute
  async (c) => {
    try {
      const body = await c.req.json()
      const parsed = judgeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

      const cacheUserId = c.get('userId') ?? null

      const { input, questionText, answerIds, answers, revealedIndices } = parsed.data
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
            user_id: cacheUserId,
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
            user_id: cacheUserId,
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

      const prompt = `You are judging a survey game show where contestants try to match the most popular answers to questions. Judge strictly: only count answers that match the same core meaning as a board answer for the given question.

The survey question is: "${questionText}"
The player answered: "${input}"

The survey answers still hidden on the board are (index: text):
${candidateList}

Allowed matches:
- Close semantic equivalents where the player's meaning is clearly the same as one hidden answer to THIS question.
- Common synonyms and brief paraphrases that preserve the same central idea.
- Minor grammatical variation (plural/singular, tense) when intent stays the same.

Disallowed matches:
- Broad topical overlap that changes the main idea.
- Weak associations, vibes, or "kind of related" connections.
- Guesses that could loosely fit multiple answers but do not clearly match one.

Decision rule:
- If exactly one hidden answer is clearly the same core meaning, set match=true and return that index.
- If no hidden answer is clearly the same core meaning, set match=false and index=null.

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{"match": boolean, "index": number | null, "confidence": number, "matchType": string}

Notes:
- confidence must be between 0 and 1.
- matchType should be one of: "exact", "synonym", "paraphrase", "none".
- When match=false, always set index to null and matchType to "none".`

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: JUDGE_MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      })

      const replyText = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim()
      const modelResponse = parseJudgeModelResponse(replyText)

      let matchedIndex: number | null = null
      if (
        modelResponse?.match === true &&
        modelResponse.confidence >= MIN_MATCH_CONFIDENCE &&
        modelResponse.index !== null
      ) {
        const parsedIdx = modelResponse.index
        if (
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
            // Prisma types omit null for optional compound keys; DB + NULLS NOT DISTINCT allow guest rows.
            game_id_user_id_input_text_survey_answer_id: {
              game_id: GAME_ID,
              user_id: cacheUserId,
              input_text: normalizedInput,
              survey_answer_id: surveyAnswerId,
            } as unknown as Prisma.judge_cacheGame_idUser_idInput_textSurvey_answer_idCompoundUniqueInput,
          },
          create: {
            game_id: GAME_ID,
            user_id: cacheUserId,
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
            user_id: cacheUserId,
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
