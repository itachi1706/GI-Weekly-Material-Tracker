import { BrowserWindow, session } from 'electron'

/**
 * Downloads images from Fandom's CDN (static.wikia.nocookie.net), which now fronts responses with a
 * Cloudflare bot-check. A plain `fetch` can never pass it — the check requires actually running the
 * challenge's JS — so on a mitigated response we fall back to driving a real (hidden, reused)
 * Chromium window through it, then replay the request with the cookies that earns.
 */

const PARTITION = 'persist:wiki-cdn'
const REFERER = 'https://genshin-impact.fandom.com/'
const AUTO_CLEAR_TIMEOUT_MS = 8000 // time to let a non-interactive "managed challenge" clear on its own
const INTERACTIVE_TIMEOUT_MS = 120000 // time to let the user solve a visible Turnstile prompt
const POLL_MS = 400
const CHALLENGE_TITLE_RE = /just a moment|attention required|checking your browser/i

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Electron's default UA embeds "Electron/x.y.z", a token several bot-detection products block
 * outright. Swap in a plain desktop-Chrome UA built from the bundled Chromium version instead, so the
 * hidden window looks like an ordinary browser rather than an app shell.
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

let solverWindow: BrowserWindow | null = null

function getSolverWindow(): BrowserWindow {
  if (solverWindow && !solverWindow.isDestroyed()) return solverWindow
  const win = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    title: 'Verifying image host…',
    webPreferences: {
      session: session.fromPartition(PARTITION),
      sandbox: true,
      contextIsolation: true
    }
  })
  win.webContents.setUserAgent(chromeUserAgent())
  win.on('closed', () => {
    if (solverWindow === win) solverWindow = null
  })
  solverWindow = win
  return win
}

/**
 * Navigate the hidden solver window to `url` and wait for Cloudflare's challenge to clear. Chromium
 * usually clears a "managed challenge" on its own within a couple of seconds — it only needs to run
 * the page's JS, unlike a plain `fetch`. If it instead renders an interactive prompt (e.g. a Turnstile
 * checkbox), the window is revealed so the user can complete it, then hidden again once the page moves
 * past the challenge.
 */
async function passCloudflareChallenge(url: string): Promise<void> {
  const win = getSolverWindow()
  await win.loadURL(url).catch(() => {
    // Navigating straight to an image resource can report a navigation error even when the request
    // itself went through (e.g. it gets handled as a download) — the title poll below is the real signal.
  })

  const isChallenge = (): boolean => CHALLENGE_TITLE_RE.test(win.webContents.getTitle())

  const waitWhileChallenged = async (timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (win.isDestroyed()) throw new Error('Verification window was closed before completing.')
      if (!isChallenge()) return true
      await sleep(POLL_MS)
    }
    return false
  }

  if (await waitWhileChallenged(AUTO_CLEAR_TIMEOUT_MS)) return

  win.show()
  try {
    if (!(await waitWhileChallenged(INTERACTIVE_TIMEOUT_MS))) {
      throw new Error("Timed out waiting for the image host's bot-check to clear.")
    }
  } finally {
    if (!win.isDestroyed()) win.hide()
  }
}

/** Cookie header string for `url` from the solver window's (persistent) session. */
async function cookieHeaderFor(url: string): Promise<string> {
  const cookies = await getSolverWindow().webContents.session.cookies.get({ url })
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

// Dedupe concurrent challenge-solves (e.g. a grid of thumbnails all 403ing at once) onto one pass —
// they all clear the same Cloudflare cookie, so only one needs to drive the window.
let clearancePromise: Promise<void> | null = null
function ensureClearance(url: string): Promise<void> {
  clearancePromise ??= passCloudflareChallenge(url).finally(() => {
    clearancePromise = null
  })
  return clearancePromise
}

// Cached from the last successful verification so later downloads can skip straight to a plain fetch
// instead of re-driving the solver window every time.
let cachedCookieHeader: string | null = null

/**
 * Download an image, transparently solving Fandom's Cloudflare bot-check when it's shown. Tries a
 * plain request first (cheap, and most requests still aren't challenged); only drives the hidden
 * browser when that comes back mitigated.
 */
export async function fetchImageBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': chromeUserAgent(),
    Referer: REFERER,
    Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8'
  }
  const attempt = (cookie: string | null): Promise<Response> =>
    fetch(url, { headers: cookie ? { ...baseHeaders, Cookie: cookie } : baseHeaders })

  let res = await attempt(cachedCookieHeader)
  if (res.ok) {
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') }
  }
  if (!looksLikeCloudflareChallenge(res)) {
    throw new Error(`Image download failed (${res.status}) for ${url}`)
  }

  await ensureClearance(url)
  cachedCookieHeader = await cookieHeaderFor(url)
  res = await attempt(cachedCookieHeader)
  if (!res.ok) {
    throw new Error(`Image download failed (${res.status}) for ${url} (after passing verification)`)
  }
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') }
}
