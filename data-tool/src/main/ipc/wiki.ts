import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { AnyNode } from 'domhandler'
import type {
  WikiCharacterResult,
  WikiTalent,
  WikiConstellation,
  WikiWeaponResult,
  WikiOutfitResult,
  WikiMaterialResult
} from '@shared/types'

const WIKI_HOST = 'genshin-impact.fandom.com'
const USER_AGENT = 'gi-dataset-tool/0.1 (personal dataset manager; contact via local app)'

/**
 * Talent-table `type` labels we treat as real talent header rows (vs scaling sub-rows, which lack an
 * icon anyway). Combat talents by exact name; any passive by an `…Passive` suffix — this covers the
 * standard "Nth Ascension Passive" / "Utility Passive" AND special ones like "Witch's Eve Rite Passive"
 * (Nicole) or other character-specific passive labels.
 */
const TALENT_TYPE_RE =
  /^(?:Normal Attack|Elemental Skill|Elemental Burst|Alternate Sprint|.*Passive)$/

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
  const hostname = u.hostname.toLowerCase()
  if (hostname !== WIKI_HOST) {
    throw new Error(`Expected a ${WIKI_HOST} URL, got "${u.hostname}".`)
  }
  const m = /\/wiki\/(.+)$/.exec(u.pathname)
  const rawTitle = m ? m[1] : u.searchParams.get('title')
  if (!rawTitle) throw new Error('Could not find a page title in that URL.')
  return decodeURIComponent(rawTitle).replaceAll('_', ' ').trim()
}

/**
 * Remove every match of `re` (which must be global) repeatedly until the string stops changing, so
 * a single pass can't leave residual markup when a removal glues two fragments into a fresh match
 * (e.g. `<scr<script>ipt>`, or overlapping `<!--…<!--…-->`). Terminates because the string only shrinks.
 */
function stripUntilStable(s: string, re: RegExp): string {
  let prev: string
  do {
    prev = s
    s = s.replace(re, '')
  } while (s !== prev)
  return s
}

/** Named HTML entities the inline cleaner decodes. */
const INLINE_ENTITIES: Record<string, string> = { nbsp: ' ', mdash: '—', amp: '&', shy: '' }

/**
 * Decode our handful of expected entities in ONE pass. A single combined replace (rather than a
 * chain that decodes `&amp;`→`&` after the others) avoids double-unescaping — a decoded `&` can't
 * recombine with following text into an entity that an earlier step would have expanded.
 */
function decodeEntities(s: string): string {
  return s
    .replaceAll(/&(nbsp|mdash|amp|shy);/gi, (_m, name: string) => INLINE_ENTITIES[name.toLowerCase()] ?? _m)
    .replaceAll('­', '') // bare soft-hyphen character
}

