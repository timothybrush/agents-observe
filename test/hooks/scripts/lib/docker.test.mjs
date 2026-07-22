// test/hooks/scripts/lib/docker.test.mjs
import { describe, it, expect } from 'vitest'
import { buildPortMapping } from '../../../../hooks/scripts/lib/docker.mjs'

describe('buildPortMapping (issue #22)', () => {
  it('prefixes the loopback bind host by default', () => {
    expect(buildPortMapping('127.0.0.1', 4981, 4981)).toBe('127.0.0.1:4981:4981')
  })

  it('supports auto-assign (host port 0) while keeping the loopback prefix', () => {
    expect(buildPortMapping('127.0.0.1', 0, 4981)).toBe('127.0.0.1:0:4981')
  })

  it('allows binding all interfaces for LAN access', () => {
    expect(buildPortMapping('0.0.0.0', 4981, 4981)).toBe('0.0.0.0:4981:4981')
  })

  it('omits the host prefix when bind host is empty (docker default)', () => {
    expect(buildPortMapping('', 4981, 4981)).toBe('4981:4981')
  })
})
