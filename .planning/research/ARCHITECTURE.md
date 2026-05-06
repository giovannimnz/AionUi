# Directory Selection Architecture Research

> Research Date: 2026-05-06
> Focus: DirectorySelectionModal + WorkspaceFolderSelect integration, IPC bridge pattern, web renderer build

---

## 1. System Overview

The AionUi application supports two runtime environments:

| Environment | Platform Detection | Directory Selection |
|-------------|-------------------|-------------------|
| **Electron Desktop** | `isElectronDesktop()` → checks `window.electronAPI` | Native `dialog.showOpenDialog` via IPC |
| **WebUI (Browser)** | `!isElectronDesktop()` | `DirectorySelectionModal` web component + REST API |

---

## 2. Component Architecture

### 2.1 DirectorySelectionModal

**Location:** `src/renderer/components/settings/DirectorySelectionModal.tsx`

A pure React component that provides a file/directory browser UI for WebUI mode. It does NOT directly communicate with IPC — instead it is controlled by parent components or hooks.

**Key Props:**
```typescript
interface DirectorySelectionModalProps {
  visible: boolean;
  isFileMode?: boolean;        // true = select files, false = select directories
  onConfirm: (paths: string[] | undefined) => void;
  onCancel: () => void;
}
```

**Data Flow (WebUI):**
1. Fetches directory listings from `/api/directory/browse?path={dir}&showFiles={bool}`
2. The REST endpoint is handled by `src/process/webserver/directoryApi.ts`
3. Modal does NOT use IPC bridge — it communicates via React props/callbacks

**Key Implementation Details:**
- Uses Arco Design `Modal`, `Spin`, `Button` components
- Single-click on directory navigates into it
- "Select" button on items to choose them
- ".." item to navigate up (parent directory)
- Windows: `__ROOT__` signals to show drive letter list (C:, D:, etc.)
- Max 500 items per directory to prevent browser freeze
- Filters hidden files (starting with `.`)

---

### 2.2 WorkspaceFolderSelect

**Location:** `src/renderer/components/workspace/WorkspaceFolderSelect.tsx`

A unified folder selector component that abstracts the Electron vs WebUI difference.

**Key Props:**
```typescript
type WorkspaceFolderSelectProps = {
  value?: string;                           // Currently selected path
  onChange: (value: string) => void;        // Called when user selects
  onClear?: () => void;
  placeholder: string;
  inputPlaceholder?: string;
  recentLabel: string;
  chooseDifferentLabel: string;
  recentStorageKey?: string;                // localStorage key for recent list
  triggerTestId?: string;
  menuTestId?: string;
  menuZIndex?: number;
};
```

**Integration Pattern with DirectorySelectionModal:**

```typescript
// WorkspaceFolderSelect.tsx (lines 128-136)
const handleBrowse = async () => {
  setMenuVisible(false);

  if (isElectronDesktop()) {
    // Electron: use native dialog via IPC
    const files = await ipcBridge.dialog.showOpen.invoke({ 
      properties: ['openDirectory', 'createDirectory'] 
    });
    if (files?.[0]) {
      onChange(files[0]);
      addRecentWorkspace(files[0], recentStorageKey);
    }
  } else {
    // WebUI: show web-based DirectorySelectionModal
    setShowDirectorySelector(true);
  }
};
```

**When triggered, renders DirectorySelectionModal (lines 262-272):**
```tsx
<DirectorySelectionModal
  visible={showDirectorySelector}
  onConfirm={(paths) => {
    if (paths?.[0]) {
      onChange(paths[0]);
      addRecentWorkspace(paths[0], recentStorageKey);
    }
    setShowDirectorySelector(false);
  }}
  onCancel={() => setShowDirectorySelector(false)}
/>
```

**Recent Workspaces Feature:**
- Stores last 5 selected directories in `localStorage`
- Key is configurable via `recentStorageKey` prop
- Shown in dropdown menu when clicked

---

## 3. IPC Bridge Pattern

### 3.1 Three Adapter Architecture

The `@office-ai/platform` `bridge` library provides a unified IPC abstraction with three runtime adapters:

