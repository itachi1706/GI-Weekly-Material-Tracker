/**
 * End-to-end check of the Materials commit logic (ordering + serialize + schema) against the real
 * Local_Specialities file. Run: npm run test:materials
 *
 * Exercises the same shared functions the IPC layer uses, so it validates the highest-risk path
 * (clean diffs, correct insertion, field order, usage reset) without the Electron GUI.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { diffLines } from 'diff'
import { applyFormValues, deriveKey, getMaterialSchema } from '../src/shared/materialsSchema.ts'
import { insertRecord, removeRecord } from '../src/shared/ordering.ts'
import { stringifyDataFile, withTrailingNewline } from '../src/shared/serialize.ts'

const root = join(import.meta.dirname, '..', 'dataset')
const file = join(root, 'data', 'Materials-Local_Specialities.json')
const templatesFile = join(root, 'templates', 'materials.json')

const raw = readFileSync(file, 'utf-8')
const parsed = JSON.parse(raw)
const schema = getMaterialSchema('local_speciality')!
let failures = 0
const ok = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures++
}

function serialize(p: unknown): string {
  return withTrailingNewline(stringifyDataFile(p), raw)
}
function changedLineCount(a: string, b: string): number {
  return diffLines(a, b).reduce((n, p) => n + (p.added || p.removed ? (p.count ?? 0) : 0), 0)
}

// --- 1. EDIT: change `obtained` on the first record -> exactly 1 changed line (+1 added, the new value)
const firstKey = Object.keys(parsed.materials)[0]
const editBase = parsed.materials[firstKey]
const editedRec = applyFormValues(editBase, schema, {
  name: editBase.name,
  type: editBase.type,
  image: editBase.image,
  description: editBase.description,
  obtained: '- EDITED FOR TEST',
  wiki: editBase.wiki,
  hoyowiki: editBase.hoyowiki,
  released: editBase.released
})
const editedFile = serialize({
  ...parsed,
  materials: insertRecord(parsed.materials, firstKey, editedRec, 'alphabetical')
})
ok(
  changedLineCount(raw, editedFile) === 2,
  `edit of "${firstKey}" obtained touches exactly 2 lines (1 removed + 1 added), got ${changedLineCount(raw, editedFile)}`
)
ok(JSON.parse(editedFile).materials[firstKey].obtained === '- EDITED FOR TEST', 'edit applied')
ok(
  Object.keys(JSON.parse(editedFile).materials).join() ===
    Object.keys(parsed.materials).join(),
  'edit preserves key order'
)

// --- 2. CREATE: new "Zzz Test Speciality" from the template -> inserted alphabetically (at the end)
const templates = JSON.parse(readFileSync(templatesFile, 'utf-8'))
const templateBase = templates[schema.templateKey]
const newKey = deriveKey('Zzz Test Speciality')
const newRec = applyFormValues(templateBase, schema, {
  name: 'Zzz Test Speciality',
  type: 'Local Speciality (Mondstadt)',
  image: `Materials/Local_Specialities/Item_${newKey}.png`,
  description: 'A test material.',
  obtained: '- Found in tests',
  wiki: null,
  hoyowiki: '',
  released: true
})
const created = insertRecord(parsed.materials, newKey, newRec, 'alphabetical')
const createdFile = serialize({ ...parsed, materials: created })
const createdParsed = JSON.parse(createdFile)
ok(newKey in createdParsed.materials, `created key "${newKey}" present`)
ok(
  Object.keys(createdParsed.materials).at(-1) === newKey,
  'new "Zzz" key inserted at the alphabetical end'
)
const cr = createdParsed.materials[newKey]
ok(
  JSON.stringify(cr.usage) === '{"characters":[],"weapons":[]}',
  'new record usage is empty (CI-computed)'
)
ok(cr.rarity === 1 && cr.innerType === 'local_speciality', 'new record rarity=1, innerType set')
ok(cr.hoyowiki === null, 'empty hoyowiki coerced to null')
ok(
  Object.keys(cr).join(',') ===
    'image,rarity,type,innerType,description,obtained,name,released,wiki,usage,hoyowiki,subCollection',
  `new record field order matches template (got: ${Object.keys(cr).join(',')})`
)

// --- 3. DELETE the created key -> reproduces the original bytes exactly
const deletedFile = serialize({ ...parsed, materials: removeRecord(created, newKey) })
ok(deletedFile === raw, 'create-then-delete round-trips to original bytes')

console.log('')
if (failures) {
  console.error(`${failures} check(s) failed.`)
  process.exit(1)
}
console.log('All materials commit checks passed.')
