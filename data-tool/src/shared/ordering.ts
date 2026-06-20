/**
 * Ordering helpers for writing name-keyed dataset objects back to disk.
 *
 * Each data/*.json file (except EventBanners) has the shape:
 *     { "<rootKey>": { "<RecordName>": { ... } } }
 * Key order is significant and must match the existing on-disk convention:
 *   - Characters / Weapons / Outfits: alphabetical by record name (case-insensitive).
 *   - Materials: alphabetical OR append-to-bottom, depending on the file.
 *   - EventBanners.json: arrays under banners.{character,weapon,standard,chronicled,template};
 *     each array keeps its own chronological order (handled separately, not here).
 *
 * JS objects preserve string-key insertion order, so the strategy is to rebuild the records
 * object by inserting keys in the desired sequence, then JSON.stringify with 2-space indent.
 *
 * NOT IMPLEMENTED YET — wired up in the per-entity CRUD milestones.
 */
export type InsertMode = 'alphabetical' | 'append'

export function insertRecord<T>(
  _records: Record<string, T>,
  _name: string,
  _record: T,
  _mode: InsertMode
): Record<string, T> {
  throw new Error('ordering.insertRecord not implemented yet (future milestone)')
}
