import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { getMaterialSchema } from '@shared/materialsSchema'
import { datasetFile, imageDir, imagePath } from './paths'
import {
  listEntityFiles,
  readEntityRecords,
  applyKeyedChange,
  planActionText,
  performImageOp,
  serializeRecords,
  assembleCommit
} from './entityStore'
import type {
  MaterialChange,
  MaterialRecord,
  MaterialSummary,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const MATERIALS = ENTITIES.find((e) => e.key === 'materials')!
const DRIFT =
  'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'

/** Flatten all material records across files into browse-list rows. */
export async function listMaterials(rootPath: string): Promise<MaterialSummary[]> {
  const out: MaterialSummary[] = []
  for (const file of await listEntityFiles(rootPath, MATERIALS.filePrefix!)) {
    const { records } = await readEntityRecords<MaterialRecord>(rootPath, file, 'materials')
    for (const [key, rec] of Object.entries(records)) {
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
  const { records } = await readEntityRecords<MaterialRecord>(rootPath, file, 'materials')
  return records[key] ?? null
}

/** Return all records in a single file (used for tier-set sibling lookup). */
export async function getMaterialsForFile(
  rootPath: string,
  file: string
): Promise<Record<string, MaterialRecord>> {
  const { records } = await readEntityRecords<MaterialRecord>(rootPath, file, 'materials')
  return records
}

/** Template skeletons from templates/materials.json (base objects for new records). */
export async function listTemplates(rootPath: string): Promise<Record<string, MaterialRecord>> {
  const path = join(rootPath, 'templates', 'materials.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

/** List existing image filenames in an images/ subfolder (for the "pick existing" picker). */
export async function listImages(rootPath: string, folder: string): Promise<string[]> {
  const dir = imageDir(rootPath, folder)
  if (!existsSync(dir)) return []
  const files = await readdir(dir)
  return files.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort((a, b) => a.localeCompare(b))
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
  const results: string[] = []
  for (const folder of folders) {
    const dirPath = imageDir(rootPath, folder)
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
      const abs = imagePath(rootPath, plan.relativePath)
      if (!existsSync(abs)) return null
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

export async function previewCommit(
  rootPath: string,
  change: MaterialChange
): Promise<CommitPreview> {
  const { raw } = await readEntityRecords<MaterialRecord>(rootPath, change.file, 'materials')
  return {
    file: change.file,
    ...assembleCommit(raw, 'materials', change, DRIFT),
    imageAction: planActionText(change.image)
  }
}

export async function commit(rootPath: string, change: MaterialChange): Promise<CommitResult> {
  try {
    const preview = await previewCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }
    // Image op first so a failed download/copy doesn't leave a dangling JSON reference.
    if (change.image) await performImageOp(rootPath, change.image)
    await writeFile(datasetFile(rootPath, change.file), preview.after, 'utf-8')
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
  const { raw } = await readEntityRecords<MaterialRecord>(rootPath, file, 'materials')

  // Fall back to {} if `materials` is missing, not an object, or an array (arrays are typeof
  // 'object' but aren't a keyed record map).
  const parsedMaterials = raw ? (JSON.parse(raw).materials as unknown) : undefined
  let records: Record<string, MaterialRecord> =
    parsedMaterials && typeof parsedMaterials === 'object' && !Array.isArray(parsedMaterials)
      ? (parsedMaterials as Record<string, MaterialRecord>)
      : {}
  for (const change of changes) records = applyKeyedChange(records, change)

  return {
    file,
    ...serializeRecords(raw, 'materials', records, DRIFT),
    imageAction:
      changes
        .map((c) => planActionText(c.image))
        .filter((s): s is string => s !== null)
        .join('\n') || null
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
    await writeFile(datasetFile(rootPath, changes[0].file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
