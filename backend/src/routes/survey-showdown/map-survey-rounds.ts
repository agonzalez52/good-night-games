/**
 * Maps relational survey_questions / survey_answers rows to the public API
 * rounds payload: { question, answers: [{ id, answer, points }] } (`id` is `survey_answers.id`).
 */

type SurveyRoundAnswer = {
  readonly id: string
  readonly answer: string
  readonly points: number
}

type SurveyRound = {
  readonly question: string
  readonly answers: readonly SurveyRoundAnswer[]
}

type AnswerRow = {
  id: string
  answer: string
  points: number
  display_order: number
}

type QuestionRow = {
  question: string
  display_order: number
  answers: AnswerRow[]
}

/**
 * Converts ordered questions (each with ordered answers) into API rounds.
 */
/** Maps DB question/answer rows to the JSON `rounds` shape expected by clients. */
export function mapQuestionsToRounds(questions: readonly QuestionRow[]): SurveyRound[] {
  const sortedQuestions = [...questions].sort((a, b) => a.display_order - b.display_order)
  return sortedQuestions.map((q) => ({
    question: q.question,
    answers: [...q.answers]
      .sort((a, b) => a.display_order - b.display_order)
      .map((a) => ({ id: a.id, answer: a.answer, points: a.points })),
  }))
}
