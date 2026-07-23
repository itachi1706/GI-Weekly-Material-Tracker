import { describe, it, expect } from 'vitest'
import {
  pageTitleFromUrl,
  cleanInline,
  decodeEntities,
  stripUntilStable,
  rawParam,
  wikiParam,
  wikiParamMultiline,
  infoboxBlock,
  convertBirthday,
  wikiSection
} from './wiki'

describe('pageTitleFromUrl', () => {
  it('extracts and de-underscores a /wiki/ title', () => {
    expect(pageTitleFromUrl('https://genshin-impact.fandom.com/wiki/Kamisato_Ayaka')).toBe('Kamisato Ayaka')
  })
  it('accepts the ?title= form when the path is not /wiki/…', () => {
    expect(pageTitleFromUrl('https://genshin-impact.fandom.com/index.php?title=Barbara')).toBe('Barbara')
  })
  it('throws on a non-Fandom host', () => {
    expect(() => pageTitleFromUrl('https://example.com/wiki/X')).toThrow()
  })
  it('throws on a non-URL', () => {
    expect(() => pageTitleFromUrl('not a url')).toThrow()
  })
})

describe('cleanInline', () => {
  it('strips bold quotes and unwraps wiki links', () => {
    expect(cleanInline("'''Barbara''' is a [[playable character|character]].")).toBe('Barbara is a character.')
  })
  it('unwraps [[a]] links', () => {
    expect(cleanInline('See [[Mondstadt]].')).toBe('See Mondstadt.')
  })
  it('keeps text after the first pipe in a multi-pipe link', () => {
    expect(cleanInline('[[a|b|c]]')).toBe('b|c')
  })
  it('leaves a malformed link with a stray ] untouched', () => {
    expect(cleanInline('[[a]b]]')).toBe('[[a]b]]')
  })
  it('unwraps the innermost when links are adjacent to brackets', () => {
    expect(cleanInline('[[a[[b]]')).toBe('a[[b')
  })
  it('keeps the label of an external link and drops a bare url', () => {
    expect(cleanInline('see [https://ex.com/p Example] here')).toBe('see Example here')
    expect(cleanInline('ref [https://ex.com/p] done')).toBe('ref done')
  })
  it('preserves an empty <> (needs ≥1 char between angle brackets)', () => {
    expect(cleanInline('a<>b')).toBe('a<>b')
  })
  it('keeps the display arg of text-wrapping templates', () => {
    expect(cleanInline('{{w|Adventure Rank}} rises.')).toBe('Adventure Rank rises.')
  })
  it('drops non-text templates entirely', () => {
    expect(cleanInline('a {{Color|red|x}} b')).toBe('a b')
  })
  it('removes HTML comments and tags (repeat-until-stable)', () => {
    expect(cleanInline('a<!--note-->b')).toBe('ab')
    expect(cleanInline('<b>x</b>')).toBe('x')
  })
  it('collapses whitespace and trims', () => {
    expect(cleanInline('  a   b  ')).toBe('a b')
  })
})

describe('decodeEntities', () => {
  it('decodes the expected named entities in one pass', () => {
    expect(decodeEntities('A&nbsp;B &amp; C&mdash;D')).toBe('A B & C—D')
  })
  it('drops soft hyphens', () => {
    expect(decodeEntities('Mist&shy;splitter')).toBe('Mistsplitter')
  })
})

describe('stripUntilStable', () => {
  it('removes all matches repeatedly until stable', () => {
    expect(stripUntilStable('a<!--x-->b<!--y-->c', /<!--[\s\S]*?-->/g)).toBe('abc')
  })
})

describe('rawParam / wikiParam / wikiParamMultiline', () => {
  const infobox = '{{Character Infobox\n|name = Ayaka\n|realname = \n|element = Cryo\n}}'

  it('rawParam captures a param value up to the next param', () => {
    expect(rawParam(infobox, 'name')).toBe('Ayaka')
    expect(rawParam(infobox, 'element')).toBe('Cryo')
  })
  it('rawParam returns null for a missing key', () => {
    expect(rawParam(infobox, 'nope')).toBeNull()
  })
  it('rawParam does not let an empty param swallow the next value', () => {
    // `realname` is empty; must not capture the following `element` value.
    expect(rawParam(infobox, 'realname')).toBe('')
  })
  it('wikiParam cleans inline markup', () => {
    const box = "{{Infobox\n|title = '''Frostflake''' [[Heron]]\n|x = y\n}}"
    expect(wikiParam(box, 'title')).toBe('Frostflake Heron')
  })
  it('wikiParamMultiline preserves <br> line breaks', () => {
    const box = '{{Infobox\n|desc = Line one<br>Line two\n}}'
    expect(wikiParamMultiline(box, 'desc')).toBe('Line one\nLine two')
  })
})

describe('infoboxBlock', () => {
  it('extracts the balanced template block', () => {
    const wikitext = 'lead\n{{Character Infobox\n|name = X\n|nested = {{y|z}}\n}}\ntrailing'
    expect(infoboxBlock(wikitext, 'Character Infobox')).toBe('{{Character Infobox\n|name = X\n|nested = {{y|z}}\n}}')
  })
  it('returns empty string when the template is absent', () => {
    expect(infoboxBlock('no infobox here', 'Character Infobox')).toBe('')
  })
})

describe('convertBirthday', () => {
  it('converts "Month Day" to D/M with no leading zeros', () => {
    expect(convertBirthday('October 13th')).toBe('13/10')
    expect(convertBirthday('September 5')).toBe('5/9')
  })
  it('passes through null and unparseable input', () => {
    expect(convertBirthday(null)).toBeNull()
    expect(convertBirthday('sometime')).toBe('sometime')
  })
  it('uses the first letters+number run and does not search past a non-month first run', () => {
    // First triple is "Foo 5"; "Foo" is not a month → the whole value passes through unchanged.
    expect(convertBirthday('Foo 5 September 3')).toBe('Foo 5 September 3')
  })
  it('finds the month even when preceded by a leading number token', () => {
    expect(convertBirthday('12 October 13')).toBe('13/10')
  })
})

describe('wikiSection', () => {
  it('extracts a == heading == section body up to the next heading', () => {
    const wikitext = 'lead\n==Story==\nSome lore here.\n==Trivia==\nother'
    expect(wikiSection(wikitext, 'Story')).toBe('Some lore here.')
  })
  it('returns null when the heading is absent', () => {
    expect(wikiSection('==Other==\nx', 'Story')).toBeNull()
  })
})