| Adapter | File | Environment | Transport |
|---------|------|-------------|-----------|
| `main.ts` | `src/common/adapter/main.ts` | Electron | `ipcMain`/`ipcRenderer` |
| `browser.ts` | `src/common/adapter/browser.ts` | WebUI Browser | WebSocket |
| `standalone.ts` | `src/common/adapter/standalone.ts` | Server mode | Node EventEmitter |

### 3.2 Dialog Bridge (Desktop)

**Location:** `src/process/bridge/dialogBridge.ts`

```typescript
export function initDialogBridge(): void {
  ipcBridge.dialog.showOpen.provider((options) => {
    const parentWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const dialogOptions = {
      defaultPath: options?.defaultPath,
      properties: options?.properties,
    };

    const showDialogPromise = parentWindow
      ? dialog.showOpenDialog(parentWindow, dialogOptions)
      : dialog.showOpenDialog(dialogOptions);

    return showDialogPromise.then((res) => res.filePaths);
  });
}
```

**IPC Channel Definition** (from `src/common/adapter/ipcBridge.ts`):
```typescript
export const dialog = {
  showOpen: bridge.buildProvider<
    string[] | undefined,
    | { defaultPath?: string; properties?: OpenDialogOptions['properties']; filters?: OpenDialogOptions['filters'] }
  >('dialog.show-open'),
};
```

### 3.3 WebUI Bridge (Browser)

**Location:** `src/common/adapter/browser.ts`

The browser adapter uses WebSocket for communication:

```typescript
// Web environment detection (lines 23-40)
if (win.electronAPI) {
  // Electron: use IPC
  bridge.adapter({
    emit(name, data) { return win.electronAPI.emit(name, data); },
    on(emitter) { /* ... */ },
  });
} else {
  // WebUI: use WebSocket
  bridge.adapter({
    emit(name, data) { socket.send(JSON.stringify({ name, data })); },
    on(emitter) { /* listen to WebSocket messages */ },
  });
}
```

**Key WebUI Behaviors:**
- Auto-reconnect with exponential backoff
- Message queuing during disconnection
- Ping/pong heartbeat for keepalive
- Auth expiration handling with login redirect

### 3.4 Standalone Adapter (Server)

**Location:** `src/common/adapter/standalone.ts`

Used by `src/server.ts` for `--webui` mode. Uses Node.js EventEmitter internally and broadcasts to all connected WebSocket clients.

---

## 4. useDirectorySelection Hook

**Location:** `src/renderer/hooks/file/useDirectorySelection.tsx`

A hook for globally handling directory selection requests that come through the IPC bridge (e.g., from main process).

**Purpose:** Listens for `show-open-request` events on the bridge and displays `DirectorySelectionModal` globally.

```typescript
export const useDirectorySelection = () => {
  const [visible, setVisible] = useState(false);
  const [requestData, setRequestData] = useState<DirectorySelectionRequest | null>(null);

  // Called when user confirms selection
  const handleConfirm = useCallback((paths: string[] | undefined) => {
    if (requestData) {
      // Send callback via bridge emitter
      const callbackEventName = `subscribe.callback-show-open${requestData.id}`;
      (window as any).__emitBridgeCallback(callbackEventName, paths);
    }
    setVisible(false);
    setRequestData(null);
  }, [requestData]);

  // Listen for show-open-request events from main process
  useEffect(() => {
    const handleShowOpenRequest = (data: DirectorySelectionRequest) => {
      setRequestData({ ...data, isFileMode: /* derived */ });
      setVisible(true);
    };
    bridge.on(SHOW_OPEN_REQUEST_EVENT, handleShowOpenRequest);
    return () => bridge.off(SHOW_OPEN_REQUEST_EVENT, handleShowOpenRequest);
  }, []);

  return { contextHolder: <DirectorySelectionModal visible={visible} ... /> };
};
```

**Bridge Event Constant** (`src/common/adapter/constant.ts`):
```typescript
export const SHOW_OPEN_REQUEST_EVENT = 'show-open-request';
```

---

## 5. WebUI Directory API

**Location:** `src/process/webserver/directoryApi.ts`

Express router providing directory browsing REST API for WebUI mode.

### Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/directory/browse?path=X&showFiles=true/false` | List directory contents |
| POST | `/api/directory/validate` | Validate a path |
| GET | `/api/directory/shortcuts` | Get common shortcuts |

### Security:

