import { readFile, readdir, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, extname, relative } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { getMaterialSchema } from '@shared/materialsSchema'
import { insertRecord, removeRecord, renameRecord } from '@shared/ordering'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import type {
  MaterialChange,
  MaterialRecord,
  MaterialSummary,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const MATERIALS = ENTITIES.find((e) => e.key === 'materials')!

function dataDir(rootPath: string): string {
  return join(rootPath, 'data')
}
function imagesDir(rootPath: string): string {
  return join(rootPath, 'images')
}

async function materialFiles(rootPath: string): Promise<string[]> {
  const files = await readdir(dataDir(rootPath))
  return files.filter((f) => f.startsWith(MATERIALS.filePrefix!) && f.endsWith('.json')).sort()
}

async function readRecords(
  rootPath: string,
  file: string
): Promise<{ raw: string; parsed: { materials: Record<string, MaterialRecord> } }> {
  const path = join(dataDir(rootPath), file)
  if (!existsSync(path)) {
    return { raw: '', parsed: { materials: {} } }
  }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!parsed.materials || typeof parsed.materials !== 'object') parsed.materials = {}
  return { raw, parsed }
}

/** Flatten all material records across files into browse-list rows. */
export async function listMaterials(rootPath: string): Promise<MaterialSummary[]> {
  const out: MaterialSummary[] = []
  for (const file of await materialFiles(rootPath)) {
    const { parsed } = await readRecords(rootPath, file)
    for (const [key, rec] of Object.entries(parsed.materials)) {
      out.push({
        key,
        file,
        innerType: rec.innerType,
        name: rec.name ?? key,
        rarity: rec.rarity ?? 0,
        image: rec.image ?? '',
        released: Boolean(rec.released),
        editable: getMaterialSchema(rec.innerType) !== undefined
      })
    }
  }
  return out
}

export async function getMaterial(
  rootPath: string,
  file: string,
  key: string
): Promise<MaterialRecord | null> {
  const { parsed } = await readRecords(rootPath, file)
  return parsed.materials[key] ?? null
}

/** Return all records in a single file (used for tier-set sibling lookup). */
export async function getMaterialsForFile(
  rootPath: string,
  file: string
): Promise<Record<string, MaterialRecord>> {
  const { parsed } = await readRecords(rootPath, file)
  return parsed.materials ?? {}
}

