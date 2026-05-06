# AionUi Web+Electron Directory Selection - Stack Research

> Generated: 2026-05-06

## Overview

AionUi implements a unified directory/file selection API (`ipcBridge.dialog.showOpen`) that works across **Electron desktop** and **WebUI (browser)** modes through an adapter-based bridge pattern.

---

## Current Stack (from Codebase)

### Core Technologies
| Category | Technology | Version |
|----------|------------|---------|
| Language | TypeScript | ^5.8.3 |
| UI Framework | React | ^19.1.0 |
| Desktop Runtime | Electron | ^37.10.3 |
| Build Tool | electron-vite | ^5.0.0 |
| Bundler | esbuild | ^0.25.11 |
| Node.js | Server/Bundler | >=22 <25 |

### Key Libraries for IPC & Bridge
| Library | Purpose |
|---------|---------|
| `@office-ai/platform` | Bridge framework providing `bridge.buildProvider`, `bridge.buildEmitter`, `bridge.adapter` |
| `ws` | WebSocket server for WebUI mode |

### CSS & UI
| Library | Version |
|---------|---------|
| UnoCSS | ^66.3.3 |
| @arco-design/web-react | ^2.66.1 |

---

## Architecture: Three-Process + Adapter Pattern

```
src/
├── index.ts                    → Main process (Electron main, BrowserWindow)
├── preload/main.ts             → Preload (contextBridge → ipcRenderer)
├── renderer/                   → React 19 SPA
├── process/                    → Main process modules (business logic)
│   ├── bridge/                → IPC bridge implementations
│   └── webserver/              → Express + WebSocket for --webui mode
└── common/
    ├── adapter/                → Bridge adapters (main.ts, browser.ts, standalone.ts)
    └── adapter/ipcBridge.ts    → Unified API definitions
```

### Bridge Adapters (`src/common/adapter/`)

| Adapter | File | Runtime |
|---------|------|---------|
| Electron | `main.ts` | Uses `ipcMain` to communicate with BrowserWindows |
| Browser | `browser.ts` | Uses `electronAPI` (preload) in Electron, WebSocket in browser |
| Standalone | `standalone.ts` | Uses Node.js EventEmitter for server mode |

### IPC Bridge API Definition (`src/common/adapter/ipcBridge.ts`)

```typescript
export const dialog = {
  showOpen: bridge.buildProvider<
    string[] | undefined,
    { defaultPath?: string; properties?: OpenDialogOptions['properties']; filters?: OpenDialogOptions['filters'] }
  >('show-open'),
};
```

---

## Directory Selection Implementation

### Electron Mode (Desktop)

**Bridge Implementation:** `src/process/bridge/dialogBridge.ts`

```typescript
export function initDialogBridge(): void {
  ipcBridge.dialog.showOpen.provider((options) => {
    const parentWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    return dialog.showOpenDialog(parentWindow, dialogOptions).then((res) => res.filePaths);
  });
}
```

- Uses native Electron `dialog.showOpenDialog`
- Returns `filePaths` array to renderer
- Modal appears in front of parent window

### WebUI Mode (Browser)

**Two components required:**

1. **React Hook:** `src/renderer/hooks/file/useDirectorySelection.tsx`
   - Listens for `SHOW_OPEN_REQUEST_EVENT` via bridge
   - Opens `DirectorySelectionModal` when triggered
   - Sends callback with selected paths via `__emitBridgeCallback`

2. **Modal Component:** `src/renderer/components/settings/DirectorySelectionModal.tsx`
   - Custom directory browser UI (Arco Design)
   - Fetches directory contents from server via `/api/directory/browse`
   - Supports both file and directory selection modes

**Server API:** `src/process/webserver/directoryApi.ts`

```typescript
router.get('/browse', fileOperationLimiter, (req, res) => {
  // GET /api/directory/browse?path=...&showFiles=true|false
  // Returns: { items, canGoUp, parentPath, currentPath }
});
```

**WebSocket Handling:** `src/process/webserver/websocket/WebSocketManager.ts`

```typescript
private handleFileSelection(ws: WebSocket, data: any): void {
  // Listens for 'subscribe-show-open' from renderer
  // Forwards as SHOW_OPEN_REQUEST_EVENT to client
  ws.send(JSON.stringify({ name: SHOW_OPEN_REQUEST_EVENT, data: {...} }));
}
```

---

## Directory Selection Data Flow

