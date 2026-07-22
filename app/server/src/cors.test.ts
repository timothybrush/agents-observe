import { describe, test, expect } from 'vitest'
import { isLoopbackOrigin, resolveCorsOrigin } from './cors'

describe('isLoopbackOrigin', () => {
  test('accepts localhost / 127.0.0.1 / ::1 on any port', () => {
    expect(isLoopbackOrigin('http://localhost:5174')).toBe(true)
    expect(isLoopbackOrigin('http://127.0.0.1:4981')).toBe(true)
    expect(isLoopbackOrigin('http://[::1]:4981')).toBe(true)
  })

  test('rejects non-loopback and malformed origins', () => {
    expect(isLoopbackOrigin('https://evil.com')).toBe(false)
    expect(isLoopbackOrigin('http://192.168.1.5:4981')).toBe(false)
    expect(isLoopbackOrigin('')).toBe(false)
    expect(isLoopbackOrigin('not-a-url')).toBe(false)
  })
})

describe('resolveCorsOrigin', () => {
  test('default (empty allowlist) reflects loopback origins only', () => {
    const origin = resolveCorsOrigin([])
    expect(typeof origin).toBe('function')
    const fn = origin as (o: string) => string | null
    expect(fn('http://localhost:5174')).toBe('http://localhost:5174')
    expect(fn('https://evil.com')).toBeNull()
  })

  test('wildcard allows any origin', () => {
    expect(resolveCorsOrigin(['*'])).toBe('*')
  })

  test('explicit allowlist is passed through verbatim', () => {
    expect(resolveCorsOrigin(['https://a.example', 'https://b.example'])).toEqual([
      'https://a.example',
      'https://b.example',
    ])
  })
})
