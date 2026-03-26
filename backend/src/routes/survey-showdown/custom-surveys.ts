import { Hono } from 'hono'
import { requireAuth, AuthVariables } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { createSurveySchema, createCollectionSchema } from '../../schemas/zod'

const MAX_CUSTOM_SURVEYS = 40

const customSurveys = new Hono<{ Variables: AuthVariables }>()

// All survey routes require auth
customSurveys.use('/*', requireAuth)

// GET /api/survey-showdown/custom-surveys
// Returns the user's surveys and collections
customSurveys.get('/', async (c) => {
  const userId = c.get('userId')
  try {
    const [userSurveys, userCollections] = await Promise.all([
      prisma.custom_surveys.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      }),
      prisma.custom_survey_collections.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      }),
    ])
    return c.json({ surveys: userSurveys, collections: userCollections })
  } catch (error) {
    console.error('GET /api/survey-showdown/custom-surveys error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/survey-showdown/custom-surveys
// Creates a new custom survey — enforces 40-survey limit
customSurveys.post('/', async (c) => {
  const userId = c.get('userId')
  try {
    const body = await c.req.json()
    const parsed = createSurveySchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

    const count = await prisma.custom_surveys.count({ where: { user_id: userId } })
    if (count >= MAX_CUSTOM_SURVEYS) {
      return c.json({ error: `Survey limit of ${MAX_CUSTOM_SURVEYS} reached` }, 403)
    }

    const survey = await prisma.custom_surveys.create({
      data: {
        user_id: userId,
        name: parsed.data.name,
        collection_id: parsed.data.collectionId ?? null,
        questions: parsed.data.questions,
      },
    })
    return c.json(survey, 201)
  } catch (error) {
    console.error('POST /api/survey-showdown/custom-surveys error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/survey-showdown/custom-surveys/:id
// Updates a survey — owner only
customSurveys.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  try {
    const existing = await prisma.custom_surveys.findUnique({ where: { id } })
    if (!existing || existing.user_id !== userId) {
      return c.json({ error: 'Not found' }, 404)
    }

    const body = await c.req.json()
    const parsed = createSurveySchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const updated = await prisma.custom_surveys.update({
      where: { id },
      data: {
        name: parsed.data.name,
        collection_id: parsed.data.collectionId ?? null,
        questions: parsed.data.questions,
      },
    })
    return c.json(updated)
  } catch (error) {
    console.error('PUT /api/survey-showdown/custom-surveys/:id error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/survey-showdown/custom-surveys/:id
// Deletes a survey — owner only
customSurveys.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  try {
    const existing = await prisma.custom_surveys.findUnique({ where: { id } })
    if (!existing || existing.user_id !== userId) {
      return c.json({ error: 'Not found' }, 404)
    }
    await prisma.custom_surveys.delete({ where: { id } })
    return c.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/survey-showdown/custom-surveys/:id error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// POST /api/survey-showdown/custom-surveys/collections
customSurveys.post('/collections', async (c) => {
  const userId = c.get('userId')
  try {
    const body = await c.req.json()
    const parsed = createCollectionSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const collection = await prisma.custom_survey_collections.create({
      data: { user_id: userId, name: parsed.data.name },
    })
    return c.json(collection, 201)
  } catch (error) {
    console.error('POST /api/survey-showdown/custom-surveys/collections error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/survey-showdown/custom-surveys/collections/:id
customSurveys.put('/collections/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  try {
    const existing = await prisma.custom_survey_collections.findUnique({ where: { id } })
    if (!existing || existing.user_id !== userId) {
      return c.json({ error: 'Not found' }, 404)
    }

    const body = await c.req.json()
    const parsed = createCollectionSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'Invalid request' }, 400)

    const updated = await prisma.custom_survey_collections.update({
      where: { id },
      data: { name: parsed.data.name },
    })
    return c.json(updated)
  } catch (error) {
    console.error('PUT /api/survey-showdown/custom-surveys/collections/:id error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/survey-showdown/custom-surveys/collections/:id
// Deletes the collection only — surveys are reassigned to null (uncategorized)
customSurveys.delete('/collections/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  try {
    const existing = await prisma.custom_survey_collections.findUnique({ where: { id } })
    if (!existing || existing.user_id !== userId) {
      return c.json({ error: 'Not found' }, 404)
    }

    // Reassign surveys to uncategorized before deleting the collection
    await prisma.custom_surveys.updateMany({
      where: { user_id: userId, collection_id: id },
      data: { collection_id: null },
    })

    await prisma.custom_survey_collections.delete({ where: { id } })
    return c.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/survey-showdown/custom-surveys/collections/:id error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default customSurveys