const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export const EMAIL_FAILURE_CATEGORIES = {
  DISPOSABLE_DOMAIN: 'DISPOSABLE_DOMAIN',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_TEMPORARY: 'PROVIDER_TEMPORARY',
  UNKNOWN: 'UNKNOWN',
} as const

export type EmailFailureCategory =
  (typeof EMAIL_FAILURE_CATEGORIES)[keyof typeof EMAIL_FAILURE_CATEGORIES]

export interface AuthApiErrorMetadata {
  errorCode?: string
  errorCategory?: EmailFailureCategory
}

interface AuthApiErrorOptions extends AuthApiErrorMetadata {
  status: number
}

export class AuthApiError extends Error {
  readonly status: number
  readonly errorCode?: string
  readonly errorCategory?: EmailFailureCategory

  constructor(message: string, options: AuthApiErrorOptions) {
    super(message)
    this.name = 'AuthApiError'
    this.status = options.status
    this.errorCode = options.errorCode
    this.errorCategory = options.errorCategory
  }
}

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

interface ConfirmSignupVerificationResponseBody {
  success?: unknown
  verified?: unknown
  alreadyCredited?: unknown
  email_verified?: unknown
  balance?: unknown
}

interface ApiErrorResponseBody {
  error?: unknown
  errorCode?: unknown
  errorCategory?: unknown
}

const isEmailFailureCategory = (value: unknown): value is EmailFailureCategory =>
  Object.values(EMAIL_FAILURE_CATEGORIES).includes(value as EmailFailureCategory)

const parseAuthApiError = (
  data: unknown,
  fallbackErrorMessage: string,
  status: number,
): AuthApiError => {
  const body = data as ApiErrorResponseBody
  const message = typeof body.error === 'string' ? body.error : fallbackErrorMessage
  const errorCode = typeof body.errorCode === 'string' ? body.errorCode : undefined
  const errorCategory = isEmailFailureCategory(body.errorCategory) ? body.errorCategory : undefined

  return new AuthApiError(message, {
    status,
    errorCode,
    errorCategory,
  })
}

const parseConfirmSignupVerificationResponse = (
  data: unknown,
  fallbackErrorMessage: string,
): ConfirmSignupVerificationResponse => {
  const body = data as ConfirmSignupVerificationResponseBody

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

  throw new Error(fallbackErrorMessage)
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
    throw parseAuthApiError(data, 'Failed to send verification email', res.status)
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
    throw parseAuthApiError(data, 'Failed to verify email', res.status)
  }

  return parseConfirmSignupVerificationResponse(data, 'Failed to verify email')
}

export async function confirmOAuthSignup(token: string): Promise<ConfirmSignupVerificationResponse> {
  const res = await fetch(`${BACKEND_URL}/api/auth/confirm-oauth-signup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw parseAuthApiError(data, 'Failed to confirm OAuth signup', res.status)
  }

  return parseConfirmSignupVerificationResponse(data, 'Failed to confirm OAuth signup')
}
