import type { ImagePlan } from '@shared/types'

/** Extension (no dot, lowercased) from a path or URL; defaults to "png". Ignores a Fandom
 *  `/revision/latest[/scale…]` suffix so the ext is read from the real `…X.png` filename. */
export function extOf(pathOrUrl: string): string {
  const clean = pathOrUrl.split(/[?#]/)[0].replace(/\/revision\/.*$/i, '')
  const m = /\.([a-zA-Z0-9]+)$/.exec(clean)
  return m ? m[1].toLowerCase() : 'png'
}

/** How the user is sourcing the image in the form. */
export type ImageState =
  | { mode: 'none' }
  | { mode: 'existing'; relative: string }
  | { mode: 'localFile'; sourcePath: string; imageName?: string }
  | { mode: 'url'; url: string; imageName?: string }

/**
 * Normalize a Fandom image URL to the full-res LATEST-revision download URL, dropping the thumbnail
 * scaling + cache-buster. Fandom serves `…/X.png/revision/latest/scale-to-width-down/NNN?cb=…`; we
 * keep `…/X.png/revision/latest` (the un-scaled latest revision), e.g.
 *   https://…/Prune_Icon.png/revision/latest/scale-to-width-down/74?cb=2026…
 * → https://…/Prune_Icon.png/revision/latest
 * The save-as name is derived separately (`sanitizeImageBasename` ignores the `/revision/…` suffix, so
 * it still yields "Prune_Icon"). URLs without `/revision/…` fall back to truncating after the image
 * extension; anything unrecognized is returned unchanged.
 */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim()
  const rev = /^(https?:\/\/.*?\/revision\/latest)(?:[/?#].*)?$/i.exec(trimmed)
  if (rev) return rev[1]
  const m = /^(https?:\/\/.*?\.(?:png|jpe?g|gif|webp|avif|bmp|svg))(?:[/?#].*)?$/i.exec(trimmed)
  return m ? m[1] : trimmed
}

/**
 * Derive a safe image basename from a URL.
 * URL-decodes first (so `%2C`, `%21` etc. become the real punctuation), strips the extension, then
 * drops anything that isn't alphanumeric / dash / underscore — collapsing runs to a single `_` and
 * trimming edges. So `…Not%21.png` → `Not`, `…Life%2C_Who…` → `Life_Who` (matching the dataset).
 */
export function sanitizeImageBasename(url: string): string {
  // Drop query/hash AND a Fandom `/revision/latest[/scale…]` suffix so the last path segment is the
  // real `X.png` filename (not "latest").
  const clean = url.split(/[?#]/)[0].replace(/\/revision\/.*$/i, '')
  let filename = clean.split('/').pop() ?? 'image'
  try {
    filename = decodeURIComponent(filename)
  } catch {
    // Malformed %-escape — fall back to the raw filename.
  }
  const base = filename.replace(/\.[^.]+$/, '') || 'image'
  return (
    base
      .replaceAll(/['’]/g, '') // apostrophes are dropped, not underscored ("It's" → "Its")
      .replaceAll(/[^a-zA-Z0-9\-_]/g, '_')
      .replaceAll(/_+/g, '_')
      .replaceAll(/^_|_$/g, '') || 'image'
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
