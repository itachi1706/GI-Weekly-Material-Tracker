import type { EntityConfig } from './types'

/** Subfolders a valid dataset root must contain. */
export const REQUIRED_SUBFOLDERS = ['data', 'images', 'templates'] as const

/**
 * The dataset entities, in display order. Values derive from the real on-disk layout:
 *   - Characters-<Element>.json   -> rootKey "characters"
 *   - Weapons-<Type>.json         -> rootKey "weapons"
 *   - Materials-<Category>.json   -> rootKey "materials"
 *   - Outfits-<Type>.json         -> rootKey "outfits"
 *   - EventBanners.json           -> rootKey "banners" (arrays per banner type)
 *
 * `enabled` is false for all entities this milestone; flip to true (and add a view)
 * as each entity's CRUD is built.
 */
export const ENTITIES: EntityConfig[] = [
  { key: 'materials', label: 'Materials', rootKey: 'materials', filePrefix: 'Materials-', enabled: true },
  { key: 'characters', label: 'Characters', rootKey: 'characters', filePrefix: 'Characters-', enabled: false },
  { key: 'weapons', label: 'Weapons', rootKey: 'weapons', filePrefix: 'Weapons-', enabled: false },
  { key: 'outfits', label: 'Outfits', rootKey: 'outfits', filePrefix: 'Outfits-', enabled: false },
  { key: 'banners', label: 'Banners', rootKey: 'banners', singleFile: 'EventBanners.json', enabled: false }
]
