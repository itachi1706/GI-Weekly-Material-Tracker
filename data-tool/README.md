# GI Dataset Tool

A self-contained desktop app (Electron + React + TypeScript) for managing the GI Weekly Material
Tracker dataset (`data/`, `images/`, `templates/`). Cross-platform: macOS + Windows.

## Status — Milestone 1 (foundation)

- Select a dataset folder via the native picker; validates that `data/`, `images/`, `templates/` exist.
- Scans `data/` and shows per-entity file + record counts (Materials, Characters, Weapons, Outfits, Banners).
- Entity navigation is rendered but **disabled** — CRUD is built incrementally in later milestones.
- Last-used folder is remembered between launches.

The format the app reads/writes is fixed (consumed by the existing CI → Firestore/RTDB). The tool writes
files in place and shows a diff preview before committing (future milestone); it does **not** run git.

## Develop

```bash
npm install
npm run dev        # launch with HMR
npm run typecheck  # tsc on main+preload and renderer
npm run build      # compile main/preload/renderer
npm run build:mac  # package a .dmg (macOS)
npm run build:win  # package an NSIS installer (Windows)
```

## Layout

- `src/main/` — Electron main process: window, IPC (`ipc/dialog`, `ipc/dataset`), settings.
- `src/preload/` — `contextBridge` API exposed to the renderer (`window.api`).
- `src/renderer/` — React UI.
- `src/shared/` — code shared across processes: `entities.ts` (entity registry, single source of truth),
  `types.ts`, `ordering.ts` (write-order helper contract, future).
- `dataset/` — local, uncommitted reference copy of the real dataset (gitignored).
