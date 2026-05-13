import { prisma } from '../../lib/prisma'
import { anthropic } from '../../lib/anthropic'

export const GAME_ID_SURVEY_SHOWDOWN = 'survey_showdown'
export const JUDGE_MAX_TOKENS = 96
export const MIN_MATCH_CONFIDENCE = 0.75

export interface JudgeAnswerRow {
  answer: string
  points: number
}

export interface JudgeModelResponse {
  match: boolean
  index: number | null
  confidence: number
  matchType: string
}

export const normalizeJudgeInput = (input: string): string => input.toLowerCase().trim()

export const exactMatchPhase = (
  normalizedInput: string,
  hiddenCandidates: { index: number; answer: string }[]
): { matchedIndex: number; matchedAnswer: string } | null => {
  for (const { index, answer } of hiddenCandidates) {
    if (normalizeJudgeInput(answer) === normalizedInput) {
      return { matchedIndex: index, matchedAnswer: answer }
    }
  }
  return null
}

export const resolveCachedIndex = (
  answers: JudgeAnswerRow[],
  answerIds: string[],
  revealed: Set<number>,
  cached: { matched_answer: string | null; is_match: boolean; survey_answer_id: string }
): number | null => {
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

export const parseJudgeModelResponse = (rawText: string): JudgeModelResponse | null => {
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

export const buildJudgePrompt = (params: {
  questionText: string
  input: string
  candidateLines: string
}): string => {
  const { questionText, input, candidateLines } = params
  return `You are judging a survey game show where contestants try to match the most popular answers to questions. Judge strictly: only count answers that match the same core meaning as a board answer for the given question.

The survey question is: "${questionText}"
The player answered: "${input}"

The survey answers still hidden on the board are (index: text):
${candidateLines}

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
}

export const resolveModelMatchToIndex = (params: {
  modelResponse: JudgeModelResponse | null
  answersLength: number
  revealed: Set<number>
  candidateIndices: Set<number>
}): number | null => {
  const { modelResponse, answersLength, revealed, candidateIndices } = params
  if (
    modelResponse?.match !== true ||
    modelResponse.confidence < MIN_MATCH_CONFIDENCE ||
    modelResponse.index === null
  ) {
    return null
  }
  const parsedIdx = modelResponse.index
  if (
    !Number.isInteger(parsedIdx) ||
    parsedIdx < 0 ||
    parsedIdx >= answersLength ||
    revealed.has(parsedIdx) ||
    !candidateIndices.has(parsedIdx)
  ) {
    return null
  }
  return parsedIdx
}

export const findPositiveCacheMatch = async (params: {
  gameId: string
  cacheUserId: string | null
  normalizedInput: string
  hiddenAnswerIds: string[]
  answers: JudgeAnswerRow[]
  answerIds: string[]
  revealed: Set<number>
}): Promise<{ matchedIndex: number; matchedAnswer: string | null } | null> => {
  const { gameId, cacheUserId, normalizedInput, hiddenAnswerIds, answers, answerIds, revealed } =
    params
  if (hiddenAnswerIds.length === 0) return null

  const cachedRows = await prisma.judge_cache.findMany({
    where: {
      game_id: gameId,
      user_id: cacheUserId,
      input_text: normalizedInput,
      survey_answer_id: { in: hiddenAnswerIds },
      is_match: true,
    },
  })

  for (const cached of cachedRows) {
    const matchedIndex = resolveCachedIndex(answers, answerIds, revealed, cached)
    if (matchedIndex !== null) {
      return { matchedIndex, matchedAnswer: cached.matched_answer ?? null }
    }
  }
  return null
}

export const isNegativeCacheSaturated = async (params: {
  gameId: string
  cacheUserId: string | null
  normalizedInput: string
  hiddenAnswerIdsUnique: string[]
}): Promise<boolean> => {
  const { gameId, cacheUserId, normalizedInput, hiddenAnswerIdsUnique } = params
  if (hiddenAnswerIdsUnique.length === 0) return false

  const negativeCached = await prisma.judge_cache.count({
    where: {
      game_id: gameId,
      user_id: cacheUserId,
      input_text: normalizedInput,
      survey_answer_id: { in: hiddenAnswerIdsUnique },
      is_match: false,
    },
  })
  return negativeCached === hiddenAnswerIdsUnique.length
}

export const callJudgeModel = async (params: {
  questionText: string
  input: string
  candidateList: string
}): Promise<JudgeModelResponse | null> => {
  const prompt = buildJudgePrompt({
    questionText: params.questionText,
    input: params.input,
    candidateLines: params.candidateList,
  })

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
  return parseJudgeModelResponse(replyText)
}

export const persistPositiveJudgeCache = async (params: {
  gameId: string
  cacheUserId: string | null
  normalizedInput: string
  surveyAnswerId: string
  matchedAnswer: string | null
}): Promise<void> => {
  const { gameId, cacheUserId, normalizedInput, surveyAnswerId, matchedAnswer } = params

  const existingByGlobalKey = await prisma.judge_cache.findFirst({
    where: {
      game_id: gameId,
      input_text: normalizedInput,
      survey_answer_id: surveyAnswerId,
    },
  })

  if (existingByGlobalKey) {
    await prisma.judge_cache.update({
      where: { id: existingByGlobalKey.id },
      data: {
        matched_answer: matchedAnswer,
        is_match: true,
      },
    })
  } else {
    await prisma.judge_cache.create({
      data: {
        game_id: gameId,
        user_id: cacheUserId,
        input_text: normalizedInput,
        survey_answer_id: surveyAnswerId,
        matched_answer: matchedAnswer,
        is_match: true,
      },
    })
  }
}

export const persistNegativeJudgeCache = async (params: {
  gameId: string
  cacheUserId: string
  normalizedInput: string
  hiddenAnswerIdsUnique: string[]
}): Promise<void> => {
  const { gameId, cacheUserId, normalizedInput, hiddenAnswerIdsUnique } = params
  if (hiddenAnswerIdsUnique.length === 0) return

  await prisma.judge_cache.createMany({
    data: hiddenAnswerIdsUnique.map(survey_answer_id => ({
      game_id: gameId,
      user_id: cacheUserId,
      input_text: normalizedInput,
      survey_answer_id,
      matched_answer: null,
      is_match: false,
    })),
    skipDuplicates: true,
  })
}
