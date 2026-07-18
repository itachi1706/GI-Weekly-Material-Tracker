// Shared helpers for applying wiki-fetched values into an entity form's draft. Used by the
// Character and Weapon auto-fill flows (and any future entity).
import type { ImageState } from '../materials/util'
import { normalizeImageUrl, sanitizeImageBasename, extOf } from '../materials/util'

/**
 * Build a url-mode ImageState from a raw wiki CDN URL (normalized).
 * `basename` controls the save-as name:
 *  - undefined → the wiki filename (correct for talent/passive icons, e.g. "Sword_Hydro", "Talent_X")
 *  - a string  → that exact name (constellations pass the wiki name minus its "Constellation_" prefix)
 *  - null      → omit it, so the commit falls back to the entry's default (e.g. the character/weapon key)
 */
export function urlStateFromWiki(raw: string, basename?: string | null): ImageState {
  const url = normalizeImageUrl(raw)
  if (basename === null) return { mode: 'url', url }
  return { mode: 'url', url, imageName: basename ?? sanitizeImageBasename(url) }
}

/**
 * The final on-disk filename (basename + extension) a wiki icon URL will produce — so the review
 * preview matches the committed name and can be compared against the current image. `override`
 * supplies a custom basename (constellations pass their prefix-stripped name).
 */
export function wikiIconFileName(raw: string, override?: string): string {
  const url = normalizeImageUrl(raw)
  const base = override ?? sanitizeImageBasename(url)
  return `${base}.${extOf(url)}`
}

/** Human-readable summary of an ImageState for the review table's "current" column. */
export function describeImage(state: ImageState): string {
  if (state.mode === 'existing') return state.relative.split('/').pop() ?? state.relative
  if (state.mode === 'url') return state.url.split('/').pop() ?? state.url
  if (state.mode === 'localFile') return state.sourcePath.split(/[/\\]/).pop() ?? state.sourcePath
  return ''
}

/** Trim + case-insensitive equality (drives the "changed" default-check in the review panel). */
export const eqi = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()
