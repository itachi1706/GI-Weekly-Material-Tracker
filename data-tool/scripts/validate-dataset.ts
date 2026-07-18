/**
 * Read-only dataset validator. Scans every data file and reports data-integrity issues in one place:
 * formatting drift, empty-string images, off-convention banner times, character phase-vs-map
 * mismatches, malformed titles / markup leakage, broken cross-entity references (ERRORs), plus
 * missing image files on disk and stray `series: null` (WARNs).
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

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const dataDir = args.find((a) => !a.startsWith('--')) ?? join(import.meta.dirname, '..', 'dataset', 'data')
const imagesDir = join(dirname(dataDir), 'images')

type Severity = 'ERROR' | 'WARN'
interface Finding { severity: Severity; category: string; file: string; key: string; detail: string }
const findings: Finding[] = []
const add = (severity: Severity, category: string, file: string, key: string, detail: string) =>
  findings.push({ severity, category, file, key, detail })

// ── Load ────────────────────────────────────────────────────────────────────────
const files = readdirSync(dataDir).filter(
  (f) =>
    (f.startsWith('Characters-') || f.startsWith('Weapons-') || f.startsWith('Outfits-') ||
      f.startsWith('Materials-') || f === 'EventBanners.json') && f.endsWith('.json')
)

interface Parsed { file: string; raw: string; data: Record<string, unknown> }
const parsed: Parsed[] = []
for (const file of files) {
  const raw = readFileSync(join(dataDir, file), 'utf-8')
  try {
    parsed.push({ file, raw, data: JSON.parse(raw) })
  } catch (e) {
    add('ERROR', 'invalid-json', file, '', `JSON parse failed: ${(e as Error).message}`)
  }
  // Formatting-drift gate (also catches invalid JSON).
  if (!roundTrips(raw)) add('ERROR', 'formatting-drift', file, '', 'does not round-trip (reformats untouched records on commit)')
}

const rootKey = (file: string): string =>
  file.startsWith('Characters-') ? 'characters' : file.startsWith('Weapons-') ? 'weapons'
    : file.startsWith('Outfits-') ? 'outfits' : 'materials'
const recordsOf = (p: Parsed): Record<string, Record<string, unknown>> =>
  (p.data[rootKey(p.file)] as Record<string, Record<string, unknown>>) ?? {}

// Global key sets for reference checks.
const keySet = (prefix: string): Set<string> => {
  const s = new Set<string>()
  for (const p of parsed) if (p.file.startsWith(prefix)) for (const k of Object.keys(recordsOf(p))) s.add(k)
  return s
}
const characterKeys = keySet('Characters-')
const weaponKeys = keySet('Weapons-')
const outfitKeys = keySet('Outfits-')
const materialKeys = keySet('Materials-')

// ── Shared helpers ────────────────────────────────────────────────────────────────
const MARKUP = /\[\[|\]\]|\{\{|\}\}|<!--|<br|\|\s*\w+\s*=/ // wiki links/templates/comments/br + "|param =" leak
const TITLE_BAD = /[[\]{}|<>]/

/** Flag a text field if it carries wiki markup or param-leak garbage (e.g. "|affiliation = …"). */
const checkText = (file: string, key: string, field: string, val: unknown): void => {
  if (typeof val === 'string' && MARKUP.test(val)) add('ERROR', 'text-hygiene', file, key, `${field}: markup/garbage — ${JSON.stringify(val.slice(0, 60))}`)
}
/** image === "" is a bug; null and bare-folder ("…/") placeholders are allowed. */
const checkImage = (file: string, key: string, field: string, val: unknown): void => {
  if (val === '') { add('ERROR', 'empty-image', file, key, `${field} is "" (use a real path or null)`); return }
  if (typeof val !== 'string' || !val || val.endsWith('/')) return
  if (!existsSync(join(imagesDir, val))) add('WARN', 'missing-image', file, key, `${field}: file not found — ${val}`)
}
const refCheck = (file: string, key: string, field: string, val: unknown, set: Set<string>, kind: string): void => {
  if (typeof val === 'string' && val && !set.has(val)) add('ERROR', 'broken-ref', file, key, `${field} → unknown ${kind} "${val}"`)
}
const refCheckArr = (file: string, key: string, field: string, arr: unknown, set: Set<string>, kind: string): void => {
  if (Array.isArray(arr)) for (const v of arr) refCheck(file, key, field, v, set, kind)
}

