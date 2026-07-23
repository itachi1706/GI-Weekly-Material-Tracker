/**
 * Round-trip formatting gate. Run with: npm run test:roundtrip
 *
 * Every editable data file — Materials-*, Outfits-*, Weapons-*, Characters-* and EventBanners.json —
 * must re-serialize byte-for-byte under the inline-array serializer; any file that doesn't is blocked
 * from commits (a drift would reformat untouched records).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { roundTrips } from '../src/shared/serialize.ts'
import { resolveDataDir } from './paths.ts'

const dataDir = resolveDataDir(process.argv[2], 'dataset/data')

const files = readdirSync(dataDir).filter(
  (f) =>
    (f.startsWith('Materials-') ||
      f.startsWith('Outfits-') ||
      f.startsWith('Weapons-') ||
      f.startsWith('Characters-') ||
      f === 'EventBanners.json') &&
    f.endsWith('.json')
)
let failures = 0

for (const f of files) {
  const raw = readFileSync(join(dataDir, f), 'utf-8')
  const ok = roundTrips(raw)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}`)
  if (!ok) failures++
}

console.log('')
if (failures) {
  console.error(`${failures} file(s) failed round-trip. Commits to those files are blocked.`)
  process.exit(1)
}
console.log('All files round-trip byte-identical.')
