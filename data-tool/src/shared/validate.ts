/**
 * Dataset validation rules — the single source of truth shared by the CLI
 * (`scripts/validate-dataset.ts`) and the in-app Validation view (`validate:run` IPC).
 *
 * Deliberately dependency-free: no `node:fs`, no `.ts`-extension imports. Environment concerns
 * (reading files, checking image existence, the round-trip serializer) are INJECTED via `deps`
 * so this module stays safe to bundle in both the Node main process and the renderer.
 */

export type Severity = 'ERROR' | 'WARN'
export interface Finding {
  severity: Severity
  category: string
  file: string
  key: string
  detail: string
}

/** Structured result returned to the renderer by the `validate:run` IPC. */
export interface ValidationReport {
  findings: Finding[]
  fileCount: number
  errorCount: number
  warnCount: number
}

export interface ValidateDeps {
  /** True if an image path (relative to the dataset's images/ folder) exists on disk. */
  imageExists: (relPath: string) => boolean
  /** The byte-identity round-trip gate from serialize.ts. */
  roundTrips: (raw: string) => boolean
}

/** File-name filter for the data files this validator scans. */
export const isDataFile = (name: string): boolean =>
  (name.startsWith('Characters-') || name.startsWith('Weapons-') || name.startsWith('Outfits-') ||
    name.startsWith('Materials-') || name === 'EventBanners.json') && name.endsWith('.json')

const MARKUP = /\[\[|\]\]|\{\{|\}\}|<!--|<br|\|\s*\w+\s*=/ // wiki links/templates/comments/br + "|param =" leak
const TITLE_BAD = /[[\]{}|<>]/
const TEXT_FIELDS = ['name', 'fullName', 'caption', 'nation', 'affiliation', 'constellation',
  'description', 'introduction', 'effect', 'effectName', 'lore', 'obtained', 'series']

const rootKey = (file: string): string => {
  if (file.startsWith('Characters-')) return 'characters'
  if (file.startsWith('Weapons-')) return 'weapons'
  if (file.startsWith('Outfits-')) return 'outfits'
  return 'materials'
}

/**
 * Shared closures + global key sets threaded through the per-entity checkers. Built once per
 * `validateDataset` run so the top-level helpers below stay small (SonarCloud S3776).
 */
interface ValidateCtx {
  add: (severity: Severity, category: string, file: string, key: string, detail: string) => void
  checkText: (file: string, key: string, field: string, val: unknown) => void
  checkImage: (file: string, key: string, field: string, val: unknown) => void
  refCheck: (file: string, key: string, field: string, val: unknown, set: Set<string>, kind: string) => void
  refCheckArr: (file: string, key: string, field: string, arr: unknown, set: Set<string>, kind: string) => void
  characterKeys: Set<string>
  weaponKeys: Set<string>
  outfitKeys: Set<string>
  materialKeys: Set<string>
}

type Rec = Record<string, unknown>

/** A single phase's context for slot checks (bundled to keep the arg count sane). */
interface PhaseCtx {
  file: string
  key: string
  mapName: string
  pk: string
  phase: Rec
  map: Record<string, string>
}

/** One ascension/talent phase slot: material ref + type-in-map + phase-vs-map consistency. */
function checkPhaseMaterialSlot(ctx: ValidateCtx, p: PhaseCtx, n: number): void {
  const { file, key, mapName, pk, phase, map } = p
  const type = phase[`material${n}type`] as string | null | undefined
  const name = phase[`material${n}`] as string | null | undefined
  if (name) ctx.refCheck(file, key, `${mapName}[${pk}].material${n}`, name, ctx.materialKeys, 'material')
  if (!type) return
  if (!(type in map)) {
    ctx.add('ERROR', 'phase-slot', file, key, `${mapName}[${pk}].material${n}type "${type}" not in materials.${mapName} map`)
    return
  }
  const mapped = map[type]
  if (mapped?.length && name !== mapped)
    ctx.add('ERROR', 'phase-vs-map', file, key, `${mapName}[${pk}].material${n} = "${name}" but materials.${mapName}.${type} = "${mapped}" (map is source of truth)`)
}

/** Character/weapon material maps + phases share this check. */
function checkMaterialMapAndPhases(
  ctx: ValidateCtx, file: string, key: string, rec: Rec, mapName: 'ascension' | 'talents', phases: unknown
): void {
  const map = ((rec.materials as Record<string, Record<string, string>> | undefined)?.[mapName]) ?? {}
  for (const [slot, matKey] of Object.entries(map)) ctx.refCheck(file, key, `materials.${mapName}.${slot}`, matKey, ctx.materialKeys, 'material')
  if (!phases || typeof phases !== 'object') return
  for (const [pk, phase] of Object.entries(phases as Record<string, Rec>)) {
    if (!phase || typeof phase !== 'object') continue
    for (const n of [1, 2, 3, 4]) checkPhaseMaterialSlot(ctx, { file, key, mapName, pk, phase, map }, n)
  }
}

