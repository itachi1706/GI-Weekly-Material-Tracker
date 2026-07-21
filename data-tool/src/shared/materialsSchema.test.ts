import { describe, it, expect } from 'vitest'
import { deriveKey, applyFormValues, defaultImageName } from './materialsSchema'
import type { MaterialTypeSchema } from './materialsSchema'
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
