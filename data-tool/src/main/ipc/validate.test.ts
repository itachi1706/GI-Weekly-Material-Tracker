import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fetchImageBuffer = vi.fn()
vi.mock('./imageFetch', () => ({ fetchImageBuffer: (url: string) => fetchImageBuffer(url) }))

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
afterEach(() => rmSync(root, { recursive: true, force: true }))

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
