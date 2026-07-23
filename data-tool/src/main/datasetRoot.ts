/**
 * The authoritative dataset root, owned by the main process.
 *
 * It is set ONLY when the user picks a folder through the native OS dialog (`dataset:select`) or when
 * the persisted last-path re-validates on launch (`dataset:last`) — never from a renderer-supplied
 * IPC argument. Every filesystem operation resolves against this value, so a compromised or malicious
 * renderer cannot redirect reads/writes to an arbitrary location by sending a forged `rootPath`
 * (SonarCloud tssecurity:S2083 — the taint source is "a compromised renderer can send arbitrary IPC
 * messages"). This is the trust boundary for the whole tool.
 */
let currentRoot: string | null = null

/** Record the folder the user selected (or the re-validated last path) as the active dataset root. */
export function setDatasetRoot(path: string): void {
  currentRoot = path
}

/** The active dataset root. Throws if no folder has been selected yet (callers surface the error). */
export function getDatasetRoot(): string {
  if (currentRoot == null) {
    throw new Error('No dataset folder has been selected yet.')
  }
  return currentRoot
}
