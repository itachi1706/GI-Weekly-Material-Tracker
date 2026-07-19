// Shared helpers for materials wiki auto-fill, used by both MaterialForm (single-record) and
// TierSetForm (multi-tier create).
import type { WikiMaterialResult } from '@shared/types'

/** Index → short day name for the domain-material `days` field (Mon=1…Sun=7). */
export const DAY_ABBR = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CATEGORY_LABEL: Record<string, string> = {
  local_speciality: 'Local Speciality',
  boss_drops: 'Boss Drop / Ascension Gem',
  domain_material: 'Domain Material',
  mob_drops: 'Mob Drop'
}

/**
 * Infer the material category from a wiki page's group/type (the wiki `type` param is a broad
 * category; the `group`/`group2` are the useful "Item Group"). Used to warn when the pasted page
 * doesn't match the material sub-type being edited/created.
 */
export function inferWikiCategory(res: WikiMaterialResult): string | null {
  const t = res.type ?? '', g = res.group ?? '', g2 = res.group2 ?? ''
  if (/local special/i.test(t) || /local special/i.test(g)) return 'local_speciality'
  if (/ascension gem/i.test(g2) || /ascension gem/i.test(g)) return 'boss_drops'
  if (/boss drop/i.test(g)) return 'boss_drops'
  if (/talent book|weapon ascension|forgery/i.test(g2) || /talent material|weapon ascension material/i.test(t))
    return 'domain_material'
  if (/common ascension|mob/i.test(g) || /common ascension/i.test(t)) return 'mob_drops'
  return null
}

/**
 * Map a wiki page's group/type → the dataset `type` string for this schema, from the Item GROUP
 * (not the broad wiki `type` param): local specialities keep their region ("Local Speciality
 * (Inazuma)"); "Normal Boss Drops" → "Boss Drops"; ascension gems → "Ascension Gems". Returns null
 * unless the result is a valid option in this schema (domain/mob aren't cleanly derivable).
 */
export function mapWikiType(res: WikiMaterialResult, innerType: string, typeOptions: string[]): string | null {
  let candidate: string | null = null
  if (innerType === 'local_speciality') {
    const m = /\(([^)]+)\)/.exec(res.type ?? '') // "Local Specialty (Inazuma)" → region
    if (m) candidate = `Local Speciality (${m[1]})`
  } else if (innerType === 'boss_drops') {
    const g = res.group ?? '', g2 = res.group2 ?? '', t = res.type ?? ''
    if (/ascension gem/i.test(g2) || /ascension gem/i.test(g)) candidate = 'Ascension Gems'
    else if (/weekly/i.test(g) || /weekly/i.test(t)) candidate = 'Boss Drops (Weekly)'
    else if (/boss drop/i.test(g)) candidate = 'Boss Drops'
  }
  return candidate && typeOptions.includes(candidate) ? candidate : null
}
