import { useEffect, useMemo, useState } from 'react'
import type {
  CharacterRecord,
  CharacterChange,
  CharacterAscensionPhase,
  CharacterTalentLevel,
  CharacterTalentEntry,
  CharacterConstellation,
  ImagePlan,
  MaterialSummary,
  OutfitSummary,
  WikiCharacterResult,
  WikiTalent
} from '@shared/types'
import { deriveKey } from '@shared/materialsSchema'
import ImageField from '../materials/ImageField'
import { TagsInput } from '../materials/MaterialForm'
import { extOf, sanitizeImageBasename, normalizeImageUrl, type ImageState } from '../materials/util'
import { MatImage, MaterialPickerPopup, findTierSet, roman } from '../shared/materialPicker'
import { RaritySelect } from '../shared/rarity'
import { EntityLinkInput, type LinkOption } from '../shared/entityLink'
import WikiFillPanel, { type WikiRow } from '../shared/WikiFillPanel'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from '../shared/wikiApply'

// ── Constants ─────────────────────────────────────────────────────────────────

const ELEMENTS = ['Anemo', 'Cryo', 'Dendro', 'Electro', 'Geo', 'Hydro', 'Pyro'] as const
type Element = typeof ELEMENTS[number]

const WEAPON_TYPES = ['Sword', 'Claymore', 'Polearm', 'Bow', 'Catalyst'] as const

// Gender is a fixed set (Male/Female for most; "Male/Female" for the Traveler). Empty = unspecified.
const GENDERS = ['Male', 'Female', 'Male/Female'] as const
// Nation suggestions (datalist) — the canonical regions; the field still accepts custom/composite
// values ("Nod-Krai, Snezhnaya", crossover origins, etc.) which the dataset uses.
const NATIONS = [
  'Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Snezhnaya',
  'Nod-Krai', "Khaenri'ah", 'Teyvat', 'Outlander'
] as const

function fileForElement(element: string): string {
  return `Characters-${element}.json`
}

// A material-map slot, DERIVED from the keys actually present in a record's materials maps — so the
// Traveler's boss_drop-less ascension and mastery2-1..mastery3-3 talent variants render correctly,
// rather than assuming the standard fixed slot set. Tier slots (tierSize > 1) auto-fill siblings.
interface SlotSpec {
  map: 'ascension' | 'talents' // which materials sub-map this slot belongs to
  slotKey: string        // the data's material-map key (e.g. "gem1", "boss_drop", "mastery2-1")
  prefix: string         // autofill group ("gem"/"common"/"mastery"); singles/variants use slotKey
  label: string          // display label
  fileKeyword: string    // substring matched against MaterialSummary.file (picker filter)
  tierSize: number       // > 1 → findTierSet autofill; else individual picker
  index: number          // position within tier (roman label)
  expectedRarity: number // picker rarity filter; -1 = any
}

// Draft key namespaced by map, since ascension & talents can hold DIFFERENT `common1..3` values
// (true for Travelers: ascension commons are masks, talent commons are region books).
const slotDraftKey = (s: SlotSpec): string => `${s.map}.${s.slotKey}`

const SINGLE_SLOTS: Record<string, { label: string; fileKeyword: string }> = {
  boss_drop: { label: 'Boss drop', fileKeyword: 'Boss_Drops' },
  local_speciality: { label: 'Local specialty', fileKeyword: 'Local_Special' },
  weekly_boss_drop: { label: 'Weekly boss drop', fileKeyword: 'Weekly_Boss' },
  crown: { label: 'Crown', fileKeyword: 'Weekly_Boss' }
}

/** Classify a material-map key into a slot spec (picker filter + optional tier autofill). */
function classifySlot(key: string, map: 'ascension' | 'talents'): SlotSpec {
  const gem = /^gem(\d+)$/.exec(key)
  if (gem)
    return { map, slotKey: key, prefix: 'gem', label: 'Gem', fileKeyword: 'Boss_Gems', tierSize: 4, index: +gem[1], expectedRarity: +gem[1] + 1 }
  const common = /^common(\d+)$/.exec(key)
  if (common)
    return { map, slotKey: key, prefix: 'common', label: 'Common', fileKeyword: 'Common_Mob', tierSize: 3, index: +common[1], expectedRarity: +common[1] }
  const mastery = /^mastery(\d+)$/.exec(key)
  if (mastery)
    return { map, slotKey: key, prefix: 'mastery', label: 'Mastery', fileKeyword: 'Mastery_Domain', tierSize: 3, index: +mastery[1], expectedRarity: +mastery[1] + 1 }
  const masterySet = /^mastery(\d+)-(\d+)$/.exec(key) // Traveler variant: 3 parallel book-lines, no autofill
  if (masterySet)
    return { map, slotKey: key, prefix: key, label: `Mastery ${roman(+masterySet[1])} (set ${masterySet[2]})`, fileKeyword: 'Mastery_Domain', tierSize: 0, index: +masterySet[1], expectedRarity: +masterySet[1] + 1 }
  const s = SINGLE_SLOTS[key]
  if (s) return { map, slotKey: key, prefix: key, label: s.label, fileKeyword: s.fileKeyword, tierSize: 0, index: 1, expectedRarity: -1 }
  return { map, slotKey: key, prefix: key, label: key, fileKeyword: '', tierSize: 0, index: 1, expectedRarity: -1 }
}

