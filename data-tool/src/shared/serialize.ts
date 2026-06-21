/**
 * Serializer for the dataset's data/*.json files.
 *
 * The on-disk format must be reproduced EXACTLY so commits produce minimal diffs.
 * Rules observed from the committed files:
 *   - 2-space indent, objects expanded
 *   - Empty arrays/objects (`[]`, `{}`) already inline from JSON.stringify
 *   - Populated arrays whose elements are ALL primitives (strings, numbers, null, bool)
 *     are kept INLINE on one line when the resulting line is ≤ 200 chars,
 *     EXCEPT `characters` arrays with more than one entry (Traveler's 5 forms are kept expanded):
 *       numbers  →  [1,4,7]         (no spaces)
 *       strings  →  ["a", "b"]      (space after comma)
 *   - Arrays containing objects, nested arrays, or too long to fit one line stay expanded
 *   - `released_version` integer values (e.g. `1` parsed from `1.0`) are re-written as `1.0`
 *
 * Trailing-newline handling is NOT baked in here: per-file convention is detected by the commit
 * layer via `withTrailingNewline`.
 */
export function stringifyDataFile(obj: unknown): string {
  let result = collapsePrimitiveArrays(JSON.stringify(obj, null, 2))
  // JSON.parse loses the trailing zero from floats like 1.0 → 1. Restore it for version fields.
  result = result.replace(/("released_version": )(\d+)(?![\d.])/g, '$1$2.0')
  return result
}

/**
 * Post-process the output of JSON.stringify(obj, null, 2) to collapse arrays that contain only
 * primitive values (strings, numbers, null, true, false) onto a single line.
 *
 * JSON.stringify expands every array — even ["Slimes"] — to multi-line form. This restores the
 * inline format used in the committed dataset files.
 */
function collapsePrimitiveArrays(json: string): string {
  const lines = json.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trimEnd()

    // Only attempt collapse when the line ends with a bare `[`.
    if (!trimmed.endsWith('[')) {
      out.push(line)
      i++
      continue
    }

    // Scan forward for the array elements and the closing `]`.
    const items: string[] = []
    let allPrimitive = true
    let allNumbers = true
    let j = i + 1

    while (j < lines.length) {
      const inner = lines[j].trim()
      // Closing bracket (with optional trailing comma from the parent object).
      if (inner === ']' || inner === '],') break
      // Strip the comma that JSON.stringify appends to all-but-last elements.
      const val = inner.endsWith(',') ? inner.slice(0, -1) : inner
      // Classify the value.
      const isStr = val.startsWith('"') && val.endsWith('"')
      const isNum = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(val)
      const isLit = val === 'null' || val === 'true' || val === 'false'
      if (isStr || isLit) allNumbers = false
      if (!isStr && !isNum && !isLit) { allPrimitive = false; break }
      items.push(val)
      j++
    }

    if (allPrimitive && j < lines.length) {
      // Collapse: numbers use no spaces; strings use ", " separator.
      const sep = allNumbers ? ',' : ', '
      const closing = lines[j].trim() === '],' ? ',' : ''
      const collapsed = `${trimmed.slice(0, -1)}[${items.join(sep)}]${closing}`

      // The `characters` field for Traveler outfits has 5 entries and is kept expanded in the
      // committed files. Single-element characters arrays stay collapsed as normal.
      const fieldMatch = trimmed.match(/"([^"]+)":\s*\[$/)
      const forceExpand = fieldMatch?.[1] === 'characters' && items.length > 1

      if (!forceExpand && collapsed.length <= 200) {
        out.push(collapsed)
        i = j + 1
      } else {
        out.push(line)
        i++
      }
    } else {
      // Not collapsible — keep the line and continue scanning normally.
      out.push(line)
      i++
    }
  }

  return out.join('\n')
}

/** Returns whether `content` ends with a trailing newline (the convention to preserve per file). */
export function hasTrailingNewline(content: string): boolean {
  return content.endsWith('\n')
}

/** Match a serialized string to a reference file's trailing-newline convention. */
export function withTrailingNewline(serialized: string, reference: string): string {
  const wanted = hasTrailingNewline(reference)
  const has = hasTrailingNewline(serialized)
  if (wanted && !has) return serialized + '\n'
  if (!wanted && has) return serialized.replace(/\n+$/, '')
  return serialized
}

/**
 * Round-trip check: re-serializing a parsed file must reproduce the original bytes.
 * Used as a safety gate before writing — formatting drift would reformat untouched records.
 */
export function roundTrips(rawFileText: string): boolean {
  try {
    const reserialized = withTrailingNewline(stringifyDataFile(JSON.parse(rawFileText)), rawFileText)
    return reserialized === rawFileText
  } catch {
    return false
  }
}
