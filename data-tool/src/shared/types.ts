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
