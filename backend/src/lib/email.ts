import { Resend } from 'resend'

const getRequiredEmailEnv = (name: 'RESEND_API_KEY' | 'EMAIL_FROM'): string => {
  const value = process.env[name]
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing ${name}: set this environment variable before sending transactional emails.`,
    )
  }
  return value
}

const getOptionalEmailEnv = (name: 'EMAIL_REPLY_TO'): string | undefined => {
  const value = process.env[name]
  if (value === undefined) return undefined

  const trimmedValue = value.trim()
  return trimmedValue === '' ? undefined : trimmedValue
}

const resend = new Resend(getRequiredEmailEnv('RESEND_API_KEY'))
const emailFrom = getRequiredEmailEnv('EMAIL_FROM')
const defaultReplyTo = getOptionalEmailEnv('EMAIL_REPLY_TO')

export interface SendEmailTemplateVariables {
  [key: string]: string | number
}

export interface SendEmailTemplateInput {
  to: string | string[]
  templateId: string
  variables?: SendEmailTemplateVariables
  replyTo?: string | string[]
}

export interface SendEmailContentInput {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string | string[]
}

export type SendEmailInput =
  | SendEmailContentInput
  | SendEmailTemplateInput

export interface SendEmailResult {
  id: string
}

export interface EmailService {
  send: (input: SendEmailInput) => Promise<SendEmailResult>
}

const resendEmailService: EmailService = {
  send: async (input) => {
    const messagePayload =
      'templateId' in input
        ? {
            from: emailFrom,
            to: input.to,
            replyTo: input.replyTo ?? defaultReplyTo,
            template: {
              id: input.templateId,
              variables: input.variables,
            },
          }
        : {
            from: emailFrom,
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            replyTo: input.replyTo ?? defaultReplyTo,
          }

    const { data, error } = await resend.emails.send({
      ...messagePayload,
    })

    if (error !== null) {
      throw new Error(`Resend email send failed: ${error.message}`)
    }

    if (data === null || typeof data.id !== 'string' || data.id.trim() === '') {
      throw new Error('Resend email send failed: missing message id in response.')
    }

    return { id: data.id }
  },
}

export const sendEmail = (input: SendEmailInput): Promise<SendEmailResult> =>
  resendEmailService.send(input)
