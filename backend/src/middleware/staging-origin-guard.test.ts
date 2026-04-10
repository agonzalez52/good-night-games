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
    vi.stubEnv('FRONTEND_URL', '')
    const s = buildAllowedOriginsSet()
    expect(s.has('https://a.com')).toBe(true)
    expect(s.has('https://b.com:444')).toBe(true)
  })

  it('merges FRONTEND_URL when ALLOWED_ORIGINS is also set', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://preview.example.com')
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000')
    const s = buildAllowedOriginsSet()
    expect(s.has('https://preview.example.com')).toBe(true)
    expect(s.has('http://localhost:3000')).toBe(true)
    expect(s.has('http://127.0.0.1:3000')).toBe(true)
  })

  it('falls back to FRONTEND_URL when ALLOWED_ORIGINS is unset', () => {
    vi.stubEnv('ALLOWED_ORIGINS', '')
    vi.stubEnv('FRONTEND_URL', 'https://app.example.com/')
    const s = buildAllowedOriginsSet()
    expect(s.has('https://app.example.com')).toBe(true)
  })

  it('adds 127.0.0.1 twin when FRONTEND_URL uses localhost', () => {
    vi.stubEnv('ALLOWED_ORIGINS', '')
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000')
    const s = buildAllowedOriginsSet()
    expect(s.has('http://localhost:3000')).toBe(true)
    expect(s.has('http://127.0.0.1:3000')).toBe(true)
  })

  it('adds localhost twin when FRONTEND_URL uses 127.0.0.1', () => {
    vi.stubEnv('ALLOWED_ORIGINS', '')
    vi.stubEnv('FRONTEND_URL', 'http://127.0.0.1:3000/')
    const s = buildAllowedOriginsSet()
    expect(s.has('http://127.0.0.1:3000')).toBe(true)
    expect(s.has('http://localhost:3000')).toBe(true)
  })
})
