import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ENTITIES, REQUIRED_SUBFOLDERS } from '@shared/entities'
import type { DatasetInfo, EntitySummary } from '@shared/types'

async function isDir(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** Count records in a parsed file for a given entity (banners sum their per-type arrays). */
function countRecords(json: unknown, rootKey: string, isBanners: boolean): number {
  const root = (json as Record<string, unknown> | null)?.[rootKey]
  if (!root || typeof root !== 'object') return 0
  if (isBanners) {
    return Object.values(root as Record<string, unknown>).reduce<number>(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    )
  }
  return Object.keys(root as Record<string, unknown>).length
}

/**
 * Validates that `rootPath` is a dataset folder and, if so, scans data/ for each entity's
 * files and record counts. Read-only; this also serves as the load path for future milestones.
 */
export async function scanDataset(rootPath: string): Promise<DatasetInfo> {
  const missing: string[] = []
  for (const sub of REQUIRED_SUBFOLDERS) {
    if (!(await isDir(join(rootPath, sub)))) missing.push(sub)
  }
  if (missing.length > 0) {
    return { valid: false, rootPath, missing, entities: [] }
  }

  const dataDir = join(rootPath, 'data')
  const dataFiles = (await readdir(dataDir)).filter((f) => f.endsWith('.json'))

  const entities: EntitySummary[] = []
  for (const ent of ENTITIES) {
    const files = (
      ent.singleFile
        ? dataFiles.filter((f) => f === ent.singleFile)
        : dataFiles.filter((f) => f.startsWith(ent.filePrefix ?? ''))
    ).sort((a, b) => a.localeCompare(b))

    let recordCount = 0
    for (const file of files) {
      try {
        const json = JSON.parse(await readFile(join(dataDir, file), 'utf-8'))
        recordCount += countRecords(json, ent.rootKey, ent.key === 'banners')
      } catch {
        // Unparseable file contributes 0; surfaced as a low count rather than a hard failure.
      }
    }
    entities.push({ key: ent.key, label: ent.label, files, recordCount })
  }

  return { valid: true, rootPath, missing: [], entities }
}
