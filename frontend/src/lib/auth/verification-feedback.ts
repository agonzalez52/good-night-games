import {
  AuthApiError,
  EMAIL_FAILURE_CATEGORIES,
  type EmailFailureCategory,
} from '@/lib/api/auth'

export const VERIFY_DELIVERY_STATE = {
  SENT: 'sent',
  TARGETED_FAILURE: 'targeted-failure',
  CATCH_ALL_FAILURE: 'catch-all-failure',
} as const

export type VerifyDeliveryState =
  (typeof VERIFY_DELIVERY_STATE)[keyof typeof VERIFY_DELIVERY_STATE]

interface VerificationFailureFeedback {
  category?: EmailFailureCategory
  state: VerifyDeliveryState
  message: string
}

const FALLBACK_FAILURE_MESSAGE =
  'Could not send verification right now. Try resend or continue and verify later.'

export const getVerificationFailureFeedback = (error: unknown): VerificationFailureFeedback => {
  if (!(error instanceof AuthApiError) || !error.errorCategory) {
    return {
      state: VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE,
      message: FALLBACK_FAILURE_MESSAGE,
    }
  }

  if (error.errorCategory === EMAIL_FAILURE_CATEGORIES.DISPOSABLE_DOMAIN) {
    return {
      category: error.errorCategory,
      state: VERIFY_DELIVERY_STATE.TARGETED_FAILURE,
      message: 'This email provider is not supported for verification rewards. Use a different email provider.',
    }
  }

  if (
    error.errorCategory === EMAIL_FAILURE_CATEGORIES.RATE_LIMITED ||
    error.errorCategory === EMAIL_FAILURE_CATEGORIES.PROVIDER_TEMPORARY
  ) {
    return {
      category: error.errorCategory,
      state: VERIFY_DELIVERY_STATE.TARGETED_FAILURE,
      message: 'Verification email is temporarily unavailable. Try resend in a minute.',
    }
  }

  return {
    category: error.errorCategory,
    state: VERIFY_DELIVERY_STATE.CATCH_ALL_FAILURE,
    message: FALLBACK_FAILURE_MESSAGE,
  }
}
