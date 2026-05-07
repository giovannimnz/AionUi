# AionUi — Project

> Fork: https://github.com/giovannimnz/AionUi

## What This Is

AionUi is a desktop AI agent application built with Electron + React 19 + TypeScript. It provides a unified interface for interacting with multiple AI providers (Claude, GPT, Gemini, Bedrock) through a plugin-based channel system (Telegram, DingTalk, Lark, WeCom, WeChat) and supports extensibility via a custom extension market.

The project fork (`giovannimnz/AionUi`) targets **multiplatform deployment**: both **WebUI** (hosted on Apache2) and **Electron desktop**.

## Core Value

Enable users to interact with AI agents through a unified chat interface, accessible from both desktop (Electron) and web browser, with a consistent UX across platforms.

## Context

The base AionUi already supports `--webui` mode (Express + WebSocket server). The WebUI is deployed on an Apache2 Linux server. The Electron desktop app uses native OS dialogs for directory selection.

**Key constraint**: WebUI runs on a server — it does not have access to the user's local filesystem. Directory selection must therefore browse the **server filesystem** via the `/api/directory/browse` API.

## Target Users

- Developers and power users who run AionUi as a self-hosted AI agent
- Teams deploying AionUi on internal Linux servers accessed via browser
- Users who prefer web access over desktop installation

## Platform Support

| Platform | Status | Directory Selection |
|----------|--------|---------------------|
| Electron Desktop | ✅ Existing | Native OS dialog (`ipcBridge.dialog.showOpen`) |
| WebUI (Apache2) | ⚠️ Limited | Text-only input (no visual picker) |

---

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Multiplatform: Web + Electron | User requirement | Active |
| WebUI hosted on Apache2 (Linux) | User's current deployment | Active |
| Server-side directory browsing for WebUI | WebUI has no local filesystem access | Active |
| Reuse existing `DirectorySelectionModal` | Already implemented, uses `/api/directory/browse` | Active |

---

## Requirements

### Validated

- ✅ Desktop: Native directory picker via Electron IPC (`src/renderer/components/workspace/WorkspaceFolderSelect.tsx`)
- ✅ Electron main/preload/renderer three-process architecture
- ✅ WebUI mode via Express + WebSocket server (`src/server.ts`, `src/process/webserver/`)
- ✅ API endpoint `/api/directory/browse` for server-side directory listing
- ✅ `DirectorySelectionModal` component for visual directory selection in WebUI
- ✅ React 19 + TypeScript + electron-vite build system

### Active

- [ ] **WEB-FS-01**: WebUI displays visual directory selector (not text-only input) on session start
- [ ] **WEB-FS-02**: `WorkspaceFolderSelect` renders full browse UI on web, not fallback `<Input>`
- [ ] **WEB-FS-03**: Directory selection uses `DirectorySelectionModal` on web, native dialog on desktop
- [ ] **BUILD-01**: Web build produces deployable assets (`bun run build:renderer:web`, `bun run build:server`)
- [ ] **BUILD-02**: Desktop build produces installable Electron app

### Out of Scope

- [Native mobile apps] — Not in scope for this phase
- [Custom directory browsing UI beyond existing modal] — Reuse existing `DirectorySelectionModal`
- [Real-time sync between web and desktop sessions] — Out of scope

---

## Tech Stack

See: `.planning/codebase/STACK.md`

## Architecture

See: `.planning/codebase/ARCHITECTURE.md`

## Structure

See: `.planning/codebase/STRUCTURE.md`

## Concerns

See: `.planning/codebase/CONCERNS.md`

## Current Milestone: v2 — Fork Sync Engine

**Goal:** Módulo reutilizável de sincronização automática de fork com upstream oficial — verificação diária às 08:00, merge automático ao detectar nova release, e intervenção de IA via Telegram para conflitos.

**Target features:**
- Fork Sync Core (FSYNC-01 a FSYNC-04)
- AI Decision Engine (FSYNC-05 a FSYNC-07)
- Telegram Approval Flow (FSYNC-08 a FSYNC-09)
- Module Packaging (FSYNC-10 a FSYNC-11)

## Requirements

### Active

- [ ] **FSYNC-01**: Cron job diário às 08:00 que verifica nova release no upstream
- [ ] **FSYNC-02**: Detecta nova versão/release via GitHub API (tag ou release)
- [ ] **FSYNC-03**: Pull das changes upstream com rebase/merge preservando overrides locais
- [ ] **FSYNC-04**: Auto commit e push das alterações mergeadas para branch do fork
- [ ] **FSYNC-05**: AI Decision Engine detecta conflitos de merge e impacto em alterações customizadas
- [ ] **FSYNC-06**: Análise de diff pela IA antes de aplicar merge
- [ ] **FSYNC-07**: Notificação via Telegram com contexto + recomendação quando há impacto
- [ ] **FSYNC-08**: Telegram approval flow — comandos para approve/reject/adjust
- [ ] **FSYNC-09**: Grava decisão do usuário e executa ação (merge, abort, ou ajusta)
- [ ] **FSYNC-10**: Módulo reutilizável em `~/fork-sync/` com templates por projeto
- [ ] **FSYNC-11**: Config por projeto (`sync.yaml`) — upstream URL, branch, paths protegidos, tokens

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-05-06 after initialization (auto mode)*
