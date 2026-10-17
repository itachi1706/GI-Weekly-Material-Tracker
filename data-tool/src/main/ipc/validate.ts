import { readFileSync, readdirSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { roundTrips } from '@shared/serialize'
import {
  validateDataset,
  isDataFile,
  sniffImageFormat,
  formatForExtension,
  IMAGE_HEADER_BYTES,
  type ValidationReport
} from '@shared/validate'
import { imagePath } from './paths'
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
 * Overwrite an existing dataset image with the one at `url` — the fix for an `image-format` finding.
 * Refuses unless the download's real format matches the file's extension, so a still-transcoded
 * (or non-image) response can't replace one bad file with another.
 */
export async function replaceImageFromUrl(rootPath: string, relativePath: string, url: string): Promise<void> {
  const dest = imagePath(rootPath, relativePath)
  const expected = formatForExtension(dest)
  if (!expected) throw new Error(`Not an image file: ${relativePath}`)
  if (!existsSync(dest)) throw new Error(`Image not found: ${relativePath}`)
  const { buffer } = await fetchImageBuffer(url)
  const actual = sniffImageFormat(buffer)
  if (actual !== expected) {
    throw new Error(
      `That URL returned ${actual ? actual.toUpperCase() : 'something that is not an image'}, but ${relativePath} needs ${expected.toUpperCase()}.`
    )
  }
  await writeFile(dest, buffer)
}

/** Scan a dataset root (report-only) and return structured findings for the renderer. */
export function runValidation(rootPath: string): ValidationReport {
  const dataDir = join(rootPath, 'data')
  const imagesDir = join(rootPath, 'images')

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
    imageExists: (rel) => existsSync(join(imagesDir, rel)),
    roundTrips,
    imageHeader: (rel) => readImageHeader(join(imagesDir, rel))
  })

  const errorCount = findings.filter((f) => f.severity === 'ERROR').length
  return { findings, fileCount: names.length, errorCount, warnCount: findings.length - errorCount }
}
