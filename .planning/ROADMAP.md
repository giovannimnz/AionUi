# AionUi — Roadmap

> Fork: https://github.com/giovannimnz/AionUi

## Overview

**2 phases** | **9 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Web Directory Selector | Enable visual folder selection on WebUI by wiring `DirectorySelectionModal` into `WorkspaceFolderSelect` | WEB-FS-01, WEB-FS-02, WEB-FS-03, WEB-FS-04 | 4 |
| 2 | Build Pipeline & Hardening | Produce deployable web/server assets and harden server-side path validation | BUILD-01, BUILD-02, BUILD-03, SEC-01, SEC-02 | 5 |

---

## Phase 1: Web Directory Selector

**Goal**: WebUI renders a visual directory picker (not a text input) on session start.

### Requirements

- [ ] WEB-FS-01: WebUI displays visual directory selector on session start
- [ ] WEB-FS-02: `WorkspaceFolderSelect` renders full browse UI on web
- [ ] WEB-FS-03: Desktop vs web branching in `handleBrowse()`
- [ ] WEB-FS-04: Modal path validated before `onChange` call

### Files to Modify

- `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` — remove `!isDesktop` guard, add modal state, wire `handleBrowse()` branching
- `src/renderer/components/settings/DirectorySelectionModal.tsx` — import into `WorkspaceFolderSelect` (may need prop adjustments)

### Success Criteria

1. User opens WebUI → sees browse button (not plain input)
2. Clicking browse on web opens `DirectorySelectionModal`
3. Selecting a directory in the modal → path appears in `WorkspaceFolderSelect` input
4. Electron desktop → browse button still opens native OS dialog
5. No regression: existing desktop behavior unchanged

### Notes

- Do NOT add new directory browsing logic — reuse existing `DirectorySelectionModal` and `/api/directory/browse`
- Do NOT modify the server-side API unless path validation is missing
- Keep the modal's `visible`/`onCancel`/`onConfirm` contract intact

---

## Phase 2: Build Pipeline & Hardening

**Goal**: Produce production-ready deployable artifacts for web and desktop, with hardened path validation.

### Requirements

- [ ] BUILD-01: Web renderer builds to Apache2-deployable assets (`dist-renderer-web/`)
- [ ] BUILD-02: Server builds to deployable bundle (`dist-server/`)
- [ ] BUILD-03: Desktop build produces installable Electron app
- [ ] SEC-01: Server-side path validation on `/api/directory/browse`
- [ ] SEC-02: Path validation via `POST /api/directory/validate` before saving

### Files to Modify

- Build scripts / `package.json` (if missing build commands)
- `src/process/webserver/directoryApi.ts` (if path validation gaps found)
- Apache2 deployment config (if needed)

### Success Criteria

1. `bun run build:renderer:web` → static assets in `dist-renderer-web/`
2. `bun run build:server` → bundle in `dist-server/`, starts without errors
3. `bun run build:electron` → installable app (`.AppImage`/`.dmg`/`.exe`)
4. `/api/directory/browse` rejects paths outside allowed roots (tested manually)
5. Selecting `/` or `../` via WebUI modal → server returns 403 or empty, no crash

---

## Phase Details

### Phase 1: Web Directory Selector

**Goal**: Enable visual folder selection on WebUI by wiring existing `DirectorySelectionModal` into `WorkspaceFolderSelect`

**Files**: `src/renderer/components/workspace/WorkspaceFolderSelect.tsx`, `src/renderer/components/settings/DirectorySelectionModal.tsx`

**Success criteria**:
1. User opens WebUI → sees browse button (not plain input)
2. Clicking browse on web opens `DirectorySelectionModal`
3. Selecting a directory in the modal → path appears in `WorkspaceFolderSelect` input
4. Electron desktop → browse button still opens native OS dialog
5. No regression: existing desktop behavior unchanged

### Phase 2: Build Pipeline & Hardening

**Goal**: Produce deployable web/server assets and harden server-side path validation

**Files**: Build scripts, `src/process/webserver/directoryApi.ts`, Apache2 config

**Success criteria**:
1. `bun run build:renderer:web` → static assets in `dist-renderer-web/`
2. `bun run build:server` → bundle in `dist-server/`, starts without errors
3. `bun run build:electron` → installable app
4. `/api/directory/browse` rejects paths outside allowed roots
5. Selecting `/` or `../` via WebUI modal → server returns 403 or empty, no crash

---

*Last updated: 2026-05-06 after roadmap creation*