/** Slot specs for a materials sub-map, in on-disk key order. */
function deriveSlots(mapObj: Record<string, string> | undefined, map: 'ascension' | 'talents'): SlotSpec[] {
  return Object.keys(mapObj ?? {}).map((k) => classifySlot(k, map))
}

// Semantic column meaning of material1..4 in each table (a hard game convention, verified in data).
const ASC_COLS = ['Gem', 'Boss', 'Local spec.', 'Common'] as const
const TALENT_COLS = ['Crown', 'Weekly', 'Mastery', 'Common'] as const

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

// ── Wiki auto-fill helpers ──────────────────────────────────────────────────────

/** Which draft attack index a wiki talent maps to (fixed 3, matched by structural type), or -1. */
function attackIndexFor(wt: WikiTalent, attacks: { type: string }[]): number {
  const t = wt.type.toLowerCase()
  if (t.includes('normal')) return attacks.findIndex((a) => /normal/i.test(a.type))
  if (t.includes('skill')) return attacks.findIndex((a) => /skill/i.test(a.type))
  if (t.includes('burst')) return attacks.findIndex((a) => /burst/i.test(a.type))
  return -1
}

const isPassiveType = (t: string): boolean => /passive|sprint/i.test(t)

// Image folder for a talent-attack entry, by its (structural) type. Passives are always
// Talents/Passive; constellations always Constellation.
const ATTACK_FOLDER: Record<string, string> = {
  'Normal/Charged Attack': 'Talents/Normal',
  'Elemental Skill': 'Talents/Skill',
  'Elemental Burst': 'Talents/Burst'
}
const PASSIVE_TYPES = [
  'Passive 1', 'Passive 2', 'Passive 3', 'Passive 4 (Utility)', 'Alternate Sprint'
]

// ── Draft ───────────────────────────────────────────────────────────────────

interface AscPhaseDraft { levelKey: string; level: number; mora: number; q1: number; q2: number; q3: number; q4: number }
interface TalentLevelDraft { levelKey: string; mora: number; q1: number; q2: number; q3: number; q4: number }
// Attacks (3) and passives (variable). `originalKey` is the on-disk key (for base lookup); `key` is
// the editable current key (defaults to originalKey; derived from name for new entries).
interface TalentEntryDraft {
  originalKey: string
  key: string
  keyTouched: boolean
  name: string
  effect: string
  imageState: ImageState
  order: number
  type: string
}
interface ConstEntryDraft { key: string; name: string; effect: string; imageState: ImageState }

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
  crossover: boolean
  wiki: string
  hoyowiki: string
  imageState: ImageState
  matSlots: Record<string, string>
  ascPhases: AscPhaseDraft[]
  talentLevels: TalentLevelDraft[]
  attacks: TalentEntryDraft[]
  passives: TalentEntryDraft[]
  constellationEntries: ConstEntryDraft[]
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
function talentEntriesFromRecord(obj: Record<string, CharacterTalentEntry> | undefined): TalentEntryDraft[] {
  return Object.entries(obj ?? {}).map(([key, e]) => ({
    originalKey: key,
    key,
    keyTouched: true,
    name: String(e.name ?? ''),
    effect: String(e.effect ?? ''),
    imageState: stateFromImage(e.image),
    order: Number(e.order ?? 0),
    type: String(e.type ?? '')
  }))
}
function constEntriesFromRecord(obj: Record<string, CharacterConstellation> | undefined): ConstEntryDraft[] {
  return Object.entries(obj ?? {}).map(([key, e]) => ({
    key,
    name: String(e.name ?? ''),
    effect: String(e.effect ?? ''),
    imageState: stateFromImage(e.image)
  }))
}

