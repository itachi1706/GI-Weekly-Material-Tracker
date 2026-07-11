import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { WikiCharacterResult, WikiTalent, WikiConstellation } from '@shared/types'

const WIKI_HOST = 'genshin-impact.fandom.com'
const USER_AGENT = 'gi-dataset-tool/0.1 (personal dataset manager; contact via local app)'

/** Talent-table `type` labels we treat as real talent header rows (vs scaling sub-rows). */
const TALENT_TYPE_RE =
  /^(Normal Attack|Elemental Skill|Elemental Burst|Alternate Sprint|\d(?:st|nd|rd|th) Ascension Passive|Utility Passive|Passive)$/

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
}

/**
 * Extract the MediaWiki page title from a pasted Fandom URL.
 * Accepts `https://genshin-impact.fandom.com/wiki/<Title>` (with optional query/hash) and the
 * `?title=<Title>` form. Throws on non-Fandom hosts so a mis-paste fails loudly.
 */
export function pageTitleFromUrl(raw: string): string {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    throw new Error('Not a valid URL. Paste a full Genshin Wiki page URL.')
  }
  if (!u.hostname.endsWith('fandom.com')) {
    throw new Error(`Expected a ${WIKI_HOST} URL, got "${u.hostname}".`)
  }
  const m = u.pathname.match(/\/wiki\/(.+)$/)
  const rawTitle = m ? m[1] : u.searchParams.get('title')
  if (!rawTitle) throw new Error('Could not find a page title in that URL.')
  return decodeURIComponent(rawTitle).replace(/_/g, ' ').trim()
}

/** Strip inline wiki markup from an infobox param value → plain text. */
function cleanInline(s: string): string {
  return s
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1') // [[a|b]] → b
    .replace(/\[\[([^\]]*)\]\]/g, '$1') // [[a]] → a
    .replace(/\{\{(?:w|zh|ja|ko)\|([^}|]*)(?:\|[^}]*)?\}\}/gi, '$1') // {{w|X}} → X
    .replace(/\{\{[^{}]*\}\}/g, '') // drop other templates
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1') // [url label] → label
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Read a named infobox param from the `{{Character Infobox ...}}` block. Grabs everything after
 * `|key =` up to the next top-level `|` at line start or the closing `}}`.
 */
function wikiParam(infobox: string, key: string): string | null {
  const re = new RegExp(`\\|\\s*${key}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\|[a-zA-Z0-9_]+\\s*=|\\n\\}\\})`, 'i')
  const m = infobox.match(re)
  if (!m) return null
  const cleaned = cleanInline(m[1])
  return cleaned || null
}

/** Isolate the Character Infobox template block from full wikitext. */
function infoboxBlock(wikitext: string): string {
  const start = wikitext.search(/\{\{Character Infobox/i)
  if (start < 0) return ''
  // Walk braces to find the matching close.
  let depth = 0
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') { depth--; i++; if (depth === 0) return wikitext.slice(start, i + 1) }
  }
  return wikitext.slice(start)
}

/** "October 13th" → "13/10" (the dataset's D/M, NO leading zeros). Unchanged if unparseable. */
function convertBirthday(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/([A-Za-z]+)\s+(\d{1,2})/)
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()]
    if (mon) return `${parseInt(m[2], 10)}/${mon}`
  }
  return raw
}

/**
 * Clean a rendered-HTML block into dataset-style prose. Drops scaling tables, tab labels, previews,
 * references and galleries; converts `<br>` and block boundaries to newlines; normalizes whitespace.
 * Verified byte-identical to committed talent/constellation effect text for combat talents.
 */
function cleanBlock($: CheerioAPI, el: AnyNode): string {
  const $clone = $(el).clone()
  $clone
    .find('table, style, sup.reference, .reference, .wds-tabs__wrapper, .wds-tabs, .mw-collapsible-toggle, [class*="preview"], .gallery, .wikia-gallery, figure')
    .remove()
  $clone.find('br').replaceWith('\n')
  $clone.find('p, li, div').each((_, n) => { $(n).append('\n') })
  let txt = $clone.text()
  txt = txt
    .replace(/\n?Hover over previews[\s\S]*$/i, '')
    .replace(/\n?\(Preview Preferences\)[\s\S]*$/i, '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return txt || ''
}

/** Parse the talent table: name + type + icon + effect for each real talent. */
function parseTalents($: CheerioAPI): WikiTalent[] {
  const tt = $('table.talent-table').first()
  if (!tt.length) return []
  const out: WikiTalent[] = []
  let cur: WikiTalent | null = null
  tt.find('tr').each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.children('td')
    const img = $tr.find('td img[data-src]').first()
    const type = tds.eq(2).text().trim()
    const isHeader = img.length > 0 && tds.length >= 3 && TALENT_TYPE_RE.test(type)
    if (isHeader) {
      cur = { name: tds.eq(1).text().trim(), type, effect: null, iconUrl: img.attr('data-src') ?? null }
      out.push(cur)
    } else if (cur && cur.effect === null) {
      const tabber = $tr.find('.wds-tabber').first()
      if (tabber.length) {
        const labels = tabber.find('.wds-tabs__tab').map((_i, l) => $(l).text().trim()).get()
        const panels = tabber.find('.wds-tab__content')
        const di = labels.findIndex((l) => /^Description/i.test(l))
        const panel = panels.get(di >= 0 ? di : 0)
        if (panel) cur.effect = cleanBlock($, panel)
      } else {
        // Short passive with no tabber: fall back to the row's own prose.
        const prose = cleanBlock($, tr)
        if (prose) cur.effect = prose
      }
    }
  })
  return out
}

