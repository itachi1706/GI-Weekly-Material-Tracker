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
 * Derive a safe image basename from a URL.
 * Strips the extension, then replaces anything that isn't alphanumeric / dash / underscore with `_`.
 */
export function sanitizeImageBasename(url: string): string {
  const clean = url.split(/[?#]/)[0]
  const filename = clean.split('/').pop() ?? 'image'
  const base = filename.replace(/\.[^.]+$/, '') || 'image'
  return base.replace(/[^a-zA-Z0-9\-_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'image'
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
