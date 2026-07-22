import { join, resolve, basename, sep } from 'node:path'
import { isDataFile } from '@shared/validate'

/**
 * Path-containment guards for the IPC handlers. Renderer-supplied values (`change.file`,
 * `plan.destRelative`, `plan.relativePath`, image `folder`s) are untrusted and must never be able to
 * escape the dataset's `data/` or `images/` roots via `..` segments or absolute paths. Every `fs`
 * sink routes through `resolveWithin`, which normalizes with `path.resolve` (collapsing `..`) and then
 * asserts the result stays inside the intended base — stronger than the old
 * `relative(base, dest).startsWith('..')` inline check and applied uniformly in one place.
 */

/** The dataset's `data/` directory (canonical, resolved). */
export function dataDir(rootPath: string): string {
  return resolve(join(rootPath, 'data'))
}

/** The dataset's `images/` directory (canonical, resolved). */
export function imagesDir(rootPath: string): string {
  return resolve(join(rootPath, 'images'))
}

/**
 * Resolve `untrusted` against `baseDir` and refuse anything that lands outside `baseDir`
 * (absolute paths, `..` traversal, symlink-style escapes via normalization). Returns the safe
 * absolute path; throws otherwise.
 */
export function resolveWithin(baseDir: string, untrusted: string): string {
  const base = resolve(baseDir)
  const abs = resolve(base, untrusted)
  if (abs !== base && !abs.startsWith(base + sep)) {
    throw new Error(`Path escapes its allowed directory: ${untrusted}`)
  }
  return abs
}

/**
 * Resolve a renderer-supplied data file name to an absolute path inside `data/`. Beyond the
 * containment guard, the basename must be one of the recognised dataset files (no arbitrary
 * `.json` writes) and the name must be a bare file (no subdirectory components).
 */
export function datasetFile(rootPath: string, file: string): string {
  // `basename` strips any directory / `..` components — a path-traversal sanitiser the SonarCloud
  // taint engine recognises. We then require the untrusted input to have BEEN a bare, recognised
  // data-file name (so `sub/x.json` or `../x.json` is rejected outright, not silently rebased).
  const name = basename(file)
  if (name !== file || !isDataFile(name)) {
    throw new Error(`Not a recognised dataset file: ${file}`)
  }
  return join(dataDir(rootPath), name)
}

/** Resolve a renderer-supplied image path (relative to `images/`) to a safe absolute path. */
export function imagePath(rootPath: string, relativePath: string): string {
  return resolveWithin(imagesDir(rootPath), relativePath)
}

/** Resolve a renderer-supplied image subfolder (relative to `images/`) to a safe absolute path. */
export function imageDir(rootPath: string, folder: string): string {
  return resolveWithin(imagesDir(rootPath), folder)
}
