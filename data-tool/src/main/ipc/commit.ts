/**
 * Preview-and-commit is implemented per entity, not here. Each handler exposes a
 * `preview*Commit` (returns before/after + drift/image plan for the preview screen) and a
 * `commit*` (writes in place, order-preserving via shared/ordering) pair:
 *   - materials.ts  (previewCommit / commit, plus previewBatchCommit / batchCommit)
 *   - outfits.ts, characters.ts, weapons.ts, banners.ts
 * Shared serialization plumbing lives in entityStore.ts.
 *
 * The tool intentionally does NOT run git: the user commits/pushes manually and the existing
 * GitHub Actions CI uploads to Firestore/RTDB.
 */
export {}
