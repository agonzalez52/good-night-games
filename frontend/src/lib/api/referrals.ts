// Phase 9: implement referral API helpers

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// GET /api/referrals — returns { referralCode, claimed, pending, max: 3 }
export async function getReferralData(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/referrals`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch referral data')
  return res.json()
}

// POST /api/referrals/claim — awards tokens to referrer
export async function claimReferral(token: string) {
  const res = await fetch(`${BACKEND_URL}/api/referrals/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to claim referral')
  return res.json()
}
