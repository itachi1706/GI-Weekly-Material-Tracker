/**
 * Preview-and-commit flow (FUTURE MILESTONE — not implemented).
 *
 * Planned shape:
 *   1. The renderer holds in-memory edits to one or more data files.
 *   2. computeDiff(rootPath, edits) -> per-file unified diff for a preview screen.
 *   3. commit(rootPath, edits) -> writes files in place (order-preserving via shared/ordering),
 *      only after the user approves the preview. Rejecting discards the in-memory edits.
 *
 * The tool intentionally does NOT run git: the user commits/pushes manually and the existing
 * GitHub Actions CI uploads to Firestore/RTDB.
 */
export {}
