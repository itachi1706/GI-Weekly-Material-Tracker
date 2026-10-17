import { describe, it, expect, vi } from 'vitest'

// Minimal stand-ins for the Electron session + verification window. By default the window's page
// never finishes loading and never answers a probe — the stalled-page case.
const electron = vi.hoisted(() => {
  const windows: { shown: boolean; destroyed: boolean }[] = []
  class FakeWindow {
    shown = false
    destroyed = false
    webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      executeJavaScript: vi.fn(() => new Promise(() => {}))
    }
    loadURL = vi.fn(() => new Promise(() => {}))
    constructor() {
      windows.push(this)
    }
    once(_event: string, cb: () => void): void {
      cb()
    }
    show(): void {
      this.shown = true
    }
    focus(): void {}
    isDestroyed(): boolean {
      return this.destroyed
    }
    destroy(): void {
      this.destroyed = true
    }
  }
  const ses = { setUserAgent: vi.fn(), on: vi.fn(), fetch: vi.fn() }
  return { windows, FakeWindow, ses }
})
vi.mock('electron', () => ({ BrowserWindow: electron.FakeWindow, session: { fromPartition: () => electron.ses } }))

import {
  chromeUserAgent,
  looksLikeCloudflareChallenge,
  isSolvableHost,
  withOriginalFormat,
  fetchImageBuffer
} from './imageFetch'

describe('fetchImageBuffer', () => {
  it('only accepts http(s) URLs (session.fetch would otherwise read file:// paths)', async () => {
    await expect(fetchImageBuffer('file:///etc/passwd')).rejects.toThrow(/Only http\(s\)/)
    await expect(fetchImageBuffer('javascript:alert(1)')).rejects.toThrow(/Only http\(s\)/)
  })

  it('times out and destroys the verification window even if its page never finishes loading', async () => {
    vi.useFakeTimers()
    try {
      electron.ses.fetch.mockResolvedValue(
        new Response('challenge', { status: 403, headers: { 'cf-mitigated': 'challenge' } })
      )
      const result = expect(fetchImageBuffer('https://static.wikia.nocookie.net/x.png')).rejects.toThrow(/Timed out/)
      await vi.advanceTimersByTimeAsync(121_000)
      await result
      expect(electron.windows).toHaveLength(1)
      expect(electron.windows[0]).toMatchObject({ shown: true, destroyed: true })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('withOriginalFormat', () => {
  const cdn = 'https://static.wikia.nocookie.net/gensin-impact/images/6/6e/X.png/revision/latest'
  it('asks the Fandom CDN for the original file instead of a WebP transcode', () => {
    expect(withOriginalFormat(cdn)).toBe(`${cdn}?format=original`)
    expect(withOriginalFormat(`${cdn}?cb=123`)).toBe(`${cdn}?cb=123&format=original`)
  })
  it('keeps an explicit format param', () => {
    expect(withOriginalFormat(`${cdn}?format=webp`)).toBe(`${cdn}?format=webp`)
  })
  it('leaves other hosts and non-URLs untouched', () => {
    expect(withOriginalFormat('https://example.com/x.png')).toBe('https://example.com/x.png')
    expect(withOriginalFormat('not a url')).toBe('not a url')
  })
})

describe('isSolvableHost', () => {
  it('accepts the Fandom CDN and wiki hosts', () => {
    expect(isSolvableHost('https://static.wikia.nocookie.net/gensin-impact/images/6/6e/X.png')).toBe(true)
    expect(isSolvableHost('https://genshin-impact.fandom.com/wiki/Amber')).toBe(true)
  })
  it('rejects other hosts, including look-alike suffixes', () => {
    expect(isSolvableHost('https://example.com/x.png')).toBe(false)
    expect(isSolvableHost('https://evilnocookie.net/x.png')).toBe(false)
    expect(isSolvableHost('https://fandom.com.evil.io/x.png')).toBe(false)
  })
  it('rejects non-URLs', () => {
    expect(isSolvableHost('not a url')).toBe(false)
  })
})

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
