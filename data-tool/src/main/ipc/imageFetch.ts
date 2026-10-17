import { BrowserWindow, session } from 'electron'
import type { Session } from 'electron'

/**
 * Downloads images from Fandom's CDN (static.wikia.nocookie.net), which now fronts responses with a
 * Cloudflare bot-check. Requests normally go straight through; when one is challenged, we open a
 * visible window on the same Electron session so the user can complete the check themselves, then
 * retry. All requests use that session (`ses.fetch`), so the clearance cookie is attached by
 * Chromium's own cookie jar (scoped to the right host) and the request carries the same network
 * fingerprint that earned it.
 */

const PARTITION = 'persist:wiki-cdn'
const REQUEST_TIMEOUT_MS = 20000
const VERIFY_TIMEOUT_MS = 120000 // time to let the user complete the check in the window
const POLL_MS = 400

/** Hosts we're willing to open a verification window for — never arbitrary pasted URLs. */
const SOLVABLE_HOST_SUFFIXES = ['nocookie.net', 'fandom.com']

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Electron's default UA embeds "Electron/x.y.z", a token several bot-detection products block
 * outright. Use a plain desktop-Chrome UA built from the bundled Chromium version instead.
 */
export function chromeUserAgent(): string {
  const platform =
    process.platform === 'darwin'
      ? 'Macintosh; Intel Mac OS X 10_15_7'
      : process.platform === 'win32'
        ? 'Windows NT 10.0; Win64; x64'
        : 'X11; Linux x86_64'
  // process.versions.chrome is only set inside Electron; fall back to a recent version for tests.
  const chromeVersion = process.versions.chrome ?? '140.0.0.0'
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
}

/**
 * Cloudflare marks a mitigated response with this header — a precise signal that beats sniffing the
 * HTML body, and (unlike the status code alone) doesn't confuse a challenge with a genuine 403/404.
 */
export function looksLikeCloudflareChallenge(res: Response): boolean {
  return res.headers.get('cf-mitigated') === 'challenge'
}

/** True for the Fandom hosts (and their subdomains) whose bot-check we'll drive a window through. */
export function isSolvableHost(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return SOLVABLE_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))
}

/**
 * Fandom's CDN transcodes to WebP for Chrome-like clients regardless of `Accept`, which would land
 * WebP bytes in the dataset's `.png` files. `format=original` serves the file as uploaded.
 */
export function withOriginalFormat(url: string): string {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return url
  }
  const host = u.hostname.toLowerCase()
  if (host !== 'nocookie.net' && !host.endsWith('.nocookie.net')) return url
  if (!u.searchParams.has('format')) u.searchParams.set('format', 'original')
  return u.toString()
}

let cdnSession: Session | null = null

function getSession(): Session {
  if (cdnSession) return cdnSession
  const ses = session.fromPartition(PARTITION)
  ses.setUserAgent(chromeUserAgent())
  // The verification window should only ever render the challenge/image, never save files.
  ses.on('will-download', (event) => event.preventDefault())
  cdnSession = ses
  return ses
}

function createSolverWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    title: 'Verify image host — complete the check to continue',
    webPreferences: {
      session: getSession(),
      sandbox: true,
      contextIsolation: true
    }
  })
  const { hostname } = new URL(url)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // The challenge only reloads the same URL (with Cloudflare's own query params); block anything else.
  win.webContents.on('will-navigate', (event, target) => {
    try {
      if (new URL(target).hostname !== hostname) event.preventDefault()
    } catch {
      event.preventDefault()
    }
  })
  return win
}

/**
 * Whether the window has moved past the challenge to the image itself. Checks the loaded document's
 * MIME type rather than its title, because Cloudflare localizes the interstitial's title.
 */
async function showsImage(win: BrowserWindow): Promise<boolean> {
  try {
    const type: unknown = await win.webContents.executeJavaScript('document.contentType', false)
    return typeof type === 'string' && type.startsWith('image/')
  } catch {
    return false // mid-navigation (the challenge reloading itself) — treat as not cleared yet
  }
}

/**
 * Open `url` in a verification window and wait for the user to complete Cloudflare's check. Shown
 * straight away: a hidden window never clears the challenge on its own (observed: it sits on
 * "Just a moment..." indefinitely). The window is always destroyed afterwards — the clearance cookie
 * lives in the persistent session, and a lingering window would keep the app from quitting.
 */
async function passCloudflareChallenge(url: string): Promise<void> {
  const win = createSolverWindow(url)
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  try {
    await win.loadURL(url).catch((e: { code?: string }) => {
      // ERR_ABORTED is the challenge page reloading itself mid-load; anything else is a real failure.
      if (e.code !== 'ERR_ABORTED') throw e
    })

    const deadline = Date.now() + VERIFY_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (win.isDestroyed()) throw new Error('Verification window was closed before completing.')
      if (await showsImage(win)) return
      await sleep(POLL_MS)
    }
    throw new Error("Timed out waiting for the image host's bot-check to clear.")
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

// One in-flight solve per host, so a grid of thumbnails all 403ing at once shares a single window,
// while a challenge on a different host still gets its own pass.
const clearanceByHost = new Map<string, Promise<void>>()
function ensureClearance(url: string): Promise<void> {
  const host = new URL(url).hostname
  let p = clearanceByHost.get(host)
  if (!p) {
    p = passCloudflareChallenge(url).finally(() => clearanceByHost.delete(host))
    clearanceByHost.set(host, p)
  }
  return p
}

/**
 * Download an image, transparently solving Fandom's Cloudflare bot-check when it's shown. Only
 * Fandom hosts get the verification window; a challenge from any other host fails like a normal 403.
 */
export async function fetchImageBuffer(
  requestedUrl: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
  // session.fetch (unlike Node's fetch) also serves file:// and custom schemes — images only come from the web.
  if (!/^https?:$/.test(new URL(requestedUrl).protocol)) {
    throw new Error(`Only http(s) image URLs are supported: ${requestedUrl}`)
  }
  const url = withOriginalFormat(requestedUrl)
  const attempt = (): Promise<Response> =>
    getSession().fetch(url, {
      headers: { Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })

  let res = await attempt()
  if (!res.ok && looksLikeCloudflareChallenge(res) && isSolvableHost(url)) {
    await res.body?.cancel()
    await ensureClearance(url)
    res = await attempt()
  }
  if (!res.ok) {
    throw new Error(`Image download failed (${res.status}) for ${requestedUrl}`)
  }
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') }
}