1. **Path Validation:** All paths validated via `validatePath()` to prevent traversal attacks
2. **Allowed Directories:**
   - `process.cwd()` (AionUi run directory)
   - `os.homedir()` (User home)
   - `/` on Unix-like systems
   - Drive letters on Windows
3. **Rate Limiting:** `fileOperationLimiter` middleware

### Windows Drive Handling:
```typescript
if (process.platform === 'win32' && (!queryPath || queryPath === '__ROOT__')) {
  // Return list of available drives (C:, D:, etc.)
  return res.json({ items: getWindowsDrives(), canGoUp: false, ... });
}
```

---

## 6. Platform Detection

**Location:** `src/renderer/utils/platform.ts`

```typescript
export const isElectronDesktop = (): boolean => {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
};
```

The `electronAPI` object is exposed via `contextBridge` in `src/preload/main.ts`.

---

## 7. Web Renderer Build Considerations

**Location:** `electron.vite.config.ts` (renderer section, lines 161-288)

### Key Configuration:

```typescript
renderer: {
  base: './',              // Relative paths for electron compatibility
  appType: 'mpa',          // Multi-page application
  
  resolve: {
    alias: { /* @ → src, @common → src/common, etc. */ },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,  // KB
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: 'src/renderer/index.html',
        pet: 'src/renderer/pet/pet.html',
        'pet-hit': 'src/renderer/pet/pet-hit.html',
        'pet-confirm': 'src/renderer/pet/pet-confirm.html',
      },
      output: {
        manualChunks(id) {
          // Vendor chunk splitting
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('/@arco-design/')) return 'vendor-arco';
          if (id.includes('/react-markdown/')) return 'vendor-markdown';
          if (id.includes('/monaco-editor/')) return 'vendor-editor';
          // ... more vendor chunks
        },
      },
    },
  },
  
  optimizeDeps: {
    exclude: ['electron'],  // Don't try to bundle electron in browser
    include: [ /* react, arco, icon-park, etc. */ ],
  },
}
```

### Multi-Instance Support:
```typescript
define: {
  'process.env.AIONUI_MULTI_INSTANCE': JSON.stringify(process.env.AIONUI_MULTI_INSTANCE ?? ''),
}
```

### HMR Configuration:
```typescript
server: {
  port: 5173,
  host: '0.0.0.0',
  allowedHosts: ['localhost', 'aion.atius.com.br', 'aion.horistic.com'],
  hmr: { host: 'localhost' },  // Direct Vite connection, not through proxy
}
```

---

## 8. Data Flow Summary

### Electron Desktop Mode:
```
User clicks "Browse"
    ↓
WorkspaceFolderSelect.handleBrowse()
    ↓
isElectronDesktop() === true
    ↓
ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] })
    ↓
[Main Process] dialogBridge → Electron dialog.showOpenDialog
    ↓
Returns string[] of filePaths
    ↓
WorkspaceFolderSelect.onChange(selectedPath)
```

### WebUI Mode:
```
User clicks "Browse"
    ↓
WorkspaceFolderSelect.handleBrowse()
    ↓
isElectronDesktop() === false
    ↓
setShowDirectorySelector(true)
    ↓
DirectorySelectionModal renders
    ↓
User navigates directories via /api/directory/browse
    ↓
User clicks "Select" on folder
    ↓
onConfirm([selectedPath])
    ↓
WorkspaceFolderSelect.onChange(selectedPath)
```

---

## 9. Key Files Reference

| File | Purpose |
|------|---------|
| `src/renderer/components/settings/DirectorySelectionModal.tsx` | WebUI directory browser modal |
| `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` | Unified folder selector |
| `src/renderer/hooks/file/useDirectorySelection.tsx` | Global IPC-based directory selection hook |
| `src/common/adapter/main.ts` | Electron IPC adapter |
| `src/common/adapter/browser.ts` | WebUI WebSocket adapter |
| `src/common/adapter/standalone.ts` | Standalone server adapter |
| `src/common/adapter/ipcBridge.ts` | IPC channel definitions |
| `src/process/bridge/dialogBridge.ts` | Dialog provider for Electron |
| `src/process/webserver/directoryApi.ts` | REST API for WebUI directory browsing |
| `src/renderer/utils/platform.ts` | Platform detection utilities |
| `src/preload/main.ts` | contextBridge API exposure |
| `electron.vite.config.ts` | Build configuration |