function checkCharacterRecord(ctx: ValidateCtx, file: string, key: string, rec: Rec): void {
  ctx.checkImage(file, key, 'image', rec.image)
  if (Array.isArray(rec.titles)) rec.titles.forEach((t, i) => {
    if (typeof t === 'string' && (TITLE_BAD.test(t) || MARKUP.test(t))) ctx.add('ERROR', 'malformed-title', file, key, `titles[${i}] — ${JSON.stringify(t)}`)
  })
  ctx.refCheckArr(file, key, 'outfits', rec.outfits, ctx.outfitKeys, 'outfit')
  const talents = rec.talents as Record<string, unknown> | undefined
  for (const grp of ['attack', 'passives'] as const)
    for (const [tk, e] of Object.entries((talents?.[grp] as Record<string, Rec>) ?? {}))
      ctx.checkImage(file, key, `talents.${grp}.${tk}.image`, e.image)
  for (const [ck, c] of Object.entries((rec.constellations as Record<string, Rec>) ?? {}))
    ctx.checkImage(file, key, `constellations.${ck}.image`, c.image)
  checkMaterialMapAndPhases(ctx, file, key, rec, 'ascension', rec.ascension)
  checkMaterialMapAndPhases(ctx, file, key, rec, 'talents', (rec.talents as Rec)?.ascension)
}

function checkWeaponRecord(ctx: ValidateCtx, file: string, key: string, rec: Rec): void {
  ctx.checkImage(file, key, 'image', rec.image)
  if (rec.series === null) ctx.add('WARN', 'series-null', file, key, 'series is null (convention: omit when empty)')
  const map = ((rec.materials as Record<string, Record<string, string>> | undefined)?.ascension) ?? {}
  for (const [slot, matKey] of Object.entries(map)) ctx.refCheck(file, key, `materials.ascension.${slot}`, matKey, ctx.materialKeys, 'material')
  for (const [pk, phase] of Object.entries((rec.ascension as Record<string, Rec>) ?? {}))
    for (const n of [1, 2, 3]) ctx.refCheck(file, key, `ascension[${pk}].material${n}`, phase[`material${n}`], ctx.materialKeys, 'material')
}

function checkOutfitRecord(ctx: ValidateCtx, file: string, key: string, rec: Rec): void {
  for (const f of ['image', 'thumbnail', 'wishimage']) ctx.checkImage(file, key, f, rec[f])
  ctx.refCheck(file, key, 'character', rec.character, ctx.characterKeys, 'character')
  ctx.refCheckArr(file, key, 'characters', rec.characters, ctx.characterKeys, 'character')
}

/** Dispatch a single record to its entity-specific checks (all records get the text-field scan). */
function checkRecord(ctx: ValidateCtx, file: string, key: string, rec: Rec): void {
  for (const f of TEXT_FIELDS) ctx.checkText(file, key, f, rec[f])
  if (file.startsWith('Characters-')) checkCharacterRecord(ctx, file, key, rec)
  else if (file.startsWith('Weapons-')) checkWeaponRecord(ctx, file, key, rec)
  else if (file.startsWith('Outfits-')) checkOutfitRecord(ctx, file, key, rec)
  else ctx.checkImage(file, key, 'image', rec.image) // Materials-
}

/** Banner records live in per-type arrays under `banners`, not a keyed record map. */
function checkBanners(ctx: ValidateCtx, data: Record<string, unknown>): void {
  const groups = (data.banners as Record<string, unknown>) ?? {}
  for (const [type, arr] of Object.entries(groups)) {
    if (type === 'template' || !Array.isArray(arr)) continue
    arr.forEach((b: Rec | null, i) => {
      if (!b || typeof b !== 'object') return
      const key = `${type}[${i}] ${typeof b.name === 'string' ? b.name : ''}`.trim()
      ctx.checkText('EventBanners.json', key, 'name', b.name)
      ctx.checkText('EventBanners.json', key, 'description', b.description)
      ctx.checkImage('EventBanners.json', key, 'image', b.image)
      if (typeof b.start === 'string' && !/T\d{2}:00:00\+08$/.test(b.start)) ctx.add('ERROR', 'banner-time', 'EventBanners.json', key, `start off-convention — ${b.start}`)
      if (typeof b.end === 'string' && !/T\d{2}:59:59\+08$/.test(b.end)) ctx.add('ERROR', 'banner-time', 'EventBanners.json', key, `end off-convention — ${b.end}`)
      ctx.refCheckArr('EventBanners.json', key, 'characters', b.characters, ctx.characterKeys, 'character')
      ctx.refCheckArr('EventBanners.json', key, 'rateupcharacters', b.rateupcharacters, ctx.characterKeys, 'character')
      ctx.refCheckArr('EventBanners.json', key, 'weapons', b.weapons, ctx.weaponKeys, 'weapon')
      ctx.refCheckArr('EventBanners.json', key, 'rateupweapon', b.rateupweapon, ctx.weaponKeys, 'weapon')
    })
  }
}

