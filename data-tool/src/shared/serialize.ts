/**
 * Serializer for the dataset's data/*.json files.
 *
 * The on-disk format must be reproduced EXACTLY so commits produce minimal diffs.
 * Observed conventions (see plan): 2-space indent, objects expanded, empty `[]`/`{}` inline.
 *
 * For `local_speciality` records (this milestone) there are no populated arrays, so the standard
 * `JSON.stringify(obj, null, 2)` output is byte-identical to the committed files (verified by the
 * round-trip test). Array-bearing innerTypes (`days`, `enemies`) keep arrays INLINE and will need an
 * extended serializer — deliberately deferred until those types are built.
 *
 * Trailing-newline handling is intentionally NOT baked in here: files in the dataset are inconsistent
 * (some end with `\n`, some don't). The commit layer detects the target file's existing convention and
 * applies it via `withTrailingNewline`, so an untouched file keeps its exact byte layout.
 */
export function stringifyDataFile(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
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
 * Round-trip check: re-serializing a parsed file (and matching its trailing-newline convention) must
 * reproduce the original bytes. Used as a safety gate before writing — formatting drift means we'd
 * reformat untouched records and create a noisy diff, so the commit is refused in that case.
 */
export function roundTrips(rawFileText: string): boolean {
  try {
    const reserialized = withTrailingNewline(stringifyDataFile(JSON.parse(rawFileText)), rawFileText)
    return reserialized === rawFileText
  } catch {
    return false
  }
}
