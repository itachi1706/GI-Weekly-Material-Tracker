/**
 * Round-trip formatting gate. Run with: npm run test:roundtrip
 *
 * Asserts that re-serializing each Materials data file reproduces it byte-for-byte. This protects
 * against commits reformatting untouched records. `local_speciality` MUST pass (this milestone);
 * array-bearing files are reported but allowed to fail until the inline-array serializer lands.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { roundTrips } from '../src/shared/serialize.ts'

const dataDir = process.argv[2] ?? join(import.meta.dirname, '..', 'dataset', 'data')
const REQUIRED = 'Materials-Local_Specialities.json'

const files = readdirSync(dataDir).filter((f) => f.startsWith('Materials-') && f.endsWith('.json'))
let requiredOk = false
const deferred: string[] = []

for (const f of files) {
  const raw = readFileSync(join(dataDir, f), 'utf-8')
  const ok = roundTrips(raw)
  const tag = ok ? 'PASS' : 'DRIFT'
  console.log(`${tag}  ${f}`)
  if (f === REQUIRED) requiredOk = ok
  else if (!ok) deferred.push(f)
}

console.log('')
if (deferred.length) {
  console.log(`(deferred — need inline-array serializer: ${deferred.join(', ')})`)
}

if (!requiredOk) {
  console.error(`\nFAIL: ${REQUIRED} must round-trip byte-identical but did not.`)
  process.exit(1)
}
console.log(`\nOK: ${REQUIRED} round-trips byte-identical.`)
