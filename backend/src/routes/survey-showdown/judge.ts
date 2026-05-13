import { Hono } from 'hono'
import { performance } from 'node:perf_hooks'
import { optionalAuth, OptionalAuthVariables } from '../../middleware/auth'
import { rateLimit } from '../../middleware/rateLimit'
import { judgeSchema } from '../../schemas/zod'
import { JUDGE_RESPONSE_STATUS } from './judge-contract'
import { enqueueJudgeBackgroundJob, type JudgeBackgroundJobMeta } from './judge-background'
import {
  callJudgeModel,
  exactMatchPhase,
  findPositiveCacheMatch,
  GAME_ID_SURVEY_SHOWDOWN,
  isNegativeCacheSaturated,
  persistNegativeJudgeCache,
  persistPositiveJudgeCache,
  resolveModelMatchToIndex,
  normalizeJudgeInput,
  type JudgeAnswerRow,
} from './judge-pipeline'

const judge = new Hono<{ Variables: OptionalAuthVariables }>()

judge.post(
  '/',
  optionalAuth,
  rateLimit(60, 60 * 1000), // 60 requests per minute
  async c => {
    const phaseMs = {
      exact: 0,
      cache: 0,
      ai: 0,
    }

    try {
      const body = await c.req.json()
      const parsed = judgeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

      const cacheUserId = c.get('userId') ?? null
      const isGuest = cacheUserId === null

      const { input, questionText, answerIds, answers, revealedIndices } = parsed.data
      if (answerIds.length !== answers.length) {
        return c.json({ error: 'answerIds must align with answers' }, 400)
      }

      const normalizedInput = normalizeJudgeInput(input)
      const revealed = new Set(revealedIndices)
      const hiddenAnswerIds = answerIds.filter((_, i) => !revealed.has(i))
      const hiddenAnswerIdsUnique = [...new Set(hiddenAnswerIds)]

      const candidates = answers
        .map((a, i) => ({ i, text: a.answer }))
        .filter(({ i }) => !revealed.has(i))

      const finalMissBody = {
        status: JUDGE_RESPONSE_STATUS.FINAL_MISS,
        isMatch: false as const,
        matchedAnswer: null,
        matchedIndex: null,
      }

      if (candidates.length === 0) {
        return c.json(finalMissBody)
      }

      const hiddenForExact = candidates.map(({ i, text }) => ({ index: i, answer: text }))
      const tExact = performance.now()
      const exactHit = exactMatchPhase(normalizedInput, hiddenForExact)
      phaseMs.exact = performance.now() - tExact

      if (exactHit) {
        return c.json({
          status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
          isMatch: true as const,
          matchedIndex: exactHit.matchedIndex,
          matchedAnswer: exactHit.matchedAnswer,
        })
      }

      const tCache = performance.now()
      const cachePositive = await findPositiveCacheMatch({
        gameId: GAME_ID_SURVEY_SHOWDOWN,
        cacheUserId,
        normalizedInput,
        hiddenAnswerIds,
        answers: answers as JudgeAnswerRow[],
        answerIds,
        revealed,
      })

      const negativeSaturated = await isNegativeCacheSaturated({
        gameId: GAME_ID_SURVEY_SHOWDOWN,
        cacheUserId,
        normalizedInput,
        hiddenAnswerIdsUnique,
      })
      phaseMs.cache = performance.now() - tCache

      if (cachePositive) {
        const matchedAnswer =
          cachePositive.matchedAnswer ?? answers[cachePositive.matchedIndex]!.answer
        return c.json({
          status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
          isMatch: true as const,
          matchedIndex: cachePositive.matchedIndex,
          matchedAnswer,
        })
      }

      if (negativeSaturated) {
        return c.json(finalMissBody)
      }

      const candidateList = candidates.map(({ i, text }) => `${i}: "${text}"`).join('\n')
      const candidateIndexSet = new Set(candidates.map(({ i }) => i))

      const backgroundMeta: JudgeBackgroundJobMeta = {
        gameId: GAME_ID_SURVEY_SHOWDOWN,
        userId: cacheUserId,
        normalizedInput,
        hiddenAnswerIds: hiddenAnswerIdsUnique,
      }

      if (isGuest) {
        enqueueJudgeBackgroundJob({
          kind: 'guest_ai',
          meta: backgroundMeta,
          execute: async () => {
            const tAi = performance.now()
            let modelResponse = null
            try {
              modelResponse = await callJudgeModel({
                questionText,
                input,
                candidateList,
              })
            } catch (err) {
              console.error('Judge guest AI phase error:', err)
              return
            }
            const aiMs = performance.now() - tAi

            const matchedIndex = resolveModelMatchToIndex({
              modelResponse,
              answersLength: answers.length,
              revealed,
              candidateIndices: candidateIndexSet,
            })

            if (matchedIndex === null) {
              console.error(
                JSON.stringify({
                  route: 'survey-showdown/judge',
                  scope: 'guest',
                  phasesMs: { ai: Number(aiMs.toFixed(2)) },
                  outcome: 'background_miss',
                })
              )
              return
            }

            const tPersist = performance.now()
            await persistPositiveJudgeCache({
              gameId: GAME_ID_SURVEY_SHOWDOWN,
              cacheUserId,
              normalizedInput,
              surveyAnswerId: answerIds[matchedIndex]!,
              matchedAnswer: answers[matchedIndex]!.answer,
            })
            const persistMs = performance.now() - tPersist

            console.error(
              JSON.stringify({
                route: 'survey-showdown/judge',
                scope: 'guest',
                phasesMs: {
                  ai: Number(aiMs.toFixed(2)),
                  persist: Number(persistMs.toFixed(2)),
                },
                outcome: 'background_positive_persist',
              })
            )
          },
        })

        console.error(
          JSON.stringify({
            route: 'survey-showdown/judge',
            scope: 'guest',
            phasesMs: { exact: phaseMs.exact, cache: phaseMs.cache },
            outcome: 'pending_ai',
          })
        )

        return c.json({
          status: JUDGE_RESPONSE_STATUS.PENDING_AI,
          isMatch: false as const,
          matchedAnswer: null,
          matchedIndex: null,
        })
      }

      const tAi = performance.now()
      let modelResponse = null
      try {
        modelResponse = await callJudgeModel({
          questionText,
          input,
          candidateList,
        })
      } catch (err) {
        console.error('Judge authed AI phase error:', err)
        phaseMs.ai = performance.now() - tAi
        console.error(
          JSON.stringify({
            route: 'survey-showdown/judge',
            scope: 'authed',
            phasesMs: { ...phaseMs, ai: phaseMs.ai },
            outcome: 'ai_failure_final_miss',
          })
        )
        return c.json(finalMissBody)
      }
      phaseMs.ai = performance.now() - tAi

      const matchedIndex = resolveModelMatchToIndex({
        modelResponse,
        answersLength: answers.length,
        revealed,
        candidateIndices: candidateIndexSet,
      })

      const isMatch = matchedIndex !== null
      const matchedAnswer = matchedIndex !== null ? answers[matchedIndex]!.answer : null

      enqueueJudgeBackgroundJob({
        kind: 'authed_cache_persist',
        meta: backgroundMeta,
        execute: async () => {
          const tPersist = performance.now()
          if (isMatch && matchedIndex !== null) {
            await persistPositiveJudgeCache({
              gameId: GAME_ID_SURVEY_SHOWDOWN,
              cacheUserId,
              normalizedInput,
              surveyAnswerId: answerIds[matchedIndex]!,
              matchedAnswer,
            })
          } else if (hiddenAnswerIdsUnique.length > 0) {
            await persistNegativeJudgeCache({
              gameId: GAME_ID_SURVEY_SHOWDOWN,
              cacheUserId,
              normalizedInput,
              hiddenAnswerIdsUnique,
            })
          }
          const persistMs = performance.now() - tPersist
          console.error(
            JSON.stringify({
              route: 'survey-showdown/judge',
              scope: 'authed',
              phasesMs: { persist: Number(persistMs.toFixed(2)) },
              outcome: 'background_persist',
            })
          )
        },
      })

      console.error(
        JSON.stringify({
          route: 'survey-showdown/judge',
          scope: 'authed',
          phasesMs: {
            exact: Number(phaseMs.exact.toFixed(2)),
            cache: Number(phaseMs.cache.toFixed(2)),
            ai: Number(phaseMs.ai.toFixed(2)),
          },
          outcome: isMatch ? 'final_match' : 'final_miss',
        })
      )

      if (isMatch && matchedIndex !== null && matchedAnswer !== null) {
        return c.json({
          status: JUDGE_RESPONSE_STATUS.FINAL_MATCH,
          isMatch: true as const,
          matchedIndex,
          matchedAnswer,
        })
      }

      return c.json(finalMissBody)
    } catch (error) {
      console.error('POST /api/survey-showdown/judge error:', error)
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
)

export default judge
