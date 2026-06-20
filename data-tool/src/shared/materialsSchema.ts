import type { MaterialInnerType, MaterialRecord } from './types'

/** Form widget kinds the renderer knows how to draw. */
export type Widget = 'text' | 'textarea' | 'number' | 'select' | 'bool' | 'image'

export interface FieldSpec {
  key: string
  label: string
  widget: Widget
  required?: boolean
  options?: { value: string | number; label: string }[]
  help?: string
  /** For the image widget: the images/ subfolder this field's files live in. */
  imageFolder?: string
}

export interface MaterialTypeSchema {
  innerType: MaterialInnerType
  label: string
  /** Skeleton key inside templates/materials.json used as the base for new records. */
  templateKey: string
  /** images/ subfolder for this type's assets. */
  imageFolder: string
  /** Editable fields, in form display order. Fields not listed (usage, subCollection, rarity for
   *  local_speciality, innerType) are managed implicitly and never shown. */
  fields: FieldSpec[]
}

const GENSHIN_REGIONS = [
  'Mondstadt',
  'Liyue',
  'Inazuma',
  'Sumeru',
  'Fontaine',
  'Natlan',
  'Nod-Krai'
] as const

const LOCAL_SPECIALITY_TYPES = GENSHIN_REGIONS.map((r) => ({
  value: `Local Speciality (${r})`,
  label: r
}))

const localSpeciality: MaterialTypeSchema = {
  innerType: 'local_speciality',
  label: 'Local Speciality',
  templateKey: 'Local_Speciality',
  imageFolder: 'Materials/Local_Specialities',
  fields: [
    {
      key: 'name',
      label: 'Name',
      widget: 'text',
      required: true,
      help: 'Display name. The record key is derived from this (spaces → underscores).'
    },
    {
      key: 'type',
      label: 'Region',
      widget: 'select',
      required: true,
      options: LOCAL_SPECIALITY_TYPES
    },
    {
      key: 'image',
      label: 'Image',
      widget: 'image',
      required: true,
      imageFolder: 'Materials/Local_Specialities'
    },
    { key: 'description', label: 'Description', widget: 'textarea' },
    {
      key: 'obtained',
      label: 'Obtained',
      widget: 'textarea',
      help: 'Multi-line, e.g. "- Found on Seirai Island"'
    },
    { key: 'wiki', label: 'Wiki URL', widget: 'text' },
    { key: 'hoyowiki', label: 'HoYoWiki ID', widget: 'number', help: 'Numeric ID, or leave blank.' },
    { key: 'released', label: 'Released', widget: 'bool' }
  ]
}

/** innerTypes that have an editable form this milestone. */
export const MATERIAL_SCHEMAS: Partial<Record<MaterialInnerType, MaterialTypeSchema>> = {
  local_speciality: localSpeciality
}

export function getMaterialSchema(innerType: string): MaterialTypeSchema | undefined {
  return MATERIAL_SCHEMAS[innerType as MaterialInnerType]
}

/** Derive the record key from a display name (spaces → underscores). */
export function deriveKey(name: string): string {
  return name.trim().replace(/\s+/g, '_')
}

/** Default image filename for a new record in a type's folder: `Item_<key>.<ext>`. */
export function defaultImageName(key: string, ext: string): string {
  const clean = ext.replace(/^\.*/, '').toLowerCase() || 'png'
  return `Item_${key}.${clean}`
}

/**
 * Apply form values onto a base record (template skeleton for create, existing record for update),
 * preserving the base's field order and any unknown fields. Managed fields are forced:
 *  - usage is always reset to empty (CI recomputes it)
 *  - subCollection defaults to {} if absent
 *  - innerType is forced to the schema's type
 * `hoyowiki` empty string/NaN becomes null.
 */
export function applyFormValues(
  base: MaterialRecord,
  schema: MaterialTypeSchema,
  values: Record<string, unknown>
): MaterialRecord {
  const record: MaterialRecord = { ...base }
  for (const field of schema.fields) {
    const v = values[field.key]
    if (field.widget === 'number') {
      record[field.key] = v === '' || v === null || v === undefined || Number.isNaN(Number(v))
        ? null
        : Number(v)
    } else if (field.widget === 'bool') {
      record[field.key] = Boolean(v)
    } else if (field.widget === 'textarea' || field.widget === 'text') {
      record[field.key] = v === '' || v === undefined ? null : (v as string)
    } else {
      record[field.key] = v as never
    }
  }
  record.innerType = schema.innerType
  record.usage = { characters: [], weapons: [] }
  if (record.subCollection == null) record.subCollection = {}
  return record
}
