import { readFile, readdir, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { insertRecord, removeRecord, renameRecord } from '@shared/ordering'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import { dataDir, datasetFile, imagePath } from './paths'
import type { InsertModeName, ImagePlan } from '@shared/types'

/**
 * Shared filesystem + serialization plumbing for the keyed-record entities (materials, characters,
 * weapons, outfits). Each handler used to carry a byte-identical copy of these — extracting them here
 * removes that duplication (SonarCloud) and makes the pure pieces (`applyKeyedChange`,
 * `planActionText`, `assembleCommit`) unit-testable. Banners reuse the image helpers only (they store
 * per-type arrays, not a keyed map).
 */

/** The common shape of a create/update/delete against a keyed record map. */
export interface KeyedChange<R> {
  op: 'create' | 'update' | 'delete'
  key: string
  originalKey?: string
  record?: R
  ordering: InsertModeName
}

/** Sorted list of an entity's data files (`<prefix>*.json`) in the dataset's data/ dir. */
export async function listEntityFiles(rootPath: string, filePrefix: string): Promise<string[]> {
  const files = await readdir(dataDir(rootPath))
  return files
    .filter((f) => f.startsWith(filePrefix) && f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
}

/** Read one data file and return its raw text + the record map under `rootKey` (empty if absent). */
export async function readEntityRecords<R>(
  rootPath: string,
  file: string,
  rootKey: string
): Promise<{ raw: string; records: Record<string, R> }> {
  const path = datasetFile(rootPath, file)
  if (!existsSync(path)) return { raw: '', records: {} }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const rec = parsed[rootKey]
  return { raw, records: (rec && typeof rec === 'object' ? rec : {}) as Record<string, R> }
}

/** Apply a keyed create/update/delete. Update-in-place keeps position; a rename (key change) and a
 *  create re-insert per `ordering` (`append` → end, `alphabetical` → sorted). */
export function applyKeyedChange<R>(
  records: Record<string, R>,
  change: KeyedChange<R>
): Record<string, R> {
  if (change.op === 'delete') {
    return removeRecord(records, change.key)
  }
  // create/update must carry the record to write; fail loudly at this IPC boundary if it's missing.
  if (!change.record) {
    throw new Error(`applyKeyedChange: '${change.op}' for key '${change.key}' is missing a record`)
  }
  const record = change.record
  if (change.op === 'update' && change.originalKey && change.originalKey !== change.key) {
    return renameRecord(records, change.originalKey, change.key, record, change.ordering)
  }
  return insertRecord(records, change.key, record, change.ordering)
}

/** Human-readable description of an image op for the commit preview (null when nothing to copy). */
export function planActionText(plan: ImagePlan | undefined): string | null {
  if (!plan || plan.source === 'existing') return null
  if (plan.source === 'localFile') return `Copy ${plan.sourcePath} → images/${plan.destRelative}`
  return `Download ${plan.url} → images/${plan.destRelative}`
}

/** Join one or more image-op descriptions, or null if none apply. */
export function joinActionText(plans: (ImagePlan | undefined)[]): string | null {
  const lines = plans.map(planActionText).filter((s): s is string => s !== null)
  return lines.length > 0 ? lines.join('\n') : null
}

/** The before/after/drift portion of a CommitPreview (file + imageAction are added by the caller). */
export interface CommitCore {
  before: string
  after: string
  formattingDriftWarning: string | null
}

/**
 * Re-serialize `records` under `rootKey` back into the file, preserving any other top-level keys and
 * the file's trailing-newline convention. Refuses (via the drift block) when the existing file
 * doesn't round-trip, so a commit never reformats untouched records.
 */
export function serializeRecords<R>(
  raw: string,
  rootKey: string,
  records: Record<string, R>,
  driftWarning: string
): CommitCore {
  const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
  const after = withTrailingNewline(stringifyDataFile({ ...parsed, [rootKey]: records }), raw || '\n')
  return {
    before: raw,
    after,
    formattingDriftWarning: raw && !roundTrips(raw) ? driftWarning : null
  }
}

/** Read the current records from `raw`, apply one keyed change, and re-serialize (see serializeRecords). */
export function assembleCommit<R>(
  raw: string,
  rootKey: string,
  change: KeyedChange<R>,
  driftWarning: string
): CommitCore {
  const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
  const current = (parsed[rootKey] ?? {}) as Record<string, R>
  return serializeRecords(raw, rootKey, applyKeyedChange(current, change), driftWarning)
}

/** Perform a pending image copy/download into images/ (no-op for an existing-file reference). */
export async function performImageOp(rootPath: string, plan: ImagePlan): Promise<void> {
  if (plan.source === 'existing') return
  const dest = imagePath(rootPath, plan.destRelative)
  await mkdir(dirname(dest), { recursive: true })
  if (plan.source === 'localFile') {
    await copyFile(plan.sourcePath, dest)
    return
  }
  const res = await fetch(plan.url)
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${plan.url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}
