import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { datasetFile } from './paths'
import {
  listEntityFiles,
  readEntityRecords,
  joinActionText,
  performImageOp,
  assembleCommit
} from './entityStore'
import type { OutfitChange, OutfitRecord, OutfitSummary, CommitPreview, CommitResult } from '@shared/types'

const OUTFITS = ENTITIES.find((e) => e.key === 'outfits')!
const DRIFT =
  'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'

export async function listOutfits(rootPath: string): Promise<OutfitSummary[]> {
  const out: OutfitSummary[] = []
  for (const file of await listEntityFiles(rootPath, OUTFITS.filePrefix!)) {
    const { records } = await readEntityRecords<OutfitRecord>(rootPath, file, 'outfits')
    for (const [key, rec] of Object.entries(records)) {
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
  const { records } = await readEntityRecords<OutfitRecord>(rootPath, file, 'outfits')
  return records[key] ?? null
}

/** Template skeleton from templates/misc.json — returns the "Outfit" key. */
export async function listMiscTemplates(rootPath: string): Promise<Record<string, OutfitRecord>> {
  const path = join(rootPath, 'templates', 'misc.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

export async function previewOutfitCommit(
  rootPath: string,
  change: OutfitChange
): Promise<CommitPreview> {
  const { raw } = await readEntityRecords<OutfitRecord>(rootPath, change.file, 'outfits')
  return {
    file: change.file,
    ...assembleCommit(raw, 'outfits', change, DRIFT),
    imageAction: joinActionText([change.image, change.thumbnailImage, change.wishimageImage])
  }
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
    await writeFile(datasetFile(rootPath, change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
