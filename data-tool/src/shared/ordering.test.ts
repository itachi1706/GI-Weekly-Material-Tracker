import { describe, it, expect } from 'vitest'
import { compareKeys, insertRecord, removeRecord, renameRecord } from './ordering'

describe('compareKeys (raw code-unit order)', () => {
  it('orders by code unit, not locale', () => {
    expect(compareKeys('a', 'b')).toBe(-1)
    expect(compareKeys('b', 'a')).toBe(1)
    expect(compareKeys('a', 'a')).toBe(0)
    // Uppercase sorts before lowercase in code-unit order.
    expect(compareKeys('Z', 'a')).toBe(-1)
  })
})

describe('insertRecord', () => {
  const base = { Apple: 1, Cherry: 3 }

  it('inserts alphabetically at the code-unit position', () => {
    const out = insertRecord(base, 'Banana', 2, 'alphabetical')
    expect(Object.keys(out)).toEqual(['Apple', 'Banana', 'Cherry'])
  })

  it('appends at the end in append mode', () => {
    const out = insertRecord(base, 'Aaa', 0, 'append')
    expect(Object.keys(out)).toEqual(['Apple', 'Cherry', 'Aaa'])
  })

  it('inserts at the front when it sorts first', () => {
    const out = insertRecord(base, 'Aardvark', 0, 'alphabetical')
    expect(Object.keys(out)).toEqual(['Aardvark', 'Apple', 'Cherry'])
  })

  it('replaces an existing key in place without reordering', () => {
    const out = insertRecord(base, 'Apple', 99, 'alphabetical')
    expect(Object.keys(out)).toEqual(['Apple', 'Cherry'])
    expect(out.Apple).toBe(99)
  })

  it('does not mutate the input', () => {
    insertRecord(base, 'Banana', 2, 'alphabetical')
    expect(Object.keys(base)).toEqual(['Apple', 'Cherry'])
  })
})

describe('removeRecord', () => {
  it('removes a key and preserves order', () => {
    const out = removeRecord({ a: 1, b: 2, c: 3 }, 'b')
    expect(Object.keys(out)).toEqual(['a', 'c'])
  })
  it('is a no-op for a missing key', () => {
    const out = removeRecord({ a: 1 }, 'z')
    expect(Object.keys(out)).toEqual(['a'])
  })
})

describe('renameRecord', () => {
  it('removes the old key and re-inserts alphabetically', () => {
    const out = renameRecord({ Apple: 1, Cherry: 3 }, 'Apple', 'Blueberry', 1, 'alphabetical')
    expect(Object.keys(out)).toEqual(['Blueberry', 'Cherry'])
  })
})
