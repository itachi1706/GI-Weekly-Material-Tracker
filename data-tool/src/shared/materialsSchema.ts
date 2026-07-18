import type { MaterialInnerType, MaterialRecord } from './types'

/** Form widget kinds the renderer knows how to draw. */
export type Widget = 'text' | 'textarea' | 'number' | 'select' | 'bool' | 'image' | 'tags' | 'days' | 'computed' | 'rarity'

export interface FieldSpec {
  key: string
  label: string
  widget: Widget
  required?: boolean
  options?: { value: string | number; label: string }[]
  help?: string
  /** For image widget: default images/ subfolder (overridden by schema-level imageFolderFn). */
  imageFolder?: string
  /** For computed widget: source field key + transform. */
  computeFrom?: string
  computeFn?: (sourceValue: unknown) => unknown
  /**
   * For rarity widget: the valid star values to offer, or a function deriving them from the
   * current form values (e.g. Normal vs Elite mob drops have different rarity ranges). Defaults
   * to [1,2,3,4,5] when omitted.
   */
  rarityOptions?: number[] | ((values: Record<string, unknown>) => number[])
}

/** Resolve the valid rarity values for a `rarity` field given the current form values. */
export function resolveRarityOptions(field: FieldSpec, values: Record<string, unknown>): number[] {
  if (!field.rarityOptions) return [1, 2, 3, 4, 5]
  return typeof field.rarityOptions === 'function' ? field.rarityOptions(values) : field.rarityOptions
}

/** Config for one tier within a tier set (e.g. one rarity level of a mob drop group). */
export interface TierItemConfig {
  /** Template key in templates/materials.json (falls back to schema.templateKey if absent). */
  templateKey?: string
  /** Fixed rarity value written to this tier's record. */
  rarity: number
}

/** Config for a multi-tier create flow (mob drops, domain materials, weekly boss sets). */
export interface TierSetConfig {
  /**
   * Per-tier configuration array, or a function that derives it from the current shared form
   * values. Use a function when tier count varies (e.g. forgery=4 tiers, mastery=3).
   */
  tiers: TierItemConfig[] | ((shared: Record<string, unknown>) => TierItemConfig[])
  /** Keys of schema.fields shown once in the shared section at the top of the form. */
  sharedFieldKeys: string[]
  /**
   * When true the "obtained" field appears only in the shared section and is copied to all
   * tiers (used for weekly boss where all 3 drops share the same obtained text).
   */
  sharedObtained?: boolean
  /**
   * When true, tiers at index ≥ 1 get an "Auto-fill" button that inserts the alchemy recipe
   * referencing the previous tier's name (mob drops and domain materials).
   */
  autoAlchemy?: boolean
}

export interface MaterialTypeSchema {
  innerType: MaterialInnerType
  /** Human-readable label shown in the UI. */
  label: string
  /** Skeleton key inside templates/materials.json used as the base for new records. */
  templateKey: string
  /** Default images/ subfolder (used when imageFolderFn is absent or values are empty). */
  imageFolder: string
  /** Dynamic images/ subfolder — overrides imageFolder when form values are available. */
  imageFolderFn?: (values: Record<string, unknown>) => string
  /**
   * Derive the target data file from the current form values (used for CREATE).
   * For EDIT, the file is always taken from the existing record's source file.
   */
  deriveFile: (values: Record<string, unknown>) => string
  /** Editable fields in form display order. Fields managed implicitly (usage, subCollection,
   *  innerType) are excluded. */
  fields: FieldSpec[]
  /**
   * When 'tier_set', the "New" flow uses TierSetForm (multi-tier) instead of the single-record
   * MaterialForm.
   */
  createMode?: 'tier_set'
  tierSet?: TierSetConfig
}

/** Resolve the actual images/ folder to use given the current form values. */
export function resolveImageFolder(schema: MaterialTypeSchema, values: Record<string, unknown>): string {
  return schema.imageFolderFn ? schema.imageFolderFn(values) : schema.imageFolder
}

/** Resolve the current tier configs from a TierSetConfig, given the current shared values. */
export function resolveTiers(config: TierSetConfig, shared: Record<string, unknown>): TierItemConfig[] {
  return typeof config.tiers === 'function' ? config.tiers(shared) : config.tiers
}

// ── Shared region lists ──────────────────────────────────────────────────────

const GENSHIN_REGIONS = [
  'Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan', 'Nod-Krai'
] as const

