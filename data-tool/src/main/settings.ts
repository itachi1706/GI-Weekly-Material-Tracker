import { app } from 'electron'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

/**
 * Minimal, dependency-free persisted settings stored as JSON in the app's userData dir.
 * (Replaces electron-store to avoid its ESM-only packaging quirks; the surface we need is tiny.)
 */
interface Settings {
  lastDatasetPath?: string
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export async function readSettings(): Promise<Settings> {
  try {
    return JSON.parse(await readFile(settingsPath(), 'utf-8')) as Settings
  } catch {
    return {}
  }
}

export async function writeSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...(await readSettings()), ...patch }
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
}
