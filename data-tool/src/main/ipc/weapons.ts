import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { datasetFile } from './paths'
import {
  listEntityFiles,
  readEntityRecords,
  planActionText,
  performImageOp,
  assembleCommit
} from './entityStore'
import type { WeaponChange, WeaponRecord, WeaponSummary, CommitPreview, CommitResult } from '@shared/types'

const WEAPONS = ENTITIES.find((e) => e.key === 'weapons')!
const DRIFT =
  'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'

export async function listWeapons(rootPath: string): Promise<WeaponSummary[]> {
  const out: WeaponSummary[] = []
  for (const file of await listEntityFiles(rootPath, WEAPONS.filePrefix!)) {
    const { records } = await readEntityRecords<WeaponRecord>(rootPath, file, 'weapons')
    for (const [key, rec] of Object.entries(records)) {
      out.push({
        key,
        file,
        name: String(rec.name ?? key),
        type: String(rec.type ?? ''),
        rarity: Number(rec.rarity ?? 3),
        image: String(rec.image ?? ''),
        released: Boolean(rec.released)
      })
    }
  }
  return out
}

export async function getWeapon(
  rootPath: string,
  file: string,
  key: string
): Promise<WeaponRecord | null> {
  const { records } = await readEntityRecords<WeaponRecord>(rootPath, file, 'weapons')
  return records[key] ?? null
}

export async function listWeaponTemplates(rootPath: string): Promise<Record<string, WeaponRecord>> {
  const path = join(rootPath, 'templates', 'weapons.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

export async function previewWeaponCommit(
  rootPath: string,
  change: WeaponChange
): Promise<CommitPreview> {
  const { raw } = await readEntityRecords<WeaponRecord>(rootPath, change.file, 'weapons')
  return {
    file: change.file,
    ...assembleCommit(raw, 'weapons', change, DRIFT),
    imageAction: planActionText(change.image)
  }
}

export async function commitWeapon(
  rootPath: string,
  change: WeaponChange
): Promise<CommitResult> {
  try {
    const preview = await previewWeaponCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }
    if (change.image) await performImageOp(rootPath, change.image)
    await writeFile(datasetFile(rootPath, change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
