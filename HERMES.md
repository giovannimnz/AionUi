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

**v2 — Fork Sync Engine** (in progress)

Milestone `v2` targets a self-sustaining fork sync engine with daily automation. Phase 1 (Fork Sync Core) was discussed — see `.planning/phases/01-fork-sync-core/01-PLAN.md` for the full plan.

Previous milestone **v1** (Web Directory Selector) features are implemented and protected in `sync.yaml`.

See: `.planning/MILESTONES.md`, `.planning/ROADMAP.md`

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

## Hermes Agent Integration

When Hermes is selected as the backend agent in AionUi, the application launches `hermes acp` as a subprocess and communicates via the Agent Client Protocol (ACP). This enables full Hermes CLI functionality within AionUi sessions.

### Features Automatically Loaded

When a Hermes session starts via AionUi, the following are automatically loaded:

| Feature | Source | Status |
|---------|--------|--------|
| Slash Commands (built-in) | `_ADVERTISED_COMMANDS` in ACP adapter | ✅ Working |
| Skills (180+) | `~/.hermes/skills/` via `get_skill_commands()` | ✅ Working |
| Model Configuration | `~/.hermes/config.yaml` → `model` section | ✅ Working |
| Provider Credentials | `~/.hermes/config.yaml` → `providers` section | ✅ Working |
| API Keys | Environment / config | ✅ Working |
| ACP Protocol | `hermes acp` subprocess | ✅ Working |

### ACP Adapter Modifications (Required for Skills)

The Hermes ACP adapter (``~/.hermes/hermes-agent/acp_adapter/server.py``) was modified to:

1. **`_available_commands()`** — Loads skills from `~/.hermes/skills/` and advertises them to AionUi
2. **`_handle_slash_command()`** — Handles skill commands (`/skill-name`) by loading skill payload
3. **`_cmd_help()`** — Lists both built-in commands and skills in help output

### Restart Requirement

After modifying `acp_adapter/server.py`, the Hermes subprocess must be restarted to pick up code changes:

```bash
# 1. Kill running Electron/Hermes processes
sudo kill -9 $(pgrep -f "electron") 2>/dev/null
sleep 3

# 2. Restart AionUi
cd /home/ubuntu/GitHub/forks/AionUi && bash start-aionui.sh
```

### Validation

After restart, verify skills are loaded:

```bash
# Check Hermes ACP adapter syntax
python3 -m py_compile ~/.hermes/hermes-agent/acp_adapter/server.py

# Verify skills are detected
cd ~/.hermes/hermes-agent && python3 -c "
from agent.skill_commands import get_skill_commands
skills = get_skill_commands()
print(f'Skills loaded: {len(skills)}')
"
```

### Manual Browser Validation

1. Open https://aion.atius.com.br/
2. Login with credentials
3. Select or create a workspace
4. Start a new session choosing **Hermes Agent**
5. Type `/` in the message input — skills should appear in autocomplete
6. Type `/help` to see all available commands including skills

### Architecture

```
AionUi (Electron/React)
    │
    ├─► Spawns: hermes acp (subprocess)
    │       │
    │       └─► HermesACPAgent (acp_adapter/server.py)
    │               │
    │               ├─► SessionManager → AIAgent
    │               ├─► _available_commands() → loads skills + built-ins
    │               └─► ACP stdio JSON-RPC
    │
    └─► ACP Client (renderer/backend bridge)
```

---

## Fork Sync Protection

This fork is synchronized with upstream (`iOfficeAI/AionUi`) using **fork-sync**. All customizations are protected against being overwritten during upstream merges.

### Release Versioning

Releases follow the schema **`v{upstream_version}-rf{N}`**:

| Trigger | RF Counter | Action |
|---------|-----------|--------|
| Sync + local changes | `rf{N} → rf{N+1}` | Creates release + tag + push |
| Sync only (no changes) | No change | No release created |
| Upstream version bump | `rf1` (reset) | New release when changes exist |

### Protected Paths (sync.yaml)

All fork customizations are listed in `~/fork-sync/projects/aionui/sync.yaml` under `protected_paths`. During upstream sync, changes to these files stop for human decision (or AI decision if below threshold).

**Current features protected:**

| Feature | Files |
|---------|-------|
| Web Directory Selection | `WorkspaceFolderSelect.tsx`, `GuidActionRow.tsx`, `DirectorySelectionModal.tsx`, `directoryApi.ts`, `*.test.tsx` |
| Server-side Theme Persistence | `useTheme.ts`, `staticRoutes.ts`, `UserSettingsService.ts`, `userSettingsRoutes.ts`, `setup.ts`, `index.ts` |
| API Route Refactor | `apiRoutes.ts` (removal of generic `/api` endpoint → moved to `index.ts`) |
| Network Config | `electron.vite.config.ts` (`allowedHosts`, `host: 0.0.0.0`) |
| Service Worker | `public/sw.js` (cache v2, `/_next` excluded) |
| PM2 Deployment | `ecosystem.aionui-web.config.js`, `ecosystem.config.js`, `start-aionui.sh` |
| Fork Documentation | `HERMES.md` |

### Sync Scripts

```bash
# Dry-run sync (shows what would change)
~/fork-sync/bin/sync.sh aionui --dry-run

# Real sync
~/fork-sync/bin/sync.sh aionui

# Create release manually
~/fork-sync/bin/create-release.sh aionui /home/ubuntu/GitHub/forks/AionUi v1.9.25 https://github.com/giovannimnz/AionUi
```

---

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

*Generated: 2026-05-07*