interface ParsedFile { file: string; data: Record<string, unknown> }

/** Parse each file (a failure becomes an `invalid-json` finding) and gate formatting drift. */
function parseFiles(files: { file: string; raw: string }[], deps: ValidateDeps, add: ValidateCtx['add']): ParsedFile[] {
  const parsed: ParsedFile[] = []
  for (const { file, raw } of files) {
    try {
      parsed.push({ file, data: JSON.parse(raw) })
    } catch (e) {
      // Invalid JSON: report it and skip the drift check (a parse failure isn't a formatting drift).
      add('ERROR', 'invalid-json', file, '', `JSON parse failed: ${(e as Error).message}`)
      continue
    }
    if (!deps.roundTrips(raw)) add('ERROR', 'formatting-drift', file, '', 'does not round-trip (reformats untouched records on commit)')
  }
  return parsed
}

/**
 * Run every check against the given files. Each file is `{ file, raw }`; parsing happens here so a
 * parse failure becomes an `invalid-json` finding rather than throwing.
 */
export function validateDataset(files: { file: string; raw: string }[], deps: ValidateDeps): Finding[] {
  const findings: Finding[] = []
  const add: ValidateCtx['add'] = (severity, category, file, key, detail) => {
    findings.push({ severity, category, file, key, detail })
  }

  const parsed = parseFiles(files, deps, add)
  const recordsOf = (p: ParsedFile): Record<string, Rec> =>
    (p.data[rootKey(p.file)] as Record<string, Rec>) ?? {}

  // Global key sets for reference checks.
  const keySet = (prefix: string): Set<string> => {
    const s = new Set<string>()
    for (const p of parsed) if (p.file.startsWith(prefix)) for (const k of Object.keys(recordsOf(p))) s.add(k)
    return s
  }

  const checkText: ValidateCtx['checkText'] = (file, key, field, val) => {
    if (typeof val === 'string' && MARKUP.test(val)) add('ERROR', 'text-hygiene', file, key, `${field}: markup/garbage — ${JSON.stringify(val.slice(0, 60))}`)
  }
  const checkImage: ValidateCtx['checkImage'] = (file, key, field, val) => {
    if (val === '') { add('ERROR', 'empty-image', file, key, `${field} is "" (use a real path or null)`); return }
    if (typeof val !== 'string' || !val || val.endsWith('/')) return
    if (!deps.imageExists(val)) add('WARN', 'missing-image', file, key, `${field}: file not found — ${val}`)
  }
  const refCheck: ValidateCtx['refCheck'] = (file, key, field, val, set, kind) => {
    if (typeof val === 'string' && val && !set.has(val)) add('ERROR', 'broken-ref', file, key, `${field} → unknown ${kind} "${val}"`)
  }
  const refCheckArr: ValidateCtx['refCheckArr'] = (file, key, field, arr, set, kind) => {
    if (Array.isArray(arr)) for (const v of arr) refCheck(file, key, field, v, set, kind)
  }

  const ctx: ValidateCtx = {
    add, checkText, checkImage, refCheck, refCheckArr,
    characterKeys: keySet('Characters-'),
    weaponKeys: keySet('Weapons-'),
    outfitKeys: keySet('Outfits-'),
    materialKeys: keySet('Materials-')
  }

  for (const p of parsed) {
    if (p.file === 'EventBanners.json') continue
    for (const [key, rec] of Object.entries(recordsOf(p))) checkRecord(ctx, p.file, key, rec)
  }

  const bannerFile = parsed.find((p) => p.file === 'EventBanners.json')
  if (bannerFile) checkBanners(ctx, bannerFile.data)

  return findings
}

/** Group findings by category, ERRORs first, cap long groups — the CLI's text report. */
export function formatReport(findings: Finding[], fileCount: number, cap = 12): string {
  const byCat = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byCat.has(f.category)) byCat.set(f.category, [])
    byCat.get(f.category)!.push(f)
  }
  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  const warnCount = findings.length - errorCount

  const sevOf = (c: string): number => (byCat.get(c)!.some((f) => f.severity === 'ERROR') ? 0 : 1)
  const order = [...byCat.keys()].sort((a, b) => sevOf(a) - sevOf(b) || a.localeCompare(b))

  const lines: string[] = []
  for (const cat of order) {
    const list = byCat.get(cat)!
    const sev = list.some((f) => f.severity === 'ERROR') ? 'ERROR' : 'WARN'
    lines.push(`\n[${sev}] ${cat} (${list.length})`)
    for (const f of list.slice(0, cap)) lines.push(`  ${f.file} :: ${f.key} — ${f.detail}`)
    if (list.length > cap) lines.push(`  …and ${list.length - cap} more`)
  }
  lines.push(`\nScanned ${fileCount} files. ${errorCount} error(s), ${warnCount} warning(s).`)
  if (errorCount === 0 && warnCount === 0) lines.push('✓ Dataset is clean.')
  return lines.join('\n')
}
