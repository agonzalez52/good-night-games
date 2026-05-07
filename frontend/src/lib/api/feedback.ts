const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

/** Same `game_id` as Survey Showdown API usage (e.g. judge route). */
const SURVEY_SHOWDOWN_GAME_ID = 'survey_showdown'

export type FeedbackCategory = 'Bug Report' | 'Feature Request' | 'General'

export interface PostFeedbackInput {
  category: FeedbackCategory
  message: string
}

// POST /api/feedback — Bearer required; 201 = success
export async function postFeedback(
  body: PostFeedbackInput,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      category: body.category,
      message: body.message,
      game_id: SURVEY_SHOWDOWN_GAME_ID,
    }),
  })

  if (res.status === 201) return

  const data: unknown = await res.json().catch(() => ({}))

  if (res.status === 401) {
    const err = data as { error?: string }
    const serverMsg = typeof err.error === 'string' && err.error.trim() ? err.error : null
    throw new Error(
      serverMsg ?? 'Your session has expired. Please sign in again.'
    )
  }

  const err = data as { error?: string }
  if (typeof err.error === 'string' && err.error) {
    throw new Error(err.error)
  }
  throw new Error('Failed to send feedback')
}