const TEXT_FIELDS = ['name', 'fullName', 'caption', 'nation', 'affiliation', 'constellation',
  'description', 'introduction', 'effect', 'effectName', 'lore', 'obtained', 'series']

// Character/weapon material maps + phases share this check.
const checkMaterialMapAndPhases = (
  file: string, key: string, rec: Record<string, unknown>, mapName: 'ascension' | 'talents', phases: unknown
): void => {
  const map = ((rec.materials as Record<string, Record<string, string>> | undefined)?.[mapName]) ?? {}
  for (const [slot, matKey] of Object.entries(map)) refCheck(file, key, `materials.${mapName}.${slot}`, matKey, materialKeys, 'material')
  if (!phases || typeof phases !== 'object') return
  for (const [pk, phase] of Object.entries(phases as Record<string, Record<string, unknown>>)) {
    for (const n of [1, 2, 3, 4]) {
      const type = phase[`material${n}type`] as string | null | undefined
      const name = phase[`material${n}`] as string | null | undefined
      if (name) refCheck(file, key, `${mapName}[${pk}].material${n}`, name, materialKeys, 'material')
      if (!type) continue
      if (!(type in map)) { add('ERROR', 'phase-slot', file, key, `${mapName}[${pk}].material${n}type "${type}" not in materials.${mapName} map`); continue }
      const mapped = map[type]
      if (mapped && mapped.length && name !== mapped)
        add('ERROR', 'phase-vs-map', file, key, `${mapName}[${pk}].material${n} = "${name}" but materials.${mapName}.${type} = "${mapped}" (map is source of truth)`)
    }
  }
}

// ── Per-entity checks ─────────────────────────────────────────────────────────────
for (const p of parsed) {
  const { file } = p
  if (file === 'EventBanners.json') continue

  for (const [key, rec] of Object.entries(recordsOf(p))) {
    for (const f of TEXT_FIELDS) checkText(file, key, f, rec[f])

    if (file.startsWith('Characters-')) {
      checkImage(file, key, 'image', rec.image)
      if (Array.isArray(rec.titles)) rec.titles.forEach((t, i) => {
        if (typeof t === 'string' && (TITLE_BAD.test(t) || MARKUP.test(t))) add('ERROR', 'malformed-title', file, key, `titles[${i}] — ${JSON.stringify(t)}`)
      })
      refCheckArr(file, key, 'outfits', rec.outfits, outfitKeys, 'outfit')
      const talents = rec.talents as Record<string, unknown> | undefined
      for (const grp of ['attack', 'passives'] as const)
        for (const [tk, e] of Object.entries((talents?.[grp] as Record<string, Record<string, unknown>>) ?? {}))
          checkImage(file, key, `talents.${grp}.${tk}.image`, e.image)
      for (const [ck, c] of Object.entries((rec.constellations as Record<string, Record<string, unknown>>) ?? {}))
        checkImage(file, key, `constellations.${ck}.image`, c.image)
      checkMaterialMapAndPhases(file, key, rec, 'ascension', rec.ascension)
      checkMaterialMapAndPhases(file, key, rec, 'talents', (rec.talents as Record<string, unknown>)?.ascension)
    } else if (file.startsWith('Weapons-')) {
      checkImage(file, key, 'image', rec.image)
      if (rec.series === null) add('WARN', 'series-null', file, key, 'series is null (convention: omit when empty)')
      const map = ((rec.materials as Record<string, Record<string, string>> | undefined)?.ascension) ?? {}
      for (const [slot, matKey] of Object.entries(map)) refCheck(file, key, `materials.ascension.${slot}`, matKey, materialKeys, 'material')
      for (const [pk, phase] of Object.entries((rec.ascension as Record<string, Record<string, unknown>>) ?? {}))
        for (const n of [1, 2, 3]) refCheck(file, key, `ascension[${pk}].material${n}`, phase[`material${n}`], materialKeys, 'material')
    } else if (file.startsWith('Outfits-')) {
      for (const f of ['image', 'thumbnail', 'wishimage']) checkImage(file, key, f, rec[f])
      refCheck(file, key, 'character', rec.character, characterKeys, 'character')
      refCheckArr(file, key, 'characters', rec.characters, characterKeys, 'character')
    } else { // Materials-
      checkImage(file, key, 'image', rec.image)
    }
  }
}

