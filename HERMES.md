# AionUi — Project Guide

> Fork: https://github.com/giovannimnz/AionUi

## Project Overview

AionUi is a desktop AI agent application built with Electron + React 19 + TypeScript. This fork targets **multiplatform deployment**: WebUI (Apache2) and Electron desktop. The initial v1 goal is enabling visual directory selection on the WebUI.

## Tech Stack

TypeScript ^5.8.3, React 19.1, Electron 37.10, electron-vite 5.0, UnoCSS, @arco-design/web-react, better-sqlite3, Express (WebUI server), WebSocket.

See: `.planning/codebase/STACK.md`

## Architecture

Three-process Electron: Main (src/index.ts) / Preload (src/preload/main.ts) / Renderer (src/renderer/). IPC bridge with three adapters: main.ts (Electron), browser.ts (WebUI), standalone.ts (server). Directory selection uses `ipcBridge.dialog.showOpen` on desktop and `DirectorySelectionModal` + `/api/directory/browse` on web.

See: `.planning/codebase/ARCHITECTURE.md`

## Planning Artifacts

| Artifact | Location |
|----------|----------|
| Project context | `.planning/PROJECT.md` |
| Config | `.planning/config.json` |
| Research | `.planning/research/` |
| Requirements | `.planning/REQUIREMENTS.md` |
| Roadmap | `.planning/ROADMAP.md` |
| State | `.planning/STATE.md` |

## Current Phase

**Not started** — Run `/gsd-discuss-phase 1` to begin Phase 1 (Web Directory Selector).

## v1 Requirements (9 total)

### Phase 1: Web Directory Selector
- WEB-FS-01: WebUI displays visual directory selector (not text input)
- WEB-FS-02: WorkspaceFolderSelect renders full browse UI on web
- WEB-FS-03: handleBrowse() branches desktop (native dialog) vs web (modal)
- WEB-FS-04: Modal path validated before onChange call

### Phase 2: Build Pipeline & Hardening
- BUILD-01: Web renderer builds to dist-renderer-web/
- BUILD-02: Server builds to dist-server/
- BUILD-03: Desktop builds to installable app
- SEC-01: Server-side path validation on /api/directory/browse
- SEC-02: Path validation via POST /api/directory/validate before saving

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` | Phase 1 target — remove !isDesktop guard, add modal |
| `src/renderer/components/settings/DirectorySelectionModal.tsx` | Reuse existing modal |
| `src/process/webserver/directoryApi.ts` | Server-side path browsing + validation |
| `src/common/adapter/ipcBridge.ts` | Unified IPC dialog API |

## GSD Workflow

```
/gsd-discuss-phase 1  → gather context, clarify approach
/gsd-plan-phase 1     → create PLAN.md for Phase 1
/gsd-execute-phase 1  → implement Phase 1
/gsd-verify-phase 1   → verify Phase 1 deliverables
```

## Build Commands

```bash
# Web renderer (Apache2 deployable)
bun run build:renderer:web

# Server bundle
bun run build:server

# Electron desktop
bun run build:electron
```

---

*Generated: 2026-05-06*
