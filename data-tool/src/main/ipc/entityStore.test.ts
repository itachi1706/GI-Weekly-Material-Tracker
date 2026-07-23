import { describe, it, expect } from 'vitest'
import {
  applyKeyedChange,
  planActionText,
  joinActionText,
  serializeRecords,
  assembleCommit,
  type KeyedChange
} from './entityStore'
import { stringifyDataFile } from '@shared/serialize'
import type { ImagePlan } from '@shared/types'

interface Rec {
  name: string
}
const change = (over: Partial<KeyedChange<Rec>>): KeyedChange<Rec> => ({
  op: 'create',
  key: 'X',
  ordering: 'append',
  ...over
})

describe('applyKeyedChange', () => {
  const base = { A: { name: 'A' }, B: { name: 'B' } }

  it('appends a created record', () => {
    const out = applyKeyedChange(base, change({ op: 'create', key: 'C', record: { name: 'C' } }))
    expect(Object.keys(out)).toEqual(['A', 'B', 'C'])
  })
  it('updates in place without moving the key', () => {
    const out = applyKeyedChange(base, change({ op: 'update', key: 'A', originalKey: 'A', record: { name: 'A2' } }))
    expect(Object.keys(out)).toEqual(['A', 'B'])
    expect(out.A.name).toBe('A2')
  })
  it('renames by removing the old key and re-inserting per ordering (append → end)', () => {
    const out = applyKeyedChange(base, change({ op: 'update', key: 'Z', originalKey: 'A', record: { name: 'Z' } }))
    expect(Object.keys(out)).toEqual(['B', 'Z'])
    expect(out.Z.name).toBe('Z')
  })
  it('renames alphabetically when ordering says so', () => {
    const out = applyKeyedChange(base, change({ op: 'update', key: 'AA', originalKey: 'B', record: { name: 'AA' }, ordering: 'alphabetical' }))
    expect(Object.keys(out)).toEqual(['A', 'AA'])
  })
  it('deletes a key', () => {
    const out = applyKeyedChange(base, change({ op: 'delete', key: 'A' }))
    expect(Object.keys(out)).toEqual(['B'])
  })
  it('does not mutate the input map', () => {
    applyKeyedChange(base, change({ op: 'delete', key: 'A' }))
    expect(Object.keys(base)).toEqual(['A', 'B'])
  })
})

describe('planActionText / joinActionText', () => {
  const local: ImagePlan = { source: 'localFile', sourcePath: '/tmp/a.png', destRelative: 'X/y.png' }
  const url: ImagePlan = { source: 'url', url: 'https://e/x.png', destRelative: 'X/y.png' }

  it('returns null for missing or existing-file plans', () => {
    expect(planActionText(undefined)).toBeNull()
    expect(planActionText({ source: 'existing', relativePath: 'X/y.png' })).toBeNull()
  })
  it('describes copy and download ops', () => {
    expect(planActionText(local)).toBe('Copy /tmp/a.png → images/X/y.png')
    expect(planActionText(url)).toBe('Download https://e/x.png → images/X/y.png')
  })
  it('joins the applicable plans, dropping the null ones', () => {
    expect(joinActionText([undefined, local, { source: 'existing', relativePath: 'z' }, url]))
      .toBe('Copy /tmp/a.png → images/X/y.png\nDownload https://e/x.png → images/X/y.png')
    expect(joinActionText([undefined])).toBeNull()
  })
})

describe('serializeRecords', () => {
  const raw = stringifyDataFile({ materials: { A: { name: 'A' } } }) + '\n'

  it('re-serializes new records, preserving the trailing-newline convention', () => {
    const core = serializeRecords(raw, 'materials', { A: { name: 'A' }, B: { name: 'B' } }, 'DRIFT')
    expect(core.formattingDriftWarning).toBeNull()
    expect(core.after.endsWith('\n')).toBe(true)
    expect(core.after).toContain('"B"')
  })
  it('flags formatting drift when the existing file does not round-trip', () => {
    const nonCanonical = '{\n  "materials": {\n    "A": {\n      "days": [\n        1,\n        4\n      ]\n    }\n  }\n}\n'
    const core = serializeRecords(nonCanonical, 'materials', {}, 'DRIFT-MSG')
    expect(core.formattingDriftWarning).toBe('DRIFT-MSG')
  })
})

describe('assembleCommit', () => {
  it('applies a keyed change against the file and re-serializes', () => {
    const raw = stringifyDataFile({ weapons: { A: { name: 'A' } } }) + '\n'
    const core = assembleCommit(raw, 'weapons', change({ op: 'create', key: 'B', record: { name: 'B' } }), 'D')
    expect(core.after).toContain('"B"')
    expect(core.before).toBe(raw)
  })
  it('preserves other top-level keys (e.g. a template block)', () => {
    const raw = stringifyDataFile({ weapons: { A: { name: 'A' } }, note: 'keep' }) + '\n'
    const core = assembleCommit(raw, 'weapons', change({ op: 'delete', key: 'A' }), 'D')
    expect(core.after).toContain('"note": "keep"')
  })
})
