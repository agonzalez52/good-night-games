const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export interface ReferralDataResponse {
  referralCode: string
  claimed: number
  pending: number
  max: number
}

export interface ClaimReferralResponse {
  success: true
  referralClaimed: boolean
  balance: number
}

// GET /api/referrals — returns { referralCode, claimed, pending, max }
export async function getReferralData(token: string): Promise<ReferralDataResponse> {
  const res = await fetch(`${BACKEND_URL}/api/referrals`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch referral data')
  return res.json() as Promise<ReferralDataResponse>
}

// POST /api/referrals/claim — 200 for all non-error outcomes (nothing to claim vs claimed).
export async function claimReferral(token: string): Promise<ClaimReferralResponse> {
  const res = await fetch(`${BACKEND_URL}/api/referrals/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string }
    throw new Error(typeof err.error === 'string' ? err.error : 'Failed to claim referral')
  }
  const body = data as { success?: unknown; referralClaimed?: unknown; balance?: unknown }
  if (
    body.success === true &&
    typeof body.referralClaimed === 'boolean' &&
    typeof body.balance === 'number'
  ) {
    return { success: true, referralClaimed: body.referralClaimed, balance: body.balance }
  }
  throw new Error('Failed to claim referral')
}
