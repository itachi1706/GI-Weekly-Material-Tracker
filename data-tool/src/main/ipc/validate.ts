import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { roundTrips } from '@shared/serialize'
import { validateDataset, isDataFile, type ValidationReport } from '@shared/validate'

/** Scan a dataset root (report-only) and return structured findings for the renderer. */
export function runValidation(rootPath: string): ValidationReport {
  const dataDir = join(rootPath, 'data')
  const imagesDir = join(rootPath, 'images')

  // A missing data/ dir (or a data path that isn't a directory) is a real problem, not a clean
  // dataset: report it as an ERROR finding rather than throwing (ENOTDIR would otherwise escape
  // readdirSync) or returning a "✓ clean" empty report.
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    return {
      findings: [
        {
          severity: 'ERROR',
          category: 'dataset',
          file: 'data/',
          key: '',
          detail: 'No data/ directory found under the dataset root — nothing to validate.'
        }
      ],
      fileCount: 0,
      errorCount: 1,
      warnCount: 0
    }
  }

  const names = readdirSync(dataDir).filter(isDataFile)
  const files = names.map((file) => ({ file, raw: readFileSync(join(dataDir, file), 'utf-8') }))

  const findings = validateDataset(files, {
    imageExists: (rel) => existsSync(join(imagesDir, rel)),
    roundTrips
  })

  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  return { findings, fileCount: names.length, errorCount, warnCount: findings.length - errorCount }
}
