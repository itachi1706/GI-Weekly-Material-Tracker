/**
 * Read-only dataset validator (CLI). Thin wrapper over the shared rules in src/shared/validate.ts —
 * the same logic backs the in-app Validation view, so the two can never drift.
 *
 * Run:  node scripts/validate-dataset.ts [dataDir] [--strict]
 *   dataDir  optional; defaults to the bundled dataset/data. images/ is resolved as its sibling.
 *   --strict make WARNs also fail the run (default: only ERRORs set exit code 1).
 *
 * Report-only — never writes. Fix findings in the canonical data by hand (the phase-vs-map bug in
 * particular can't be safely auto-fixed: sometimes the MAP is the wrong side, not the phase).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { roundTrips } from '../src/shared/serialize.ts'
import { validateDataset, formatReport, isDataFile } from '../src/shared/validate.ts'
import { resolveDataDir } from './paths.ts'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const dataDir = resolveDataDir(args.find((a) => !a.startsWith('--')), 'dataset/data')
const imagesDir = join(dirname(dataDir), 'images')

const names = readdirSync(dataDir).filter(isDataFile)
const files = names.map((file) => ({ file, raw: readFileSync(join(dataDir, file), 'utf-8') }))

const findings = validateDataset(files, {
  imageExists: (rel) => existsSync(join(imagesDir, rel)),
  roundTrips
})

console.log(formatReport(findings, names.length))

const errorCount = findings.filter((f) => f.severity === 'ERROR').length
const warnCount = findings.length - errorCount
if (errorCount > 0 || (strict && warnCount > 0)) process.exit(1)
