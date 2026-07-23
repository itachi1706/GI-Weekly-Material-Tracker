import { describe, it, expect } from 'vitest'
import { inferWikiCategory, mapWikiType } from './materialWiki'
import type { WikiMaterialResult } from '@shared/types'

const res = (over: Partial<WikiMaterialResult>): WikiMaterialResult => ({
  sourceUrl: '', title: '', wikiUrl: '', name: null, description: null, obtained: null,
  days: null, type: null, group: null, group2: null, rarity: null, iconUrl: null,
  ...over
})

describe('inferWikiCategory', () => {
  it('detects local speciality from type or group', () => {
    expect(inferWikiCategory(res({ type: 'Local Specialty (Inazuma)' }))).toBe('local_speciality')
  })
  it('detects boss drops / ascension gems', () => {
    expect(inferWikiCategory(res({ group2: 'Ascension Gem' }))).toBe('boss_drops')
    expect(inferWikiCategory(res({ group: 'Normal Boss Drops' }))).toBe('boss_drops')
  })
  it('detects domain materials (talent book / forgery)', () => {
    expect(inferWikiCategory(res({ group2: 'Talent Book' }))).toBe('domain_material')
    expect(inferWikiCategory(res({ type: 'Weapon Ascension Material' }))).toBe('domain_material')
  })
  it('detects mob drops', () => {
    expect(inferWikiCategory(res({ group: 'Common Ascension Material' }))).toBe('mob_drops')
  })
  it('returns null when nothing matches', () => {
    expect(inferWikiCategory(res({ type: 'Mystery' }))).toBeNull()
  })
})

describe('mapWikiType', () => {
  const opts = ['Local Speciality (Inazuma)', 'Ascension Gems', 'Boss Drops', 'Boss Drops (Weekly)']

  it('extracts the region for a local speciality (only if a valid option)', () => {
    expect(mapWikiType(res({ type: 'Local Specialty (Inazuma)' }), 'local_speciality', opts))
      .toBe('Local Speciality (Inazuma)')
    expect(mapWikiType(res({ type: 'Local Specialty (Natlan)' }), 'local_speciality', opts)).toBeNull()
  })
  it('maps boss-drop sub-types from the group', () => {
    expect(mapWikiType(res({ group2: 'Ascension Gem' }), 'boss_drops', opts)).toBe('Ascension Gems')
    expect(mapWikiType(res({ group: 'Weekly Boss Drops' }), 'boss_drops', opts)).toBe('Boss Drops (Weekly)')
    expect(mapWikiType(res({ group: 'Normal Boss Drops' }), 'boss_drops', opts)).toBe('Boss Drops')
  })
  it('returns null for types it cannot cleanly derive', () => {
    expect(mapWikiType(res({ type: 'x' }), 'domain_material', opts)).toBeNull()
  })
})
