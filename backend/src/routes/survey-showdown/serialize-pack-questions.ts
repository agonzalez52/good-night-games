/**
 * Maps relational su_survey_questions / su_survey_answers rows to the public API
 * `questions` payload: { id, question, answers: [{ id, answer, points }] }.
 */

export type PackQuestionAnswerRow = {
  id: string
  answer: string
  points: number
  display_order: number
}

export type PackQuestionRow = {
  id: string
  question: string
  display_order: number
  answers: PackQuestionAnswerRow[]
}

export type SerializedPackQuestion = {
  id: string
  question: string
  answers: { id: string; answer: string; points: number }[]
}

export function serializePackQuestions(questions: readonly PackQuestionRow[]): SerializedPackQuestion[] {
  return [...questions]
    .sort((a, b) => a.display_order - b.display_order)
    .map((q) => ({
      id: q.id,
      question: q.question,
      answers: [...q.answers]
        .sort((a, b) => a.display_order - b.display_order)
        .map((a) => ({ id: a.id, answer: a.answer, points: a.points })),
    }))
}
