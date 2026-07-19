import { useEffect, useMemo, useState } from 'react'
import type {
  WeaponRecord, WeaponChange, WeaponAscensionPhase, ImagePlan, MaterialSummary, WikiWeaponResult
} from '@shared/types'
import { deriveKey } from '@shared/materialsSchema'
import ImageField from '../materials/ImageField'
import { extOf, sanitizeImageBasename, type ImageState } from '../materials/util'
import { MatImage, MaterialPickerPopup, findTierSet, roman } from '../shared/materialPicker'
import { RaritySelect } from '../shared/rarity'
import WikiFillPanel, { type WikiRow } from '../shared/WikiFillPanel'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from '../shared/wikiApply'

// ── Constants ─────────────────────────────────────────────────────────────────

const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'] as const
type WeaponType = typeof WEAPON_TYPES[number]

const SECONDARY_STAT_TYPES = [
  'ATK%', 'HP%', 'DEF%', 'CRIT Rate%', 'CRIT DMG%',
  'Elemental Mastery', 'Energy Recharge%', 'Physical DMG%',
] as const

// Wiki 2nd_stat_type vocab → this form's `%`-suffixed options (the `%` is intentional; see plan).
const STAT_TYPE_WIKI_TO_FORM: Record<string, string> = {
  ATK: 'ATK%', HP: 'HP%', DEF: 'DEF%',
  'CRIT Rate': 'CRIT Rate%', 'CRIT DMG': 'CRIT DMG%',
  'Energy Recharge': 'Energy Recharge%', 'Physical DMG Bonus': 'Physical DMG%',
  'Elemental Mastery': 'Elemental Mastery'
}

function matSlotKeys(rarity: number): string[] {
  if (rarity <= 2) {
    return ['common1', 'common2', 'forgery1', 'forgery2', 'forgery3', 'elite1', 'elite2']
  }
  return ['common1', 'common2', 'common3', 'forgery1', 'forgery2', 'forgery3', 'forgery4', 'elite1', 'elite2', 'elite3']
}

function fileForType(type: string): string {
  return `Weapons-${type}.json`
}

const PREFIX_TO_FILE_KEYWORD: Record<string, string> = {
  forgery: 'Forgery',
  elite:   'Elite',
  common:  'Common',
}
const PREFIX_TIER_SIZE: Record<string, number> = { forgery: 4, elite: 3, common: 3 }

