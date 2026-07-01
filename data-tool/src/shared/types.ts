export type EntityKey = 'materials' | 'characters' | 'weapons' | 'outfits' | 'banners'

/**
 * Static description of one dataset entity. Drives the sidebar navigation now and the
 * per-entity CRUD views in later milestones. Single source of truth: shared/entities.ts.
 */
export interface EntityConfig {
  key: EntityKey
  label: string
  /** Top-level JSON key inside each file, e.g. "characters", "weapons", "banners". */
  rootKey: string
  /** File-name prefix for multi-file entities, e.g. "Characters-". */
  filePrefix?: string
  /** Exact file name for single-file entities, e.g. "EventBanners.json". */
  singleFile?: string
  /** When false the entity is shown but disabled in the UI. All false this milestone. */
  enabled: boolean
}

/** Per-entity scan result: which files matched and how many records they hold. */
export interface EntitySummary {
  key: EntityKey
  label: string
  files: string[]
  recordCount: number
}

/** Result of scanning a candidate dataset folder. */
export interface DatasetInfo {
  /** True only when all required subfolders exist. */
  valid: boolean
  rootPath: string
  /** Required subfolders that were missing (empty when valid). */
  missing: string[]
  /** Per-entity counts (empty when invalid). */
  entities: EntitySummary[]
}

// ---- Materials ----

export type MaterialInnerType = 'local_speciality' | 'mob_drops' | 'boss_drops' | 'domain_material'

/** A material record. Common fields are typed; innerType-specific fields are optional. */
export interface MaterialRecord {
  image: string
  rarity: number
  type: string
  innerType: MaterialInnerType
  description: string | null
  obtained: string | null
  name: string | null
  released: boolean
  wiki: string | null
  usage: { characters: string[]; weapons: string[] }
  hoyowiki: number | null
  subCollection: Record<string, unknown>
  // innerType-specific (not used by local_speciality):
  enemies?: string[]
  days?: number[]
  innerSubType?: string
  [extra: string]: unknown
}

/** Lightweight row for the browse list. */
export interface MaterialSummary {
  key: string
  file: string
  innerType: MaterialInnerType | string
  name: string
  rarity: number
  image: string
  released: boolean
  /** Whether this innerType has an editable form yet. */
  editable: boolean
}

/** Where a new/updated image comes from. The dest relative path is stored in the record's `image`. */
export type ImagePlan =
  | { source: 'existing'; relativePath: string }
  | { source: 'localFile'; sourcePath: string; destRelative: string }
  | { source: 'url'; url: string; destRelative: string }

/** A pending change to a material record, fed to previewCommit/commit. */
export interface MaterialChange {
  op: 'create' | 'update' | 'delete'
  /** Target data file, e.g. "Materials-Local_Specialities.json". */
  file: string
  /** Record key after the change (omit meaning for delete: the key to remove). */
  key: string
  /** For update/rename: the previous key (if the name/key changed). */
  originalKey?: string
  /** The full record to write (create/update). Omitted for delete. */
  record?: MaterialRecord
  /** Where to place a newly-inserted key. */
  ordering: InsertModeName
  /** Optional image operation performed on commit. */
  image?: ImagePlan
}

export type InsertModeName = 'alphabetical' | 'append'

/** Result of previewCommit: the file before/after + a human description of any image action. */
export interface CommitPreview {
  file: string
  before: string
  after: string
  imageAction: string | null
  /** Set when the target file fails the round-trip gate (would reformat untouched records). */
  formattingDriftWarning: string | null
}

export interface CommitResult {
  ok: boolean
  error?: string
}

// ---- Outfits ----

export interface OutfitRecord {
  name?: string | null
  character?: string | null
  characters?: string[]
  rarity?: number
  type?: string
  image?: string | null
  thumbnail?: string | null
  wishimage?: string | null
  '3dmodel'?: string | null
  description?: string | null
  obtained?: string | null
  lore?: string | null
  shop?: boolean
  shop_cost?: number
  shop_cost_discounted?: number
  shop_cost_discounted_till?: string | null
  event_give_free?: boolean
  event_give_free_till?: string | null
  released_version?: number
  released_version_name?: string | null
  released?: boolean
  wiki?: string | null
  subCollection?: Record<string, never>
  [key: string]: unknown
}

