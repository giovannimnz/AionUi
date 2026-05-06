# AionUi Directory Selection — Research Summary

> Generated: 2026-05-06

---

## Stack

| Category | Technology | Version |
|----------|------------|---------|
| Language | TypeScript | ^5.8.3 |
| UI Framework | React | ^19.1.0 |
| Desktop Runtime | Electron | ^37.10.3 |
| Build Tool | electron-vite | ^5.0.0 |
| Bundler | esbuild | ^0.25.11 |
| Node.js | Server/Bundler | >=22 <25 |
| Bridge Framework | `@office-ai/platform` | (provides `bridge.buildProvider`, `bridge.buildEmitter`, `bridge.adapter`) |
| CSS | UnoCSS | ^66.3.3 |
| UI Components | @arco-design/web-react | ^2.66.1 |
| WebSocket | ws | (for WebUI mode) |

**No new packages required.** Directory selection uses only existing stack components.

---

## Table-Stakes Features

Required for any directory selection interaction to meet minimum usability and security standards:

1. **Platform-Native Dialog (Desktop)** — Use `ipcBridge.dialog.showOpen` which maps to Electron's `dialog.showOpenDialog`. Accepts `defaultPath` so dialogs open at the current location. Already implemented in `dialogBridge.ts`.

2. **Path Allowlisting / Security Boundaries** — `validatePath()` and `isPathAllowed()` restrict access to `DEFAULT_ALLOWED_DIRECTORIES`: cwd, homedir, `/` on Unix, all drive letters on Windows. Prevents directory traversal (`..`, null bytes). Extension directories must be confined to sandbox roots.

3. **Recent / History** — Remember last 5 selected directories per context in `localStorage` (keyed by `recentStorageKey`). Deduplicate on re-selection. Display folder name + full path on hover. Clear individual entries. Pattern already exists in `WorkspaceFolderSelect.tsx`.

4. **Validation on Confirm** — Always call `POST /api/directory/validate` before persisting a selected path. Frontend must disable confirm until a valid selection. Show inline error if path becomes invalid after selection.

5. **Cross-Platform Path Display** — Use `path` module APIs for all path operations. Handle `__ROOT__` on Windows to show drive letters. Do not assume path separators.

---

## Key Pitfalls

### Adapter Switching (High Risk)

- **`dialog.showOpen` has no WebUI implementation.** Any code calling `ipcBridge.dialog.showOpen.invoke(...)` in WebUI mode gets a "provider not found" error. `DirInputItem.tsx` uses this directly — it only works in Electron.
- **`DirectorySelectionModal` only works when WebUI server is running.** It hardcodes `fetch('/api/directory/browse')` — no fallback to IPC in Electron.
- **No adapter capability query.** Renderer cannot ask "what adapter am I running under?" Scattered `if (win.electronAPI)` guards throughout. Missing a guard causes silent failures in WebUI or crashes in Electron.

### IPC Race Conditions (Medium Risk)

- **Non-atomic workspace update in `useWorkspaceSelector`** — 5-step sequence (dialog → get conversation → update conversation → mutate cache → emit). If `conversation.update` fails, UI optimistically updates but backend differs. `emitter.emit` fires regardless.
- **`adapterWindowList` concurrent modification** — `main.ts:78–85` splices the window array while iterating, risking skipped windows if a window closes during broadcast.
- **WebSocket queue ordering under reconnect** — Queued IPC calls during exponential backoff (up to 8s) can race with a new socket's delivery of an earlier response.
- **50MB IPC payload limit with no per-channel quota** — A large workspace directory response can saturate the shared limit; the entire event is dropped silently.

### Security Issues (High Risk)

- **`/` allowed on Unix in WebUI directory browse** — Any authenticated WebUI user can browse any readable file on the system. Broad attack surface in shared/multi-user deployments.
- **`getFilesByDir` IPC has no path validation** — `fsBridge.ts:309–316` passes `dir` directly to `readDirectoryRecursive` without `isPathWithinRoot` or `validatePath`. Workspace boundary not enforced in Electron mode.
- **`isPathWithinRoot` doesn't resolve symlinks** — Uses `path.relative` on logical paths. A symlink inside root pointing outside passes the check. Should use `fs.realpathSync` (as `pathSafety.ts` correctly does).
- **No rate limiting on Electron-side fs IPC** — `ipcBridge.fs.getFilesByDir` bypasses the WebUI `fileOperationLimiter`. Malicious renderer/extension can enumerate filesystem rapidly.

