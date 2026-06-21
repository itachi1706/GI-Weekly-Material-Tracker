import { readFile, readdir, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { insertRecord, removeRecord, renameRecord } from '@shared/ordering'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import type {
  OutfitChange,
  OutfitRecord,
  OutfitSummary,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const OUTFITS = ENTITIES.find((e) => e.key === 'outfits')!

function dataDir(rootPath: string): string {
  return join(rootPath, 'data')
}
function imagesDir(rootPath: string): string {
  return join(rootPath, 'images')
}

async function outfitFiles(rootPath: string): Promise<string[]> {
  const files = await readdir(dataDir(rootPath))
  return files.filter((f) => f.startsWith(OUTFITS.filePrefix!) && f.endsWith('.json')).sort()
}

async function readOutfitRecords(
  rootPath: string,
  file: string
): Promise<{ raw: string; parsed: { outfits: Record<string, OutfitRecord> } }> {
  const path = join(dataDir(rootPath), file)
  if (!existsSync(path)) {
    return { raw: '', parsed: { outfits: {} } }
  }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!parsed.outfits || typeof parsed.outfits !== 'object') parsed.outfits = {}
  return { raw, parsed }
}

export async function listOutfits(rootPath: string): Promise<OutfitSummary[]> {
  const out: OutfitSummary[] = []
  for (const file of await outfitFiles(rootPath)) {
    const { parsed } = await readOutfitRecords(rootPath, file)
    for (const [key, rec] of Object.entries(parsed.outfits)) {
      out.push({
        key,
        file,
        name: String(rec.name ?? key),
        character: String(rec.character ?? ''),
        type: String(rec.type ?? ''),
        image: String(rec.thumbnail ?? ''),
        rarity: Number(rec.rarity ?? 4),
        released: Boolean(rec.released)
      })
    }
  }
  return out
}

export async function getOutfit(
  rootPath: string,
  file: string,
  key: string
): Promise<OutfitRecord | null> {
  const { parsed } = await readOutfitRecords(rootPath, file)
  return parsed.outfits[key] ?? null
}

/** Template skeleton from templates/misc.json — returns the "Outfit" key. */
export async function listMiscTemplates(rootPath: string): Promise<Record<string, OutfitRecord>> {
  const path = join(rootPath, 'templates', 'misc.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

function applyChange(
  records: Record<string, OutfitRecord>,
  change: OutfitChange
): Record<string, OutfitRecord> {
  if (change.op === 'delete') {
    return removeRecord(records, change.key)
  }
  const record = change.record!
  if (change.op === 'update' && change.originalKey && change.originalKey !== change.key) {
    return renameRecord(records, change.originalKey, change.key, record, change.ordering)
  }
  return insertRecord(records, change.key, record, change.ordering)
}

function planActionText(plan: ImagePlan | undefined): string | null {
  if (!plan || plan.source === 'existing') return null
  if (plan.source === 'localFile')
    return `Copy ${plan.sourcePath} → images/${plan.destRelative}`
  return `Download ${plan.url} → images/${plan.destRelative}`
}

function allImageActions(change: OutfitChange): string | null {
  const lines = [
    planActionText(change.image),
    planActionText(change.thumbnailImage),
    planActionText(change.wishimageImage),
  ].filter((s): s is string => s !== null)
  return lines.length > 0 ? lines.join('\n') : null
}

export async function previewOutfitCommit(
  rootPath: string,
  change: OutfitChange
): Promise<CommitPreview> {
  const { raw } = await readOutfitRecords(rootPath, change.file)
  const parsed = raw ? JSON.parse(raw) : { outfits: {} }
  const before = raw

  const nextOutfits = applyChange(parsed.outfits ?? {}, change)
  const nextParsed = { ...parsed, outfits: nextOutfits }
  const reference = before || '\n'
  const after = withTrailingNewline(stringifyDataFile(nextParsed), reference)

  return {
    file: change.file,
    before,
    after,
    imageAction: allImageActions(change),
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

export async function commitOutfit(
  rootPath: string,
  change: OutfitChange
): Promise<CommitResult> {
  try {
    const preview = await previewOutfitCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }
    if (change.image) await performImageOp(rootPath, change.image)
    if (change.thumbnailImage) await performImageOp(rootPath, change.thumbnailImage)
    if (change.wishimageImage) await performImageOp(rootPath, change.wishimageImage)
    await writeFile(join(dataDir(rootPath), change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
