import { describe, it, expect } from 'vitest'
import { stringifyDataFile, withTrailingNewline, hasTrailingNewline, roundTrips } from './serialize'

describe('stringifyDataFile — primitive array collapsing', () => {
  it('collapses a number array inline with no spaces', () => {
    expect(stringifyDataFile({ days: [1, 4, 7] })).toBe('{\n  "days": [1,4,7]\n}')
  })

  it('collapses a string array inline with ", " separator', () => {
    expect(stringifyDataFile({ tags: ['a', 'b'] })).toBe('{\n  "tags": ["a", "b"]\n}')
  })

  it('collapses null/bool literals inline', () => {
    expect(stringifyDataFile({ xs: [null, true, false] })).toBe('{\n  "xs": [null, true, false]\n}')
  })

  it('keeps an array of objects expanded', () => {
    const out = stringifyDataFile({ xs: [{ a: 1 }] })
    expect(out).toContain('"xs": [\n')
  })

  it('keeps a >200-char primitive array expanded', () => {
    const big = Array.from({ length: 25 }, (_, i) => `item_number_${i}`)
    const out = stringifyDataFile({ big })
    expect(out).toContain('"big": [\n')
  })
})

describe('stringifyDataFile — force-expand fields', () => {
  it('always expands titles, even single-element', () => {
    expect(stringifyDataFile({ titles: ['X'] })).toBe('{\n  "titles": [\n    "X"\n  ]\n}')
  })

  it('always expands outfits/weapons/rateupcharacters/rateupweapon', () => {
    for (const field of ['outfits', 'weapons', 'rateupcharacters', 'rateupweapon']) {
      expect(stringifyDataFile({ [field]: ['X'] })).toContain(`"${field}": [\n`)
    }
  })

  it('collapses a single-element characters array but expands multi-element', () => {
    expect(stringifyDataFile({ characters: ['A'] })).toBe('{\n  "characters": ["A"]\n}')
    expect(stringifyDataFile({ characters: ['A', 'B'] })).toContain('"characters": [\n')
  })
})

describe('stringifyDataFile — float version restore', () => {
  it('rewrites integer released_version / versionNumber as x.0', () => {
    expect(stringifyDataFile({ released_version: 1 })).toBe('{\n  "released_version": 1.0\n}')
    expect(stringifyDataFile({ versionNumber: 2 })).toBe('{\n  "versionNumber": 2.0\n}')
  })

  it('leaves non-integer versions untouched', () => {
    expect(stringifyDataFile({ versionNumber: 1.6 })).toBe('{\n  "versionNumber": 1.6\n}')
  })
})

describe('trailing newline handling', () => {
  it('detects a trailing newline', () => {
    expect(hasTrailingNewline('{}\n')).toBe(true)
    expect(hasTrailingNewline('{}')).toBe(false)
  })

  it('adds a newline to match a reference that has one', () => {
    expect(withTrailingNewline('{}', '{}\n')).toBe('{}\n')
  })

  it('strips trailing newlines to match a reference without one', () => {
    expect(withTrailingNewline('{}\n', '{}')).toBe('{}')
    expect(withTrailingNewline('{}\n\n', '{}')).toBe('{}')
  })

  it('leaves it unchanged when conventions already match', () => {
    expect(withTrailingNewline('{}', '{}')).toBe('{}')
    expect(withTrailingNewline('{}\n', '{}\n')).toBe('{}\n')
  })
})

describe('roundTrips', () => {
  it('is true for canonical serialized text', () => {
    const canonical = stringifyDataFile({ Slime: { drops: [1, 2, 3], name: 'Slime' } })
    expect(roundTrips(canonical)).toBe(true)
  })

  it('is false for non-canonical (expanded primitive array) text', () => {
    const nonCanonical = '{\n  "days": [\n    1,\n    4,\n    7\n  ]\n}'
    expect(roundTrips(nonCanonical)).toBe(false)
  })

  it('is false for invalid JSON', () => {
    expect(roundTrips('{ not json')).toBe(false)
  })
})