// ── Banners (array-based) ──────────────────────────────────────────────────────────
const bannerFile = parsed.find((p) => p.file === 'EventBanners.json')
if (bannerFile) {
  const groups = (bannerFile.data.banners as Record<string, unknown>) ?? {}
  for (const [type, arr] of Object.entries(groups)) {
    if (type === 'template' || !Array.isArray(arr)) continue
    arr.forEach((b: Record<string, unknown>, i) => {
      const key = `${type}[${i}] ${b.name ?? ''}`.trim()
      checkText('EventBanners.json', key, 'name', b.name)
      checkText('EventBanners.json', key, 'description', b.description)
      checkImage('EventBanners.json', key, 'image', b.image)
      if (typeof b.start === 'string' && !/T\d{2}:00:00\+08$/.test(b.start)) add('ERROR', 'banner-time', 'EventBanners.json', key, `start off-convention — ${b.start}`)
      if (typeof b.end === 'string' && !/T\d{2}:59:59\+08$/.test(b.end)) add('ERROR', 'banner-time', 'EventBanners.json', key, `end off-convention — ${b.end}`)
      refCheckArr('EventBanners.json', key, 'characters', b.characters, characterKeys, 'character')
      refCheckArr('EventBanners.json', key, 'rateupcharacters', b.rateupcharacters, characterKeys, 'character')
      refCheckArr('EventBanners.json', key, 'weapons', b.weapons, weaponKeys, 'weapon')
      refCheckArr('EventBanners.json', key, 'rateupweapon', b.rateupweapon, weaponKeys, 'weapon')
    })
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────────
const CAP = 12
const byCat = new Map<string, Finding[]>()
for (const f of findings) {
  if (!byCat.has(f.category)) byCat.set(f.category, [])
  byCat.get(f.category)!.push(f)
}
const errorCount = findings.filter((f) => f.severity === 'ERROR').length
const warnCount = findings.length - errorCount

const order = [...byCat.keys()].sort((a, b) => {
  const sev = (c: string) => (byCat.get(c)!.some((f) => f.severity === 'ERROR') ? 0 : 1)
  return sev(a) - sev(b) || a.localeCompare(b)
})
for (const cat of order) {
  const list = byCat.get(cat)!
  const sev = list.some((f) => f.severity === 'ERROR') ? 'ERROR' : 'WARN'
  console.log(`\n[${sev}] ${cat} (${list.length})`)
  for (const f of list.slice(0, CAP)) console.log(`  ${f.file} :: ${f.key} — ${f.detail}`)
  if (list.length > CAP) console.log(`  …and ${list.length - CAP} more`)
}

console.log(`\nScanned ${files.length} files. ${errorCount} error(s), ${warnCount} warning(s).`)
if (errorCount === 0 && warnCount === 0) console.log('✓ Dataset is clean.')
if (errorCount > 0 || (strict && warnCount > 0)) process.exit(1)
