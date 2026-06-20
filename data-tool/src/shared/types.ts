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
