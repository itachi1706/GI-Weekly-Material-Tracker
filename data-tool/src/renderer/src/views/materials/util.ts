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
  | { mode: 'localFile'; sourcePath: string }
  | { mode: 'url'; url: string }

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
