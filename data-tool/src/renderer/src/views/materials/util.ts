import type { ImagePlan } from '@shared/types'

/** Extension (no dot, lowercased) from a path or URL; defaults to "png". */
export function extOf(pathOrUrl: string): string {
  const clean = pathOrUrl.split(/[?#]/)[0]
  const m = clean.match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : 'png'
}

/** How the user is sourcing the image in the form. */
export type ImageState =
  | { mode: 'none' }
  | { mode: 'existing'; relative: string }
  | { mode: 'localFile'; sourcePath: string; imageName?: string }
  | { mode: 'url'; url: string; imageName?: string }

/**
 * Normalize an image URL by truncating everything after the image filename.
 * Genshin Wiki / Fandom (and similar CDNs) append `/revision/latest/scale-to-width-down/NNN?cb=…`
 * after the real filename, e.g.
 *   https://…/Sandrone_Icon.png/revision/latest/scale-to-width-down/150?cb=2026…
 * → https://…/Sandrone_Icon.png
 * Keeps the true filename (so the save-as name is "Sandrone_Icon", not "150") and fetches full-res.
 * If the URL has no recognizable image extension, it's returned unchanged.
 */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim()
  const m = trimmed.match(/^(https?:\/\/.*?\.(?:png|jpe?g|gif|webp|avif|bmp|svg))(?:[/?#].*)?$/i)
  return m ? m[1] : trimmed
}

/**
 * Derive a safe image basename from a URL.
 * URL-decodes first (so `%2C`, `%21` etc. become the real punctuation), strips the extension, then
 * drops anything that isn't alphanumeric / dash / underscore — collapsing runs to a single `_` and
 * trimming edges. So `…Not%21.png` → `Not`, `…Life%2C_Who…` → `Life_Who` (matching the dataset).
 */
export function sanitizeImageBasename(url: string): string {
  const clean = url.split(/[?#]/)[0]
  let filename = clean.split('/').pop() ?? 'image'
  try {
    filename = decodeURIComponent(filename)
  } catch {
    // Malformed %-escape — fall back to the raw filename.
  }
  const base = filename.replace(/\.[^.]+$/, '') || 'image'
  return (
    base
      .replace(/['’]/g, '') // apostrophes are dropped, not underscored ("It's" → "Its")
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'image'
  )
}

/** Convert form ImageState + the target relative path into an ImagePlan for the commit. */
export function toImagePlan(state: ImageState, destRelative: string): ImagePlan | null {
  switch (state.mode) {
    case 'existing':
      return { source: 'existing', relativePath: state.relative }
    case 'localFile':
      return { source: 'localFile', sourcePath: state.sourcePath, destRelative }
    case 'url':
      return { source: 'url', url: state.url, destRelative }
    default:
      return null
  }
}
