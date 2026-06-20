import type { MaterialInnerType, MaterialRecord } from './types'

/** Form widget kinds the renderer knows how to draw. */
export type Widget = 'text' | 'textarea' | 'number' | 'select' | 'bool' | 'image' | 'tags' | 'days' | 'computed'

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
   *  innerType, rarity for local_speciality) are excluded. */
  fields: FieldSpec[]
}

/** Resolve the actual images/ folder to use given the current form values. */
export function resolveImageFolder(schema: MaterialTypeSchema, values: Record<string, unknown>): string {
  return schema.imageFolderFn ? schema.imageFolderFn(values) : schema.imageFolder
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
  fields: [
    {
      key: 'name', label: 'Name', widget: 'text', required: true,
      help: 'Display name. Record key derived from this.'
    },
    { key: 'type', label: 'Category', widget: 'select', required: true, options: MOB_TYPE_OPTIONS },
    { key: 'rarity', label: 'Rarity', widget: 'number', required: true, help: '1–3 (Normal) or 2–4 (Elite)' },
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
    { key: 'rarity', label: 'Rarity', widget: 'number', required: true },
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
  fields: [
    { key: 'name', label: 'Name', widget: 'text', required: true },
    { key: 'type', label: 'Category', widget: 'select', required: true, options: BOSS_WEEKLY_TYPE_OPTIONS },
    { key: 'rarity', label: 'Rarity', widget: 'number', required: true },
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
  fields: [
    { key: 'name', label: 'Name', widget: 'text', required: true },
    { key: 'type', label: 'Domain Type', widget: 'select', required: true, options: DOMAIN_TYPE_OPTIONS },
    {
      // Derived from `type` — not shown in the form, written automatically.
      key: 'innerSubType', label: 'innerSubType', widget: 'computed',
      computeFrom: 'type',
      computeFn: (type: unknown) => String(type).includes('Forgery') ? 'forgery' : 'mastery'
    },
    { key: 'rarity', label: 'Rarity', widget: 'number', required: true, help: '2–5' },
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
  { label: 'Mob Drops', schemaKey: 'mob_drops', schema: mobDrops },
  { label: 'Boss Drop / Ascension Gem', schemaKey: 'boss_drops', schema: bossDropsStandard },
  { label: 'Weekly Boss Drop', schemaKey: 'boss_drops:Materials-Weekly_Boss_Drops.json', schema: bossDropsWeekly },
  { label: 'Domain Material', schemaKey: 'domain_material', schema: domainMaterial }
]

/** Derive the record key from a display name (spaces → underscores). */
export function deriveKey(name: string): string {
  return name.trim().replace(/\s+/g, '_')
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
 *  - `tags` (string array): written only if non-empty OR the key already exists in base (prevents
 *    silently adding an `enemies` key to Weekly_Boss_Drop records that don't have one)
 *  - `days` (number array): written as a sorted number array
 *  - `computed`: value is derived via computeFn rather than read from form input
 *  - `hoyowiki` empty/NaN → null
 *  - `image` is handled outside this function (it lives in draft.imageState)
 */
export function applyFormValues(
  base: MaterialRecord,
  schema: MaterialTypeSchema,
  values: Record<string, unknown>
): MaterialRecord {
  const record: MaterialRecord = { ...base }
  for (const field of schema.fields) {
    if (field.widget === 'image') continue
    const v = values[field.key]
    if (field.widget === 'number') {
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
