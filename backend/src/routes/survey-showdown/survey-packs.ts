import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { serializePackQuestions } from './serialize-pack-questions'

const surveyPacks = new Hono<{ Variables: AuthVariables }>()

const packQuestionsInclude = {
  questions: {
    orderBy: { display_order: 'asc' as const },
    include: {
      answers: { orderBy: { display_order: 'asc' as const } },
    },
  },
} satisfies Prisma.su_survey_packsInclude

const getPackListInclude = (now: Date) =>
  ({
    ...packQuestionsInclude,
    tags: {
      where: {
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { created_at: 'asc' as const },
    },
  }) satisfies Prisma.su_survey_packsInclude

interface PackTagListRow {
  id: string
  label: string
  color: string | null
  expires_at: Date | null
}

const serializePackTags = (tags: PackTagListRow[]) =>
  tags.map((t) => ({
    id: t.id,
    label: t.label,
    color: t.color,
    expires_at: t.expires_at,
  }))

// GET /api/survey-showdown/packs
// Public — no auth required for free packs
// Returns { free: packs with questions[], premium: metadata + question_count }
surveyPacks.get('/', async (c) => {
  try {
    const now = new Date()
    const allPacks = await prisma.su_survey_packs.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
      include: getPackListInclude(now),
    })

    const freePacks = allPacks
      .filter((p) => p.is_free)
      .map(({ questions, tags, ...rest }) => ({
        ...rest,
        questions: serializePackQuestions(questions),
        tags: serializePackTags(tags),
      }))

    const premiumPacks = allPacks
      .filter((p) => !p.is_free)
      .map(({ questions, tags, ...rest }) => ({
        ...rest,
        question_count: questions.length,
        tags: serializePackTags(tags),
      }))

    return c.json({
      free: freePacks,
      premium: premiumPacks,
    })
  } catch (error) {
    console.error('GET /api/survey-showdown/packs error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/survey-showdown/packs/:id/questions
// Protected — only callable after tokens have been spent
surveyPacks.get('/:id/questions', requireAuth, async (c) => {
  const id = c.req.param('id')
  try {
    const pack = await prisma.su_survey_packs.findUnique({
      where: { id },
      include: packQuestionsInclude,
    })
    if (!pack || !pack.is_active) return c.json({ error: 'Pack not found' }, 404)
    return c.json({ questions: serializePackQuestions(pack.questions) })
  } catch (error) {
    console.error('GET /api/survey-showdown/packs/:id/questions error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default surveyPacks