### Path Validation Inconsistencies

- **`validatePath` doesn't check permissions** — Returns `valid: true` for readable-but-not-writable directories.
- **Tilde expansion only in `validatePath`, not globally** — `~/project` works in WebUI but fails when passed to Electron-side IPC calls.
- **Different path constraints per mode** — Electron allows any OS-native path; WebUI enforces `DEFAULT_ALLOWED_DIRECTORIES`. A directory accessible in one mode may be inaccessible in the other.
- **No maximum path length validation** — Extremely long paths may pass `validatePath` but fail on `fs.readdirSync` with unhandled exceptions.

---

## Architecture Highlights

### Three-Process + Adapter Pattern

```
src/
├── index.ts                     → Main process entry (Electron main, BrowserWindow)
├── preload/main.ts              → Preload (contextBridge → ipcRenderer)
├── renderer/                    → React 19 SPA
├── process/                     → Main process modules
│   ├── bridge/                  → IPC bridge implementations (dialogBridge, fsBridge, etc.)
│   └── webserver/               → Express + WebSocket for --webui mode
└── common/
    ├── adapter/                 → Bridge adapters (main.ts, browser.ts, standalone.ts)
    └── adapter/ipcBridge.ts     → Unified API definitions
```

### Three Adapters

| Adapter | File | Runtime | Transport |
|---------|------|---------|-----------|
| Electron | `main.ts` | Desktop | `ipcMain`/`ipcRenderer` |
| Browser | `browser.ts` | WebUI Browser | WebSocket |
| Standalone | `standalone.ts` | Server mode | Node EventEmitter |

### Directory Selection Data Flow

**Electron Desktop:**
```
Renderer: ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] })
    → IPC (preload contextBridge)
Main: dialogBridge.provider() → dialog.showOpenDialog()
    → Native OS dialog
User selects → filePaths returned → Renderer receives string[]
```

**WebUI Browser:**
```
Renderer: ipcBridge.dialog.showOpen.invoke()
    → WebSocket → Bridge emit
WebSocketManager.handleFileSelection()
    → 'subscribe-show-open' message
Renderer receives SHOW_OPEN_REQUEST_EVENT via bridge.on()
    → useDirectorySelection hook opens Modal
User navigates (fetches /api/directory/browse)
    → Modal confirms selection
__emitBridgeCallback('subscribe.callback-show-open{id}', paths)
    → WebSocket sends callback → Bridge resolves with string[]
```

### Key Files

| File | Purpose |
|------|---------|
| `src/common/adapter/ipcBridge.ts` | IPC channel definitions |
| `src/process/bridge/dialogBridge.ts` | Electron native dialog provider |
| `src/process/webserver/directoryApi.ts` | WebUI REST API (browse, validate, shortcuts) |
| `src/renderer/components/settings/DirectorySelectionModal.tsx` | WebUI in-app directory browser |
| `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` | Unified folder selector (Electron IPC + WebUI modal) |
| `src/renderer/hooks/file/useDirectorySelection.tsx` | Global IPC-based directory selection hook |
| `src/common/adapter/browser.ts` | WebUI WebSocket adapter |
| `src/common/adapter/main.ts` | Electron IPC adapter |
| `src/process/bridge/fsBridge.ts` | Electron-side filesystem IPC (unvalidated `getFilesByDir` is a security gap) |

### Platform Detection

```typescript
export const isElectronDesktop = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
};
```

`WorkspaceFolderSelect` uses this to branch: Electron → `ipcBridge.dialog.showOpen.invoke()`, WebUI → `DirectorySelectionModal`.

---

## Priority Matrix for Improvements

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Keyboard navigation in in-app browser | Medium | Medium | P2 |
| Search/filter in modal | Medium | Low | P2 |
| Breadcrumb navigation | Medium | Low | P2 |
| Stale path detection | Medium | Low | P2 |
| Create folder in modal | Low | Medium | P3 |
| Multi-select for skill paths | Low | Medium | P3 |
| Unified recent paths hook | Low | Medium | P3 |
| `getFilesByDir` path validation | High | Medium | P1 (security) |
| `isPathWithinRoot` symlink fix | High | Low | P1 (security) |
| Rate limiting on Electron fs IPC | Medium | Medium | P1 (security) |