/** Parse the constellation table: name + effect + icon for C1..C6. */
function parseConstellations($: CheerioAPI): WikiConstellation[] {
  const ct = $('table.constellation-table').first()
  if (!ct.length) return []
  const out: WikiConstellation[] = []
  let cur: WikiConstellation | null = null
  ct.find('tr').each((_, tr) => {
    const $tr = $(tr)
    const tds = $tr.children('td')
    const img = $tr.find('td img[data-src]').first()
    if (tds.length >= 3 && img.length) {
      const level = parseInt(tds.eq(2).text().trim(), 10)
      cur = {
        index: Number.isFinite(level) ? level : out.length + 1,
        name: tds.eq(1).text().trim(),
        effect: null,
        iconUrl: img.attr('data-src') ?? null
      }
      out.push(cur)
    } else if (cur && cur.effect === null && tds.length) {
      cur.effect = cleanBlock($, tds.get(tds.length - 1)!)
    }
  })
  return out
}

/**
 * Portrait/card candidates from the infobox hero gallery only (`.pi-image`). Excludes the small
 * stat icons (5-star badge, element/weapon/role icons) which live in `.pi-data` sections. Labels
 * come from the gallery tab captions (Card 1 / Wish / In-Game …) when available, else the img alt.
 */
function parseImageCandidates($: CheerioAPI): { label: string; url: string }[] {
  const seen = new Set<string>()
  const out: { label: string; url: string }[] = []
  const imgs = $('aside.portable-infobox .pi-image-collection img, aside.portable-infobox figure.pi-item img')
  const labels = $('aside.portable-infobox .pi-image-collection .wds-tabs__tab').map((_i, l) => $(l).text().trim()).get()
  imgs.each((i, img) => {
    const raw = $(img).attr('data-src') || $(img).attr('src') || ''
    if (!raw || raw.startsWith('data:') || seen.has(raw)) return
    seen.add(raw)
    const label = labels[i] || $(img).attr('alt')?.trim() || `Image ${out.length + 1}`
    out.push({ label, url: raw })
  })
  return out
}

/**
 * Fetch a Fandom character page and parse it into review candidates. Network runs in main (renderer
 * CSP blocks cross-origin). One `parse` API call returns both wikitext (clean infobox params) and
 * rendered HTML (talent/constellation effect prose). Throws with a friendly message on failure.
 */
export async function fetchCharacterFromWiki(url: string): Promise<WikiCharacterResult> {
  const title = pageTitleFromUrl(url)
  if (/^(Traveler|Aether|Lumine)$/i.test(title)) {
    throw new Error('Traveler pages are not supported by auto-fill (multi-element layout).')
  }

  const api = `https://${WIKI_HOST}/api.php?action=parse&page=${encodeURIComponent(
    title
  )}&format=json&formatversion=2&prop=wikitext%7Ctext&redirects=1`

  interface ParseResponse {
    parse?: { title?: string; wikitext?: string; text?: string }
    error?: { info?: string }
  }
  let json: ParseResponse
  try {
    const res = await fetch(api, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`Wiki request failed (HTTP ${res.status}).`)
    json = (await res.json()) as ParseResponse
  } catch (e) {
    throw new Error(`Could not reach the Genshin Wiki: ${(e as Error).message}`)
  }
  if (json.error) throw new Error(`Wiki: ${json.error.info ?? 'page not found'}.`)
  const wikitext = json.parse?.wikitext ?? ''
  const html = json.parse?.text ?? ''
  if (!wikitext && !html) throw new Error('Wiki returned an empty page.')

  const box = infoboxBlock(wikitext)
  const titlesRaw = [wikiParam(box, 'title'), wikiParam(box, 'title2'), wikiParam(box, 'title3')]
  const caption = titlesRaw[0]
  const titles = titlesRaw.slice(1).filter((t): t is string => !!t)

  const affiliations = [
    wikiParam(box, 'affiliation'),
    wikiParam(box, 'affiliation2'),
    wikiParam(box, 'affiliation3')
  ].filter((a): a is string => !!a)

  const qualityStr = wikiParam(box, 'quality')
  const rarity = qualityStr ? parseInt(qualityStr, 10) : null

  const $ = cheerio.load(html)

  const resolvedTitle = json.parse?.title ?? title

  return {
    sourceUrl: url,
    title: resolvedTitle,
    // Canonical page URL in the dataset's style: spaces → underscores, no extra encoding.
    wikiUrl: `https://${WIKI_HOST}/wiki/${resolvedTitle.replace(/ /g, '_')}`,
    name: wikiParam(box, 'name'),
    fullName: wikiParam(box, 'realname'),
    caption,
    titles,
    affiliation: affiliations.length ? affiliations.join(', ') : null,
    constellation: wikiParam(box, 'constellation'),
    nation: wikiParam(box, 'region'),
    birthday: convertBirthday(wikiParam(box, 'birthday')),
    element: wikiParam(box, 'element'),
    weapon: wikiParam(box, 'weapon'),
    rarity: rarity && Number.isFinite(rarity) ? rarity : null,
    talents: parseTalents($),
    constellations: parseConstellations($),
    imageCandidates: parseImageCandidates($)
  }
}
