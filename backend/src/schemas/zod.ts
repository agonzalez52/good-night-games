import { z } from 'zod'

export const spendTokensSchema = z.object({
  amount: z.number().int().positive(),
})

export const purchaseTokensSchema = z.object({
  bundleId: z.string().uuid(),
})

export const createSurveySchema = z.object({
  name: z.string().min(1).max(100),
  collectionId: z.string().uuid().nullable().optional(),
  questions: z.array(z.object({
    question: z.string().min(1),
    answers: z.array(z.object({
      text: z.string().min(1),
      points: z.number().int().min(1).max(100),
    })).min(2).max(8),
  })).min(1),
})

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
})

export const judgeSchema = z.object({
  input: z.string().min(1).max(200),
  surveyId: z.string(),
  answers: z.array(z.object({
    text: z.string(),
    points: z.number(),
  })),
})

export const feedbackSchema = z.object({
  category: z.enum(['Bug Report', 'Feature Request', 'General']),
  message: z.string().min(1).max(2000),
  game_id: z.string().optional(),
})

export const historySchema = z.object({
  game_id: z.string(),
  team1: z.string(),
  team2: z.string(),
  rounds: z.number().int().positive(),
  pack: z.string(),
  winner: z.string(),
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
})