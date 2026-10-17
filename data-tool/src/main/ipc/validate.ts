import { readFileSync, readdirSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { writeFile, lstat, realpath, rename, rm } from 'node:fs/promises'
import { join, dirname, basename, sep } from 'node:path'
import { roundTrips } from '@shared/serialize'
import {
  validateDataset,
  isDataFile,
  sniffImageFormat,
  formatForExtension,
  IMAGE_HEADER_BYTES,
  type ValidationReport
} from '@shared/validate'
import { imagePath, imagesDir } from './paths'
import { fetchImageBuffer } from './imageFetch'

/** First few bytes of a file (enough to sniff its image format), or null if unreadable. */
function readImageHeader(abs: string): Uint8Array | null {
  let fd: number | null = null
  try {
    fd = openSync(abs, 'r')
    const buf = Buffer.alloc(IMAGE_HEADER_BYTES)
    return buf.subarray(0, readSync(fd, buf, 0, IMAGE_HEADER_BYTES, 0))
  } catch {
    return null
  } finally {
    if (fd !== null) closeSync(fd)
  }
}

/**
 * Resolve an existing image for overwriting. `imagePath` only checks the path lexically, so also
 * refuse a symlinked file and require the folder's real location to be inside the real images/ —
 * otherwise a link in the dataset could redirect the write anywhere on disk.
 */
async function realImageTarget(rootPath: string, relativePath: string): Promise<string> {
  const dest = imagePath(rootPath, relativePath)
  const st = await lstat(dest).catch(() => null)
  if (!st) throw new Error(`Image not found: ${relativePath}`)
  if (st.isSymbolicLink() || !st.isFile()) throw new Error(`Not a regular image file: ${relativePath}`)
  const [realDir, realBase] = await Promise.all([realpath(dirname(dest)), realpath(imagesDir(rootPath))])
  if (realDir !== realBase && !realDir.startsWith(realBase + sep)) {
    throw new Error(`Path escapes its allowed directory: ${relativePath}`)
  }
  return join(realDir, basename(dest))
}

/**
 * Overwrite an existing dataset image with the one at `url` — the fix for an `image-format` finding.
 * Refuses unless the download's real format matches the file's extension, so a still-transcoded
 * (or non-image) response can't replace one bad file with another.
 */
export async function replaceImageFromUrl(rootPath: string, relativePath: string, url: string): Promise<void> {
  const expected = formatForExtension(relativePath)
  if (!expected) throw new Error(`Not an image file: ${relativePath}`)
  const target = await realImageTarget(rootPath, relativePath)
  const { buffer } = await fetchImageBuffer(url)
  const actual = sniffImageFormat(buffer)
  if (actual !== expected) {
    throw new Error(
      `That URL returned ${actual ? actual.toUpperCase() : 'something that is not an image'}, but ${relativePath} needs ${expected.toUpperCase()}.`
    )
  }
  // Write beside the target, then rename over it: a failed write leaves the original intact, and the
  // rename replaces the directory entry rather than following whatever is at that path.
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tmp, buffer, { flag: 'wx' })
    await rename(tmp, target)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}

/** Scan a dataset root (report-only) and return structured findings for the renderer. */
export function runValidation(rootPath: string): ValidationReport {
  const dataDir = join(rootPath, 'data')
  const imagesRoot = join(rootPath, 'images')

  // A missing data/ dir (or a data path that isn't a directory) is a real problem, not a clean
  // dataset: report it as an ERROR finding rather than throwing (ENOTDIR would otherwise escape
  // readdirSync) or returning a "✓ clean" empty report.
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    return {
      findings: [
        {
          severity: 'ERROR',
          category: 'dataset',
          file: 'data/',
          key: '',
          detail: 'No data/ directory found under the dataset root — nothing to validate.'
        }
      ],
      fileCount: 0,
      errorCount: 1,
      warnCount: 0
    }
  }

  const names = readdirSync(dataDir).filter(isDataFile)
  const files = names.map((file) => ({ file, raw: readFileSync(join(dataDir, file), 'utf-8') }))

  const findings = validateDataset(files, {
    imageExists: (rel) => existsSync(join(imagesRoot, rel)),
    roundTrips,
    imageHeader: (rel) => readImageHeader(join(imagesRoot, rel))
  })

  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  return { findings, fileCount: names.length, errorCount, warnCount: findings.length - errorCount }
}
