/**
 * One-time formatting normalizer. Run with:
 *   npm run normalize:format -- <path-to-dataset/data>   (defaults to ./dataset/data)
 *   npm run normalize:format -- <path> --write            (apply; omit for a dry run)
 *
 * Why this exists: some data files were hand-edited over time with inconsistent array
 * formatting — e.g. character `titles`/`outfits` arrays are EXPANDED in ~88% of records but
 * INLINE in a handful of newer ones. The serializer (`stringifyDataFile`) emits a single
 * canonical form (expanded), so those straggler records fail the round-trip gate, which blocks
 * commits to the whole file. Running this once rewrites each file through the serializer so it
 * matches canonical form; the only changes are formatting (semantically identical — the content
 * survives JSON.parse unchanged). After this, `npm run test:roundtrip` passes and edits produce
 * minimal diffs.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { stringifyDataFile, withTrailingNewline } from '../src/shared/serialize.ts'
import { resolveDataDir } from './paths.ts'

const args = process.argv.slice(2)
const write = args.includes('--write')
const dataDir = resolveDataDir(args.find((a) => !a.startsWith('--')), 'dataset/data')

const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))
let changed = 0

for (const f of files) {
  const path = join(dataDir, f)
  const raw = readFileSync(path, 'utf-8')
  let norm: string
  try {
    norm = withTrailingNewline(stringifyDataFile(JSON.parse(raw)), raw)
  } catch {
    console.log(`SKIP  ${f} (not valid JSON)`)
    continue
  }
  if (norm === raw) continue
  changed++
  const delta = norm.split('\n').length - raw.split('\n').length
  console.log(`${write ? 'WROTE' : 'WOULD REWRITE'}  ${f}  (${delta >= 0 ? '+' : ''}${delta} lines)`)
  if (write) writeFileSync(path, norm)
}

console.log('')
if (!changed) console.log('All files already canonical — nothing to do.')
else if (write) console.log(`Normalized ${changed} file(s). Review the diff, then commit.`)
else console.log(`${changed} file(s) would change. Re-run with --write to apply.`)
