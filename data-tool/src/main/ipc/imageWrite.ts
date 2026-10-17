import { lstat, mkdir, realpath, rename, rm } from 'node:fs/promises'
import { basename, dirname, join, sep } from 'node:path'
import { imagePath, imagesDir } from './paths'

/**
 * Filesystem-level guards for writing into images/. `imagePath` only checks the path *text*; these
 * also follow what's actually on disk, so a symlink in the dataset can't redirect a write elsewhere.
 */

const isWithin = (base: string, p: string): boolean => p === base || p.startsWith(base + sep)

/** `p` itself if it exists, else its nearest existing ancestor. */
async function nearestExisting(p: string): Promise<string> {
  let cur = p
  for (;;) {
    if (await lstat(cur).then(() => true, () => false)) return cur
    const up = dirname(cur)
    if (up === cur) return cur
    cur = up
  }
}

/**
 * Resolve where an image under images/ should be written, creating its folder if needed. Refuses a
 * symlinked or non-regular existing file, and any folder whose real location is outside the real
 * images/. Returns the target inside the resolved real folder.
 */
export async function resolveImageWriteTarget(
  rootPath: string,
  relativePath: string,
  { mustExist }: { mustExist: boolean }
): Promise<string> {
  const dest = imagePath(rootPath, relativePath)
  const escapes = (): Error => new Error(`Path escapes its allowed directory: ${relativePath}`)
  const base = imagesDir(rootPath)
  await mkdir(base, { recursive: true })
  const realBase = await realpath(base)
  const dir = dirname(dest)

  // Check before creating anything: `mkdir -p` follows links in the folders that already exist, so
  // it could otherwise create folders outside images/.
  if (!isWithin(realBase, await realpath(await nearestExisting(dir)))) throw escapes()

  const st = await lstat(dest).catch(() => null)
  if (st && (st.isSymbolicLink() || !st.isFile())) throw new Error(`Not a regular image file: ${relativePath}`)
  if (!st && mustExist) throw new Error(`Image not found: ${relativePath}`)

  await mkdir(dir, { recursive: true })
  const realDir = await realpath(dir)
  if (!isWithin(realBase, realDir)) throw escapes()
  return join(realDir, basename(dest))
}

/**
 * Produce `target` via a temp file beside it, then rename over it. A failed write leaves any existing
 * file untouched, and the rename replaces the directory entry rather than writing through it.
 * `write` must create the temp file exclusively (e.g. `{ flag: 'wx' }` / `COPYFILE_EXCL`).
 */
export async function replaceAtomically(target: string, write: (tmp: string) => Promise<void>): Promise<void> {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    await write(tmp)
    await rename(tmp, target)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}
