// Phase 9: implement custom surveys CRUD helpers

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

const h = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

export async function getCustomSurveys(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys`, { headers: h(token) })
  if (!res.ok) throw new Error('Failed to fetch custom surveys')
  return res.json()
}

export async function createCustomSurvey(token: string, body: object) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys`, { method: 'POST', headers: h(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error('Failed to create survey')
  return res.json()
}

export async function updateCustomSurvey(token: string, id: string, body: object) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/${id}`, { method: 'PUT', headers: h(token), body: JSON.stringify(body) })
  if (!res.ok) throw new Error('Failed to update survey')
  return res.json()
}

export async function deleteCustomSurvey(token: string, id: string) {
  const res = await fetch(`${BACKEND_URL}/api/survey-showdown/custom-surveys/${id}`, { method: 'DELETE', headers: h(token) })
  if (!res.ok) throw new Error('Failed to delete survey')
}
