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

/** A talent attack/passive entry (keyed by a name-derived key). On-disk field order preserved. */
export interface CharacterTalentEntry {
  name: string | null
  effect: string | null
  image: string | null
  order: number
  type: string
  [key: string]: unknown
}

/** A constellation entry ("1".."6"). No order/type. */
export interface CharacterConstellation {
  name: string | null
  effect: string | null
  image: string | null
  [key: string]: unknown
}

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
    passives?: Record<string, CharacterTalentEntry>
    attack?: Record<string, CharacterTalentEntry>
    [key: string]: unknown
  }
  constellations?: Record<string, CharacterConstellation>
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
  /** Portrait image op. */
  image?: ImagePlan
  /** Additional image ops (talent/constellation icons). */
  images?: ImagePlan[]
}

// ---- Wiki auto-fill (Fandom Genshin Impact wiki) ----

/** One talent parsed from a wiki page. `type` is the wiki label (e.g. "Normal Attack", "Elemental
 * Skill", "1st Ascension Passive", "Utility Passive"); the renderer maps it to a draft attack/passive. */
export interface WikiTalent {
  name: string
  type: string
  effect: string | null
  /** Raw Fandom CDN URL (renderer normalizes via normalizeImageUrl). */
  iconUrl: string | null
}

/** One constellation parsed from a wiki page. `index` is 1..6 (matches the dataset "1".."6" keys). */
export interface WikiConstellation {
  index: number
  name: string
  effect: string | null
  iconUrl: string | null
}

/**
 * Result of parsing a Fandom character page. All identity fields are raw candidate strings the user
 * reviews per-field; nulls mean "not found on the page" (a missing field never crashes the parse).
 * `element`/`weapon`/`rarity` are confirmation-only (never auto-applied). `description`/`introduction`
 * are intentionally absent — the in-game archive/profile text is not on the wiki page.
 */
export interface WikiCharacterResult {
  sourceUrl: string
  title: string
  /** Canonical Fandom page URL for the (redirect-resolved) title — for the dataset `wiki` field. */
  wikiUrl: string
  name: string | null
  /** From infobox `realname` — often a partial match for the dataset `fullName`. */
  fullName: string | null
  /** From infobox `title` — maps to the dataset `caption`. */
  caption: string | null
  /** From infobox `title2`(+3) — maps to the dataset `titles[]`. */
  titles: string[]
  /** From infobox `affiliation`(+2/3), joined with ", ". */
  affiliation: string | null
  /** Constellation NAME (infobox `constellation`). */
  constellation: string | null
  /** From infobox `region`. */
  nation: string | null
  /** Reformatted to the dataset "DD/MM" from the wiki "Month Dayth". */
  birthday: string | null
  // confirmation-only (compared, never applied):
  element: string | null
  weapon: string | null
  rarity: number | null
  talents: WikiTalent[]
  constellations: WikiConstellation[]
  /** Candidate portrait/card image URLs from the infobox gallery (raw Fandom CDN URLs). */
  imageCandidates: { label: string; url: string }[]
}

/**
 * Result of parsing a Fandom weapon page. Candidate strings the user reviews per-field; nulls mean
 * "not found". `secondaryStatType` is the RAW wiki value (e.g. "CRIT DMG") — the renderer maps it to
 * the form's `%`-vocab. `type`/`rarity` are confirmation-only. `obtained` is intentionally absent (the
 * dataset's is a hand-curated controlled vocab that doesn't map from the wiki's short obtain text).
 */
export interface WikiWeaponResult {
  sourceUrl: string
  title: string
  wikiUrl: string
  name: string | null
  series: string | null
  description: string | null
  effectName: string | null
  /** Passive effect with `(varN)` placeholders substituted to `R1~R5` inline ranges. */
  effect: string | null
  baseAtk: number | null
  maxBaseAtk: number | null
  secondaryStat: string | null
  maxSecondaryStat: string | null
  /** Raw wiki stat type, e.g. "CRIT DMG" / "Physical DMG Bonus" (renderer maps to form vocab). */
  secondaryStatType: string | null
  // confirmation-only:
  type: string | null
  rarity: number | null
  iconUrl: string | null
}

/**
 * Result of parsing a Fandom outfit page. `character`/`type`/`rarity` are confirmation-only (the wiki
 * `type` is the outfit *set* "Themed"/"Default", not the dataset `type` "Summer"/"Formal"). `obtained`
 * DOES map cleanly. Portrait/wish image URLs come from the infobox gallery (raw Fandom CDN URLs).
 */
export interface WikiOutfitResult {
  sourceUrl: string
  title: string
  wikiUrl: string
  name: string | null
  description: string | null
  /** Long lore from the `==Description==` section (multi-paragraph, `\n`-joined). */
  lore: string | null
  obtained: string | null
  // confirmation-only:
  character: string | null
  type: string | null
  rarity: number | null
  /** "In-Game" gallery image → portrait slot. */
  portraitUrl: string | null
  /** "Wish" gallery image → wishimage slot. */
  wishUrl: string | null
}

/**
 * Result of parsing a Fandom material (`{{Item Infobox}}`) page. Description-centric: `obtained`,
 * `enemies`, `hoyowiki` are intentionally absent (dataset values are curated / not on the wiki).
 * `rarity`/`type` are confirmation-only. `days` (domain-material availability) is Mon=1…Sun=7.
 */
export interface WikiMaterialResult {
  sourceUrl: string
  title: string
  wikiUrl: string
  name: string | null
  description: string | null
  /** Bullet list built from the infobox `source1..N` params (`- a\n- b`), for the `obtained` field. */
  obtained: string | null
  days: number[] | null
  /** Raw infobox `type` param (broad category, e.g. "Local Specialty (Inazuma)"). */
  type: string | null
  /** Infobox `group` param (the useful Item Group, e.g. "Local Specialties", "Normal Boss Drops"). */
  group: string | null
  /** Infobox `group2` param (secondary group, e.g. "Ascension Gems", "Talent Books"). */
  group2: string | null
  rarity: number | null
  iconUrl: string | null
}

// ---- Banners ----

export type BannerType = 'character' | 'weapon' | 'standard' | 'chronicled'

/**
 * One event-wish banner. Unlike other entities, banners live in arrays (per type) inside
 * EventBanners.json, not a name-keyed map. `versionName` is sometimes ABSENT (not null) — preserve
 * its presence. `characters`/`weapons` are the full gacha pool; `rateup*` are the featured entries.
 */
export interface BannerRecord {
  name?: string | null
  start?: string | null
  end?: string | null
  description?: string | null
  type?: string | null
  characters?: string[]
  weapons?: string[]
  rateupcharacters?: string[]
  rateupweapon?: string[]
  softpity?: number | null
  hardpity?: number | null
  versionNumber?: number | null
  versionName?: string | null
  wiki?: string | null
  image?: string | null
  [key: string]: unknown
}

export interface BannerSummary {
  bannerType: BannerType
  index: number
  name: string
  version: number
  start: string
  end: string
  image: string
  rateup: string[]
}

export interface BannerChange {
  op: 'create' | 'update' | 'delete'
  bannerType: BannerType
  /** Array index within the type's array — required for update/delete. */
  index?: number
  record?: BannerRecord
  image?: ImagePlan
}