// Expected rarity for a given slot: forgery1→2, elite1→2, common1→1, etc.
function slotExpectedRarity(slotKey: string): number {
  const m = /^(forgery|elite|common)(\d+)$/.exec(slotKey)
  if (!m) return -1
  return m[1] === 'common' ? Number(m[2]) : Number(m[2]) + 1
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function buildImageEntry(
  state: ImageState,
  folder: string,
  defaultName: string
): { path: string | null; plan: ImagePlan | undefined } {
  if (state.mode === 'existing') {
    return { path: state.relative, plan: { source: 'existing', relativePath: state.relative } }
  }
  if (state.mode === 'localFile') {
    const ext = extOf(state.sourcePath)
    const name = state.imageName?.trim() ? `${state.imageName.trim()}.${ext}` : `${defaultName}.${ext}`
    const path = `${folder}/${name}`
    return { path, plan: { source: 'localFile', sourcePath: state.sourcePath, destRelative: path } }
  }
  if (state.mode === 'url') {
    const ext = extOf(state.url)
    const name = state.imageName?.trim() ? `${state.imageName.trim()}.${ext}` : `${sanitizeImageBasename(state.url)}.${ext}`
    const path = `${folder}/${name}`
    return { path, plan: { source: 'url', url: state.url, destRelative: path } }
  }
  return { path: null, plan: undefined }
}

function stateFromPath(path: string | null | undefined): ImageState {
  return path ? { mode: 'existing', relative: String(path) } : { mode: 'none' }
}

// ── Draft types ───────────────────────────────────────────────────────────────

interface AscPhase {
  level: number
  mora: number
  mat1qty: number   // forgery
  mat2qty: number   // elite
  mat3qty: number   // common
  mat1type: string
  mat2type: string
  mat3type: string
}

interface Draft {
  name: string
  keyOverride: string
  keyTouched: boolean
  file: string
  type: WeaponType
  rarity: string
  series: string
  description: string
  obtained: string
  baseAtk: string
  maxBaseAtk: string
  secondaryStatType: string
  secondaryStat: string
  maxSecondaryStat: string
  effectName: string
  effect: string
  imageState: ImageState
  released: boolean
  wiki: string
  hoyowiki: string
  matSlots: Record<string, string>
  phases: AscPhase[]
}

function phasesFromRecord(ascension: WeaponRecord['ascension'] | undefined): AscPhase[] {
  if (!ascension) return []
  return Object.values(ascension).map((p) => ({
    level: p.level, mora: p.mora,
    mat1qty: p.material1qty, mat2qty: p.material2qty, mat3qty: p.material3qty,
    mat1type: p.material1type, mat2type: p.material2type, mat3type: p.material3type,
  }))
}

function draftFromRecord(rec: WeaponRecord, defaultFile?: string, existingKey?: string): Draft {
  const type = (WEAPON_TYPES.includes(rec.type as WeaponType) ? rec.type : 'Sword') as WeaponType
  const file = defaultFile ?? fileForType(type)
  return {
    name: String(rec.name ?? ''),
    keyOverride: existingKey ?? '',
    keyTouched: !!existingKey,
    file,
    type,
    rarity: String(rec.rarity ?? 3),
    series: String(rec.series ?? ''),
    description: String(rec.description ?? ''),
    obtained: String(rec.obtained ?? 'Gacha'),
    baseAtk: rec.base_atk != null ? String(rec.base_atk) : '',
    maxBaseAtk: rec.max_base_atk != null ? String(rec.max_base_atk) : '',
    secondaryStatType: String(rec.secondary_stat_type ?? ''),
    secondaryStat: String(rec.secondary_stat ?? ''),
    maxSecondaryStat: String(rec.max_secondary_stat ?? ''),
    effectName: String(rec.effectName ?? ''),
    effect: String(rec.effect ?? ''),
    imageState: stateFromPath(rec.image),
    released: Boolean(rec.released),
    wiki: String(rec.wiki ?? ''),
    hoyowiki: rec.hoyowiki != null ? String(rec.hoyowiki) : '',
    matSlots: { ...((rec.materials?.ascension ?? {}) as Record<string, string>) },
    phases: phasesFromRecord(rec.ascension),
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rootPath: string
  mode: 'create' | 'edit'
  template: WeaponRecord
  originalKey?: string
  file?: string
  onPreview: (change: WeaponChange) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeaponForm({
  rootPath, mode, template, originalKey, file, onPreview, onDelete, onCancel
}: Readonly<Props>) {
  const [draft, setDraft] = useState<Draft>(() =>
    draftFromRecord(template, file, originalKey)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [matSummaries, setMatSummaries] = useState<MaterialSummary[]>([])
  const [templates, setTemplates] = useState<Record<string, WeaponRecord>>({})
  const [pickerState, setPickerState] = useState<{ slotKey: string; prefix: string } | null>(null)
  // Wiki auto-fill (URL box hidden behind a header toggle; open by default when creating).
  const [showWiki, setShowWiki] = useState(mode === 'create')
  const [wikiUrl, setWikiUrl] = useState('')
  const [wikiBusy, setWikiBusy] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiWeaponResult | null>(null)

  const matSummaryMap = useMemo(
    () => new Map(matSummaries.map((m) => [m.key, m])),
    [matSummaries]
  )

  useEffect(() => { void window.api.materials.list(rootPath).then(setMatSummaries) }, [rootPath])

  useEffect(() => {
    if (mode === 'create') void window.api.weapons.templates(rootPath).then(setTemplates)
  }, [rootPath, mode])

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const currentKey = draft.keyTouched && draft.keyOverride.trim()
    ? draft.keyOverride.trim()
    : deriveKey(draft.name)

  const imageFolder = `Weapons/${draft.type}`
  const phaseCount = Number(draft.rarity) <= 2 ? 4 : 6

  const applyTemplate = (type: WeaponType, rarity: string) => {
    const tpl = templates[`${type}_${rarity}`]
    if (!tpl) return
    setDraft((p) => ({
      ...p, type, rarity, file: fileForType(type),
      matSlots: { ...((tpl.materials?.ascension ?? {}) as Record<string, string>) },
      phases: phasesFromRecord(tpl.ascension),
    }))
  }

  // ── Mat slot helpers ─────────────────────────────────────────────────────────

  const openPicker = (slotKey: string) => {
    setPickerState({ slotKey, prefix: slotKey.replace(/\d+$/, '') })
  }

  const setMatSlot = (key: string, val: string) => {
    setDraft((p) => ({ ...p, matSlots: { ...p.matSlots, [key]: val } }))
  }

  const handlePickerSelect = (key: string) => {
    if (!pickerState) return
    const { prefix } = pickerState
    const newSlots = { ...draft.matSlots, [pickerState.slotKey]: key }
    // Autofill other tiers in the same set
    const tierFill = findTierSet(matSummaries, key, PREFIX_TO_FILE_KEYWORD[prefix] ?? '', PREFIX_TIER_SIZE[prefix] ?? 0, prefix)
    if (tierFill) Object.assign(newSlots, tierFill)
    setDraft((p) => ({ ...p, matSlots: newSlots }))
    setPickerState(null)
  }

  // ── Wiki auto-fill ─────────────────────────────────────────────────────────────

  const fetchWeaponWiki = () => {
    const url = wikiUrl.trim() || draft.wiki.trim()
    if (!url) { setWikiError('Paste a Genshin Wiki weapon URL first.'); return }
    setWikiBusy(true)
    setWikiError(null)
    window.api.wiki
      .fetchWeapon(url)
      .then((r) => { setWikiResult(r); setWikiUrl(url) })
      .catch((e: unknown) => setWikiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWikiBusy(false))
  }

  // Build review rows + id→Draft mutation map (grouped Identity/Stats/Effect/Image). Apply fns are
  // simple field writes since the Draft is flat. Recomputed from the current draft so "current" stays
  // accurate; nothing writes to disk — only into the Draft, still gated by the commit preview.
  const wikiData = useMemo(() => {
    const res = wikiResult
    const rows: WikiRow[] = []
    const apply: Record<string, (d: Draft) => Draft> = {}
    if (!res) return { rows, apply }

    const add = (
      row: Omit<WikiRow, 'changed'> & { changed?: boolean },
      fn?: (d: Draft) => Draft
    ) => {
      const changed = row.changed ?? (!!row.fetched.trim() && !eqi(row.fetched, row.current))
      rows.push({ ...row, changed })
      if (fn) apply[row.id] = fn
    }
    const field = (
      id: string, group: string, label: string, current: string, fetched: string | null,
      fn: (d: Draft, v: string) => Draft
    ) => {
      const v = fetched ?? ''
      if (!v) return
      add({ id, group, label, current, fetched: v }, (d) => fn(d, v))
    }
    const numStr = (n: number | null): string => (n != null ? String(n) : '')

    // Identity
    field('w-name', 'Identity', 'Name', draft.name, res.name, (d, v) => ({
      ...d, name: v, ...(d.keyTouched ? {} : { keyOverride: deriveKey(v) })
    }))
    field('w-series', 'Identity', 'Series', draft.series, res.series, (d, v) => ({ ...d, series: v }))
    field('w-desc', 'Identity', 'Description', draft.description, res.description, (d, v) => ({ ...d, description: v }))
    // Confirmation-only (locked): type + rarity
    const confirm = (id: string, label: string, current: string, fetched: string | null) => {
      if (!fetched) return
      add({ id, group: 'Identity', label, current, fetched, confirmOnly: true, ok: eqi(current, fetched), changed: false })
    }
    confirm('w-type', 'Type (locked)', draft.type, res.type)
    confirm('w-rarity', 'Rarity (locked)', draft.rarity, res.rarity != null ? String(res.rarity) : null)

    // Stats
    field('w-batk', 'Stats', 'Base ATK', draft.baseAtk, numStr(res.baseAtk), (d, v) => ({ ...d, baseAtk: v }))
    field('w-mbatk', 'Stats', 'Max base ATK', draft.maxBaseAtk, numStr(res.maxBaseAtk), (d, v) => ({ ...d, maxBaseAtk: v }))
    if (res.secondaryStatType) {
      const mapped = STAT_TYPE_WIKI_TO_FORM[res.secondaryStatType] ?? res.secondaryStatType
      add({ id: 'w-stype', group: 'Stats', label: 'Secondary stat type', current: draft.secondaryStatType, fetched: mapped },
        (d) => ({ ...d, secondaryStatType: mapped }))
    }
    field('w-sstat', 'Stats', 'Secondary stat', draft.secondaryStat, res.secondaryStat, (d, v) => ({ ...d, secondaryStat: v }))
    field('w-msstat', 'Stats', 'Max secondary stat', draft.maxSecondaryStat, res.maxSecondaryStat, (d, v) => ({ ...d, maxSecondaryStat: v }))

    // Effect
    field('w-effname', 'Effect', 'Effect name', draft.effectName, res.effectName, (d, v) => ({ ...d, effectName: v }))
    field('w-eff', 'Effect', 'Effect', draft.effect, res.effect, (d, v) => ({ ...d, effect: v }))

    // Image — save as the weapon key in Weapons/<type>/ (pass currentKey; buildImageEntry's url
    // fallback would otherwise use the wiki filename "Weapon_<Name>").
    if (res.iconUrl) {
      const file = wikiIconFileName(res.iconUrl, currentKey)
      add({ id: 'w-icon', group: 'Image', label: 'Icon', current: describeImage(draft.imageState),
        fetched: file, changed: describeImage(draft.imageState) !== file },
        (d) => ({ ...d, imageState: urlStateFromWiki(res.iconUrl!, currentKey) }))
    }

    // Wiki URL
    field('w-wiki', 'Identity', 'Wiki URL', draft.wiki, res.wikiUrl, (d, v) => ({ ...d, wiki: v }))

    return { rows, apply }
  }, [wikiResult, draft, currentKey])

  const applyWiki = (ids: string[]) => {
    setDraft((d) => ids.reduce((acc, id) => (wikiData.apply[id] ? wikiData.apply[id](acc) : acc), d))
    setWikiResult(null)
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errs: string[] = []
    if (!draft.name.trim()) errs.push('Name is required.')
    if (!currentKey) errs.push('Record key is required.')
    if (!draft.type) errs.push('Weapon type is required.')
    if (!draft.rarity) errs.push('Rarity is required.')
    if (draft.baseAtk && draft.maxBaseAtk &&
        Number(draft.maxBaseAtk) < Number(draft.baseAtk)) {
      errs.push('Max Base ATK must be ≥ Base ATK.')
    }
    return errs
  }

  // ── Build WeaponChange ────────────────────────────────────────────────────────

  const buildChange = (): WeaponChange => {
    const img = buildImageEntry(draft.imageState, imageFolder, currentKey)

    const slotKeys = matSlotKeys(Number(draft.rarity))
    const matAsc: Record<string, string> = {}
    for (const k of slotKeys) {
      if (draft.matSlots[k] !== undefined) matAsc[k] = draft.matSlots[k]
    }

    const ascension: Record<string, WeaponAscensionPhase> = {}
    draft.phases.slice(0, phaseCount).forEach((p, i) => {
      ascension[String(i + 1)] = {
        material3: draft.matSlots[p.mat3type] ?? p.mat3type,
        level: p.level,
        material2: draft.matSlots[p.mat2type] ?? p.mat2type,
        material3qty: p.mat3qty,
        material1: draft.matSlots[p.mat1type] ?? p.mat1type,
        material2qty: p.mat2qty,
        material1qty: p.mat1qty,
        mora: p.mora,
        material3type: p.mat3type,
        material2type: p.mat2type,
        material1type: p.mat1type,
      }
    })

    const hasStat = !!draft.secondaryStatType
    // Spread the original record first so any field not modelled by the form is preserved (edit mode:
    // `template` is the on-disk record; create mode: the template skeleton). Explicit fields below
    // override in place, keeping the canonical key order.
    const record: WeaponRecord = {
      ...template,
      secondary_stat_type: hasStat ? draft.secondaryStatType : null,
      description: draft.description.trim() || null,
      name: draft.name.trim() || null,
      series: draft.series.trim() || null,
      ascension,
      materials: { ascension: matAsc },
      image: img.path || null,
      secondary_stat: hasStat ? (draft.secondaryStat.trim() || null) : null,
      rarity: Number(draft.rarity),
      type: draft.type,
      max_secondary_stat: hasStat ? (draft.maxSecondaryStat.trim() || null) : null,
      max_base_atk: draft.maxBaseAtk.trim() ? Number(draft.maxBaseAtk) : null,
      base_atk: draft.baseAtk.trim() ? Number(draft.baseAtk) : null,
      obtained: draft.obtained.trim() || null,
      effectName: draft.effectName.trim() || null,
      effect: draft.effect.trim() || null,
      released: draft.released,
      wiki: draft.wiki.trim() || null,
      hoyowiki: draft.hoyowiki.trim() ? Number(draft.hoyowiki) : null,
      subCollection: {},
    }

    // Omit `series` entirely when empty (don't write `series: null`) — matches the dataset weapons
    // that have no series key. Built in-position above so the key order is preserved when present.
    if (!draft.series.trim()) delete record.series

    return {
      op: mode === 'edit' ? 'update' : 'create',
      file: mode === 'edit' && file ? file : draft.file,
      key: currentKey,
      originalKey: mode === 'edit' ? originalKey : undefined,
      record, ordering: 'alphabetical', image: img.plan,
    }
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (!errs.length) onPreview(buildChange())
  }

  const updatePhase = (idx: number, field: keyof AscPhase, val: number) => {
    setDraft((p) => {
      const phases = [...p.phases]
      phases[idx] = { ...phases[idx], [field]: val }
      return { ...p, phases }
    })
  }

  const activePhases = draft.phases.slice(0, phaseCount)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'edit' ? 'Edit' : 'New'} Weapon</h2>
        {mode === 'edit' && originalKey && <span className="pill">{originalKey}</span>}
        <button type="button" className="btn-secondary btn-sm wiki-toggle"
          aria-expanded={showWiki} onClick={() => setShowWiki((v) => !v)}>
          {showWiki ? 'Hide auto-fill' : '✨ Auto-fill from wiki'}
        </button>
      </header>

      <div className="mat-form-grid">

        {/* ── Wiki auto-fill (toggled from the header) ── */}
        {showWiki && (
          <div className="field field-wide wiki-fetch-field">
            <label>Auto-fill from Genshin Wiki</label>
            <div className="wiki-fetch-row">
              <input type="text" placeholder="Paste a fandom.com weapon page URL…" autoFocus
                value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchWeaponWiki() } }} />
              <button type="button" className="btn-secondary" disabled={wikiBusy} onClick={fetchWeaponWiki}>
                {wikiBusy ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {wikiError && <p className="field-help wiki-fetch-error">{wikiError}</p>}
            <p className="field-help">Fetches identity, stats &amp; effect; you pick which fields to apply.</p>
          </div>
        )}

        {/* ── Identity ── */}
        <div className="field">
          <label htmlFor="wpn-f1">Name<span className="req">*</span></label>
          <input id="wpn-f1" type="text" value={draft.name}
            onChange={(e) => {
              const name = e.target.value
              set('name', name)
              if (!draft.keyTouched) set('keyOverride', deriveKey(name))
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="wpn-f2">Record key</label>
          <input id="wpn-f2" type="text"
            value={draft.keyTouched ? draft.keyOverride : deriveKey(draft.name)}
            onChange={(e) => setDraft((p) => ({ ...p, keyOverride: e.target.value, keyTouched: true }))}
          />
          <p className="field-help">Auto-derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label htmlFor="wpn-f3">Weapon type<span className="req">*</span></label>
          <select id="wpn-f3" value={draft.type} disabled={mode === 'edit'}
            onChange={(e) => { if (mode === 'create') applyTemplate(e.target.value as WeaponType, draft.rarity) }}
          >
            {WEAPON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {mode === 'edit' && <p className="field-help">Cannot move a weapon between type files.</p>}
        </div>

        <div className="field">
          <label>Rarity<span className="req">*</span></label>
          <RaritySelect
            value={draft.rarity}
            disabled={mode === 'edit'}
            options={[1, 2, 3, 4, 5]}
            onChange={(v) => { if (mode === 'create') applyTemplate(draft.type, v) }}
          />
          {mode === 'edit' && <p className="field-help">Rarity cannot be changed after creation.</p>}
        </div>

        {/* ── Stats ── */}
        <div className="field">
          <label htmlFor="wpn-f4">Base ATK</label>
          <input id="wpn-f4" type="number" min={0} value={draft.baseAtk}
            onChange={(e) => set('baseAtk', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wpn-f5">Max Base ATK</label>
          <input id="wpn-f5" type="number" min={0} value={draft.maxBaseAtk}
            onChange={(e) => set('maxBaseAtk', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wpn-f6">Secondary stat type</label>
          <select id="wpn-f6" value={draft.secondaryStatType}
            onChange={(e) => set('secondaryStatType', e.target.value)}
          >
            <option value="">None</option>
            {SECONDARY_STAT_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {draft.secondaryStatType && (<>
          <div className="field">
            <label htmlFor="wpn-f7">Secondary stat</label>
            <input id="wpn-f7" type="text" placeholder="e.g. 9.6%" value={draft.secondaryStat}
              onChange={(e) => set('secondaryStat', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="wpn-f8">Max secondary stat</label>
            <input id="wpn-f8" type="text" placeholder="e.g. 44.1%" value={draft.maxSecondaryStat}
              onChange={(e) => set('maxSecondaryStat', e.target.value)} />
          </div>
        </>)}

        {/* ── Effect ── */}
        <div className="field">
          <label htmlFor="wpn-f9">Effect name</label>
          <input id="wpn-f9" type="text" value={draft.effectName}
            onChange={(e) => set('effectName', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="wpn-f10">Effect description</label>
          <textarea id="wpn-f10" rows={3} value={draft.effect}
            onChange={(e) => set('effect', e.target.value)} />
        </div>

        {/* ── Info ── */}
        <div className="field">
          <label htmlFor="wpn-f11">Series</label>
          <input id="wpn-f11" type="text" value={draft.series}
            onChange={(e) => set('series', e.target.value)} />
          <p className="field-help">e.g. "Lithic Series"</p>
        </div>

        <div className="field field-wide">
          <label htmlFor="wpn-f12">Description</label>
          <textarea id="wpn-f12" rows={2} value={draft.description}
            onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wpn-f13">Obtained</label>
          <input id="wpn-f13" type="text" value={draft.obtained}
            onChange={(e) => set('obtained', e.target.value)} />
          <p className="field-help">e.g. "Gacha", "Forging", "Battle Pass"</p>
        </div>

        {/* ── Image ── */}
        <div className="field field-wide">
          <label>Image</label>
          <ImageField
            rootPath={rootPath}
            imageFolder={imageFolder}
            defaultBasename={currentKey || undefined}
            state={draft.imageState}
            onChange={(s) => set('imageState', s)}
          />
          <p className="field-help">Stored at Weapons/{draft.type}/…</p>
        </div>

        {/* ── Release ── */}
        <div className="field">
          <label>Released</label>
          <label className="switch">
            <input type="checkbox" checked={draft.released}
              onChange={(e) => set('released', e.target.checked)} />
            <span>{draft.released ? 'Yes' : 'No'}</span>
          </label>
        </div>

        <div className="field field-wide">
          <label htmlFor="wpn-f14">Wiki URL</label>
          <input id="wpn-f14" type="text" value={draft.wiki}
            onChange={(e) => set('wiki', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="wpn-f15">HoYoWiki ID</label>
          <input id="wpn-f15" type="number" min={0} value={draft.hoyowiki}
            onChange={(e) => set('hoyowiki', e.target.value)} />
        </div>

        {/* ── Ascension materials map ── */}
        <div className="field field-wide">
          <label>Ascension Materials
            <span className="field-help-inline muted"> — click a slot to pick; selecting any tier auto-fills the set</span>
          </label>
          <div className="weapon-mat-slots">
            {[
              { prefix: 'forgery', label: 'Forgery', count: Number(draft.rarity) <= 2 ? 3 : 4 },
              { prefix: 'elite',   label: 'Elite',   count: Number(draft.rarity) <= 2 ? 2 : 3 },
              { prefix: 'common',  label: 'Common',  count: Number(draft.rarity) <= 2 ? 2 : 3 },
            ].map(({ prefix, label, count }) => (
              <div key={prefix} className="weapon-mat-row">
                <span className="wmr-label">{label}</span>
                <div className="wmr-slots" data-count={count}>
                  {Array.from({ length: count }, (_, i) => {
                    const slotKey = `${prefix}${i + 1}`
                    const selectedKey = draft.matSlots[slotKey] ?? ''
                    const displayName = selectedKey
                      ? (matSummaryMap.get(selectedKey)?.name ?? selectedKey)
                      : null
                    const imgPath = selectedKey ? (matSummaryMap.get(selectedKey)?.image ?? '') : ''
                    return (
                      <div key={slotKey} className="wmr-slot">
                        <span className="wmr-tier">{roman(i + 1)}</span>
                        <div className="mat-slot-picker">
                          {imgPath && (
                            <MatImage rootPath={rootPath} imagePath={imgPath} className="mat-slot-icon" />
                          )}
                          <button
                            type="button"
                            className={`mat-slot-btn${displayName ? '' : ' mat-slot-btn-empty'}`}
                            onClick={() => openPicker(slotKey)}
                          >
                            {displayName ?? 'Select…'}
                          </button>
                          {selectedKey && (
                            <button type="button" className="mat-slot-clear" title="Clear"
                              onClick={() => setMatSlot(slotKey, '')}>×</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ascension phases table ── */}
        <div className="field field-wide">
          <label>Ascension Phases</label>
          <table className="mat-table weapon-asc-table">
            <thead>
              <tr>
                <th className="asc-col-phase">#</th>
                <th className="asc-col-num">Level</th>
                <th className="asc-col-num">Mora</th>
                <th className="asc-col-qty">Forgery Qty</th>
                <th className="asc-col-qty">Elite Qty</th>
                <th className="asc-col-qty">Common Qty</th>
              </tr>
            </thead>
            <tbody>
              {activePhases.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input type="number" min={1} max={90} className="asc-input"
                      value={p.level}
                      onChange={(e) => updatePhase(i, 'level', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={p.mora}
                      onChange={(e) => updatePhase(i, 'mora', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={p.mat1qty}
                      onChange={(e) => updatePhase(i, 'mat1qty', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={p.mat2qty}
                      onChange={(e) => updatePhase(i, 'mat2qty', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={p.mat3qty}
                      onChange={(e) => updatePhase(i, 'mat3qty', Number(e.target.value))} />
                  </td>
                </tr>
              ))}
              {activePhases.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: '8px 0' }}>
                    No phases — select a type and rarity to load from template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <footer className="mat-form-actions">
        <button type="button" className="btn-primary" onClick={submitPreview}>Preview changes</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button type="button" className="btn-danger"
            onClick={() => {
              if (confirm(`Delete "${originalKey}"? This can be reviewed in the preview before it's applied.`))
                onDelete()
            }}
          >Delete</button>
        )}
      </footer>

      {pickerState && (
        <MaterialPickerPopup
          rootPath={rootPath}
          title={`${pickerState.prefix.charAt(0).toUpperCase()}${pickerState.prefix.slice(1)} ${roman(Number(pickerState.slotKey.replaceAll(/\D/g, '')))}`}
          fileKeyword={PREFIX_TO_FILE_KEYWORD[pickerState.prefix] ?? ''}
          expectedRarity={slotExpectedRarity(pickerState.slotKey)}
          selectedKey={draft.matSlots[pickerState.slotKey] ?? ''}
          materials={matSummaries}
          onSelect={handlePickerSelect}
          onClose={() => setPickerState(null)}
        />
      )}

      {wikiResult && (
        <WikiFillPanel
          sourceTitle={wikiResult.title}
          rows={wikiData.rows}
          groupOrder={['Identity', 'Stats', 'Effect', 'Image']}
          onApply={applyWiki}
          onClose={() => setWikiResult(null)}
        />
      )}
    </div>
  )
}
