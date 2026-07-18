import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { roundTrips } from '@shared/serialize'
import { validateDataset, isDataFile, type ValidationReport } from '@shared/validate'

/** Scan a dataset root (report-only) and return structured findings for the renderer. */
export function runValidation(rootPath: string): ValidationReport {
  const dataDir = join(rootPath, 'data')
  const imagesDir = join(rootPath, 'images')

  const names = readdirSync(dataDir).filter(isDataFile)
  const files = names.map((file) => ({ file, raw: readFileSync(join(dataDir, file), 'utf-8') }))

  const findings = validateDataset(files, {
    imageExists: (rel) => existsSync(join(imagesDir, rel)),
    roundTrips
  })

  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  return { findings, fileCount: names.length, errorCount, warnCount: findings.length - errorCount }
}
