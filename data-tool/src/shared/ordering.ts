/**
 * Ordering helpers for writing name-keyed dataset objects back to disk.
 *
 * Each data/*.json file (except EventBanners) has the shape:
 *     { "<rootKey>": { "<RecordName>": { ... } } }
 * Key order is significant and must match the existing on-disk convention. Verified against
 * Materials-Local_Specialities.json: keys are ordered by raw code-unit comparison (NOT locale-aware) —
 * equivalent to a default JS string sort. So we compare with `<`/`>`, not `localeCompare`.
 *
 * These helpers preserve the order of all untouched keys; only the affected key moves. JS objects keep
 * string-key insertion order, so we rebuild the object inserting keys in the desired sequence.
 */
export type InsertMode = 'alphabetical' | 'append'

/** Raw code-unit comparison, matching the dataset's on-disk key ordering. */
export function compareKeys(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Insert or replace `key` -> `record`.
 * - If `key` already exists: replace in place (order unchanged).
 * - `mode: 'append'`: add at the end.
 * - `mode: 'alphabetical'`: insert at the code-unit-sorted position.
 */
export function insertRecord<T>(
  records: Record<string, T>,
  key: string,
  record: T,
  mode: InsertMode
): Record<string, T> {
  if (Object.prototype.hasOwnProperty.call(records, key)) {
    const out: Record<string, T> = {}
    for (const k of Object.keys(records)) out[k] = k === key ? record : records[k]
    return out
  }

  if (mode === 'append') {
    return { ...records, [key]: record }
  }

  const out: Record<string, T> = {}
  let inserted = false
  for (const k of Object.keys(records)) {
    if (!inserted && compareKeys(key, k) < 0) {
      out[key] = record
      inserted = true
    }
    out[k] = records[k]
  }
  if (!inserted) out[key] = record
  return out
}

/** Remove `key`, preserving the order of the rest. Returns a new object. */
export function removeRecord<T>(records: Record<string, T>, key: string): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k of Object.keys(records)) {
    if (k !== key) out[k] = records[k]
  }
  return out
}

/** Rename `fromKey` -> `toKey`, re-inserting per `mode` (used when a record's name changes). */
export function renameRecord<T>(
  records: Record<string, T>,
  fromKey: string,
  toKey: string,
  record: T,
  mode: InsertMode
): Record<string, T> {
  return insertRecord(removeRecord(records, fromKey), toKey, record, mode)
}
