import { app, dialog, shell, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

const OWNER = 'itachi1706'
const REPO = 'GI-Weekly-Material-Tracker'
const RELEASES_PAGE = `https://github.com/${OWNER}/${REPO}/releases/latest`

/**
 * Compare two `x.y.z` versions (prerelease suffixes after `-` are ignored). Returns true when
 * `latest` is strictly newer than `current`. Non-numeric parts degrade to 0, so a non-semver tag
 * never reads as "newer".
 */
export function isNewer(current: string, latest: string): boolean {
  const parse = (v: string): number[] =>
    v.split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
  const a = parse(current)
  const b = parse(latest)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (y > x) return true
    if (y < x) return false
  }
  return false
}

/**
 * On Windows, `electron-updater` downloads the newer NSIS installer and offers to restart-to-install.
 * macOS builds are unsigned, so Squirrel.Mac can't self-install — instead we check the GitHub
 * Releases API and, if newer, offer to open the download page for a manual update.
 *
 * No-op in dev (`!app.isPackaged`). All failures are logged and swallowed so a flaky network or
 * rate-limited API never disrupts the app.
 */
export function initAutoUpdate(mainWindow: BrowserWindow): void {
  if (!app.isPackaged) return
  try {
    if (process.platform === 'win32') initWindowsUpdater(mainWindow)
    else if (process.platform === 'darwin') void checkMacUpdate(mainWindow)
  } catch (e) {
    console.warn('[updater] init failed:', e)
  }
}

function initWindowsUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('error', (err) => console.warn('[updater] error:', err))
  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Restart the app to finish installing the update.'
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })
  void autoUpdater.checkForUpdates()
}

async function checkMacUpdate(mainWindow: BrowserWindow): Promise<void> {
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: { 'User-Agent': `${REPO}-DataTool`, Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = String(data.tag_name ?? '').replace(/^v/, '')
    const current = app.getVersion()
    if (!latest || !isNewer(current, latest)) return

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Open download page', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update available',
      message: `Version ${latest} is available (you have ${current}).`,
      detail: 'macOS builds are not code-signed, so updates are downloaded and installed manually.'
    })
    if (response === 0) await shell.openExternal(data.html_url ?? RELEASES_PAGE)
  } catch (e) {
    console.warn('[updater] macOS update check failed:', e)
  }
}
