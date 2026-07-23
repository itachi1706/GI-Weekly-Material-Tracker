import { describe, it, expect } from 'vitest'
import { validateDataset, isDataFile, type ValidateDeps, type Finding } from './validate'

// Default stubs: everything round-trips and every image exists. Override per test.
const run = (
  files: { file: string; raw: string }[],
  over: Partial<ValidateDeps> = {}
): Finding[] => validateDataset(files, { imageExists: () => true, roundTrips: () => true, ...over })

const cats = (fs: Finding[]): string[] => fs.map((f) => f.category)

describe('isDataFile', () => {
  it('accepts the recognised data files', () => {
    expect(isDataFile('Materials-Elite_Mob.json')).toBe(true)
    expect(isDataFile('Characters-Anemo.json')).toBe(true)
    expect(isDataFile('EventBanners.json')).toBe(true)
  })
  it('rejects everything else', () => {
    expect(isDataFile('templates.json')).toBe(false)
    expect(isDataFile('Materials-Elite_Mob.txt')).toBe(false)
  })
})

describe('validateDataset', () => {
  it('reports invalid-json on a parse failure', () => {
    const f = run([{ file: 'Materials-X.json', raw: '{ not json' }])
    expect(cats(f)).toContain('invalid-json')
  })

  it('reports formatting-drift when the file does not round-trip', () => {
    const f = run([{ file: 'Materials-X.json', raw: '{"materials":{}}' }], { roundTrips: () => false })
    expect(cats(f)).toContain('formatting-drift')
  })

  it('reports text-hygiene when a text field contains wiki markup', () => {
    const f = run([{ file: 'Materials-X.json', raw: '{"materials":{"Slime":{"name":"[[link]]"}}}' }])
    expect(cats(f)).toContain('text-hygiene')
  })

  it('reports empty-image for an image set to ""', () => {
    const f = run([{ file: 'Materials-X.json', raw: '{"materials":{"Slime":{"image":""}}}' }])
    expect(cats(f)).toContain('empty-image')
  })

  it('reports missing-image (WARN) when an image file is absent', () => {
    const f = run(
      [{ file: 'Materials-X.json', raw: '{"materials":{"Slime":{"image":"Item_Slime.png"}}}' }],
      { imageExists: () => false }
    )
    const mi = f.find((x) => x.category === 'missing-image')
    expect(mi?.severity).toBe('WARN')
  })

  it('reports broken-ref for an outfit pointing at an unknown character', () => {
    const f = run([{ file: 'Outfits-Standard.json', raw: '{"outfits":{"O":{"character":"Nobody"}}}' }])
    expect(cats(f)).toContain('broken-ref')
  })

  it('resolves a valid cross-file reference (no broken-ref)', () => {
    const f = run([
      { file: 'Characters-Anemo.json', raw: '{"characters":{"Jean":{"name":"Jean"}}}' },
      { file: 'Outfits-Standard.json', raw: '{"outfits":{"O":{"character":"Jean"}}}' }
    ])
    expect(cats(f)).not.toContain('broken-ref')
  })

  it('returns no findings for a clean record', () => {
    const f = run([{ file: 'Materials-X.json', raw: '{"materials":{"Slime":{"name":"Slime","image":"Item_Slime.png"}}}' }])
    expect(f).toEqual([])
  })

  it('flags a malformed character title', () => {
    const f = run([{ file: 'Characters-Anemo.json', raw: '{"characters":{"Jean":{"titles":["Dandelion Knight","[[bad]]"]}}}' }])
    expect(cats(f)).toContain('malformed-title')
  })

  it('flags a phase material type missing from the ascension map (phase-slot)', () => {
    const raw = '{"characters":{"Jean":{"materials":{"ascension":{}},"ascension":{"1":{"material1type":"gem","material1":"X"}}}}}'
    expect(cats(run([{ file: 'Characters-Anemo.json', raw }]))).toContain('phase-slot')
  })

  it('flags a phase name that disagrees with the map (phase-vs-map)', () => {
    const raw = '{"characters":{"Jean":{"materials":{"ascension":{"gem":"Real_Gem"}},"ascension":{"1":{"material1type":"gem","material1":"Wrong_Gem"}}}}}'
    expect(cats(run([{ file: 'Characters-Anemo.json', raw }]))).toContain('phase-vs-map')
  })

  it('warns when a weapon series is null', () => {
    const f = run([{ file: 'Weapons-Sword.json', raw: '{"weapons":{"Blade":{"series":null}}}' }])
    expect(f.find((x) => x.category === 'series-null')?.severity).toBe('WARN')
  })

  it('flags an unknown material reference in a weapon ascension map', () => {
    const raw = '{"weapons":{"Blade":{"materials":{"ascension":{"gem":"Unknown_Mat"}}}}}'
    expect(cats(run([{ file: 'Weapons-Sword.json', raw }]))).toContain('broken-ref')
  })

  it('flags off-convention banner times and unknown rate-up refs', () => {
    const raw = '{"banners":{"character":[{"name":"B","start":"2024-01-01T10:30:00+08","end":"2024-01-15T21:59:59+08","rateupcharacters":["Nobody"]}]}}'
    const f = run([{ file: 'EventBanners.json', raw }])
    expect(cats(f)).toContain('banner-time') // start not on :00:00
    expect(cats(f)).toContain('broken-ref') // rate-up character "Nobody" unknown
  })

  it('resolves a valid outfit→character reference across files', () => {
    const f = run([
      { file: 'Characters-Anemo.json', raw: '{"characters":{"Jean":{"name":"Jean"}}}' },
      { file: 'Outfits-Standard.json', raw: '{"outfits":{"Sea Breeze":{"character":"Jean","image":"x.png"}}}' }
    ])
    expect(cats(f)).not.toContain('broken-ref')
  })
})
