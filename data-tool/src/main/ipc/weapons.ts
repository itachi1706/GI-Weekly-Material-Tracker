import { readFile, readdir, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { insertRecord, removeRecord, renameRecord } from '@shared/ordering'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import type {
  WeaponChange,
  WeaponRecord,
  WeaponSummary,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const WEAPONS = ENTITIES.find((e) => e.key === 'weapons')!

function dataDir(rootPath: string): string {
  return join(rootPath, 'data')
}
function imagesDir(rootPath: string): string {
  return join(rootPath, 'images')
}

async function weaponFiles(rootPath: string): Promise<string[]> {
  const files = await readdir(dataDir(rootPath))
  return files.filter((f) => f.startsWith(WEAPONS.filePrefix!) && f.endsWith('.json')).sort()
}

async function readWeaponRecords(
  rootPath: string,
  file: string
): Promise<{ raw: string; parsed: { weapons: Record<string, WeaponRecord> } }> {
  const path = join(dataDir(rootPath), file)
  if (!existsSync(path)) {
    return { raw: '', parsed: { weapons: {} } }
  }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!parsed.weapons || typeof parsed.weapons !== 'object') parsed.weapons = {}
  return { raw, parsed }
}

export async function listWeapons(rootPath: string): Promise<WeaponSummary[]> {
  const out: WeaponSummary[] = []
  for (const file of await weaponFiles(rootPath)) {
    const { parsed } = await readWeaponRecords(rootPath, file)
    for (const [key, rec] of Object.entries(parsed.weapons)) {
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
  const { parsed } = await readWeaponRecords(rootPath, file)
  return parsed.weapons[key] ?? null
}

export async function listWeaponTemplates(rootPath: string): Promise<Record<string, WeaponRecord>> {
  const path = join(rootPath, 'templates', 'weapons.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

function applyChange(
  records: Record<string, WeaponRecord>,
  change: WeaponChange
): Record<string, WeaponRecord> {
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

export async function previewWeaponCommit(
  rootPath: string,
  change: WeaponChange
): Promise<CommitPreview> {
  const { raw } = await readWeaponRecords(rootPath, change.file)
  const parsed = raw ? JSON.parse(raw) : { weapons: {} }
  const before = raw

  const nextWeapons = applyChange(parsed.weapons ?? {}, change)
  const nextParsed = { ...parsed, weapons: nextWeapons }
  const reference = before || '\n'
  const after = withTrailingNewline(stringifyDataFile(nextParsed), reference)

  return {
    file: change.file,
    before,
    after,
    imageAction: planActionText(change.image),
    formattingDriftWarning:
      before && !roundTrips(before)
        ? 'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records.'
        : null
  }
}

async function performImageOp(rootPath: string, plan: ImagePlan): Promise<void> {
  if (plan.source === 'existing') return
  const dest = join(imagesDir(rootPath), plan.destRelative)
  const dest = join(imagesDir(rootPath), plan.destRelative)
  if (relative(imagesDir(rootPath), dest).startsWith('..')) {
    throw new Error('Path traversal detected')
  }
  await mkdir(dirname(dest), { recursive: true })
    await copyFile(plan.sourcePath, dest)
    return
  }
  const res = await fetch(plan.url)
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${plan.url}`)
  await writeFile(dest, Buffer.from(await res.arrayBuffer()))
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
    await writeFile(join(dataDir(rootPath), change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