/** Template skeletons from templates/materials.json (base objects for new records). */
export async function listTemplates(rootPath: string): Promise<Record<string, MaterialRecord>> {
  const path = join(rootPath, 'templates', 'materials.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

/** List existing image filenames in an images/ subfolder (for the "pick existing" picker). */
export async function listImages(rootPath: string, folder: string): Promise<string[]> {
  const dir = join(imagesDir(rootPath), folder)
  if (!existsSync(dir)) return []
  const files = await readdir(dir)
  return files
    .filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** Recursively collect image paths (relative to the given dir) within a single directory. */
async function collectImagesRecursive(dir: string, prefix: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    if (e.isDirectory()) {
      const sub = await collectImagesRecursive(join(dir, e.name), `${prefix}${e.name}/`)
      out.push(...sub)
    } else if (/\.(png|jpe?g|webp|gif)$/i.test(e.name)) {
      out.push(`${prefix}${e.name}`)
    }
  }
  return out
}

/**
 * List images from multiple folders recursively, returning paths relative to images/ root.
 * E.g. ["Characters/Pyro/Amber.png", "Outfits/Thumbnail/Standard/Amber.png"]
 */
export async function listImagesMulti(rootPath: string, folders: string[]): Promise<string[]> {
  const imDir = imagesDir(rootPath)
  const results: string[] = []
  for (const folder of folders) {
    const dirPath = join(imDir, folder)
    if (!existsSync(dirPath)) continue
    const rel = await collectImagesRecursive(dirPath, '')
    for (const f of rel) results.push(`${folder}/${f}`.replaceAll('\\', '/'))
  }
  return results.sort((a, b) => a.localeCompare(b))
}

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/png'
}

/** Resolve an ImagePlan into a data URL for thumbnail preview (fetched in main to keep CSP strict). */
export async function previewImage(rootPath: string, plan: ImagePlan): Promise<string | null> {
  try {
    if (plan.source === 'existing') {
      const abs = join(imagesDir(rootPath), plan.relativePath)
      if (relative(imagesDir(rootPath), abs).startsWith('..') || !existsSync(abs)) return null
      const buf = await readFile(abs)
      return `data:${mimeFor(abs)};base64,${buf.toString('base64')}`
    }
    if (plan.source === 'localFile') {
      if (!existsSync(plan.sourcePath)) return null
      const buf = await readFile(plan.sourcePath)
      return `data:${mimeFor(plan.sourcePath)};base64,${buf.toString('base64')}`
    }
    // url
    const res = await fetch(plan.url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get('content-type') ?? mimeFor(plan.url)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Batch variant of previewImage for existing images: resolves many relative paths in one IPC
 * round-trip, returning a map of path → data URL (or null). Callers coalesce their per-image
 * requests into a single call to avoid flooding the channel (see renderer imageCache).
 */
export async function previewImages(
  rootPath: string,
  relativePaths: string[]
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  await Promise.all(
    relativePaths.map(async (rel) => {
      out[rel] = await previewImage(rootPath, { source: 'existing', relativePath: rel })
    })
  )
  return out
}

/** Apply a change to a records map, returning the new map (order-preserving). */
function applyChange(
  records: Record<string, MaterialRecord>,
  change: MaterialChange
): Record<string, MaterialRecord> {
  if (change.op === 'delete') {
    return removeRecord(records, change.key)
  }
  const record = change.record!
  if (change.op === 'update' && change.originalKey && change.originalKey !== change.key) {
    return renameRecord(records, change.originalKey, change.key, record, change.ordering)
  }
  return insertRecord(records, change.key, record, change.ordering)
}

function imageActionText(change: MaterialChange): string | null {
  const plan = change.image
  if (!plan || plan.source === 'existing') return null // referencing an existing file = no file op
  if (plan.source === 'localFile')
    return `Copy ${plan.sourcePath} → images/${plan.destRelative}`
  return `Download ${plan.url} → images/${plan.destRelative}`
}

export async function previewCommit(
  rootPath: string,
  change: MaterialChange
): Promise<CommitPreview> {
  const { raw } = await readRecords(rootPath, change.file)
  const parsed = raw ? JSON.parse(raw) : { materials: {} }
  const before = raw

  const nextMaterials = applyChange(parsed.materials ?? {}, change)
  const nextParsed = { ...parsed, materials: nextMaterials }
  const reference = before || '\n' // new files default to a trailing newline
  const after = withTrailingNewline(stringifyDataFile(nextParsed), reference)

  return {
    file: change.file,
    before,
    after,
    imageAction: imageActionText(change),
    formattingDriftWarning:
      before && !roundTrips(before)
        ? 'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'
        : null
  }
}

async function performImageOp(rootPath: string, plan: ImagePlan): Promise<void> {
  if (plan.source === 'existing') return
  const dest = join(imagesDir(rootPath), plan.destRelative)
  await mkdir(dirname(dest), { recursive: true })
  if (plan.source === 'localFile') {
    await copyFile(plan.sourcePath, dest)
    return
  }
  const res = await fetch(plan.url)
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${plan.url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
}

export async function commit(rootPath: string, change: MaterialChange): Promise<CommitResult> {
  try {
    const preview = await previewCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }

    // Image op first so a failed download/copy doesn't leave a dangling JSON reference.
    if (change.image) await performImageOp(rootPath, change.image)

    await writeFile(join(dataDir(rootPath), change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Preview all changes in a batch (all must target the same file), applied sequentially. */
export async function previewBatchCommit(
  rootPath: string,
  changes: MaterialChange[]
): Promise<CommitPreview> {
  if (changes.length === 0) throw new Error('Empty batch')
  const file = changes[0].file
  const { raw } = await readRecords(rootPath, file)
  const parsed = raw ? JSON.parse(raw) : { materials: {} }

  let records = parsed.materials ?? {}
  for (const change of changes) {
    records = applyChange(records, change)
  }

  const reference = raw || '\n'
  const after = withTrailingNewline(stringifyDataFile({ ...parsed, materials: records }), reference)

  const imageActions = changes.map(imageActionText).filter((s): s is string => s !== null)

  return {
    file,
    before: raw,
    after,
    imageAction: imageActions.length > 0 ? imageActions.join('\n') : null,
    formattingDriftWarning:
      raw && !roundTrips(raw)
        ? 'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'
        : null
  }
}

/** Commit a batch of changes to the same file, performing all image ops then writing once. */
export async function batchCommit(
  rootPath: string,
  changes: MaterialChange[]
): Promise<CommitResult> {
  try {
    const preview = await previewBatchCommit(rootPath, changes)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }

    for (const change of changes) {
      if (change.image) await performImageOp(rootPath, change.image)
    }

    await writeFile(join(dataDir(rootPath), changes[0].file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
