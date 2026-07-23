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
import type {
  CharacterChange,
  CharacterRecord,
  CharacterSummary,
  CommitPreview,
  CommitResult
} from '@shared/types'

const CHARACTERS = ENTITIES.find((e) => e.key === 'characters')!
const DRIFT =
  'Target file does not round-trip under the current serializer; commit is blocked to avoid reformatting untouched records. Run `npm run normalize:format` against the dataset once to fix.'

export async function listCharacters(rootPath: string): Promise<CharacterSummary[]> {
  const out: CharacterSummary[] = []
  for (const file of await listEntityFiles(rootPath, CHARACTERS.filePrefix!)) {
    const { records } = await readEntityRecords<CharacterRecord>(rootPath, file, 'characters')
    for (const [key, rec] of Object.entries(records)) {
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
  const { records } = await readEntityRecords<CharacterRecord>(rootPath, file, 'characters')
  return records[key] ?? null
}

export async function listCharacterTemplates(
  rootPath: string
): Promise<Record<string, CharacterRecord>> {
  const path = join(rootPath, 'templates', 'characters.json')
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf-8'))
}

export async function previewCharacterCommit(
  rootPath: string,
  change: CharacterChange
): Promise<CommitPreview> {
  const { raw } = await readEntityRecords<CharacterRecord>(rootPath, change.file, 'characters')
  return {
    file: change.file,
    ...assembleCommit(raw, 'characters', change, DRIFT),
    imageAction: joinActionText([change.image, ...(change.images ?? [])])
  }
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
