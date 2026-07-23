import { describe, it, expect } from 'vitest'
import { ENTITIES, REQUIRED_SUBFOLDERS } from './entities'

describe('ENTITIES', () => {
  it('defines the five dataset entities, all enabled', () => {
    expect(ENTITIES.map((e) => e.key)).toEqual([
      'materials',
      'characters',
      'weapons',
      'outfits',
      'banners'
    ])
    expect(ENTITIES.every((e) => e.enabled)).toBe(true)
  })
  it('keyed entities carry a filePrefix; banners is the single EventBanners file', () => {
    for (const key of ['materials', 'characters', 'weapons', 'outfits']) {
      expect(ENTITIES.find((e) => e.key === key)?.filePrefix).toBeTruthy()
    }
    expect(ENTITIES.find((e) => e.key === 'banners')?.singleFile).toBe('EventBanners.json')
  })
  it('requires the data/images/templates subfolders', () => {
    expect(REQUIRED_SUBFOLDERS).toEqual(['data', 'images', 'templates'])
  })
})
