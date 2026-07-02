import { useEffect, useMemo, useState } from 'react'
import type {
  CharacterRecord,
  CharacterChange,
  CharacterAscensionPhase,
  CharacterTalentLevel,
  ImagePlan,
  MaterialSummary,
  OutfitSummary
} from '@shared/types'
import { deriveKey } from '@shared/materialsSchema'
import ImageField from '../materials/ImageField'
import { TagsInput } from '../materials/MaterialForm'
import { extOf, sanitizeImageBasename, type ImageState } from '../materials/util'
import { MatImage, MaterialPickerPopup, findTierSet, roman } from '../shared/materialPicker'
import { RaritySelect } from '../shared/rarity'
import { EntityLinkInput, type LinkOption } from '../shared/entityLink'

// ── Constants ─────────────────────────────────────────────────────────────────

const ELEMENTS = ['Anemo', 'Cryo', 'Dendro', 'Electro', 'Geo', 'Hydro', 'Pyro'] as const
type Element = typeof ELEMENTS[number]

const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'] as const

function fileForElement(element: string): string {
  return `Characters-${element}.json`
}

// Material slot specs. Tier sets (tierSize > 1) auto-fill siblings; singles (tierSize 0) don't.
// `common*` slots are SHARED between the ascension and talents maps (identical in the data), so
// they're edited once under Ascension and written to both maps on commit.
interface SlotSpec {
  slotKey: string        // matches the data's material-map key (e.g. "gem1", "boss_drop")
  prefix: string         // tier prefix ("gem"/"common"/"mastery") or the single-slot key
  label: string          // display label, e.g. "Gem"
  fileKeyword: string    // substring matched against MaterialSummary.file
  tierSize: number       // 4 or 3 for tier sets; 0 for singles
  index: number          // 1-based position within its tier (1 for singles)
}

function tierSpecs(prefix: string, label: string, fileKeyword: string, count: number, tierSize: number): SlotSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    slotKey: `${prefix}${i + 1}`, prefix, label, fileKeyword, tierSize, index: i + 1
  }))
}
function single(slotKey: string, label: string, fileKeyword: string): SlotSpec {
  return { slotKey, prefix: slotKey, label, fileKeyword, tierSize: 0, index: 1 }
}

const COMMON_SLOTS = tierSpecs('common', 'Common', 'Common_Mob', 3, 3)
const ASCENSION_SLOTS: SlotSpec[] = [
  ...tierSpecs('gem', 'Gem', 'Boss_Gems', 4, 4),
  single('boss_drop', 'Boss drop', 'Boss_Drops'),
  single('local_speciality', 'Local specialty', 'Local_Special'),
  ...COMMON_SLOTS
]
const TALENT_SLOTS: SlotSpec[] = [
  ...tierSpecs('mastery', 'Mastery', 'Mastery_Domain', 3, 3),
  single('weekly_boss_drop', 'Weekly boss drop', 'Weekly_Boss'),
  single('crown', 'Crown', 'Weekly_Boss')
]

// Semantic column meaning of material1..4 in each table (a hard game convention, verified in data).
const ASC_COLS = ['Gem', 'Boss', 'Local spec.', 'Common'] as const
const TALENT_COLS = ['Crown', 'Weekly', 'Mastery', 'Common'] as const

