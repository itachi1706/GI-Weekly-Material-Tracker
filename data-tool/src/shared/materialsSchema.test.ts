import { describe, it, expect } from 'vitest'
import {
  deriveKey,
  applyFormValues,
  defaultImageName,
  getMaterialSchema,
  resolveRarityOptions,
  resolveImageFolder,
  resolveTiers,
  getTierSetKey,
  type FieldSpec,
  type MaterialTypeSchema,
  type TierSetConfig
} from './materialsSchema'
import type { MaterialRecord } from './types'

describe('deriveKey', () => {
  it('replaces spaces with underscores', () => {
    expect(deriveKey('Hu Tao')).toBe('Hu_Tao')
  })
  it('strips characters outside [A-Za-z0-9_- ]', () => {
    expect(deriveKey("Mizuki's Flower!")).toBe('Mizukis_Flower')
    expect(deriveKey('Café')).toBe('Caf') // non-ASCII dropped (characterization)
  })
  it('collapses whitespace and underscores, trims leading/trailing _ and -', () => {
    expect(deriveKey('  Multi   Space  ')).toBe('Multi_Space')
    expect(deriveKey('__leading_trailing__')).toBe('leading_trailing')
  })
  it('preserves interior hyphens', () => {
    expect(deriveKey('Amber-Rifle')).toBe('Amber-Rifle')
  })
})

describe('defaultImageName', () => {
  it('builds Item_<key>.<ext> and normalizes the extension', () => {
    expect(defaultImageName('Hu_Tao', 'PNG')).toBe('Item_Hu_Tao.png')
    expect(defaultImageName('Hu_Tao', '.jpg')).toBe('Item_Hu_Tao.jpg')
    expect(defaultImageName('Hu_Tao', '')).toBe('Item_Hu_Tao.png')
  })
})

describe('getMaterialSchema', () => {
  it('resolves each innerType to its schema', () => {
    expect(getMaterialSchema('local_speciality')?.innerType).toBe('local_speciality')
    expect(getMaterialSchema('mob_drops')?.label).toBeTruthy()
    expect(getMaterialSchema('nope')).toBeUndefined()
  })
  it('prefers the file-scoped variant when present (weekly boss drops)', () => {
    const standard = getMaterialSchema('boss_drops')
    const weekly = getMaterialSchema('boss_drops', 'Materials-Weekly_Boss_Drops.json')
    expect(weekly).toBeDefined()
    expect(weekly).not.toBe(standard)
  })
  it('falls back to the unscoped schema for an unknown file', () => {
    expect(getMaterialSchema('boss_drops', 'Materials-Other.json')).toBe(getMaterialSchema('boss_drops'))
  })
})

describe('resolveRarityOptions', () => {
  it('defaults to 1..5 when a field has no rarityOptions', () => {
    expect(resolveRarityOptions({ key: 'rarity', label: 'R', widget: 'rarity' }, {})).toEqual([1, 2, 3, 4, 5])
  })
  it('returns a static list as-is', () => {
    const f = { key: 'rarity', label: 'R', widget: 'rarity', rarityOptions: [3, 4] } as unknown as FieldSpec
    expect(resolveRarityOptions(f, {})).toEqual([3, 4])
  })
  it('invokes a function form with the current values', () => {
    const f = {
      key: 'rarity', label: 'R', widget: 'rarity',
      rarityOptions: (v: Record<string, unknown>) => (v.type === 'A' ? [2] : [4, 5])
    } as unknown as FieldSpec
    expect(resolveRarityOptions(f, { type: 'A' })).toEqual([2])
    expect(resolveRarityOptions(f, { type: 'B' })).toEqual([4, 5])
  })
})

describe('resolveImageFolder / resolveTiers', () => {
  it('uses imageFolderFn when present, else the static imageFolder', () => {
    const base = { imageFolder: 'Static' } as MaterialTypeSchema
    expect(resolveImageFolder(base, {})).toBe('Static')
    const dyn = { imageFolder: 'Static', imageFolderFn: (v: Record<string, unknown>) => `Dyn/${v.type}` } as MaterialTypeSchema
    expect(resolveImageFolder(dyn, { type: 'X' })).toBe('Dyn/X')
  })
  it('resolves static and function tier configs', () => {
    const staticCfg = { tiers: [{ rarity: 2 }, { rarity: 3 }], sharedFieldKeys: [] } as TierSetConfig
    expect(resolveTiers(staticCfg, {})).toHaveLength(2)
    const fnCfg = {
      tiers: (s: Record<string, unknown>) => (s.type === 'forgery' ? [{ rarity: 2 }, { rarity: 3 }, { rarity: 4 }, { rarity: 5 }] : [{ rarity: 2 }, { rarity: 3 }, { rarity: 4 }]),
      sharedFieldKeys: []
    } as TierSetConfig
    expect(resolveTiers(fnCfg, { type: 'forgery' })).toHaveLength(4)
    expect(resolveTiers(fnCfg, { type: 'mastery' })).toHaveLength(3)
  })
})

describe('getTierSetKey', () => {
  it('keys weekly boss drops by their obtained text', () => {
    const rec = { obtained: 'Wolf of the North' } as unknown as MaterialRecord
    expect(getTierSetKey(rec, 'boss_drops', 'Materials-Weekly_Boss_Drops.json')).toBe('weekly:Wolf of the North')
  })
  it('keys mob drops by type + sorted enemies', () => {
    const rec = { type: 'Common', enemies: ['Slime', 'Hilichurl'] } as unknown as MaterialRecord
    expect(getTierSetKey(rec, 'mob_drops')).toBe('mob:Common:Hilichurl,Slime')
  })
  it('returns empty string for types without tier sets', () => {
    expect(getTierSetKey({} as MaterialRecord, 'local_speciality')).toBe('')
  })
})

describe('applyFormValues — widget coercion', () => {
  const schema = {
    innerType: 'test_type',
    fields: [
      { key: 'name', label: 'Name', widget: 'text' },
      { key: 'rarity', label: 'Rarity', widget: 'number' },
      { key: 'active', label: 'Active', widget: 'bool' },
      { key: 'enemies', label: 'Enemies', widget: 'tags' },
      { key: 'days', label: 'Days', widget: 'days' }
    ]
  } as unknown as MaterialTypeSchema

  it('coerces number, bool, text, tags, days and forces managed fields', () => {
    const out = applyFormValues({} as MaterialRecord, schema, {
      name: 'X',
      rarity: '4',
      active: true,
      enemies: ['a', ' b ', ''],
      days: [7, 1, 4]
    })
    expect(out.name).toBe('X')
    expect(out.rarity).toBe(4)
    expect(out.active).toBe(true)
    expect(out.enemies).toEqual(['a', 'b']) // trimmed + empties dropped
    expect(out.days).toEqual([1, 4, 7]) // sorted
    expect(out.innerType).toBe('test_type')
    expect(out.usage).toEqual({ characters: [], weapons: [] })
    expect(out.subCollection).toEqual({})
  })

  it('maps empty number to null and empty text to null', () => {
    const out = applyFormValues({} as MaterialRecord, schema, { name: '', rarity: '' })
    expect(out.rarity).toBeNull()
    expect(out.name).toBeNull()
  })

  it('does not add an empty tags array to a record that lacks the key', () => {
    const out = applyFormValues({} as MaterialRecord, schema, { enemies: [] })
    expect('enemies' in out).toBe(false)
  })

  it('does write an empty tags array when the key already exists in base', () => {
    const out = applyFormValues({ enemies: ['old'] } as unknown as MaterialRecord, schema, { enemies: [] })
    expect(out.enemies).toEqual([])
  })
})
