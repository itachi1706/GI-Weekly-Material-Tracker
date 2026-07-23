# GI Dataset Tool

A self-contained desktop app (Electron + React + TypeScript) for managing the GI Weekly Material
Tracker dataset (`data/`, `images/`, `templates/`) — replacing the manual copy-paste-edit-JSON
workflow with a safe, form-driven editor. Cross-platform: macOS (universal — Intel + Apple Silicon)
and Windows.

> **Development note:** this data tool was built with AI assistance (Claude Code). Every change is
> manually reviewed by a human reviewer before it is committed to the repo.  
> 
> This is an experiment to try out the capabilities of AI to assist developers.
> The codebase outside this folder remains unassisted and manually developed

## Features

- **Full CRUD for all five entities** — Materials, Characters (including the Traveler and their
  talents / passives / constellations), Weapons, Outfits, and Banners.
- **Wiki auto-fill** — fetch a Fandom wiki page and pre-fill fields (descriptions, effects, stats,
  images, etc.) with a per-field review step before anything is applied. Covers all five entities,
  including the multi-tier material create flow.
- **Safe writes** — a round-trip serializer re-emits each file byte-for-byte, so untouched records are
  never reformatted. Every commit shows a **diff preview** first. The tool writes files in place; it
  does **not** run git.
- **Dataset validation** — flags formatting drift, broken cross-entity references, bad/empty images,
  character phase-vs-map mismatches, off-convention banner times, and markup leakage. Available both as
  a CLI (`npm run validate`) and as an in-app **Validation** view.
- **Quality-of-life** — sortable/filterable lists with lazy, batched thumbnail loading; last-used
  dataset folder remembered between launches.

The on-disk format is fixed (consumed by the existing CI → Firestore/RTDB pipeline). The tool selects
a dataset folder via the native picker and validates that `data/`, `images/`, and `templates/` exist.

## Develop

Requires **Node 24+** (see `.nvmrc`) — the `scripts/*.ts` helpers run directly via Node's native
TypeScript stripping.

```bash
npm install
npm run dev            # launch with HMR
npm run typecheck      # tsc on main+preload and renderer
npm run build          # compile main/preload/renderer
npm run validate       # report-only dataset validation (CLI)
npm run test:roundtrip # serializer byte-identity gate against a dataset
npm run test:materials # materials commit no-op harness
npm run build:mac      # package a universal .dmg (macOS)
npm run build:win      # package an NSIS installer (Windows)
```

The `test:*` and `validate` scripts default to the local `dataset/` reference copy; pass a path to point
them elsewhere (e.g. `node scripts/validate-dataset.ts ../public/data`).

## Build & release

- macOS builds are **unsigned** (no Apple Developer identity) and ad-hoc-signed post-pack, so the app
  launches on both Intel and Apple Silicon (Gatekeeper may warn on first launch — right-click → Open).
- Windows builds are an unsigned NSIS installer.
- CI (`.github/workflows/data-tool-ci.yml`) type-checks and builds on every push/PR, and builds both
  installers on `master`. Tagged releases (`.github/workflows/release.yml`) attach the `.dmg` and
  `.exe` to the GitHub Release alongside the mobile app.

## Layout

- `src/main/` — Electron main process: window, settings, and IPC handlers (`ipc/dataset`, `ipc/dialog`,
  `ipc/materials`, `ipc/characters`, `ipc/weapons`, `ipc/outfits`, `ipc/banners`, `ipc/wiki`,
  `ipc/validate`, `ipc/commit`).
- `src/preload/` — `contextBridge` API exposed to the renderer as `window.api`.
- `src/renderer/` — React UI (one folder per entity under `src/renderer/src/views/`, plus `shared/`).
- `src/shared/` — code shared across processes: `entities.ts` (entity registry), `types.ts`,
  `serialize.ts` (round-trip serializer + byte-identity gate), `ordering.ts`, `materialsSchema.ts`
  (schema-driven materials), `validate.ts` (validation rules, shared by the CLI and the in-app view).
- `scripts/` — Node/TS dev harnesses: `roundtrip-test.ts`, `materials-commit-test.ts`,
  `validate-dataset.ts`, `normalize-format.ts`.
- `build/` — packaging resources: app icon and the `afterPack.cjs` ad-hoc-sign hook.
- `dataset/` — local, uncommitted reference copy of the real dataset (gitignored).
