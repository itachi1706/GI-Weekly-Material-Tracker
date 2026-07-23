import { describe, it, expect } from 'vitest'
import { urlStateFromWiki, wikiIconFileName, describeImage, eqi } from './wikiApply'

describe('urlStateFromWiki', () => {
  it('derives the save-as name from the URL by default', () => {
    expect(urlStateFromWiki('https://e/Sword_Hydro.png/revision/latest')).toEqual({
      mode: 'url',
      url: 'https://e/Sword_Hydro.png/revision/latest',
      imageName: 'Sword_Hydro'
    })
  })
  it('uses an explicit basename when given', () => {
    expect(urlStateFromWiki('https://e/X.png', 'Custom')).toMatchObject({ mode: 'url', imageName: 'Custom' })
  })
  it('omits imageName when basename is null (commit falls back to the entry key)', () => {
    const s = urlStateFromWiki('https://e/X.png', null)
    expect(s).toEqual({ mode: 'url', url: 'https://e/X.png' })
    expect('imageName' in s).toBe(false)
  })
})

describe('wikiIconFileName', () => {
  it('produces basename + extension from the URL', () => {
    expect(wikiIconFileName('https://e/Prune_Icon.png/revision/latest')).toBe('Prune_Icon.png')
  })
  it('honours an override basename', () => {
    expect(wikiIconFileName('https://e/Constellation_X.png', 'X')).toBe('X.png')
  })
})

describe('describeImage', () => {
  it('shows the last path segment for each mode', () => {
    expect(describeImage({ mode: 'existing', relative: 'Characters/Pyro/Amber.png' })).toBe('Amber.png')
    expect(describeImage({ mode: 'url', url: 'https://e/x.png' })).toBe('x.png')
    expect(describeImage({ mode: 'localFile', sourcePath: '/tmp/sub/y.png' })).toBe('y.png')
    expect(describeImage({ mode: 'none' })).toBe('')
  })
})

describe('eqi', () => {
  it('is trim- and case-insensitive', () => {
    expect(eqi('  Amber ', 'amber')).toBe(true)
    expect(eqi('Amber', 'Barbara')).toBe(false)
  })
})