export interface OutfitSummary {
  key: string
  file: string
  name: string
  character: string
  type: string
  image: string
  rarity: number
  released: boolean
}

export interface OutfitChange {
  op: 'create' | 'update' | 'delete'
  file: string
  key: string
  originalKey?: string
  record?: OutfitRecord
  ordering: InsertModeName
  /** Primary portrait (image field) */
  image?: ImagePlan
  /** Character thumbnail (thumbnail field) */
  thumbnailImage?: ImagePlan
  /** Wish card (wishimage field) */
  wishimageImage?: ImagePlan
}

// ---- Weapons ----

export interface WeaponAscensionPhase {
  material3: string
  level: number
  material2: string
  material3qty: number
  material1: string
  material2qty: number
  material1qty: number
  mora: number
  material3type: string
  material2type: string
  material1type: string
}

export interface WeaponRecord {
  secondary_stat_type?: string | null
  description?: string | null
  name?: string | null
  series?: string | null
  ascension?: Record<string, WeaponAscensionPhase>
  materials?: { ascension?: Record<string, string> }
  image?: string | null
  secondary_stat?: string | null
  rarity?: number
  type?: string | null
  max_secondary_stat?: string | null
  max_base_atk?: number | null
  base_atk?: number | null
  obtained?: string | null
  effectName?: string | null
  effect?: string | null
  released?: boolean
  wiki?: string | null
  hoyowiki?: number | null
  subCollection?: Record<string, never>
  [key: string]: unknown
}

export interface WeaponSummary {
  key: string
  file: string
  name: string
  type: string
  rarity: number
  image: string
  released: boolean
}

export interface WeaponChange {
  op: 'create' | 'update' | 'delete'
  file: string
  key: string
  originalKey?: string
  record?: WeaponRecord
  ordering: InsertModeName
  image?: ImagePlan
}

// ---- Characters ----

/** A character-level ascension phase ("1".."6"). material*type keys point into materials.ascension. */
export interface CharacterAscensionPhase {
  level: number
  mora: number
  material1: string | null
  material1qty: number
  material2: string | null
  material2qty: number
  material3: string | null
  material3qty: number
  material4: string | null
  material4qty: number
  material1type: string | null
  material2type: string | null
  material3type: string | null
  material4type: string | null
  [key: string]: unknown
}

/** A talent level-up entry ("2".."10"). material*type keys point into materials.talents. */
export interface CharacterTalentLevel {
  mora: number
  material1: string | null
  material1qty: number
  material2: string | null
  material2qty: number
  material3: string | null
  material3qty: number
  material4: string | null
  material4qty: number
  material1type: string | null
  material2type: string | null
  material3type: string | null
  material4type: string | null
  [key: string]: unknown
}

/**
 * `talents.passives`, `talents.attack`, and `constellations` are passed through verbatim this
 * milestone (not richly edited), so they're typed loosely as pass-through objects.
 */
export interface CharacterRecord {
  image?: string | null
  gender?: string | null
  birthday?: string | null
  caption?: string | null
  titles?: string[]
  name?: string | null
  fullName?: string | null
  description?: string | null
  nation?: string | null
  weapon?: string | null
  rarity?: number
  affiliation?: string | null
  constellation?: string | null
  outfits?: string[]
  talents?: {
    ascension?: Record<string, CharacterTalentLevel>
    passives?: Record<string, unknown>
    attack?: Record<string, unknown>
    [key: string]: unknown
  }
  constellations?: Record<string, unknown>
  ascension?: Record<string, CharacterAscensionPhase>
  materials?: {
    ascension?: Record<string, string>
    talents?: Record<string, string>
  }
  introduction?: string | null
  paimonmoepath?: string | null
  genshinggpath?: string | null
  element?: string | null
  released?: boolean
  wiki?: string | null
  hoyowiki?: number | null
  subCollection?: Record<string, never>
  [key: string]: unknown
}

export interface CharacterSummary {
  key: string
  file: string
  name: string
  element: string
  weapon: string
  rarity: number
  image: string
  released: boolean
}

export interface CharacterChange {
  op: 'create' | 'update' | 'delete'
  file: string
  key: string
  originalKey?: string
  record?: CharacterRecord
  ordering: InsertModeName
  image?: ImagePlan
}
