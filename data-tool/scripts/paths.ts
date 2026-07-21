import { resolve, sep } from 'node:path'

/** Repository root — two levels up from this `data-tool/scripts/` directory. */
const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

/**
 * Resolve an optional CLI-supplied data directory, refusing anything that resolves outside the
 * repository. This keeps the legitimate use (the tool's own `dataset/` or the repo's real data) while
 * ensuring a stray or hostile `argv` value can't walk the wider filesystem. `defaultRel` is resolved
 * relative to the `data-tool/` directory.
 */
export function resolveDataDir(arg: string | undefined, defaultRel: string): string {
  const base = resolve(import.meta.dirname, '..') // data-tool/
  const dir = arg ? resolve(base, arg) : resolve(base, defaultRel)
  if (dir !== REPO_ROOT && !dir.startsWith(REPO_ROOT + sep)) {
    console.error(`Refusing a data directory outside the repository: ${dir}`)
    process.exit(1)
  }
  return dir
}
