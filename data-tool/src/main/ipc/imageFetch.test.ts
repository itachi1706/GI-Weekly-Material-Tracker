import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: class {}, session: { fromPartition: vi.fn() } }))

import { chromeUserAgent, looksLikeCloudflareChallenge } from './imageFetch'

describe('chromeUserAgent', () => {
  it('never embeds "Electron" (several bot-checks block that token outright)', () => {
    expect(chromeUserAgent()).not.toMatch(/Electron/i)
  })
  it('looks like a desktop Chrome UA', () => {
    expect(chromeUserAgent()).toMatch(/^Mozilla\/5\.0 .* Chrome\/[\d.]+ Safari\/537\.36$/)
  })
})

describe('looksLikeCloudflareChallenge', () => {
  it('is true when the response carries the cf-mitigated: challenge header', () => {
    const res = new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } })
    expect(looksLikeCloudflareChallenge(res)).toBe(true)
  })
  it('is false for an ordinary 403 (e.g. a genuinely missing image)', () => {
    const res = new Response(null, { status: 403 })
    expect(looksLikeCloudflareChallenge(res)).toBe(false)
  })
})