function expectedRarityFor(spec: SlotSpec): number {
  if (spec.prefix === 'gem' || spec.prefix === 'mastery') return spec.index + 1
  if (spec.prefix === 'common') return spec.index
  return -1
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

// A template `image` is a bare folder like "Characters/Anemo/" — treat that (and empty) as no image.
function stateFromImage(path: string | null | undefined): ImageState {
  const p = String(path ?? '')
  return p && !p.endsWith('/') ? { mode: 'existing', relative: p } : { mode: 'none' }
}

const emptyToNull = (s: string): string | null => (s.trim() ? s.trim() : null)

// ── Draft ───────────────────────────────────────────────────────────────────

interface AscPhaseDraft { levelKey: string; level: number; mora: number; q1: number; q2: number; q3: number; q4: number }
interface TalentLevelDraft { levelKey: string; mora: number; q1: number; q2: number; q3: number; q4: number }

interface Draft {
  name: string
  keyOverride: string
  keyTouched: boolean
  element: Element
  rarity: string
  gender: string
  birthday: string
  caption: string
  titles: string[]
  fullName: string
  description: string
  nation: string
  weapon: string
  affiliation: string
  constellation: string
  outfits: string[]
  introduction: string
  paimonmoepath: string
  genshinggpath: string
  released: boolean
  wiki: string
  hoyowiki: string
  imageState: ImageState
  matSlots: Record<string, string>
  ascPhases: AscPhaseDraft[]
  talentLevels: TalentLevelDraft[]
}

function ascPhasesFromRecord(rec: CharacterRecord): AscPhaseDraft[] {
  return Object.entries(rec.ascension ?? {}).map(([levelKey, p]) => ({
    levelKey,
    level: Number(p.level ?? 0),
    mora: Number(p.mora ?? 0),
    q1: Number(p.material1qty ?? 0),
    q2: Number(p.material2qty ?? 0),
    q3: Number(p.material3qty ?? 0),
    q4: Number(p.material4qty ?? 0)
  }))
}
function talentLevelsFromRecord(rec: CharacterRecord): TalentLevelDraft[] {
  return Object.entries(rec.talents?.ascension ?? {}).map(([levelKey, p]) => ({
    levelKey,
    mora: Number(p.mora ?? 0),
    q1: Number(p.material1qty ?? 0),
    q2: Number(p.material2qty ?? 0),
    q3: Number(p.material3qty ?? 0),
    q4: Number(p.material4qty ?? 0)
  }))
}

function matSlotsFromRecord(rec: CharacterRecord): Record<string, string> {
  const a = (rec.materials?.ascension ?? {}) as Record<string, string>
  const t = (rec.materials?.talents ?? {}) as Record<string, string>
  const out: Record<string, string> = {}
  for (const s of ASCENSION_SLOTS) out[s.slotKey] = a[s.slotKey] ?? ''
  for (const s of TALENT_SLOTS) out[s.slotKey] = t[s.slotKey] ?? ''
  // commons live in both maps; prefer the ascension copy
  for (const s of COMMON_SLOTS) out[s.slotKey] = a[s.slotKey] ?? t[s.slotKey] ?? ''
  return out
}

function draftFromRecord(rec: CharacterRecord, existingKey?: string): Draft {
  const element = (ELEMENTS.includes(rec.element as Element) ? rec.element : 'Pyro') as Element
  return {
    name: String(rec.name ?? ''),
    keyOverride: existingKey ?? '',
    keyTouched: !!existingKey,
    element,
    rarity: String(rec.rarity ?? 5),
    gender: String(rec.gender ?? ''),
    birthday: String(rec.birthday ?? ''),
    caption: String(rec.caption ?? ''),
    titles: Array.isArray(rec.titles) ? [...rec.titles] : [],
    fullName: String(rec.fullName ?? ''),
    description: String(rec.description ?? ''),
    nation: String(rec.nation ?? ''),
    weapon: String(rec.weapon ?? 'Sword'),
    affiliation: String(rec.affiliation ?? ''),
    constellation: String(rec.constellation ?? ''),
    outfits: Array.isArray(rec.outfits) ? [...rec.outfits] : [],
    introduction: String(rec.introduction ?? ''),
    paimonmoepath: String(rec.paimonmoepath ?? ''),
    genshinggpath: String(rec.genshinggpath ?? ''),
    released: Boolean(rec.released),
    wiki: String(rec.wiki ?? ''),
    hoyowiki: rec.hoyowiki != null ? String(rec.hoyowiki) : '',
    imageState: stateFromImage(rec.image),
    matSlots: matSlotsFromRecord(rec),
    ascPhases: ascPhasesFromRecord(rec),
    talentLevels: talentLevelsFromRecord(rec)
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rootPath: string
  mode: 'create' | 'edit'
  template: CharacterRecord
  originalKey?: string
  file?: string
  onPreview: (change: CharacterChange) => void
  onDelete?: () => void
  onCancel: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CharacterForm({
  rootPath, mode, template, originalKey, file, onPreview, onDelete, onCancel
}: Props) {
  // The base record we spread-and-override on commit (template for create, fetched record for edit).
  const [base, setBase] = useState<CharacterRecord>(template)
  const [draft, setDraft] = useState<Draft>(() => draftFromRecord(template, originalKey))
  const [errors, setErrors] = useState<string[]>([])
  const [matSummaries, setMatSummaries] = useState<MaterialSummary[]>([])
  const [outfitSummaries, setOutfitSummaries] = useState<OutfitSummary[]>([])
  const [templates, setTemplates] = useState<Record<string, CharacterRecord>>({})
  const [pickerSpec, setPickerSpec] = useState<SlotSpec | null>(null)

  const matSummaryMap = useMemo(() => new Map(matSummaries.map((m) => [m.key, m])), [matSummaries])
  const outfitOptions = useMemo<LinkOption[]>(
    () => outfitSummaries.map((o) => ({ key: o.key, name: o.name, image: o.image, sublabel: o.type })),
    [outfitSummaries]
  )

  useEffect(() => { void window.api.materials.list(rootPath).then(setMatSummaries) }, [rootPath])
  useEffect(() => { void window.api.outfits.list(rootPath).then(setOutfitSummaries) }, [rootPath])
  useEffect(() => {
    if (mode === 'create') void window.api.characters.templates(rootPath).then(setTemplates)
  }, [rootPath, mode])

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }))

  const currentKey = draft.keyTouched && draft.keyOverride.trim()
    ? draft.keyOverride.trim()
    : deriveKey(draft.name)

  const imageFolder = `Characters/${draft.element}`

  const applyTemplate = (element: Element, rarity: string) => {
    const tpl = templates[`${element}_${rarity}`]
    if (!tpl) { set('element', element); set('rarity', rarity); return }
    setBase(tpl)
    setDraft((p) => ({
      ...p, element, rarity,
      matSlots: matSlotsFromRecord(tpl),
      ascPhases: ascPhasesFromRecord(tpl),
      talentLevels: talentLevelsFromRecord(tpl)
    }))
  }

  // ── Material slots ─────────────────────────────────────────────────────────

  const setMatSlot = (slotKey: string, val: string) =>
    setDraft((p) => ({ ...p, matSlots: { ...p.matSlots, [slotKey]: val } }))

  const handlePickerSelect = (key: string) => {
    if (!pickerSpec) return
    const { slotKey, prefix, fileKeyword, tierSize } = pickerSpec
    const newSlots = { ...draft.matSlots, [slotKey]: key }
    const tierFill = findTierSet(matSummaries, key, fileKeyword, tierSize, prefix)
    if (tierFill) Object.assign(newSlots, tierFill)
    setDraft((p) => ({ ...p, matSlots: newSlots }))
    setPickerSpec(null)
  }

  // Keep a slot value if it's a known material; in edit mode also keep an existing key even if its
  // summary didn't load (avoids nulling real data), while create still blanks template placeholders.
  const cleanSlot = (v: string) => (v && (mode === 'edit' || matSummaryMap.has(v)) ? v : '')
  const slotName = (v: string) => (v ? (matSummaryMap.get(v)?.name ?? null) : null)
  const slotImage = (v: string) => (v ? (matSummaryMap.get(v)?.image ?? '') : '')

  // ── Phase editing ────────────────────────────────────────────────────────────

  const updateAsc = (i: number, field: keyof AscPhaseDraft, val: number) =>
    setDraft((p) => {
      const ascPhases = [...p.ascPhases]
      ascPhases[i] = { ...ascPhases[i], [field]: val }
      return { ...p, ascPhases }
    })
  const updateTalent = (i: number, field: keyof TalentLevelDraft, val: number) =>
    setDraft((p) => {
      const talentLevels = [...p.talentLevels]
      talentLevels[i] = { ...talentLevels[i], [field]: val }
      return { ...p, talentLevels }
    })

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): string[] => {
    const errs: string[] = []
    if (!draft.name.trim()) errs.push('Name is required.')
    if (!currentKey) errs.push('Record key is required.')
    if (!draft.element) errs.push('Element is required.')
    if (!draft.weapon) errs.push('Weapon is required.')
    if (!draft.rarity) errs.push('Rarity is required.')
    return errs
  }

  // ── Build change (spread base, override only edited fields) ──────────────────

  const buildChange = (): CharacterChange => {
    const img = buildImageEntry(draft.imageState, imageFolder, currentKey)
    const slots = draft.matSlots

    // Two material maps; commons are shared (edited once, written to both). Compute only the slots
    // the user actually changed (non-empty and different from base) so a no-op edit stays byte-exact
    // and pre-existing map keys/order are preserved untouched.
    const changedSlots = (specs: SlotSpec[], baseMap: Record<string, string> | undefined) => {
      const c: Record<string, string> = {}
      for (const s of specs) {
        const nv = cleanSlot(slots[s.slotKey] ?? '')
        const ov = (baseMap ?? {})[s.slotKey] ?? ''
        if (nv && nv !== ov) c[s.slotKey] = nv
      }
      return c
    }
    const ascChanged = changedSlots(ASCENSION_SLOTS, base.materials?.ascension)
    const talChanged = changedSlots([...TALENT_SLOTS, ...COMMON_SLOTS], base.materials?.talents)

    const ascensionMap: Record<string, string> = { ...(base.materials?.ascension ?? {}) }
    for (const [k, v] of Object.entries(ascChanged)) ascensionMap[k] = v
    const talentsMap: Record<string, string> = { ...(base.materials?.talents ?? {}) }
    for (const [k, v] of Object.entries(talChanged)) talentsMap[k] = v
    const materials = { ...base.materials, ascension: ascensionMap, talents: talentsMap }

    // The `materials` map is the source of truth: each phase's material NAME is DERIVED from
    // map[materialXtype]. This intentionally corrects stale per-phase names that disagree with the
    // map in the source data (a known data bug) whenever a character is saved. Falls back to the
    // base name only if the map has no (non-empty) value for that type, so a missing map key never
    // silently nulls existing data.
    const nameFrom = (
      type: string | null | undefined,
      map: Record<string, string>,
      baseName: string | null
    ): string | null => {
      if (!type) return null
      const v = map[type]
      return v && v.length ? v : (baseName ?? null)
    }

    const ascension: Record<string, CharacterAscensionPhase> = {}
    for (const ph of draft.ascPhases) {
      const bp = base.ascension?.[ph.levelKey]
      if (!bp) continue
      ascension[ph.levelKey] = {
        ...bp,
        level: ph.level,
        mora: ph.mora,
        material1qty: ph.q1,
        material2qty: ph.q2,
        material3qty: ph.q3,
        material4qty: ph.q4,
        material1: nameFrom(bp.material1type, ascensionMap, bp.material1),
        material2: nameFrom(bp.material2type, ascensionMap, bp.material2),
        material3: nameFrom(bp.material3type, ascensionMap, bp.material3),
        material4: nameFrom(bp.material4type, ascensionMap, bp.material4)
      }
    }

    const talentAsc: Record<string, CharacterTalentLevel> = {}
    for (const tl of draft.talentLevels) {
      const bp = base.talents?.ascension?.[tl.levelKey]
      if (!bp) continue
      talentAsc[tl.levelKey] = {
        ...bp,
        mora: tl.mora,
        material1qty: tl.q1,
        material2qty: tl.q2,
        material3qty: tl.q3,
        material4qty: tl.q4,
        material1: nameFrom(bp.material1type, talentsMap, bp.material1),
        material2: nameFrom(bp.material2type, talentsMap, bp.material2),
        material3: nameFrom(bp.material3type, talentsMap, bp.material3),
        material4: nameFrom(bp.material4type, talentsMap, bp.material4)
      }
    }

    const record: CharacterRecord = {
      ...base,
      image: img.path,
      gender: emptyToNull(draft.gender),
      birthday: emptyToNull(draft.birthday),
      caption: emptyToNull(draft.caption),
      titles: draft.titles,
      name: draft.name.trim() || null,
      description: emptyToNull(draft.description),
      nation: emptyToNull(draft.nation),
      weapon: emptyToNull(draft.weapon),
      rarity: Number(draft.rarity),
      affiliation: emptyToNull(draft.affiliation),
      constellation: emptyToNull(draft.constellation),
      outfits: draft.outfits,
      talents: { ...base.talents, ascension: talentAsc },
      ascension,
      materials,
      introduction: emptyToNull(draft.introduction),
      paimonmoepath: emptyToNull(draft.paimonmoepath),
      genshinggpath: emptyToNull(draft.genshinggpath),
      element: draft.element,
      released: draft.released,
      wiki: emptyToNull(draft.wiki),
      hoyowiki: draft.hoyowiki.trim() ? Number(draft.hoyowiki) : null
    }

    // `fullName` is absent (not null) on ~1/3 of records. Preserve its presence/position: only keep
    // it when the base had it (value editable) or the user actually entered one.
    if ('fullName' in base) record.fullName = emptyToNull(draft.fullName)
    else if (draft.fullName.trim()) record.fullName = draft.fullName.trim()

    return {
      op: mode === 'edit' ? 'update' : 'create',
      file: mode === 'edit' && file ? file : fileForElement(draft.element),
      key: currentKey,
      originalKey: mode === 'edit' ? originalKey : undefined,
      record,
      ordering: 'alphabetical',
      image: img.plan
    }
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (!errs.length) onPreview(buildChange())
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderSlot = (spec: SlotSpec) => {
    const selectedKey = draft.matSlots[spec.slotKey] ?? ''
    const displayName = slotName(selectedKey)
    const imgPath = slotImage(selectedKey)
    const tierLabel = spec.tierSize > 1 ? `${spec.label} ${roman(spec.index)}` : spec.label
    return (
      <div key={spec.slotKey} className="wmr-slot">
        <span className="wmr-tier">{tierLabel}</span>
        <div className="mat-slot-picker">
          {imgPath && <MatImage rootPath={rootPath} imagePath={imgPath} className="mat-slot-icon" />}
          <button
            type="button"
            className={`mat-slot-btn${displayName ? '' : ' mat-slot-btn-empty'}`}
            onClick={() => setPickerSpec(spec)}
          >
            {displayName ?? 'Select…'}
          </button>
          {selectedKey && (
            <button type="button" className="mat-slot-clear" title="Clear"
              onClick={() => setMatSlot(spec.slotKey, '')}>×</button>
          )}
        </div>
      </div>
    )
  }

  // A qty cell is only editable when the base phase actually uses that material slot (type != null).
  const ascQtyCell = (i: number, phaseKey: string, colIdx: 1 | 2 | 3 | 4) => {
    const type = base.ascension?.[phaseKey]?.[`material${colIdx}type`] as string | null | undefined
    const field = `q${colIdx}` as keyof AscPhaseDraft
    if (!type) return <td className="asc-mat-empty">—</td>
    return (
      <td>
        <input type="number" min={0} className="asc-input"
          value={draft.ascPhases[i][field]}
          onChange={(e) => updateAsc(i, field, Number(e.target.value))} />
      </td>
    )
  }
  const talentQtyCell = (i: number, levelKey: string, colIdx: 1 | 2 | 3 | 4) => {
    const type = base.talents?.ascension?.[levelKey]?.[`material${colIdx}type`] as string | null | undefined
    const field = `q${colIdx}` as keyof TalentLevelDraft
    if (!type) return <td className="asc-mat-empty">—</td>
    return (
      <td>
        <input type="number" min={0} className="asc-input"
          value={draft.talentLevels[i][field]}
          onChange={(e) => updateTalent(i, field, Number(e.target.value))} />
      </td>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'edit' ? 'Edit' : 'New'} Character</h2>
        {mode === 'edit' && originalKey && <span className="pill">{originalKey}</span>}
      </header>

      <div className="mat-form-grid">
        {/* ── Identity ── */}
        <div className="field">
          <label>Name<span className="req">*</span></label>
          <input type="text" value={draft.name}
            onChange={(e) => {
              const name = e.target.value
              set('name', name)
              if (!draft.keyTouched) set('keyOverride', deriveKey(name))
            }} />
        </div>

        <div className="field">
          <label>Record key</label>
          <input type="text"
            value={draft.keyTouched ? draft.keyOverride : deriveKey(draft.name)}
            onChange={(e) => setDraft((p) => ({ ...p, keyOverride: e.target.value, keyTouched: true }))} />
          <p className="field-help">Auto-derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label>Element<span className="req">*</span></label>
          <select value={draft.element} disabled={mode === 'edit'}
            onChange={(e) => { if (mode === 'create') applyTemplate(e.target.value as Element, draft.rarity) }}>
            {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
          </select>
          {mode === 'edit' && <p className="field-help">Cannot move a character between element files.</p>}
        </div>

        <div className="field">
          <label>Rarity<span className="req">*</span></label>
          <RaritySelect
            value={draft.rarity}
            disabled={mode === 'edit'}
            options={[4, 5]}
            onChange={(v) => { if (mode === 'create') applyTemplate(draft.element, v) }}
          />
          {mode === 'edit' && <p className="field-help">Rarity cannot be changed after creation.</p>}
        </div>

        <div className="field">
          <label>Weapon<span className="req">*</span></label>
          <select value={draft.weapon} onChange={(e) => set('weapon', e.target.value)}>
            {WEAPON_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Gender</label>
          <input type="text" value={draft.gender} onChange={(e) => set('gender', e.target.value)} />
        </div>

        <div className="field">
          <label>Birthday</label>
          <input type="text" placeholder="DD/MM" value={draft.birthday}
            onChange={(e) => set('birthday', e.target.value)} />
        </div>

        <div className="field">
          <label>Nation</label>
          <input type="text" value={draft.nation} onChange={(e) => set('nation', e.target.value)} />
        </div>

        <div className="field">
          <label>Affiliation</label>
          <input type="text" value={draft.affiliation} onChange={(e) => set('affiliation', e.target.value)} />
        </div>

        <div className="field">
          <label>Constellation</label>
          <input type="text" value={draft.constellation} onChange={(e) => set('constellation', e.target.value)} />
        </div>

        <div className="field">
          <label>Full name</label>
          <input type="text" value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <p className="field-help">Optional; most characters leave this blank.</p>
        </div>

        <div className="field field-wide">
          <label>Caption</label>
          <input type="text" value={draft.caption} onChange={(e) => set('caption', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Description</label>
          <textarea rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Introduction</label>
          <textarea rows={3} value={draft.introduction} onChange={(e) => set('introduction', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Titles</label>
          <TagsInput value={draft.titles} onChange={(v) => set('titles', v)} />
        </div>

        <div className="field field-wide">
          <label>Outfits</label>
          <EntityLinkInput
            rootPath={rootPath}
            value={draft.outfits}
            onChange={(v) => set('outfits', v)}
            options={outfitOptions}
            addLabel="+ Add existing outfit…"
            customPlaceholder="…or type a custom key"
          />
        </div>

        {/* ── Image ── */}
        <div className="field field-wide">
          <label>Portrait image</label>
          <ImageField
            rootPath={rootPath}
            imageFolder={imageFolder}
            defaultBasename={currentKey || undefined}
            state={draft.imageState}
            onChange={(s) => set('imageState', s)}
          />
          <p className="field-help">Stored at Characters/{draft.element}/…</p>
        </div>

        {/* ── Paths / meta ── */}
        <div className="field">
          <label>paimon.moe path</label>
          <input type="text" value={draft.paimonmoepath} onChange={(e) => set('paimonmoepath', e.target.value)} />
        </div>

        <div className="field">
          <label>genshin.gg path</label>
          <input type="text" value={draft.genshinggpath} onChange={(e) => set('genshinggpath', e.target.value)} />
        </div>

        <div className="field">
          <label>Released</label>
          <label className="switch">
            <input type="checkbox" checked={draft.released}
              onChange={(e) => set('released', e.target.checked)} />
            <span>{draft.released ? 'Yes' : 'No'}</span>
          </label>
        </div>

        <div className="field">
          <label>HoYoWiki ID</label>
          <input type="number" min={0} value={draft.hoyowiki}
            onChange={(e) => set('hoyowiki', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label>Wiki URL</label>
          <input type="text" value={draft.wiki} onChange={(e) => set('wiki', e.target.value)} />
        </div>

        {/* ── Ascension materials map ── */}
        <div className="field field-wide">
          <label>Ascension Materials
            <span className="field-help-inline muted"> — click a slot to pick; selecting any tier auto-fills the set</span>
          </label>
          <div className="weapon-mat-slots">
            <div className="weapon-mat-row">
              <span className="wmr-label">Gem</span>
              <div className="wmr-slots" data-count={4}>
                {ASCENSION_SLOTS.filter((s) => s.prefix === 'gem').map(renderSlot)}
              </div>
            </div>
            <div className="weapon-mat-row">
              <span className="wmr-label">Boss / Local</span>
              <div className="wmr-slots" data-count={2}>
                {ASCENSION_SLOTS.filter((s) => s.slotKey === 'boss_drop' || s.slotKey === 'local_speciality').map(renderSlot)}
              </div>
            </div>
            <div className="weapon-mat-row">
              <span className="wmr-label">Common</span>
              <div className="wmr-slots" data-count={3}>
                {COMMON_SLOTS.map(renderSlot)}
              </div>
            </div>
          </div>
          <p className="field-help">Common materials are shared with talents.</p>
        </div>

        {/* ── Talent materials map ── */}
        <div className="field field-wide">
          <label>Talent Materials</label>
          <div className="weapon-mat-slots">
            <div className="weapon-mat-row">
              <span className="wmr-label">Mastery</span>
              <div className="wmr-slots" data-count={3}>
                {TALENT_SLOTS.filter((s) => s.prefix === 'mastery').map(renderSlot)}
              </div>
            </div>
            <div className="weapon-mat-row">
              <span className="wmr-label">Weekly / Crown</span>
              <div className="wmr-slots" data-count={2}>
                {TALENT_SLOTS.filter((s) => s.slotKey === 'weekly_boss_drop' || s.slotKey === 'crown').map(renderSlot)}
              </div>
            </div>
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
                {ASC_COLS.map((c) => <th key={c} className="asc-col-qty">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {draft.ascPhases.map((p, i) => (
                <tr key={p.levelKey}>
                  <td>{p.levelKey}</td>
                  <td>
                    <input type="number" min={0} max={90} className="asc-input"
                      value={p.level} onChange={(e) => updateAsc(i, 'level', Number(e.target.value))} />
                  </td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={p.mora} onChange={(e) => updateAsc(i, 'mora', Number(e.target.value))} />
                  </td>
                  {ascQtyCell(i, p.levelKey, 1)}
                  {ascQtyCell(i, p.levelKey, 2)}
                  {ascQtyCell(i, p.levelKey, 3)}
                  {ascQtyCell(i, p.levelKey, 4)}
                </tr>
              ))}
              {draft.ascPhases.length === 0 && (
                <tr><td colSpan={7} className="muted" style={{ padding: '8px 0' }}>No ascension phases.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Talent levels table ── */}
        <div className="field field-wide">
          <label>Talent Level-Up</label>
          <table className="mat-table weapon-asc-table">
            <thead>
              <tr>
                <th className="asc-col-phase">Lvl</th>
                <th className="asc-col-num">Mora</th>
                {TALENT_COLS.map((c) => <th key={c} className="asc-col-qty">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {draft.talentLevels.map((t, i) => (
                <tr key={t.levelKey}>
                  <td>{t.levelKey}</td>
                  <td>
                    <input type="number" min={0} className="asc-input"
                      value={t.mora} onChange={(e) => updateTalent(i, 'mora', Number(e.target.value))} />
                  </td>
                  {talentQtyCell(i, t.levelKey, 1)}
                  {talentQtyCell(i, t.levelKey, 2)}
                  {talentQtyCell(i, t.levelKey, 3)}
                  {talentQtyCell(i, t.levelKey, 4)}
                </tr>
              ))}
              {draft.talentLevels.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ padding: '8px 0' }}>No talent levels.</td></tr>
              )}
            </tbody>
          </table>
          <p className="field-help">
            Talents, passives, and constellations are preserved as-is and edited in a later milestone.
          </p>
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="form-errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <footer className="mat-form-actions">
        <button className="btn-primary" onClick={submitPreview}>Preview changes</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button className="btn-danger"
            onClick={() => {
              if (confirm(`Delete "${originalKey}"? This can be reviewed in the preview before it's applied.`))
                onDelete()
            }}>Delete</button>
        )}
      </footer>

      {pickerSpec && (
        <MaterialPickerPopup
          rootPath={rootPath}
          title={pickerSpec.tierSize > 1 ? `${pickerSpec.label} ${roman(pickerSpec.index)}` : pickerSpec.label}
          fileKeyword={pickerSpec.fileKeyword}
          expectedRarity={expectedRarityFor(pickerSpec)}
          selectedKey={draft.matSlots[pickerSpec.slotKey] ?? ''}
          materials={matSummaries}
          onSelect={handlePickerSelect}
          onClose={() => setPickerSpec(null)}
        />
      )}
    </div>
  )
}
