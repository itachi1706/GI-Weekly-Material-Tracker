import { readFile, readdir, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { ENTITIES } from '@shared/entities'
import { insertRecord, removeRecord, renameRecord } from '@shared/ordering'
import { stringifyDataFile, withTrailingNewline, roundTrips } from '@shared/serialize'
import { dataDir, datasetFile, imagePath } from './paths'
import type {
  CharacterChange,
  CharacterRecord,
  CharacterSummary,
  CommitPreview,
  CommitResult,
  ImagePlan
} from '@shared/types'

const CHARACTERS = ENTITIES.find((e) => e.key === 'characters')!

async function characterFiles(rootPath: string): Promise<string[]> {
  const files = await readdir(dataDir(rootPath))
  return files
    .filter((f) => f.startsWith(CHARACTERS.filePrefix!) && f.endsWith('.json'))
    .sort()
}

async function readCharacterRecords(
  rootPath: string,
  file: string
): Promise<{ raw: string; parsed: { characters: Record<string, CharacterRecord> } }> {
  const path = datasetFile(rootPath, file)
  if (!existsSync(path)) {
    return { raw: '', parsed: { characters: {} } }
  }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw)
  if (!parsed.characters || typeof parsed.characters !== 'object') parsed.characters = {}
  return { raw, parsed }
}

export async function listCharacters(rootPath: string): Promise<CharacterSummary[]> {
  const out: CharacterSummary[] = []
  for (const file of await characterFiles(rootPath)) {
    const { parsed } = await readCharacterRecords(rootPath, file)
    for (const [key, rec] of Object.entries(parsed.characters)) {
      out.push({
        key,
        file,
        name: String(rec.name ?? key),
        element: String(rec.element ?? ''),
        weapon: String(rec.weapon ?? ''),
        rarity: Number(rec.rarity ?? 4),
        image: String(rec.image ?? ''),
        released: Boolean(rec.released)
      })
    }
  }
  return out
}

export async function getCharacter(
  rootPath: string,
  file: string,
  key: string
): Promise<CharacterRecord | null> {
  const { parsed } = await readCharacterRecords(rootPath, file)
  return parsed.characters[key] ?? null
}

export async function listCharacterTemplates(
  rootPath: string
): Promise<Record<string, CharacterRecord>> {
  const path = join(rootPath, 'templates', 'characters.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

function applyChange(
  records: Record<string, CharacterRecord>,
  change: CharacterChange
): Record<string, CharacterRecord> {
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

export async function previewCharacterCommit(
  rootPath: string,
  change: CharacterChange
): Promise<CommitPreview> {
  const { raw } = await readCharacterRecords(rootPath, change.file)
  const parsed = raw ? JSON.parse(raw) : { characters: {} }
  const before = raw

  const nextCharacters = applyChange(parsed.characters ?? {}, change)
  const nextParsed = { ...parsed, characters: nextCharacters }
  const reference = before || '\n'
  const after = withTrailingNewline(stringifyDataFile(nextParsed), reference)

  const imageActions = [change.image, ...(change.images ?? [])]
    .map(planActionText)
    .filter((s): s is string => s !== null)

  return {
    file: change.file,
    before,
    after,
    imageAction: imageActions.length ? imageActions.join('\n') : null,
    formattingDriftWarning:
      before && !roundTrips(before)
        ? 'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records. Run `npm run normalize:format` against the dataset once to fix.'
        : null
  }
}

async function performImageOp(rootPath: string, plan: ImagePlan): Promise<void> {
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

export async function commitCharacter(
  rootPath: string,
  change: CharacterChange
): Promise<CommitResult> {
  try {
    const preview = await previewCharacterCommit(rootPath, change)
    if (preview.formattingDriftWarning) {
      return { ok: false, error: preview.formattingDriftWarning }
    }
    if (change.image) await performImageOp(rootPath, change.image)
    for (const plan of change.images ?? []) await performImageOp(rootPath, plan)
    await writeFile(datasetFile(rootPath, change.file), preview.after, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
