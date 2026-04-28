const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export interface SendSignupVerificationResponse {
  success: true
  sent: boolean
  alreadyVerified: boolean
  alreadyCredited: boolean
  expiresAt?: string
  balance?: number
}

export interface ConfirmSignupVerificationResponse {
  success: true
  verified: boolean
  alreadyCredited: boolean
  email_verified: boolean
  balance: number
}

export async function sendSignupVerification(token: string): Promise<SendSignupVerificationResponse> {
  const res = await fetch(`${BACKEND_URL}/api/auth/send-signup-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string }
    throw new Error(typeof err.error === 'string' ? err.error : 'Failed to send verification email')
  }

  const body = data as {
    success?: unknown
    sent?: unknown
    alreadyVerified?: unknown
    alreadyCredited?: unknown
    expiresAt?: unknown
    balance?: unknown
  }

  if (
    body.success === true &&
    typeof body.sent === 'boolean' &&
    typeof body.alreadyVerified === 'boolean' &&
    typeof body.alreadyCredited === 'boolean'
  ) {
    return {
      success: true,
      sent: body.sent,
      alreadyVerified: body.alreadyVerified,
      alreadyCredited: body.alreadyCredited,
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : undefined,
      balance: typeof body.balance === 'number' ? body.balance : undefined,
    }
  }

  throw new Error('Failed to send verification email')
}

export async function confirmSignupVerification(
  token: string,
  challenge: string,
): Promise<ConfirmSignupVerificationResponse> {
  const res = await fetch(`${BACKEND_URL}/api/auth/confirm-signup-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ challenge }),
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string }
    throw new Error(typeof err.error === 'string' ? err.error : 'Failed to verify email')
  }

  const body = data as {
    success?: unknown
    verified?: unknown
    alreadyCredited?: unknown
    email_verified?: unknown
    balance?: unknown
  }

  if (
    body.success === true &&
    body.verified === true &&
    typeof body.alreadyCredited === 'boolean' &&
    typeof body.email_verified === 'boolean' &&
    typeof body.balance === 'number'
  ) {
    return {
      success: true,
      verified: true,
      alreadyCredited: body.alreadyCredited,
      email_verified: body.email_verified,
      balance: body.balance,
    }
  }

  throw new Error('Failed to verify email')
}