### Electron Desktop
```
Renderer: ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] })
    ↓ IPC (preload contextBridge)
Main: dialogBridge.provider() → dialog.showOpenDialog()
    ↓ Native OS dialog
User selects directory
    ↓ filePaths returned
Renderer receives string[]
```

### WebUI Browser
```
Renderer: ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] })
    ↓ WebSocket → Bridge emit
WebSocketManager.handleFileSelection()
    ↓ 'subscribe-show-open' message
Renderer receives SHOW_OPEN_REQUEST_EVENT via bridge.on()
    ↓ useDirectorySelection hook opens Modal
User browses directories (fetches /api/directory/browse)
    ↓ Modal confirms selection
__emitBridgeCallback('subscribe.callback-show-open{id}', paths)
    ↓ WebSocket sends callback
Bridge resolves with string[]
```

---

## Security: Path Validation

**Location:** `src/process/webserver/directoryApi.ts`

### Allowed Base Directories
```typescript
export const DEFAULT_ALLOWED_DIRECTORIES = (() => {
  const baseDirs = [process.cwd(), os.homedir()];
  if (process.platform === 'win32') {
    // Add all accessible drive letters C:-Z:
  }
  if (process.platform === 'darwin' || process.platform === 'linux') {
    baseDirs.push('/');  // Allow browsing entire filesystem on Unix
  }
  return baseDirs.map(fs.realpathSync).filter(...);
})();
```

### Validation Function
- `validatePath()`: Prevents directory traversal attacks
- `isPathAllowed()`: Checks if path is within allowed directories
- Uses `fs.realpathSync` to resolve symlinks
- Rate limiting via `fileOperationLimiter`

---

## Usage Examples from Codebase

### Opening Directory Selector
```typescript
// From WorkspaceFolderSelect.tsx
const files = await ipcBridge.dialog.showOpen.invoke({
  properties: ['openDirectory', 'createDirectory']
});

// From DirInputItem.tsx (Settings)
ipcBridge.dialog.showOpen.invoke({
  defaultPath: currentPath,
  properties: ['openDirectory', 'createDirectory'],
})
```

### WebUI Directory Selection Hook
```typescript
// From useDirectorySelection.tsx
const { contextHolder } = useDirectorySelection();

// Modal auto-opens when SHOW_OPEN_REQUEST_EVENT received
// Results returned via bridge callback pattern
```

---

## Key Files for Directory Selection Feature

| File | Purpose |
|------|---------|
| `src/common/adapter/ipcBridge.ts` (line 214-219) | API definition |
| `src/process/bridge/dialogBridge.ts` | Electron main process implementation |
| `src/common/adapter/browser.ts` | Web browser bridge adapter |
| `src/process/webserver/directoryApi.ts` | Server-side directory browsing |
| `src/renderer/hooks/file/useDirectorySelection.tsx` | React hook for modal |
| `src/renderer/components/settings/DirectorySelectionModal.tsx` | Browser fallback UI |
| `src/process/webserver/websocket/WebSocketManager.ts` | WebSocket event routing |
| `src/common/adapter/constant.ts` | `SHOW_OPEN_REQUEST_EVENT` constant |

---

## Patterns Summary

### Provider/Emitter Pattern (Bridge)
```typescript
// Define
bridge.buildProvider<ReturnType, Params>('event-name')
bridge.buildEmitter<EventType>('event-name')

// Implement
ipcBridge.dialog.showOpen.provider((options) => { ... })
ipcBridge.dialog.showOpen.emit({ ... })
```

### Adapter Pattern for Multi-Runtime
```typescript
// main.ts: Electron IPC
bridge.adapter({ emit, on })  // Uses ipcMain/ipcRenderer

// browser.ts: Web Browser  
bridge.adapter({ emit, on })  // Uses WebSocket or electronAPI

// standalone.ts: Server
bridge.adapter({ emit, on })  // Uses EventEmitter
```

### Callback Pattern for Async Responses
```typescript
// Events named: subscribe.callback-{event-name}{id}
// e.g., 'subscribe.callback-show-openabc123'
```

---

## Dependencies Added by Current Implementation

From existing STACK.md - no additional packages needed for directory selection:

- `electron` (dialog module - built-in)
- `ws` (WebSocket - already in stack)
- `@office-ai/platform` (bridge framework - already in stack)

The directory selection feature uses only existing stack components with the addition of:
- Custom React modal component (`DirectorySelectionModal`)
- Server-side Express routes for directory browsing