// ── local_speciality ─────────────────────────────────────────────────────────

const LOCAL_SPECIALITY_TYPES = GENSHIN_REGIONS.map((r) => ({
  value: `Local Speciality (${r})`,
  label: r
}))

const localSpeciality: MaterialTypeSchema = {
  innerType: 'local_speciality',
  label: 'Local Speciality',
  templateKey: 'Local_Speciality',
  imageFolder: 'Materials/Local_Specialities',
  deriveFile: () => 'Materials-Local_Specialities.json',
  fields: [
    {
      key: 'name', label: 'Name', widget: 'text', required: true,
      help: 'Display name. Record key is derived from this (spaces → underscores).'
    },
    {
      key: 'type', label: 'Region', widget: 'select', required: true,
      options: LOCAL_SPECIALITY_TYPES
    },
    // Local specialities are canonically 1★ (all existing records), but keep it editable.
    { key: 'rarity', label: 'Rarity', widget: 'rarity', required: true },
    { key: 'image', label: 'Image', widget: 'image', required: true, imageFolder: 'Materials/Local_Specialities' },
    { key: 'description', label: 'Description', widget: 'textarea' },
    {
      key: 'obtained', label: 'Obtained', widget: 'textarea',
      help: 'Multi-line, e.g. "- Found on Seirai Island"'
    },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number', help: 'Numeric ID, or leave blank.' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

// ── mob_drops ─────────────────────────────────────────────────────────────────

const MOB_TYPE_OPTIONS = [
  { value: 'Common Ascension Material (Normal)', label: 'Normal Mob (Common_Mob file)' },
  { value: 'Common Ascension Material (Elite)', label: 'Elite Mob (Elite_Mob file)' }
]

function mobImageFolder(values: Record<string, unknown>): string {
  return values['type'] === 'Common Ascension Material (Normal)'
    ? 'Materials/Common_Mob'
    : 'Materials/Elite_Mob'
}

const mobDrops: MaterialTypeSchema = {
  innerType: 'mob_drops',
  label: 'Mob Drops',
  templateKey: 'Common_1',
  imageFolder: 'Materials/Common_Mob',
  imageFolderFn: mobImageFolder,
  deriveFile: (values) =>
    values['type'] === 'Common Ascension Material (Normal)'
      ? 'Materials-Common_Mob.json'
      : 'Materials-Elite_Mob.json',
  createMode: 'tier_set',
  tierSet: {
    tiers: (shared) => {
      const isNormal = !shared['type'] || shared['type'] === 'Common Ascension Material (Normal)'
      return isNormal
        ? [
            { templateKey: 'Common_1', rarity: 1 },
            { templateKey: 'Common_2', rarity: 2 },
            { templateKey: 'Common_3', rarity: 3 }
          ]
        : [
            { templateKey: 'Elite_1', rarity: 2 },
            { templateKey: 'Elite_2', rarity: 3 },
            { templateKey: 'Elite_3', rarity: 4 }
          ]
    },
    sharedFieldKeys: ['type', 'enemies', 'released'],
    autoAlchemy: true
  },
  fields: [
    {
      key: 'name', label: 'Name', widget: 'text', required: true,
      help: 'Display name. Record key derived from this.'
    },
    { key: 'type', label: 'Category', widget: 'select', required: true, options: MOB_TYPE_OPTIONS },
    {
      key: 'rarity', label: 'Rarity', widget: 'rarity', required: true,
      rarityOptions: (v) => v['type'] === 'Common Ascension Material (Normal)' ? [1, 2, 3] : [2, 3, 4]
    },
    { key: 'image', label: 'Image', widget: 'image', required: true, imageFolder: 'Materials/Common_Mob' },
    {
      key: 'enemies', label: 'Dropped By', widget: 'tags', required: true,
      help: 'Type a name and press Enter to add each enemy.'
    },
    { key: 'description', label: 'Description', widget: 'textarea' },
    { key: 'obtained', label: 'Obtained', widget: 'textarea' },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

// ── boss_drops (standard — Boss_Drops + Boss_Gems) ────────────────────────────

const BOSS_STANDARD_TYPE_OPTIONS = [
  { value: 'Boss Drops', label: 'Boss Drop (Boss_Drops file)' },
  { value: 'Ascension Gems', label: 'Ascension Gem (Boss_Gems file)' }
]

const bossDropsStandard: MaterialTypeSchema = {
  innerType: 'boss_drops',
  label: 'Boss Drops',
  templateKey: 'Boss_Drop',
  imageFolder: 'Materials/Boss_Drops',
  imageFolderFn: (values) =>
    values['type'] === 'Ascension Gems' ? 'Materials/Boss_Gems' : 'Materials/Boss_Drops',
  deriveFile: (values) =>
    values['type'] === 'Ascension Gems'
      ? 'Materials-Boss_Gems.json'
      : 'Materials-Boss_Drops.json',
  fields: [
    { key: 'name', label: 'Name', widget: 'text', required: true },
    { key: 'type', label: 'Category', widget: 'select', required: true, options: BOSS_STANDARD_TYPE_OPTIONS },
    {
      key: 'rarity', label: 'Rarity', widget: 'rarity', required: true,
      rarityOptions: (v) => v['type'] === 'Ascension Gems' ? [2, 3, 4, 5] : [4]
    },
    { key: 'image', label: 'Image', widget: 'image', required: true, imageFolder: 'Materials/Boss_Drops' },
    {
      key: 'enemies', label: 'Dropped By', widget: 'tags', required: true,
      help: 'Type a name and press Enter to add each enemy.'
    },
    { key: 'description', label: 'Description', widget: 'textarea' },
    { key: 'obtained', label: 'Obtained', widget: 'textarea' },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

// ── boss_drops (weekly — Weekly_Boss_Drops, no enemies field) ─────────────────

const BOSS_WEEKLY_TYPE_OPTIONS = [
  { value: 'Boss Drops (Weekly)', label: 'Weekly Boss Drop' },
  { value: 'Talent Level-up Material (Event)', label: 'Talent Event Material' }
]

const bossDropsWeekly: MaterialTypeSchema = {
  innerType: 'boss_drops',
  label: 'Weekly Boss Drops',
  templateKey: 'Weekly_Boss',
  imageFolder: 'Materials/Boss_Drops',
  deriveFile: () => 'Materials-Weekly_Boss_Drops.json',
  createMode: 'tier_set',
  tierSet: {
    tiers: [
      { templateKey: 'Weekly_Boss', rarity: 5 },
      { templateKey: 'Weekly_Boss', rarity: 5 },
      { templateKey: 'Weekly_Boss', rarity: 5 }
    ],
    sharedFieldKeys: ['type', 'obtained', 'released'],
    sharedObtained: true
  },
  fields: [
    { key: 'name', label: 'Name', widget: 'text', required: true },
    { key: 'type', label: 'Category', widget: 'select', required: true, options: BOSS_WEEKLY_TYPE_OPTIONS },
    { key: 'rarity', label: 'Rarity', widget: 'rarity', required: true, rarityOptions: [5] },
    { key: 'image', label: 'Image', widget: 'image', required: true, imageFolder: 'Materials/Boss_Drops' },
    { key: 'description', label: 'Description', widget: 'textarea' },
    { key: 'obtained', label: 'Obtained', widget: 'textarea' },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

// ── domain_material ───────────────────────────────────────────────────────────

const DOMAIN_TYPE_OPTIONS = [
  ...GENSHIN_REGIONS.map((r) => ({ value: `Domain of Forgery (${r})`, label: `Forgery – ${r}` })),
  ...GENSHIN_REGIONS.map((r) => ({ value: `Domain of Mastery (${r})`, label: `Mastery – ${r}` }))
]

const domainMaterial: MaterialTypeSchema = {
  innerType: 'domain_material',
  label: 'Domain Material',
  templateKey: 'Forgery_1',
  imageFolder: 'Materials/Forgery_Domain',
  imageFolderFn: (values) =>
    String(values['innerSubType'] ?? values['type'] ?? '').includes('mastery') ||
    String(values['type'] ?? '').includes('Mastery')
      ? 'Materials/Mastery_Domain'
      : 'Materials/Forgery_Domain',
  deriveFile: (values) =>
    String(values['innerSubType'] ?? values['type'] ?? '').includes('mastery') ||
    String(values['type'] ?? '').includes('Mastery')
      ? 'Materials-Mastery_Domain.json'
      : 'Materials-Forgery_Domain.json',
  createMode: 'tier_set',
  tierSet: {
    tiers: (shared) => {
      const isForgery = !shared['type'] || String(shared['type']).includes('Forgery')
      return isForgery
        ? [
            { templateKey: 'Forgery_1', rarity: 2 },
            { templateKey: 'Forgery_2', rarity: 3 },
            { templateKey: 'Forgery_3', rarity: 4 },
            { templateKey: 'Forgery_4', rarity: 5 }
          ]
        : [
            { templateKey: 'Mastery_1', rarity: 2 },
            { templateKey: 'Mastery_2', rarity: 3 },
            { templateKey: 'Mastery_3', rarity: 4 }
          ]
    },
    sharedFieldKeys: ['type', 'days', 'released'],
    autoAlchemy: true
  },
  fields: [
    { key: 'name', label: 'Name', widget: 'text', required: true },
    { key: 'type', label: 'Domain Type', widget: 'select', required: true, options: DOMAIN_TYPE_OPTIONS },
    {
      // Derived from `type` — not shown in the form, written automatically.
      key: 'innerSubType', label: 'innerSubType', widget: 'computed',
      computeFrom: 'type',
      computeFn: (type: unknown) => String(type).includes('Forgery') ? 'forgery' : 'mastery'
    },
    {
      key: 'rarity', label: 'Rarity', widget: 'rarity', required: true,
      rarityOptions: (v) => String(v['type'] ?? '').includes('Forgery') ? [2, 3, 4, 5] : [2, 3, 4]
    },
    { key: 'image', label: 'Image', widget: 'image', required: true, imageFolder: 'Materials/Forgery_Domain' },
    {
      key: 'days', label: 'Available Days', widget: 'days', required: true,
      help: 'Days of the week when this domain is available.'
    },
    { key: 'description', label: 'Description', widget: 'textarea' },
    { key: 'obtained', label: 'Obtained', widget: 'textarea' },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

// ── Schema registry ───────────────────────────────────────────────────────────

/**
 * Schema map. The weekly boss variant is keyed by `boss_drops:Materials-Weekly_Boss_Drops.json`
 * so it can be selected when editing records from that file specifically.
 */
const SCHEMA_MAP: Record<string, MaterialTypeSchema> = {
  local_speciality: localSpeciality,
  mob_drops: mobDrops,
  boss_drops: bossDropsStandard,
  'boss_drops:Materials-Weekly_Boss_Drops.json': bossDropsWeekly,
  domain_material: domainMaterial
}

/**
 * Look up the schema for an innerType, optionally scoped by file (needed for boss_drops which has
 * two schemas — standard and weekly — differing in whether the `enemies` field is present).
 */
export function getMaterialSchema(innerType: string, file?: string): MaterialTypeSchema | undefined {
  if (file) {
    const scoped = SCHEMA_MAP[`${innerType}:${file}`]
    if (scoped) return scoped
  }
  return SCHEMA_MAP[innerType]
}

/**
 * All create-able schema options. Used to populate the "New material" type picker.
 * Each entry describes one creatable variant.
 */
export interface CreateOption {
  label: string
  schemaKey: string
  schema: MaterialTypeSchema
}

export const CREATE_OPTIONS: CreateOption[] = [
  { label: 'Local Speciality', schemaKey: 'local_speciality', schema: localSpeciality },
  { label: 'Mob Drops (3-tier set)', schemaKey: 'mob_drops', schema: mobDrops },
  { label: 'Boss Drop / Ascension Gem', schemaKey: 'boss_drops', schema: bossDropsStandard },
  { label: 'Weekly Boss Drop (3-item set)', schemaKey: 'boss_drops:Materials-Weekly_Boss_Drops.json', schema: bossDropsWeekly },
  { label: 'Domain Material (tier set)', schemaKey: 'domain_material', schema: domainMaterial }
]

/** Derive the record key from a display name (spaces → underscores). */
export function deriveKey(name: string): string {
  return name.trim()
    .replace(/[^A-Za-z0-9_\- ]/g, '')  // strip chars outside A-Za-z0-9 _ -
    .trim()
    .replace(/\s+/g, '_')               // spaces → underscores
    .replace(/_+/g, '_')                // collapse consecutive underscores
    .replace(/^[_-]+|[_-]+$/g, '')      // trim leading/trailing _ or -
}

/** Default image filename for a new record: `Item_<key>.<ext>`. */
export function defaultImageName(key: string, ext: string): string {
  const clean = ext.replace(/^\.*/, '').toLowerCase() || 'png'
  return `Item_${key}.${clean}`
}

/**
 * Apply form values onto a base record (template skeleton for create, existing record for edit),
 * preserving the base's field order and any unknown fields.
 *
 * Managed fields are forced:
 *  - usage is always reset to empty (CI recomputes it)
 *  - subCollection defaults to {} if absent
 *  - innerType is forced to the schema's type
 *
 * Special per-widget rules:
 *  - `image`: if a non-empty value is provided, it is written directly to record.image
 *  - `tags` (string array): written only if non-empty OR the key already exists in base (prevents
 *    silently adding an `enemies` key to Weekly_Boss_Drop records that don't have one)
 *  - `days` (number array): written as a sorted number array
 *  - `computed`: value is derived via computeFn rather than read from form input
 *  - `hoyowiki` empty/NaN → null
 */
export function applyFormValues(
  base: MaterialRecord,
  schema: MaterialTypeSchema,
  values: Record<string, unknown>
): MaterialRecord {
  const record: MaterialRecord = { ...base }
  for (const field of schema.fields) {
    if (field.widget === 'image') {
      // Apply image path directly when a non-empty value is provided; otherwise keep base value.
      const img = values[field.key]
      if (img != null && img !== '') record.image = String(img)
      continue
    }
    const v = values[field.key]
    if (field.widget === 'number' || field.widget === 'rarity') {
      record[field.key] =
        v === '' || v === null || v === undefined || Number.isNaN(Number(v))
          ? null
          : Number(v)
    } else if (field.widget === 'bool') {
      record[field.key] = Boolean(v)
    } else if (field.widget === 'textarea' || field.widget === 'text') {
      record[field.key] = v === '' || v === undefined ? null : (v as string)
    } else if (field.widget === 'select') {
      record[field.key] = v as never
    } else if (field.widget === 'tags') {
      const arr = (Array.isArray(v) ? v : []) as string[]
      const clean = arr.map((s) => String(s).trim()).filter(Boolean)
      // Don't silently add an empty array to records that have never had this key.
      if (clean.length > 0 || field.key in base) {
        record[field.key] = clean
      }
    } else if (field.widget === 'days') {
      const arr = (Array.isArray(v) ? v : []) as number[]
      record[field.key] = [...arr].sort((a, b) => a - b)
    } else if (field.widget === 'computed') {
      if (field.computeFrom && field.computeFn) {
        record[field.key] = field.computeFn(values[field.computeFrom]) as never
      }
    }
  }
  record.innerType = schema.innerType
  record.usage = { characters: [], weapons: [] }
  if (record.subCollection == null) record.subCollection = {}
  return record
}

/**
 * Return a string that uniquely identifies which tier set a record belongs to.
 * Records that share the same key are in the same set.
 * Returns '' for types that don't use tier sets.
 */
export function getTierSetKey(record: MaterialRecord, innerType: string, file?: string): string {
  if (innerType === 'boss_drops' && file?.includes('Weekly_Boss')) {
    return `weekly:${record.obtained ?? ''}`
  }
  if (innerType === 'mob_drops') {
    const enemies = [...((record.enemies ?? []) as string[])].sort()
    return `mob:${record.type ?? ''}:${enemies.join(',')}`
  }
  if (innerType === 'domain_material') {
    const days = [...((record.days ?? []) as number[])].sort((a, b) => a - b)
    return `domain:${record.type ?? ''}:${days.join(',')}`
  }
  return ''
}

/**
 * Find all records in `allRecords` that belong to the same tier set as `record`.
 * Returns them sorted by rarity (ascending), or null if the count doesn't match
 * the expected tier count for the schema (meaning the set is incomplete/orphaned).
 */
export function findTierSetSiblings(
  record: MaterialRecord,
  innerType: string,
  file: string,
  allRecords: Record<string, MaterialRecord>
): { key: string; record: MaterialRecord }[] | null {
  const schema = getMaterialSchema(innerType, file)
  if (!schema?.tierSet) return null

  const setKey = getTierSetKey(record, innerType, file)
  if (!setKey) return null

  const siblings = Object.entries(allRecords)
    .filter(([, r]) => getTierSetKey(r, innerType, file) === setKey)
    .sort(([, a], [, b]) => ((a.rarity as number) ?? 0) - ((b.rarity as number) ?? 0))

  // Determine expected tier count from schema config using the record's shared values
  const sharedProxy = { type: record.type ?? '', innerSubType: record.innerSubType ?? '' }
  const expectedCount = resolveTiers(schema.tierSet, sharedProxy).length
  if (siblings.length !== expectedCount) return null

  return siblings.map(([k, r]) => ({ key: k, record: r }))
}
