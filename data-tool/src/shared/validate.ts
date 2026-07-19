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

const rootKey = (file: string): string =>
  file.startsWith('Characters-') ? 'characters' : file.startsWith('Weapons-') ? 'weapons'
    : file.startsWith('Outfits-') ? 'outfits' : 'materials'

/**
 * Run every check against the given files. Each file is `{ file, raw }`; parsing happens here so a
 * parse failure becomes an `invalid-json` finding rather than throwing.
 */
export function validateDataset(files: { file: string; raw: string }[], deps: ValidateDeps): Finding[] {
  const findings: Finding[] = []
  const add = (severity: Severity, category: string, file: string, key: string, detail: string): void => {
    findings.push({ severity, category, file, key, detail })
  }

  // ── Parse + formatting-drift gate ────────────────────────────────────────────────
  interface Parsed { file: string; data: Record<string, unknown> }
  const parsed: Parsed[] = []
  for (const { file, raw } of files) {
    try {
      parsed.push({ file, data: JSON.parse(raw) })
    } catch (e) {
      add('ERROR', 'invalid-json', file, '', `JSON parse failed: ${(e as Error).message}`)
    }
    if (!deps.roundTrips(raw)) add('ERROR', 'formatting-drift', file, '', 'does not round-trip (reformats untouched records on commit)')
  }

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

  // ── Shared per-field helpers ──────────────────────────────────────────────────────
  const checkText = (file: string, key: string, field: string, val: unknown): void => {
    if (typeof val === 'string' && MARKUP.test(val)) add('ERROR', 'text-hygiene', file, key, `${field}: markup/garbage — ${JSON.stringify(val.slice(0, 60))}`)
  }
  const checkImage = (file: string, key: string, field: string, val: unknown): void => {
    if (val === '') { add('ERROR', 'empty-image', file, key, `${field} is "" (use a real path or null)`); return }
    if (typeof val !== 'string' || !val || val.endsWith('/')) return
    if (!deps.imageExists(val)) add('WARN', 'missing-image', file, key, `${field}: file not found — ${val}`)
  }
  const refCheck = (file: string, key: string, field: string, val: unknown, set: Set<string>, kind: string): void => {
    if (typeof val === 'string' && val && !set.has(val)) add('ERROR', 'broken-ref', file, key, `${field} → unknown ${kind} "${val}"`)
  }
  const refCheckArr = (file: string, key: string, field: string, arr: unknown, set: Set<string>, kind: string): void => {
    if (Array.isArray(arr)) for (const v of arr) refCheck(file, key, field, v, set, kind)
  }

  // Character/weapon material maps + phases share this check.
  const checkMaterialMapAndPhases = (
    file: string, key: string, rec: Record<string, unknown>, mapName: 'ascension' | 'talents', phases: unknown
  ): void => {
    const map = ((rec.materials as Record<string, Record<string, string>> | undefined)?.[mapName]) ?? {}
    for (const [slot, matKey] of Object.entries(map)) refCheck(file, key, `materials.${mapName}.${slot}`, matKey, materialKeys, 'material')
    if (!phases || typeof phases !== 'object') return
    for (const [pk, phase] of Object.entries(phases as Record<string, Record<string, unknown>>)) {
      if (!phase || typeof phase !== 'object') continue
      for (const n of [1, 2, 3, 4]) {
        const type = phase[`material${n}type`] as string | null | undefined
        const name = phase[`material${n}`] as string | null | undefined
        if (name) refCheck(file, key, `${mapName}[${pk}].material${n}`, name, materialKeys, 'material')
        if (!type) continue
        if (!(type in map)) { add('ERROR', 'phase-slot', file, key, `${mapName}[${pk}].material${n}type "${type}" not in materials.${mapName} map`); continue }
        const mapped = map[type]
        if (mapped?.length && name !== mapped)
          add('ERROR', 'phase-vs-map', file, key, `${mapName}[${pk}].material${n} = "${name}" but materials.${mapName}.${type} = "${mapped}" (map is source of truth)`)
      }
    }
  }

  // ── Per-entity checks ───────────────────────────────────────────────────────────────
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

  // ── Banners (array-based) ────────────────────────────────────────────────────────────
  const bannerFile = parsed.find((p) => p.file === 'EventBanners.json')
  if (bannerFile) {
    const groups = (bannerFile.data.banners as Record<string, unknown>) ?? {}
    for (const [type, arr] of Object.entries(groups)) {
      if (type === 'template' || !Array.isArray(arr)) continue
      arr.forEach((b: Record<string, unknown> | null, i) => {
        if (!b || typeof b !== 'object') return
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