function matSlotsFromRecord(rec: CharacterRecord): Record<string, string> {
  const a = (rec.materials?.ascension ?? {}) as Record<string, string>
  const t = (rec.materials?.talents ?? {}) as Record<string, string>
  const out: Record<string, string> = {}
  // Namespaced by map — ascension.common1 and talents.common1 are independent (differ for Travelers).
  for (const k of Object.keys(a)) out[`ascension.${k}`] = a[k] ?? ''
  for (const k of Object.keys(t)) out[`talents.${k}`] = t[k] ?? ''
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
    crossover: Boolean(rec.crossover),
    wiki: String(rec.wiki ?? ''),
    hoyowiki: rec.hoyowiki != null ? String(rec.hoyowiki) : '',
    imageState: stateFromImage(rec.image),
    matSlots: matSlotsFromRecord(rec),
    ascPhases: ascPhasesFromRecord(rec),
    talentLevels: talentLevelsFromRecord(rec),
    attacks: talentEntriesFromRecord(rec.talents?.attack),
    passives: talentEntriesFromRecord(rec.talents?.passives),
    constellationEntries: constEntriesFromRecord(rec.constellations)
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
}: Readonly<Props>) {
  // The base record we spread-and-override on commit (template for create, fetched record for edit).
  const [base, setBase] = useState<CharacterRecord>(template)
  const [draft, setDraft] = useState<Draft>(() => draftFromRecord(template, originalKey))
  const [errors, setErrors] = useState<string[]>([])
  const [matSummaries, setMatSummaries] = useState<MaterialSummary[]>([])
  const [outfitSummaries, setOutfitSummaries] = useState<OutfitSummary[]>([])
  const [templates, setTemplates] = useState<Record<string, CharacterRecord>>({})
  const [pickerSpec, setPickerSpec] = useState<SlotSpec | null>(null)
  // Collapsible encyclopedic sections — render contents (and load their icons) only when open.
  const [openSections, setOpenSections] = useState({ attacks: false, passives: false, constellations: false })
  // Wiki auto-fill. The URL box is hidden behind a header toggle — shown by default only when
  // creating a new character (where auto-fill is most useful), collapsed when editing.
  const [showWiki, setShowWiki] = useState(mode === 'create')
  const [wikiUrl, setWikiUrl] = useState('')
  const [wikiBusy, setWikiBusy] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [wikiResult, setWikiResult] = useState<WikiCharacterResult | null>(null)

  // Slot specs derived from the record's actual material keys (handles Traveler shapes).
  const ascSlots = useMemo(() => deriveSlots(base.materials?.ascension, 'ascension'), [base])
  const talSlots = useMemo(() => deriveSlots(base.materials?.talents, 'talents'), [base])

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
      talentLevels: talentLevelsFromRecord(tpl),
      attacks: talentEntriesFromRecord(tpl.talents?.attack),
      passives: talentEntriesFromRecord(tpl.talents?.passives),
      constellationEntries: constEntriesFromRecord(tpl.constellations)
    }))
  }

  // ── Material slots ─────────────────────────────────────────────────────────

  const setMatSlot = (slotKey: string, val: string) =>
    setDraft((p) => ({ ...p, matSlots: { ...p.matSlots, [slotKey]: val } }))

  const handlePickerSelect = (key: string) => {
    if (!pickerSpec) return
    const { map, prefix, fileKeyword, tierSize } = pickerSpec
    const newSlots = { ...draft.matSlots, [slotDraftKey(pickerSpec)]: key }
    const tierFill = findTierSet(matSummaries, key, fileKeyword, tierSize, prefix)
    // tierFill keys are bare (common1, gem1…); scope them to this slot's map.
    if (tierFill) for (const [k, v] of Object.entries(tierFill)) newSlots[`${map}.${k}`] = v
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

  // Talent/constellation entry editors.
  const updateEntry = (
    listKey: 'attacks' | 'passives',
    i: number,
    patch: Partial<TalentEntryDraft>
  ) =>
    setDraft((p) => {
      const list = [...p[listKey]]
      list[i] = { ...list[i], ...patch }
      return { ...p, [listKey]: list }
    })
  const updateConst = (i: number, patch: Partial<ConstEntryDraft>) =>
    setDraft((p) => {
      const constellationEntries = [...p.constellationEntries]
      constellationEntries[i] = { ...constellationEntries[i], ...patch }
      return { ...p, constellationEntries }
    })
  const addPassive = () =>
    setDraft((p) => ({
      ...p,
      passives: [
        ...p.passives,
        {
          originalKey: '', key: '', keyTouched: false, name: '', effect: '',
          imageState: { mode: 'none' },
          order: p.passives.length,
          type: `Passive ${p.passives.length + 1}`
        }
      ]
    }))
  const removePassive = (i: number) =>
    setDraft((p) => ({ ...p, passives: p.passives.filter((_, idx) => idx !== i) }))

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

    // Each map's slots are independent (namespaced draft keys). Compute only the slots the user
    // actually changed (non-empty and different from base) so a no-op edit stays byte-exact and
    // pre-existing map keys/order are preserved untouched.
    const changedSlots = (specs: SlotSpec[], baseMap: Record<string, string> | undefined) => {
      const c: Record<string, string> = {}
      for (const s of specs) {
        const nv = cleanSlot(slots[slotDraftKey(s)] ?? '')
        const ov = (baseMap ?? {})[s.slotKey] ?? ''
        if (nv && nv !== ov) c[s.slotKey] = nv
      }
      return c
    }
    const ascChanged = changedSlots(ascSlots, base.materials?.ascension)
    const talChanged = changedSlots(talSlots, base.materials?.talents)

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

    // ── Talents (attack/passives) + constellations: rebuild preserving key + field order, edit in
    // place (keys stable unless the user edits the key field). New/changed icons collect image ops.
    const iconPlans: ImagePlan[] = []

    // Resolve an icon's image path. With no active selection (mode 'none'), preserve the base value
    // EXACTLY — some entries store "" (not null) and that distinction must round-trip — collapsing
    // only template bare-folder paths ("Talents/Passive/") to null. Otherwise build from the state
    // and stage any copy/download op.
    const resolveIconImage = (
      state: ImageState, folder: string, defaultName: string, baseImage: string | null | undefined
    ): string | null => {
      if (state.mode === 'none') {
        if (typeof baseImage === 'string' && baseImage.endsWith('/')) return null
        return baseImage ?? null
      }
      const entry = buildImageEntry(state, folder, defaultName)
      if (entry.plan && entry.plan.source !== 'existing') iconPlans.push(entry.plan)
      return entry.path
    }

    const buildTalentObj = (
      entries: TalentEntryDraft[],
      kind: 'attack' | 'passive'
    ): Record<string, CharacterTalentEntry> => {
      const baseObj = (kind === 'attack' ? base.talents?.attack : base.talents?.passives) ?? {}
      const out: Record<string, CharacterTalentEntry> = {}
      for (const e of entries) {
        const finalKey = (e.keyTouched && e.key.trim() ? e.key.trim() : deriveKey(e.name)) || e.originalKey
        if (!finalKey) continue
        const baseEntry = baseObj[e.originalKey]
        const folder = kind === 'attack' ? (ATTACK_FOLDER[e.type] ?? 'Talents/Normal') : 'Talents/Passive'
        out[finalKey] = {
          ...(baseEntry ?? {}),
          name: e.name.trim() || null,
          effect: e.effect.trim() || null,
          image: resolveIconImage(e.imageState, folder, `Talent_${finalKey}`, baseEntry?.image),
          order: e.order,
          type: e.type
        }
      }
      return out
    }

    const constellationsObj: Record<string, CharacterConstellation> = {}
    for (const e of draft.constellationEntries) {
      const baseEntry = base.constellations?.[e.key]
      constellationsObj[e.key] = {
        ...(baseEntry ?? {}),
        name: e.name.trim() || null,
        effect: e.effect.trim() || null,
        image: resolveIconImage(e.imageState, 'Constellation', deriveKey(e.name) || e.key, baseEntry?.image)
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
      talents: {
        ...base.talents,
        ascension: talentAsc,
        passives: buildTalentObj(draft.passives, 'passive'),
        attack: buildTalentObj(draft.attacks, 'attack')
      },
      constellations: constellationsObj,
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

    // `crossover` is a boolean present ONLY on crossover characters (Aloy, Manekin) as `true`;
    // omit the key entirely otherwise (never write `false`).
    if (draft.crossover) record.crossover = true
    else delete record.crossover

    return {
      op: mode === 'edit' ? 'update' : 'create',
      file: mode === 'edit' && file ? file : fileForElement(draft.element),
      key: currentKey,
      originalKey: mode === 'edit' ? originalKey : undefined,
      record,
      ordering: 'alphabetical',
      image: img.plan,
      images: iconPlans
    }
  }

  const submitPreview = () => {
    const errs = validate()
    setErrors(errs)
    if (!errs.length) onPreview(buildChange())
  }

  // ── Wiki auto-fill ───────────────────────────────────────────────────────────

  const fetchWiki = () => {
    const url = (wikiUrl.trim() || draft.wiki.trim())
    if (!url) { setWikiError('Paste a Genshin Wiki page URL first.'); return }
    setWikiBusy(true)
    setWikiError(null)
    window.api.wiki
      .fetchCharacter(url)
      .then((r) => { setWikiResult(r); setWikiUrl(url) })
      .catch((e: unknown) => setWikiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWikiBusy(false))
  }

  // Build the review rows + a map of id → Draft mutation. Recomputed from the current draft so the
  // "current" column and match indices stay accurate; apply fns operate on the accumulator so a
  // multi-row apply composes cleanly. Nothing here writes to disk — only into the Draft.
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

    // When creating, a matched attack/passive still carries the template's placeholder key
    // ("Normal", "Passive_1"); re-key it from the applied name so the object key matches the dataset
    // convention (e.g. "Soloists_Solicitation"). In edit mode keys are already correct and may carry
    // intentional disambiguation suffixes, so leave them untouched (the "never auto-re-key" rule).
    const keyPatch = (name: string): Partial<TalentEntryDraft> =>
      mode === 'create' ? { key: deriveKey(name), keyTouched: false } : {}

    // Identity (editable text).
    const idField = (
      id: string, label: string, current: string, fetched: string | null,
      fn: (d: Draft, v: string) => Draft
    ) => {
      const v = fetched ?? ''
      if (!v) return
      add({ id, group: 'Identity', label, current, fetched: v }, (d) => fn(d, v))
    }
    idField('id-name', 'Name', draft.name, res.name, (d, v) => ({
      ...d, name: v, ...(d.keyTouched ? {} : { keyOverride: deriveKey(v) })
    }))
    idField('id-fullname', 'Full name', draft.fullName, res.fullName, (d, v) => ({ ...d, fullName: v }))
    idField('id-caption', 'Caption', draft.caption, res.caption, (d, v) => ({ ...d, caption: v }))
    idField('id-affiliation', 'Affiliation', draft.affiliation, res.affiliation, (d, v) => ({ ...d, affiliation: v }))
    idField('id-constellation', 'Constellation', draft.constellation, res.constellation, (d, v) => ({ ...d, constellation: v }))
    idField('id-nation', 'Nation', draft.nation, res.nation, (d, v) => ({ ...d, nation: v }))
    idField('id-birthday', 'Birthday', draft.birthday, res.birthday, (d, v) => ({ ...d, birthday: v }))
    idField('id-wiki', 'Wiki URL', draft.wiki, res.wikiUrl, (d, v) => ({ ...d, wiki: v }))
    if (res.titles.length) {
      const fetched = res.titles.join(', ')
      add({ id: 'id-titles', group: 'Identity', label: 'Titles', current: draft.titles.join(', '), fetched },
        (d) => ({ ...d, titles: [...res.titles] }))
    }

    // Element + rarity: appliable ONLY when creating (applying loads the matching template — see
    // applyWiki). For an existing character they're locked, so show a confirm-only ✓/✗ badge.
    const confirmRow = (id: string, label: string, current: string, fetched: string | null) => {
      if (!fetched) return
      add({ id, group: 'Identity', label, current, fetched, confirmOnly: true, ok: eqi(current, fetched), changed: false })
    }
    const elFetched = res.element && ELEMENTS.includes(res.element as Element) ? res.element : null
    const rarFetched = res.rarity != null ? String(res.rarity) : null
    if (mode === 'create') {
      // apply fns just set the field; applyWiki detects these ids and reloads the template first.
      if (elFetched)
        add({ id: 'cf-element', group: 'Identity', label: 'Element', current: draft.element, fetched: elFetched },
          (d) => ({ ...d, element: elFetched as Element }))
      if (rarFetched)
        add({ id: 'cf-rarity', group: 'Identity', label: 'Rarity', current: draft.rarity, fetched: rarFetched },
          (d) => ({ ...d, rarity: rarFetched }))
    } else {
      confirmRow('cf-element', 'Element (locked)', draft.element, res.element)
      confirmRow('cf-rarity', 'Rarity (locked)', draft.rarity, rarFetched)
    }
    // Weapon is an editable field (not locked like element/rarity) → apply it (e.g. Nicole = Catalyst).
    idField('id-weapon', 'Weapon', draft.weapon, res.weapon, (d, v) => ({ ...d, weapon: v }))

    // Talents → attacks (by type) + passives (by order).
    for (const wt of res.talents) {
      if (isPassiveType(wt.type)) continue
      const ai = attackIndexFor(wt, draft.attacks)
      if (ai < 0) continue
      const cur = draft.attacks[ai]
      add({ id: `atk-txt-${ai}`, group: 'Talents', label: `${wt.name} — name & effect`, current: cur.effect, fetched: wt.effect ?? '' },
        (d) => ({ ...d, attacks: d.attacks.map((a, j) => j === ai ? { ...a, name: wt.name, effect: wt.effect ?? a.effect, ...keyPatch(wt.name) } : a) }))
      if (wt.iconUrl) {
        const file = wikiIconFileName(wt.iconUrl)
        add({ id: `atk-icon-${ai}`, group: 'Talents', label: `${wt.name} — icon`, current: describeImage(cur.imageState),
          fetched: file, changed: describeImage(cur.imageState) !== file },
          (d) => ({ ...d, attacks: d.attacks.map((a, j) => j === ai ? { ...a, imageState: urlStateFromWiki(wt.iconUrl!) } : a) }))
      }
    }
    const wikiPassives = res.talents.filter((t) => isPassiveType(t.type))
    wikiPassives.forEach((wp, pi) => {
      if (pi < draft.passives.length) {
        const cur = draft.passives[pi]
        add({ id: `pas-txt-${pi}`, group: 'Talents', label: `${wp.name} — name & effect`, current: cur.effect, fetched: wp.effect ?? '' },
          (d) => ({ ...d, passives: d.passives.map((p, j) => j === pi ? { ...p, name: wp.name, effect: wp.effect ?? p.effect, ...keyPatch(wp.name) } : p) }))
        if (wp.iconUrl) {
          const file = wikiIconFileName(wp.iconUrl)
          add({ id: `pas-icon-${pi}`, group: 'Talents', label: `${wp.name} — icon`, current: describeImage(cur.imageState),
            fetched: file, changed: describeImage(cur.imageState) !== file },
            (d) => ({ ...d, passives: d.passives.map((p, j) => j === pi ? { ...p, imageState: urlStateFromWiki(wp.iconUrl!) } : p) }))
        }
      } else {
        // No matching draft passive → append a new one (name + effect + icon together).
        add({ id: `pas-new-${pi}`, group: 'Talents', label: `${wp.name}`, current: '', fetched: wp.effect ?? wp.name,
          note: 'no draft match — will append', changed: false },
          (d) => ({
            ...d,
            passives: [...d.passives, {
              originalKey: '', key: deriveKey(wp.name), keyTouched: false, name: wp.name, effect: wp.effect ?? '',
              imageState: wp.iconUrl ? urlStateFromWiki(wp.iconUrl) : { mode: 'none' },
              order: d.passives.length, type: `Passive ${d.passives.length + 1}`
            }]
          }))
      }
    })

    // Constellations (by index).
    for (const wc of res.constellations) {
      const ci = draft.constellationEntries.findIndex((c) => c.key === String(wc.index))
      if (ci >= 0) {
        const cur = draft.constellationEntries[ci]
        add({ id: `con-txt-${wc.index}`, group: 'Constellations', label: `C${wc.index} ${wc.name} — name & effect`, current: cur.effect, fetched: wc.effect ?? '' },
          (d) => ({ ...d, constellationEntries: d.constellationEntries.map((c, j) => j === ci ? { ...c, name: wc.name, effect: wc.effect ?? c.effect } : c) }))
        if (wc.iconUrl) {
          const cbase = sanitizeImageBasename(normalizeImageUrl(wc.iconUrl)).replace(/^Constellation_/, '')
          const file = wikiIconFileName(wc.iconUrl, cbase)
          add({ id: `con-icon-${wc.index}`, group: 'Constellations', label: `C${wc.index} — icon`, current: describeImage(cur.imageState),
            fetched: file, changed: describeImage(cur.imageState) !== file },
            (d) => ({
            ...d,
            constellationEntries: d.constellationEntries.map((c, j) =>
              j === ci ? { ...c, imageState: urlStateFromWiki(wc.iconUrl!, cbase) } : c)
          }))
        }
      }
    }

    // Portrait image candidates (opt-in; multiple → last checked wins). Saved as the character key
    // (buildChange's default) rather than the wiki filename, matching the dataset convention.
    res.imageCandidates.forEach((img, i) => {
      add({ id: `img-${i}`, group: 'Images', label: `Portrait: ${img.label}`, current: describeImage(draft.imageState),
        fetched: `${currentKey}.png`, changed: false },
        (d) => ({ ...d, imageState: urlStateFromWiki(img.url, null) }))
    })

    return { rows, apply }
  }, [wikiResult, draft])

  const applyWiki = (ids: string[]) => {
    let d = draft
    let nextBase = base
    // Element/rarity (create only): load the matching template FIRST — as if the dropdown were
    // switched — so the ascension/talent-material structure is right before the other rows apply on
    // top. Done here (not via the generic reduce) so it precedes the talent/constellation writes.
    const res = wikiResult
    if (mode === 'create' && res && (ids.includes('cf-element') || ids.includes('cf-rarity'))) {
      const el = (ids.includes('cf-element') && res.element && ELEMENTS.includes(res.element as Element)
        ? (res.element as Element) : draft.element)
      const rar = ids.includes('cf-rarity') && res.rarity != null ? String(res.rarity) : draft.rarity
      const tpl = templates[`${el}_${rar}`]
      if (tpl) {
        nextBase = tpl
        d = {
          ...d, element: el, rarity: rar,
          matSlots: matSlotsFromRecord(tpl),
          ascPhases: ascPhasesFromRecord(tpl),
          talentLevels: talentLevelsFromRecord(tpl),
          attacks: talentEntriesFromRecord(tpl.talents?.attack),
          passives: talentEntriesFromRecord(tpl.talents?.passives),
          constellationEntries: constEntriesFromRecord(tpl.constellations)
        }
      } else {
        d = { ...d, element: el, rarity: rar }
      }
    }
    // Apply the remaining selected rows on top (element/rarity already handled above).
    d = ids
      .filter((id) => id !== 'cf-element' && id !== 'cf-rarity')
      .reduce((acc, id) => (wikiData.apply[id] ? wikiData.apply[id](acc) : acc), d)
    setBase(nextBase)
    setDraft(d)
    // Reveal the collapsible sections so applied talent/constellation edits are visible.
    setOpenSections({ attacks: true, passives: true, constellations: true })
    setWikiResult(null)
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderSlot = (spec: SlotSpec) => {
    const draftKey = slotDraftKey(spec)
    const selectedKey = draft.matSlots[draftKey] ?? ''
    const displayName = slotName(selectedKey)
    const imgPath = slotImage(selectedKey)
    const tierLabel = spec.tierSize > 1 ? `${spec.label} ${roman(spec.index)}` : spec.label
    return (
      <div key={draftKey} className="wmr-slot">
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
              onClick={() => setMatSlot(draftKey, '')}>×</button>
          )}
        </div>
      </div>
    )
  }

  // A labeled row of material slots; renders nothing if the group has no slots (e.g. Travelers have
  // no boss_drop, so the "Boss / Local" group shows only Local).
  const renderMatGroup = (label: string, slots: SlotSpec[]) =>
    slots.length === 0 ? null : (
      <div className="weapon-mat-row">
        <span className="wmr-label">{label}</span>
        <div className="wmr-slots" data-count={slots.length}>
          {slots.map(renderSlot)}
        </div>
      </div>
    )

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

  // Icon folder for an attack entry (by structural type); passives are always Talents/Passive.
  const attackFolder = (type: string) => ATTACK_FOLDER[type] ?? 'Talents/Normal'

  const renderTalentEntry = (
    listKey: 'attacks' | 'passives', e: TalentEntryDraft, i: number
  ) => {
    const isPassive = listKey === 'passives'
    const folder = isPassive ? 'Talents/Passive' : attackFolder(e.type)
    const displayKey = e.keyTouched ? e.key : deriveKey(e.name)
    return (
      <div key={i} className="talent-entry">
        <div className="talent-entry-icon">
          <ImageField
            rootPath={rootPath}
            imageFolder={folder}
            defaultBasename={displayKey ? `Talent_${displayKey}` : undefined}
            state={e.imageState}
            onChange={(s) => updateEntry(listKey, i, { imageState: s })}
          />
        </div>
        <div className="talent-entry-fields">
          <div className="talent-entry-row">
            <input type="text" className="talent-entry-name" placeholder="Name"
              value={e.name}
              onChange={(ev) => {
                const name = ev.target.value
                updateEntry(listKey, i, e.keyTouched ? { name } : { name, key: deriveKey(name) })
              }} />
            {isPassive ? (
              <>
                <input type="text" className="talent-entry-type" list="passive-types" placeholder="Type"
                  value={e.type} onChange={(ev) => updateEntry(listKey, i, { type: ev.target.value })} />
                <input type="number" className="talent-entry-order" title="Order"
                  value={e.order} onChange={(ev) => updateEntry(listKey, i, { order: Number(ev.target.value) })} />
                <button type="button" className="btn-danger btn-sm" title="Remove passive"
                  onClick={() => removePassive(i)}>Remove</button>
              </>
            ) : (
              <span className="pill talent-entry-typelabel">{e.type}</span>
            )}
          </div>
          <textarea className="talent-entry-effect" rows={3} placeholder="Effect"
            value={e.effect} onChange={(ev) => updateEntry(listKey, i, { effect: ev.target.value })} />
          <div className="talent-entry-key">
            <label htmlFor="chr-f1">key</label>
            <input id="chr-f1" type="text" value={displayKey}
              onChange={(ev) => updateEntry(listKey, i, { key: ev.target.value, keyTouched: true })} />
          </div>
        </div>
      </div>
    )
  }

  const renderConstEntry = (e: ConstEntryDraft, i: number) => (
    <div key={e.key} className="talent-entry">
      <div className="talent-entry-icon">
        <ImageField
          rootPath={rootPath}
          imageFolder="Constellation"
          defaultBasename={deriveKey(e.name) || undefined}
          state={e.imageState}
          onChange={(s) => updateConst(i, { imageState: s })}
        />
      </div>
      <div className="talent-entry-fields">
        <div className="talent-entry-row">
          <span className="pill talent-entry-typelabel">C{e.key}</span>
          <input type="text" className="talent-entry-name" placeholder="Name"
            value={e.name} onChange={(ev) => updateConst(i, { name: ev.target.value })} />
        </div>
        <textarea className="talent-entry-effect" rows={3} placeholder="Effect"
          value={e.effect} onChange={(ev) => updateConst(i, { effect: ev.target.value })} />
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mat-form">
      <header className="mat-form-head">
        <h2>{mode === 'edit' ? 'Edit' : 'New'} Character</h2>
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
              <input type="text" placeholder="Paste a fandom.com character page URL…" autoFocus
                value={wikiUrl} onChange={(e) => setWikiUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchWiki() } }} />
              <button type="button" className="btn-secondary" disabled={wikiBusy} onClick={fetchWiki}>
                {wikiBusy ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {wikiError && <p className="field-help wiki-fetch-error">{wikiError}</p>}
            <p className="field-help">Fetches identity, talents &amp; constellations; you pick which fields to apply.</p>
          </div>
        )}

        {/* ── Identity ── */}
        <div className="field">
          <label htmlFor="chr-f2">Name<span className="req">*</span></label>
          <input id="chr-f2" type="text" value={draft.name}
            onChange={(e) => {
              const name = e.target.value
              set('name', name)
              if (!draft.keyTouched) set('keyOverride', deriveKey(name))
            }} />
        </div>

        <div className="field">
          <label htmlFor="chr-f3">Record key</label>
          <input id="chr-f3" type="text"
            value={draft.keyTouched ? draft.keyOverride : deriveKey(draft.name)}
            onChange={(e) => setDraft((p) => ({ ...p, keyOverride: e.target.value, keyTouched: true }))} />
          <p className="field-help">Auto-derived from name; edit to override.</p>
        </div>

        <div className="field">
          <label htmlFor="chr-f4">Element<span className="req">*</span></label>
          <select id="chr-f4" value={draft.element} disabled={mode === 'edit'}
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
          <label htmlFor="chr-f5">Weapon<span className="req">*</span></label>
          <select id="chr-f5" value={draft.weapon} onChange={(e) => set('weapon', e.target.value)}>
            {WEAPON_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="chr-f6">Gender</label>
          <select id="chr-f6" value={draft.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            {/* Keep an unrecognized existing value selectable so editing never silently drops it. */}
            {draft.gender && !GENDERS.includes(draft.gender as typeof GENDERS[number]) && (
              <option value={draft.gender}>{draft.gender}</option>
            )}
          </select>
        </div>

        <div className="field">
          <label htmlFor="chr-f7">Birthday</label>
          <input id="chr-f7" type="text" placeholder="DD/MM" value={draft.birthday}
            onChange={(e) => set('birthday', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="chr-f8">Nation</label>
          <input id="chr-f8" type="text" list="character-nations" value={draft.nation}
            onChange={(e) => set('nation', e.target.value)} />
          <p className="field-help">Pick a region or type a custom/composite value.</p>
        </div>

        <div className="field">
          <label htmlFor="chr-f9">Affiliation</label>
          <input id="chr-f9" type="text" value={draft.affiliation} onChange={(e) => set('affiliation', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="chr-f10">Constellation</label>
          <input id="chr-f10" type="text" value={draft.constellation} onChange={(e) => set('constellation', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="chr-f11">Full name</label>
          <input id="chr-f11" type="text" value={draft.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <p className="field-help">Optional; most characters leave this blank.</p>
        </div>

        <div className="field field-wide">
          <label htmlFor="chr-f12">Caption</label>
          <input id="chr-f12" type="text" value={draft.caption} onChange={(e) => set('caption', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="chr-f13">Description</label>
          <textarea id="chr-f13" rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="chr-f14">Introduction</label>
          <textarea id="chr-f14" rows={3} value={draft.introduction} onChange={(e) => set('introduction', e.target.value)} />
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
            placeholder="Type to search outfits, or enter a custom key…"
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
          <label htmlFor="chr-f15">paimon.moe path</label>
          <input id="chr-f15" type="text" value={draft.paimonmoepath} onChange={(e) => set('paimonmoepath', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="chr-f16">genshin.gg path</label>
          <input id="chr-f16" type="text" value={draft.genshinggpath} onChange={(e) => set('genshinggpath', e.target.value)} />
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
          <label>Crossover</label>
          <label className="switch">
            <input type="checkbox" checked={draft.crossover}
              onChange={(e) => set('crossover', e.target.checked)} />
            <span>{draft.crossover ? 'Yes' : 'No'}</span>
          </label>
          <p className="field-help">Sets <code>crossover: true</code> (e.g. Aloy, Manekin); omitted when off.</p>
        </div>

        <div className="field">
          <label htmlFor="chr-f17">HoYoWiki ID</label>
          <input id="chr-f17" type="number" min={0} value={draft.hoyowiki}
            onChange={(e) => set('hoyowiki', e.target.value)} />
        </div>

        <div className="field field-wide">
          <label htmlFor="chr-f18">Wiki URL</label>
          <input id="chr-f18" type="text" value={draft.wiki} onChange={(e) => set('wiki', e.target.value)} />
        </div>

        {/* ── Ascension materials map ── */}
        <div className="field field-wide">
          <label>Ascension Materials
            <span className="field-help-inline muted"> — click a slot to pick; selecting any tier auto-fills the set</span>
          </label>
          <div className="weapon-mat-slots">
            {renderMatGroup('Gem', ascSlots.filter((s) => s.prefix === 'gem'))}
            {renderMatGroup('Boss / Local', ascSlots.filter((s) => s.prefix !== 'gem' && s.prefix !== 'common'))}
            {renderMatGroup('Common', ascSlots.filter((s) => s.prefix === 'common'))}
          </div>
        </div>

        {/* ── Talent materials map ── */}
        <div className="field field-wide">
          <label>Talent Materials</label>
          <div className="weapon-mat-slots">
            {renderMatGroup('Mastery', talSlots.filter((s) => s.slotKey.startsWith('mastery')))}
            {renderMatGroup('Weekly / Crown',
              talSlots.filter((s) => !s.slotKey.startsWith('mastery') && s.prefix !== 'common'))}
            {renderMatGroup('Common', talSlots.filter((s) => s.prefix === 'common'))}
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
        </div>

        {/* ── Attacks (Normal / Skill / Burst) ── */}
        <div className="field field-wide">
          <details className="talent-section"
            onToggle={(e) => { const open = (e.currentTarget as HTMLDetailsElement | null)?.open ?? false; setOpenSections((s) => ({ ...s, attacks: open })) }}>
            <summary>Attacks ({draft.attacks.length})</summary>
            {openSections.attacks && (
              <div className="talent-section-body">
                {draft.attacks.map((e, i) => renderTalentEntry('attacks', e, i))}
              </div>
            )}
          </details>
        </div>

        {/* ── Passives ── */}
        <div className="field field-wide">
          <details className="talent-section"
            onToggle={(e) => { const open = (e.currentTarget as HTMLDetailsElement | null)?.open ?? false; setOpenSections((s) => ({ ...s, passives: open })) }}>
            <summary>Passives ({draft.passives.length})</summary>
            {openSections.passives && (
              <div className="talent-section-body">
                {draft.passives.map((e, i) => renderTalentEntry('passives', e, i))}
                <button type="button" className="btn-secondary btn-sm" onClick={addPassive}>+ Add passive</button>
              </div>
            )}
          </details>
        </div>

        {/* ── Constellations ── */}
        <div className="field field-wide">
          <details className="talent-section"
            onToggle={(e) => { const open = (e.currentTarget as HTMLDetailsElement | null)?.open ?? false; setOpenSections((s) => ({ ...s, constellations: open })) }}>
            <summary>Constellations ({draft.constellationEntries.length})</summary>
            {openSections.constellations && (
              <div className="talent-section-body">
                {draft.constellationEntries.map((e, i) => renderConstEntry(e, i))}
              </div>
            )}
          </details>
        </div>
      </div>

      <datalist id="passive-types">
        {PASSIVE_TYPES.map((t) => <option key={t} value={t} />)}
      </datalist>

      <datalist id="character-nations">
        {NATIONS.map((n) => <option key={n} value={n} />)}
      </datalist>

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
            }}>Delete</button>
        )}
      </footer>

      {pickerSpec && (
        <MaterialPickerPopup
          rootPath={rootPath}
          title={pickerSpec.tierSize > 1 ? `${pickerSpec.label} ${roman(pickerSpec.index)}` : pickerSpec.label}
          fileKeyword={pickerSpec.fileKeyword}
          expectedRarity={pickerSpec.expectedRarity}
          selectedKey={draft.matSlots[slotDraftKey(pickerSpec)] ?? ''}
          materials={matSummaries}
          onSelect={handlePickerSelect}
          onClose={() => setPickerSpec(null)}
        />
      )}

      {wikiResult && (
        <WikiFillPanel
          sourceTitle={wikiResult.title}
          rows={wikiData.rows}
          onApply={applyWiki}
          onClose={() => setWikiResult(null)}
        />
      )}
    </div>
  )
}
