import { describe, it, expect } from 'vitest'
import { extOf, fieldStr, normalizeImageUrl, sanitizeImageBasename, toImagePlan, type ImageState } from './util'

describe('extOf', () => {
  it('reads the extension, lowercased', () => {
    expect(extOf('Foo/Bar.PNG')).toBe('png')
    expect(extOf('x.jpeg')).toBe('jpeg')
  })
  it('ignores query/hash and a Fandom /revision suffix', () => {
    expect(extOf('https://e/X.webp?cb=1')).toBe('webp')
    expect(extOf('https://e/X.gif/revision/latest/scale-to-width-down/74')).toBe('gif')
  })
  it('defaults to png when there is no extension', () => {
    expect(extOf('https://e/no-ext')).toBe('png')
  })
})

describe('fieldStr', () => {
  it('blanks null/undefined and stringifies primitives', () => {
    expect(fieldStr(null)).toBe('')
    expect(fieldStr(undefined)).toBe('')
    expect(fieldStr('hi')).toBe('hi')
    expect(fieldStr(4)).toBe('4')
    expect(fieldStr(false)).toBe('false')
  })
})

describe('normalizeImageUrl', () => {
  it('keeps …/revision/latest and drops the scaling + cache-buster', () => {
    expect(normalizeImageUrl('https://e/Prune_Icon.png/revision/latest/scale-to-width-down/74?cb=2026'))
      .toBe('https://e/Prune_Icon.png/revision/latest')
  })
  it('truncates after the image extension when there is no /revision', () => {
    expect(normalizeImageUrl('https://e/X.png?cb=9')).toBe('https://e/X.png')
  })
  it('returns unrecognized input unchanged (trimmed)', () => {
    expect(normalizeImageUrl('  not-an-image  ')).toBe('not-an-image')
  })
})

describe('sanitizeImageBasename', () => {
  it('strips extension + revision suffix and keeps a clean name', () => {
    expect(sanitizeImageBasename('https://e/Prune_Icon.png/revision/latest/scale-to-width-down/74')).toBe('Prune_Icon')
  })
  it('URL-decodes, drops apostrophes, and collapses punctuation to single underscores', () => {
    expect(sanitizeImageBasename('https://e/Not%21.png')).toBe('Not')
    expect(sanitizeImageBasename('https://e/Life%2C_Who.png')).toBe('Life_Who')
    expect(sanitizeImageBasename("https://e/It's_Here.png")).toBe('Its_Here')
  })
})

describe('toImagePlan', () => {
  it('maps each ImageState mode to its plan (or null for none)', () => {
    expect(toImagePlan({ mode: 'existing', relative: 'A/x.png' }, 'D/y.png'))
      .toEqual({ source: 'existing', relativePath: 'A/x.png' })
    expect(toImagePlan({ mode: 'localFile', sourcePath: '/a.png' }, 'D/y.png'))
      .toEqual({ source: 'localFile', sourcePath: '/a.png', destRelative: 'D/y.png' })
    expect(toImagePlan({ mode: 'url', url: 'https://e/x.png' }, 'D/y.png'))
      .toEqual({ source: 'url', url: 'https://e/x.png', destRelative: 'D/y.png' })
    expect(toImagePlan({ mode: 'none' } as ImageState, 'D/y.png')).toBeNull()
  })
})
