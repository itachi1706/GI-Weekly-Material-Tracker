import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fetchImageBuffer = vi.fn()
vi.mock('./imageFetch', () => ({ fetchImageBuffer: (url: string) => fetchImageBuffer(url) }))

import { performImageOp } from './entityStore'

const OLD = Buffer.from('old image bytes')
const NEW = Buffer.from('new image bytes')

let root: string
let source: string
const img = (rel: string): string => join(root, 'images', rel)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dt-imagewrite-'))
  mkdirSync(join(root, 'images', 'Materials'), { recursive: true })
  source = join(root, 'source.png')
  writeFileSync(source, NEW)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('performImageOp (commit image writes)', () => {
  it('copies a local file into a new nested folder', async () => {
    await performImageOp(root, { source: 'localFile', sourcePath: source, destRelative: 'Weapons/Bow/A.png' })
    expect(readFileSync(img('Weapons/Bow/A.png'))).toEqual(NEW)
    expect(readdirSync(img('Weapons/Bow'))).toEqual(['A.png'])
  })

  it('overwrites an existing regular file with a downloaded image', async () => {
    writeFileSync(img('Materials/X.png'), OLD)
    fetchImageBuffer.mockResolvedValue({ buffer: NEW, contentType: 'image/png' })
    await performImageOp(root, { source: 'url', url: 'https://example.com/x.png', destRelative: 'Materials/X.png' })
    expect(readFileSync(img('Materials/X.png'))).toEqual(NEW)
    expect(readdirSync(img('Materials'))).toEqual(['X.png'])
  })

  it('keeps the existing image and leaves no temp file when the copy fails', async () => {
    writeFileSync(img('Materials/X.png'), OLD)
    await expect(
      performImageOp(root, { source: 'localFile', sourcePath: join(root, 'missing.png'), destRelative: 'Materials/X.png' })
    ).rejects.toThrow()
    expect(readFileSync(img('Materials/X.png'))).toEqual(OLD)
    expect(readdirSync(img('Materials'))).toEqual(['X.png'])
  })

  it('refuses to write through a symlinked image file', async () => {
    const outside = join(root, 'outside.png')
    writeFileSync(outside, OLD)
    symlinkSync(outside, img('Materials/Link.png'))
    await expect(
      performImageOp(root, { source: 'localFile', sourcePath: source, destRelative: 'Materials/Link.png' })
    ).rejects.toThrow(/Not a regular image file/)
    expect(readFileSync(outside)).toEqual(OLD)
  })

  it('refuses a folder symlink leading outside images/, without creating folders out there', async () => {
    const outsideDir = join(root, 'elsewhere')
    mkdirSync(outsideDir)
    symlinkSync(outsideDir, img('Linked'))
    await expect(
      performImageOp(root, { source: 'localFile', sourcePath: source, destRelative: 'Linked/New/A.png' })
    ).rejects.toThrow(/escapes/)
    expect(existsSync(join(outsideDir, 'New'))).toBe(false)
  })

  it('still rejects lexical traversal, and does nothing for an existing-image reference', async () => {
    await expect(
      performImageOp(root, { source: 'localFile', sourcePath: source, destRelative: '../escape.png' })
    ).rejects.toThrow(/escapes/)
    expect(existsSync(join(root, 'escape.png'))).toBe(false)
    await performImageOp(root, { source: 'existing', relativePath: 'Materials/Anything.png' })
    expect(fetchImageBuffer).not.toHaveBeenCalled()
  })
})
