import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fetchImageBuffer = vi.fn()
vi.mock('./imageFetch', () => ({ fetchImageBuffer: (url: string) => fetchImageBuffer(url) }))

// Lets a test make the final rename fail, to prove a failed replace leaves the original intact.
const fsControl = vi.hoisted(() => ({ failRename: false }))
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...real,
    rename: async (from: string, to: string): Promise<void> => {
      if (fsControl.failRename) throw new Error('simulated disk failure')
      return real.rename(from, to)
    }
  }
})

import { replaceImageFromUrl, runValidation } from './validate'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
const URL_ = 'https://static.wikia.nocookie.net/x.png/revision/latest'

let root: string
const img = (rel: string): string => join(root, 'images', rel)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dt-validate-'))
  mkdirSync(join(root, 'images', 'Materials'), { recursive: true })
  mkdirSync(join(root, 'data'))
  writeFileSync(img('Materials/X.png'), WEBP)
})
afterEach(() => {
  fsControl.failRename = false
  rmSync(root, { recursive: true, force: true })
})

describe('replaceImageFromUrl', () => {
  it('overwrites the file when the download really is the extension’s format', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    await replaceImageFromUrl(root, 'Materials/X.png', URL_)
    expect(readFileSync(img('Materials/X.png'))).toEqual(PNG)
  })
  it('refuses (and leaves the file alone) when the download is still the wrong format', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: WEBP, contentType: 'image/webp' })
    await expect(replaceImageFromUrl(root, 'Materials/X.png', URL_)).rejects.toThrow(/returned WEBP.*needs PNG/)
    expect(readFileSync(img('Materials/X.png'))).toEqual(WEBP)
  })
  it('refuses a non-image download', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: Buffer.from('<!DOCTYPE html>'), contentType: 'text/html' })
    await expect(replaceImageFromUrl(root, 'Materials/X.png', URL_)).rejects.toThrow(/not an image/)
  })
  it('never writes outside images/, to non-image files, or to files that do not exist', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    await expect(replaceImageFromUrl(root, '../escape.png', URL_)).rejects.toThrow(/escapes/)
    await expect(replaceImageFromUrl(root, 'Materials/notes.txt', URL_)).rejects.toThrow(/Not an image/)
    await expect(replaceImageFromUrl(root, 'Materials/New.png', URL_)).rejects.toThrow(/not found/)
    expect(existsSync(join(root, 'escape.png'))).toBe(false)
    expect(existsSync(img('Materials/New.png'))).toBe(false)
    expect(fetchImageBuffer).not.toHaveBeenCalled()
  })
})

describe('replaceImageFromUrl filesystem safety', () => {
  it('leaves no temp file behind after a successful replace', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    await replaceImageFromUrl(root, 'Materials/X.png', URL_)
    expect(readdirSync(img('Materials'))).toEqual(['X.png'])
  })
  it('keeps the original image (and cleans up) when the replace fails mid-way', async () => {
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    fsControl.failRename = true
    await expect(replaceImageFromUrl(root, 'Materials/X.png', URL_)).rejects.toThrow(/simulated disk failure/)
    expect(readFileSync(img('Materials/X.png'))).toEqual(WEBP)
    expect(readdirSync(img('Materials'))).toEqual(['X.png'])
  })
  it('refuses to write through a symlinked image file', async () => {
    const outside = join(root, 'outside.png')
    writeFileSync(outside, WEBP)
    symlinkSync(outside, img('Materials/Link.png'))
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    await expect(replaceImageFromUrl(root, 'Materials/Link.png', URL_)).rejects.toThrow(/Not a regular image file/)
    expect(readFileSync(outside)).toEqual(WEBP)
  })
  it('refuses a folder symlink that leads outside images/', async () => {
    const outsideDir = join(root, 'elsewhere')
    mkdirSync(outsideDir)
    writeFileSync(join(outsideDir, 'Evil.png'), WEBP)
    symlinkSync(outsideDir, img('Linked'))
    fetchImageBuffer.mockResolvedValue({ buffer: PNG, contentType: 'image/png' })
    await expect(replaceImageFromUrl(root, 'Linked/Evil.png', URL_)).rejects.toThrow(/escapes/)
    expect(readFileSync(join(outsideDir, 'Evil.png'))).toEqual(WEBP)
  })
})

describe('runValidation', () => {
  it('flags an image whose bytes do not match its extension', () => {
    writeFileSync(
      join(root, 'data', 'Materials-Elite_Mob.json'),
      JSON.stringify({ materials: { x: { name: 'X', image: 'Materials/X.png' } } }, null, 2) + '\n'
    )
    const report = runValidation(root)
    expect(report.findings.filter((f) => f.category === 'image-format')).toEqual([
      expect.objectContaining({ key: 'x', imagePath: 'Materials/X.png', severity: 'WARN' })
    ])
  })
})