/** Strip inline wiki markup from an infobox param value → plain text. */
function cleanInline(s: string): string {
  let out = s
    .replaceAll(/<ref[^>]*\/>/gi, '')
    .replaceAll(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  out = stripUntilStable(out, /<!--[\s\S]*?-->/g) // HTML comments (repeat: nested/overlapping)
  out = out
    .replaceAll(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1') // [[a|b]] → b
    .replaceAll(/\[\[([^\]]*)\]\]/g, '$1') // [[a]] → a
    // Text-wrapping templates: keep the (first) displayed arg. {{w|X}}, {{sic|X}} ("X" [sic]),
    // {{tt|display|title}} (tooltip) — dropping these whole would lose real words (e.g. "Barbara").
    .replaceAll(/\{\{(?:w|zh|ja|ko|sic|tt)\|([^}|]*)(?:\|[^}]*)?\}\}/gi, '$1')
    .replaceAll(/\{\{[^{}]*\}\}/g, '') // drop other (non-text) templates
    .replaceAll(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1') // [url label] → label
    .replaceAll(/\[https?:\/\/\S+\]/g, '')
    .replaceAll(/'''?/g, '')
    .replaceAll(/<br\s*\/?>/gi, ' ')
  out = stripUntilStable(out, /<[^>]+>/g) // HTML tags (repeat: a removal can't re-form a tag)
  return decodeEntities(out)
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/**
 * Raw value of a named infobox param: everything after `|key =` up to the next top-level `|param =`
 * or the closing `}}`. No markup cleaning.
 */
function rawParam(infobox: string, key: string): string | null {
  // NB: horizontal-only whitespace after `=` (`[ \t]*`, not `\s*`) — otherwise an EMPTY param
  // (`|realname =\n|birthday = …`) would let `\s*` eat the newline and capture the next param's value.
  const re = new RegExp(String.raw`\|\s*${key}\s*=[ \t]*([\s\S]*?)(?=\n\s*\|[a-zA-Z0-9_]+\s*=|\n\}\})`, 'i')
  const m = re.exec(infobox)
  return m ? m[1] : null
}

/** Read + inline-clean a named infobox param (single-line: `<br>` collapses to a space). */
function wikiParam(infobox: string, key: string): string | null {
  const raw = rawParam(infobox, key)
  return raw == null ? null : cleanInline(raw) || null
}

/** Like wikiParam but preserves line breaks (`<br>` and blank lines → `\n`) — for description fields. */
function wikiParamMultiline(infobox: string, key: string): string | null {
  const raw = rawParam(infobox, key)
  if (raw == null) return null
  const out = stripUntilStable(raw, /<!--[\s\S]*?-->/g) // multi-line HTML comments (per-line cleanInline can't catch these)
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => cleanInline(line))
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
  return out || null
}

/** Isolate an infobox template block (e.g. "Character Infobox" / "Weapon Infobox") from wikitext. */
function infoboxBlock(wikitext: string, template = 'Character Infobox'): string {
  const start = wikitext.search(new RegExp(String.raw`\{\{${template}`, 'i'))
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
  const m = /([A-Za-z]+)\s+(\d{1,2})/.exec(raw)
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()]
    if (mon) return `${Number.parseInt(m[2], 10)}/${mon}`
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
    .replaceAll('\u00A0', ' ')
    .replaceAll(/[ \t]+\n/g, '\n')
    .replaceAll(/\n[ \t]+/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
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
    } else if (cur?.effect === null) {
      const tabber = $tr.find('.wds-tabber').first()
      if (tabber.length) {
        const labels = tabber.find('.wds-tabs__tab').map((_i, l) => $(l).text().trim()).get()
        const panels = tabber.find('.wds-tab__content')
        const di = labels.findIndex((l) => /^Description/i.test(l))
        const panel = panels.get(Math.max(di, 0))
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
      const level = Number.parseInt(tds.eq(2).text().trim(), 10)
      cur = {
        index: Number.isFinite(level) ? level : out.length + 1,
        name: tds.eq(1).text().trim(),
        effect: null,
        iconUrl: img.attr('data-src') ?? null
      }
      out.push(cur)
    } else if (cur?.effect === null && tds.length) {
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
 * Canonical Fandom page URL, URL-safe: spaces → underscores, then percent-encode special characters
 * (e.g. `'`→`%27`) so it matches the dataset's encoded form (`Gunnhildr%27s_Legacy`) rather than a
 * raw apostrophe. `encodeURIComponent` leaves `'!()*` alone, so encode those explicitly.
 */
function canonicalWikiUrl(resolvedTitle: string): string {
  const enc = encodeURIComponent(resolvedTitle.replaceAll(' ', '_'))
    .replaceAll("'", '%27')
    .replaceAll('!', '%21')
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replaceAll('*', '%2A')
  return `https://${WIKI_HOST}/wiki/${enc}`
}

interface ParseResult {
  title: string
  resolvedTitle: string
  wikitext: string
  html: string
}

/**
 * Fetch + validate a Fandom page via the MediaWiki parse API (one call for both raw wikitext and
 * rendered HTML). Network runs in main (renderer CSP blocks cross-origin). Throws a friendly message
 * on any failure. Shared by the character + weapon fetchers.
 */
async function fetchParse(url: string): Promise<ParseResult> {
  const title = pageTitleFromUrl(url)
  // Build via URL/URLSearchParams so the (user-derived) page title is safely encoded into a
  // fixed-host request rather than concatenated into the string.
  const api = new URL(`https://${WIKI_HOST}/api.php`)
  api.search = new URLSearchParams({
    action: 'parse',
    page: title,
    format: 'json',
    formatversion: '2',
    prop: 'wikitext|text',
    redirects: '1'
  }).toString()

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
  return { title, resolvedTitle: json.parse?.title ?? title, wikitext, html }
}

/**
 * Fetch a Fandom character page and parse it into review candidates. One `parse` API call returns
 * both wikitext (clean infobox params) and rendered HTML (talent/constellation effect prose).
 */
export async function fetchCharacterFromWiki(url: string): Promise<WikiCharacterResult> {
  const title = pageTitleFromUrl(url)
  if (/^(Traveler|Aether|Lumine)$/i.test(title)) {
    throw new Error('Traveler pages are not supported by auto-fill (multi-element layout).')
  }

  const { resolvedTitle, wikitext, html } = await fetchParse(url)
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
  const rarity = qualityStr ? Number.parseInt(qualityStr, 10) : null

  const $ = cheerio.load(html)

  return {
    sourceUrl: url,
    title: resolvedTitle,
    wikiUrl: canonicalWikiUrl(resolvedTitle),
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

// ── Weapons ─────────────────────────────────────────────────────────────────────

/** Extract the `{{Description|…}}` short weapon description (the one right after the infobox). */
function descriptionTemplate(wikitext: string): string | null {
  const m = /\{\{Description\|([\s\S]*?)\}\}/.exec(wikitext)
  return m ? cleanInline(m[1]) || null : null
}

/**
 * Substitute a weapon effect's `(varN)` placeholders with their `R1~R5` inline range, matching the
 * dataset (e.g. `(var1)` → `12~24`, multi-stack `(var2)` → `8/16/28~16/32/56`). Values come from the
 * infobox `eff_rank1_varN`/`eff_rank5_varN` params. Leaves the placeholder if a value is missing.
 */
function substituteEffectVars(effect: string, box: string): string {
  return effect.replaceAll(/\(var(\d+)\)/g, (_m, n: string) => {
    const r1 = wikiParam(box, `eff_rank1_var${n}`)
    const r5 = wikiParam(box, `eff_rank5_var${n}`)
    if (r1 && r5) return r1 === r5 ? r1 : `${r1}~${r5}`
    return r1 ?? r5 ?? `(var${n})`
  })
}

/** Strip a trailing flag letter from a stat value (`9.6%b` → `9.6%`; `7.5%` unchanged). */
function cleanStatValue(v: string | null): string | null {
  if (!v) return null
  return v.replace(/[a-zA-Z]+$/, '').trim() || null
}

/**
 * Normalize a weapon series to the dataset's "<Name> Series" form: the infobox gives the short name
 * ("Inazuma"), the dataset stores "Inazuma Series". Append " Series" unless it's already there.
 * Null (no series) stays null — no fabrication.
 */
function normalizeSeries(v: string | null): string | null {
  if (!v) return null
  return /\bseries$/i.test(v) ? v : `${v} Series`
}

/**
 * Max base ATK + max secondary stat from the rendered "Weapon Ascensions and Stats" table: the last
 * row whose level cell looks like `N/M` (level 90 for 3–5★, 70 for 1–2★). Ascension-cost rows don't
 * match that pattern, so they're skipped.
 */
function weaponMaxStats($: CheerioAPI): { maxBaseAtk: number | null; maxSecondaryStat: string | null } {
  let maxBaseAtk: number | null = null
  let maxSecondaryStat: string | null = null
  $('table.wikitable').each((_i, t) => {
    $(t).find('tr').each((_j, tr) => {
      const cells = $(tr).children('td,th').map((_k, c) => $(c).text().trim()).get()
      const lvlIdx = cells.findIndex((c) => /^\d+\/\d+$/.test(c))
      if (lvlIdx < 0) return
      const rest = cells.slice(lvlIdx + 1).filter((c) => c !== '')
      if (rest.length >= 1 && /^\d[\d,]*$/.test(rest[0])) {
        maxBaseAtk = Number.parseInt(rest[0].replaceAll(',', ''), 10)
        maxSecondaryStat = rest[1] ?? null
      }
    })
  })
  return { maxBaseAtk: Number.isFinite(maxBaseAtk) ? maxBaseAtk : null, maxSecondaryStat }
}

/**
 * Fetch a Fandom weapon page and parse it into review candidates. Nearly everything comes from the
 * `{{Weapon Infobox}}` wikitext; rendered HTML supplies only the max stats + base icon.
 */
export async function fetchWeaponFromWiki(url: string): Promise<WikiWeaponResult> {
  const { resolvedTitle, wikitext, html } = await fetchParse(url)
  const box = infoboxBlock(wikitext, 'Weapon Infobox')
  if (!box) throw new Error('That page has no Weapon Infobox — is it a weapon page?')

  const baseAtkStr = wikiParam(box, 'base_atk')
  const baseAtk = baseAtkStr ? Number.parseInt(baseAtkStr, 10) : null
  const qualityStr = wikiParam(box, 'quality')
  const rarity = qualityStr ? Number.parseInt(qualityStr, 10) : null

  const effectTemplate = wikiParam(box, 'effect')
  const effect = effectTemplate ? substituteEffectVars(effectTemplate, box) : null

  const $ = cheerio.load(html)
  const { maxBaseAtk, maxSecondaryStat } = weaponMaxStats($)
  const iconUrl = parseImageCandidates($)[0]?.url ?? null

  return {
    sourceUrl: url,
    title: resolvedTitle,
    wikiUrl: canonicalWikiUrl(resolvedTitle),
    // Some weapon infoboxes omit `title` (e.g. "Amos' Bow") → fall back to the page title.
    name: wikiParam(box, 'title') ?? resolvedTitle,
    series: normalizeSeries(wikiParam(box, 'series')),
    description: descriptionTemplate(wikitext),
    effectName: wikiParam(box, 'passive'),
    effect,
    baseAtk: baseAtk && Number.isFinite(baseAtk) ? baseAtk : null,
    maxBaseAtk,
    secondaryStat: cleanStatValue(wikiParam(box, '2nd_stat')),
    maxSecondaryStat: cleanStatValue(maxSecondaryStat),
    secondaryStatType: wikiParam(box, '2nd_stat_type'),
    type: wikiParam(box, 'type'),
    rarity: rarity && Number.isFinite(rarity) ? rarity : null,
    iconUrl
  }
}

// ── Outfits + Materials ─────────────────────────────────────────────────────────

/** Extract a top-level `==Heading==` section body (up to the next `==…==`), cleaned to prose. */
function wikiSection(wikitext: string, heading: string): string | null {
  const re = new RegExp(String.raw`\n==\s*${heading}\s*==\s*\n([\s\S]*?)(?=\n==[^=]|$)`, 'i')
  const m = re.exec(wikitext)
  if (!m) return null
  // Preserve paragraph breaks: <br> and blank lines → newlines; then clean each line's inline markup.
  const raw = stripUntilStable(m[1], /<!--[\s\S]*?-->/g) // strip multi-line HTML comments first (e.g. `<!--\n-->` separators)
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => cleanInline(line))
    .join('\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
  return raw || null
}

const DAY_NAME_TO_NUM: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7
}

/** Fetch a Fandom outfit page → review candidates (mostly wikitext; images from rendered infobox). */
export async function fetchOutfitFromWiki(url: string): Promise<WikiOutfitResult> {
  const { resolvedTitle, wikitext, html } = await fetchParse(url)
  const box = infoboxBlock(wikitext, 'Outfit Infobox')
  if (!box) throw new Error('That page has no Outfit Infobox — is it an outfit page?')

  const qualityStr = wikiParam(box, 'quality')
  const rarity = qualityStr ? Number.parseInt(qualityStr, 10) : null

  const $ = cheerio.load(html)
  const images = parseImageCandidates($)
  const pick = (labelRe: RegExp): string | null =>
    images.find((c) => labelRe.test(c.label))?.url ?? null

  return {
    sourceUrl: url,
    title: resolvedTitle,
    wikiUrl: canonicalWikiUrl(resolvedTitle),
    name: wikiParam(box, 'title') ?? resolvedTitle,
    description: wikiParamMultiline(box, 'description'),
    lore: wikiSection(wikitext, 'Description'),
    obtained: wikiParam(box, 'obtain'),
    character: wikiParam(box, 'character'),
    type: wikiParam(box, 'type'),
    rarity: rarity && Number.isFinite(rarity) ? rarity : null,
    portraitUrl: pick(/in.?game/i) ?? pick(/game/i),
    wishUrl: pick(/wish/i)
  }
}

/** Fetch a Fandom material (`{{Item Infobox}}`) page → review candidates (description-centric). */
export async function fetchMaterialFromWiki(url: string): Promise<WikiMaterialResult> {
  const { resolvedTitle, wikitext, html } = await fetchParse(url)
  const box = infoboxBlock(wikitext, 'Item Infobox')
  if (!box) throw new Error('That page has no Item Infobox — is it a material page?')

  const qualityStr = wikiParam(box, 'quality')
  const rarity = qualityStr ? Number.parseInt(qualityStr, 10) : null

  // Domain-material availability days (day1/day2/day3 → Mon=1…Sun=7).
  const days = [1, 2, 3]
    .map((n) => wikiParam(box, `day${n}`))
    .map((d) => (d ? DAY_NAME_TO_NUM[d.toLowerCase()] : undefined))
    .filter((n): n is number => typeof n === 'number')

  // Obtained: bullet list from source1..source6 (drops template-only sources that clean to empty).
  const sources = [1, 2, 3, 4, 5, 6]
    .map((n) => wikiParam(box, `source${n}`))
    .filter((s): s is string => !!s)
  const obtained = sources.length ? sources.map((s) => `- ${s}`).join('\n') : null

  const $ = cheerio.load(html)
  const iconUrl = parseImageCandidates($)[0]?.url ?? null

  return {
    sourceUrl: url,
    title: resolvedTitle,
    wikiUrl: canonicalWikiUrl(resolvedTitle),
    name: wikiParam(box, 'title') ?? resolvedTitle,
    description: wikiParamMultiline(box, 'description'),
    obtained,
    days: days.length ? days : null,
    type: wikiParam(box, 'type'),
    group: wikiParam(box, 'group'),
    group2: wikiParam(box, 'group2'),
    rarity: rarity && Number.isFinite(rarity) ? rarity : null,
    iconUrl
  }
}
