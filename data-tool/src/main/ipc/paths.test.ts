import { describe, it, expect } from 'vitest'
import { join, resolve, sep } from 'node:path'
import { resolveWithin, datasetFile, imagePath, imageDir, dataDir, imagesDir } from './paths'

const ROOT = resolve('/tmp/dataset-root')

describe('resolveWithin', () => {
  it('accepts a plain relative path inside the base', () => {
    const base = join(ROOT, 'images')
    expect(resolveWithin(base, 'Characters/Amber.png')).toBe(join(base, 'Characters', 'Amber.png'))
  })
  it('accepts the base itself', () => {
    const base = join(ROOT, 'images')
    expect(resolveWithin(base, '.')).toBe(base)
  })
  it('rejects ../ traversal', () => {
    expect(() => resolveWithin(join(ROOT, 'images'), '../data/secret.json')).toThrow()
  })
  it('rejects deep ../ traversal that resolves outside', () => {
    expect(() => resolveWithin(join(ROOT, 'images'), 'a/b/../../../etc/passwd')).toThrow()
  })
  it('rejects an absolute path outside the base', () => {
    expect(() => resolveWithin(join(ROOT, 'images'), '/etc/passwd')).toThrow()
  })
  it('does not treat a sibling prefix as inside (images vs images-evil)', () => {
    const base = join(ROOT, 'images')
    expect(() => resolveWithin(base, `..${sep}images-evil${sep}x.png`)).toThrow()
  })
})

describe('datasetFile', () => {
  it('resolves a recognised bare data file into data/', () => {
    expect(datasetFile(ROOT, 'Materials-Elite_Mob.json')).toBe(join(dataDir(ROOT), 'Materials-Elite_Mob.json'))
    expect(datasetFile(ROOT, 'EventBanners.json')).toBe(join(dataDir(ROOT), 'EventBanners.json'))
  })
  it('rejects an unrecognised json file', () => {
    expect(() => datasetFile(ROOT, 'templates.json')).toThrow()
  })
  it('rejects a name with a subdirectory component', () => {
    expect(() => datasetFile(ROOT, 'sub/Materials-X.json')).toThrow()
  })
  it('rejects traversal even with a valid-looking basename', () => {
    expect(() => datasetFile(ROOT, '../images/Materials-X.json')).toThrow()
  })
})

describe('imagePath / imageDir', () => {
  it('resolves an image path under images/', () => {
    expect(imagePath(ROOT, 'Characters/Pyro/Amber.png')).toBe(join(imagesDir(ROOT), 'Characters', 'Pyro', 'Amber.png'))
  })
  it('resolves an image folder under images/', () => {
    expect(imageDir(ROOT, 'Characters')).toBe(join(imagesDir(ROOT), 'Characters'))
  })
  it('rejects traversal in either', () => {
    expect(() => imagePath(ROOT, '../../etc/passwd')).toThrow()
    expect(() => imageDir(ROOT, '../data')).toThrow()
  })
})
