import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAllowedOriginsSet, normalizeOriginString } from './staging-origin-guard'

describe('normalizeOriginString', () => {
  it('returns origin without trailing path', () => {
    expect(normalizeOriginString('https://staging.example.com/foo')).toBe('https://staging.example.com')
  })

  it('rejects prefix impersonation vs naive startsWith', () => {
    const allowed = normalizeOriginString('https://staging.example.com')
    const attacker = normalizeOriginString('https://staging.example.com.evil.net')
    expect(allowed).not.toBe(attacker)
  })

  it('normalizes localhost with port', () => {
    expect(normalizeOriginString('http://localhost:3000')).toBe('http://localhost:3000')
  })
})

describe('buildAllowedOriginsSet', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses comma-separated ALLOWED_ORIGINS', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://a.com, https://b.com:444')
    vi.stubEnv('FRONTEND_URL', 'https://ignored.when.allowed.origins.set')
    const s = buildAllowedOriginsSet()
    expect(s.has('https://a.com')).toBe(true)
    expect(s.has('https://b.com:444')).toBe(true)
  })

  it('falls back to FRONTEND_URL when ALLOWED_ORIGINS is unset', () => {
    vi.stubEnv('ALLOWED_ORIGINS', '')
    vi.stubEnv('FRONTEND_URL', 'https://app.example.com/')
    const s = buildAllowedOriginsSet()
    expect(s.has('https://app.example.com')).toBe(true)
  })
})
