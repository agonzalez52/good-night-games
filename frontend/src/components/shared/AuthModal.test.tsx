import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthModal from './AuthModal'
import { AuthApiError, EMAIL_FAILURE_CATEGORIES } from '@/lib/api/auth'

const { signUpMock, sendSignupVerificationMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  sendSignupVerificationMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: signUpMock,
    },
  }),
}))

vi.mock('@/components/shared/TokenSVG', () => ({
  default: ({ size }: { size: number }) => <span data-testid="token-svg">{size}</span>,
}))

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => {
    useEffect(() => {
      onSuccess?.('turnstile-token')
    }, [onSuccess])
    return <div data-testid="turnstile" />
  },
}))

vi.mock('@/lib/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/auth')>('@/lib/api/auth')
  return {
    ...actual,
    sendSignupVerification: sendSignupVerificationMock,
  }
})

vi.mock('@/hooks/useProductConfig', () => ({
  useProductConfig: () => ({ signupBonusTokens: 4 }),
}))

const onCloseMock = vi.fn()
const onAuthMock = vi.fn()
const onTokenCreditMock = vi.fn()

const renderModal = () =>
  render(
    <AuthModal
      initialMode="signup"
      onClose={onCloseMock}
      onAuth={onAuthMock}
      onTokenCredit={onTokenCreditMock}
    />,
  )

const submitSignup = async () => {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('you@example.com'), 'player@example.com')
  await user.type(screen.getByPlaceholderText('At least 6 characters'), 'hunter2!')
  await user.click(screen.getByRole('button', { name: 'CREATE ACCOUNT' }))
}

describe('AuthModal signup verification handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ has_google_provider: false }),
      }),
    )

    signUpMock.mockResolvedValue({
      data: {
        user: { id: 'user_1', identities: [] },
        session: { access_token: 'signup-access-token' },
      },
      error: null,
    })
  })

  it('shows inbox instructions after signup when verification email send succeeds', async () => {
    sendSignupVerificationMock.mockResolvedValue({
      success: true,
      sent: true,
      alreadyVerified: false,
      alreadyCredited: false,
    })

    renderModal()
    await submitSignup()

    await waitFor(() => {
      expect(screen.getByText('hello@goodnightgames.app')).toBeTruthy()
      expect(screen.getByText(/Click the redemption link/i)).toBeTruthy()
    })
    expect(
      screen.queryByText(/Could not send signup email right now\. Try resend or continue and verify later\./i),
    ).toBeNull()
    expect(sendSignupVerificationMock).toHaveBeenCalledWith('signup-access-token')
  })

  it('shows targeted disposable-domain guidance and avoids sent-email copy', async () => {
    sendSignupVerificationMock.mockRejectedValue(
      new AuthApiError('Could not send verification email', {
        status: 502,
        errorCode: 'SIGNUP_VERIFICATION_DISPOSABLE_DOMAIN',
        errorCategory: EMAIL_FAILURE_CATEGORIES.DISPOSABLE_DOMAIN,
      }),
    )

    renderModal()
    await submitSignup()

    await waitFor(() => {
      expect(
        screen.getByText(
          'This email provider is not supported. Use a different email provider.',
        ),
      ).toBeTruthy()
    })
    expect(screen.queryByText('hello@goodnightgames.app')).toBeNull()
  })

  it('shows catch-all guidance for unknown failures and avoids sent-email copy', async () => {
    sendSignupVerificationMock.mockRejectedValue(
      new AuthApiError('Could not send verification email', {
        status: 502,
        errorCode: 'SIGNUP_VERIFICATION_UNKNOWN',
        errorCategory: EMAIL_FAILURE_CATEGORIES.UNKNOWN,
      }),
    )

    renderModal()
    await submitSignup()

    await waitFor(() => {
      expect(
        screen.getByText(
          'Could not send signup email right now. Try resend or continue and verify later.',
        ),
      ).toBeTruthy()
    })
    expect(screen.queryByText('hello@goodnightgames.app')).toBeNull()
  })
})
