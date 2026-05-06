# AionUi Directory Selection — Pitfalls Research

> Generated: 2026-05-06
> Based on: `.planning/codebase/CONCERNS.md` and `.planning/codebase/ARCHITECTURE.md`

---

## 1. Adapter Switching Mistakes

### 1.1 Two Distinct Directory-Selection Code Paths

AionUi has **two separate directory-selection implementations** that run in different runtime contexts. Choosing the wrong one causes silent failures or crashes.

| Context | Mechanism | Entry point |
|---------|-----------|-------------|
| Electron renderer (`desktop`) | `ipcBridge.dialog.showOpen` → native Electron `dialog.showOpen` | `src/process/bridge/dialogBridge.ts` |
| WebUI renderer (`browser`) | `fetch('/api/directory/browse')` HTTP call | `src/process/webserver/directoryApi.ts` |

Both paths are surfaced in the UI:

- **`useWorkspaceSelector`** (`src/renderer/hooks/file/useWorkspaceSelector.ts:28`) calls `ipcBridge.dialog.showOpen.invoke(...)` — **only works in Electron**.
- **`DirectorySelectionModal`** (`src/renderer/components/settings/DirectorySelectionModal.tsx:51`) calls `fetch('/api/directory/browse?...')` — **only works in WebUI server mode**.

**Pitfall:** If a future refactor wires `DirectorySelectionModal` into the workspace selection flow (or vice versa), calling the HTTP endpoint from the Electron renderer will 404 silently, and calling `ipcBridge.dialog.showOpen` from the WebUI renderer will throw an unhandled promise rejection.

### 1.2 `dialog.showOpen` Has No WebUI Fallback

`dialog.showOpen` is defined as a provider in `dialogBridge.ts` and exposed via `ipcBridge.dialog.showOpen` in `ipcBridge.ts`. It is implemented **only** for the Electron adapter (`main.ts` + `dialogBridge.ts`). The WebUI browser adapter (`browser.ts`) has no `dialog.showOpen` handler.

**Pitfall:** Any code path that calls `ipcBridge.dialog.showOpen.invoke(...)` in WebUI mode will get a "provider not found" error from the `@office-ai/platform` bridge layer. The `DirInputItem.tsx` component (`src/renderer/components/settings/SettingsModal/contents/SystemModalContent/DirInputItem.tsx:29`) uses this call directly — it works only in Electron mode.

### 1.3 Adapter Registration Order

The main process initializes adapters via `initAllBridges()` (`src/process/bridge/index.ts:59`). The adapters are registered imperatively, not declaratively. The `dialog` bridge is registered first (`initDialogBridge()`) before other bridges.

**Pitfall:** If a later bridge initialization throws, earlier bridges (including `dialog`) may be registered but their providers may reference uninitialized dependencies. No dead-letter or error-boundary pattern exists for bridge registration failures.

### 1.4 No Adapter Capability Query

The renderer cannot query which adapter is active or what capabilities it supports. `browser.ts` checks for `win.electronAPI` at import time and branches once. There is no `isElectron`, `isStandalone`, or `capabilities` object exposed.

**Pitfall:** Adding new platform-specific behavior requires scattered `if (win.electronAPI)` guards throughout the codebase. Missing a guard causes silent failures in WebUI or crashes in Electron.

---

## 2. IPC Race Conditions

### 2.1 Workspace Update vs. Cache Invalidation Race

`useWorkspaceSelector` (`src/renderer/hooks/file/useWorkspaceSelector.ts`) performs a **non-atomic multi-step operation**:

```
1. ipcBridge.dialog.showOpen.invoke()     ← user picks directory
2. ipcBridge.conversation.get.invoke()     ← fetch current conversation
3. ipcBridge.conversation.update.invoke() ← write new workspace path
4. mutate(SWR cache)                      ← invalidate local cache
5. emitter.emit()                          ← notify other components
```

Between steps 2 and 3, another tab or process could modify the conversation. The SWR `mutate` in step 4 is called with `false` (no revalidation), so the cached state may diverge from server state if the update in step 3 fails silently.

**Pitfall:** If `conversation.update` fails (network glitch, concurrent modification), the UI optimistically updates the SWR cache and shows a success message, but the backend has a different workspace. The `emitter.emit` in step 5 fires regardless, potentially confusing other listeners (e.g., workspace tree refresh).

### 2.2 `adapterWindowList` Concurrent Modification

In `main.ts:78–85`, the `emit` function iterates over `adapterWindowList` and **splices** entries when a window is found to be destroyed:

```typescript
for (let i = adapterWindowList.length - 1; i >= 0; i--) {
  const win = adapterWindowList[i];
  if (win.isDestroyed() || win.webContents.isDestroyed()) {
    adapterWindowList.splice(i, 1);  // mutates while iterating
    continue;
  }
  win.webContents.send(ADAPTER_BRIDGE_EVENT_KEY, serialized);
}
```

**Pitfall:** If a window is closed between the length-check and the index access, or if `splice` triggers a re-entrant callback that also modifies `adapterWindowList`, the loop can skip windows or throw. The array is also not thread-safe for the multi-process Electron context.

### 2.3 WebSocket Message Queue Ordering Under Reconnect

`browser.ts` queues messages when the WebSocket is not `OPEN`:

```typescript
messageQueue.push(message);  // queued while socket reconnects
// ...
flushQueue();  // drains on 'open' event
```

**Pitfall:** If the user triggers a workspace change while the WebSocket is reconnecting (exponential backoff up to 8 seconds), the IPC call may resolve successfully from the server's perspective but the response event arrives after a new socket connection — potentially after the UI has already re-rendered with stale state. The queued `invoke` may race with the new socket's delivery of an earlier response.

### 2.4 IPC Payload Size Limit with No Per-Channel Quota

`main.ts:37` defines a single `MAX_IPC_PAYLOAD_SIZE = 50MB` for all bridge events. Large workspace directory listings (thousands of files) could saturate this limit, causing the **entire event** to be dropped with an error notification to all windows, not just the offending caller.

**Pitfall:** A single `conversation.getWorkspace` response for a large workspace can exceed 50MB. The entire event is dropped; no retry or chunking mechanism exists. The renderer shows no indication that the data was lost — the workspace tree just stays empty.

### 2.5 `ipcBridge.dialog.showOpen` — No Window Association

`dialogBridge.ts:14` picks the "focused window or the first available window" as the parent for the native dialog:

```typescript
const parentWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
```

**Pitfall:** In multi-window scenarios, the dialog may appear on the wrong monitor or behind another application's window. There is no way to associate a specific renderer conversation with the dialog call to ensure the dialog is modal to the correct window.

---

## 3. Web Build Pitfalls

### 3.1 DirectorySelectionModal Only Works When WebUI Server is Running

`DirectorySelectionModal.tsx:51–56` makes a **hardcoded HTTP fetch**:

```typescript
const response = await fetch(
  `/api/directory/browse?path=${encodeURIComponent(dirPath)}&showFiles=${showFiles}`,
  { method: 'GET', credentials: 'include' }
);
```

This URL is only valid when the Express server (`src/process/webserver/`) is active (i.e., when `--webui` mode is started). If the modal is opened in a bundled Electron renderer (no WebUI server), the fetch fails with a network error and the error state is set.

**Pitfall:** The modal has no fallback to `ipcBridge.dialog.showOpen`. In a future scenario where `DirectorySelectionModal` is used for workspace selection in Electron mode (not just settings), it will fail silently.

### 3.2 WebUI Server Must Be Explicitly Started

The WebUI server is started via `webui.start` IPC call (`src/process/bridge/webuiBridge.ts`). It does not start automatically with the Electron app.

**Pitfall:** If the user opens `DirectorySelectionModal` before starting WebUI, the modal fails. There is no lazy-start trigger or user-facing indication that WebUI needs to be enabled first.

### 3.3 Different Path Constraints in WebUI vs. Electron

| Feature | Electron (`dialog.showOpen`) | WebUI (`/api/directory/browse`) |
|---------|------------------------------|--------------------------------|
| Starting directory | `defaultPath` option or OS default | Defaults to `process.cwd()`, not home |
| Allowed paths | OS native dialog, no server-side restriction | Restricted to `DEFAULT_ALLOWED_DIRECTORIES` (cwd, homedir, `/` on Unix, drives on Windows) |
| Hidden files | Shown/hidden per OS dialog settings | Always filtered (`!name.startsWith('.')`) |

**Pitfall:** A directory accessible in Electron mode may be inaccessible in WebUI mode, and vice versa. The `useWorkspaceSelector` in Electron can pick any directory the OS allows; the WebUI modal enforces `validatePath` restrictions.

### 3.4 Vite Build Chunk Splitting Can Delay Adapter Initialization

The renderer build (`electron.vite.config.ts`) splits vendor chunks (vendor-react, vendor-arco, etc.). The `browser.ts` adapter is bundled into the renderer chunk. If `browser.ts` throws during initialization (e.g., `win.electronAPI` check fails unexpectedly), the error propagates to the top-level module and may crash the React tree without a recovery mechanism.

---

## 4. Security Issues with Server Directory Browsing

### 4.1 Allowed Directory List Includes Filesystem Root on Unix

`directoryApi.ts:39–41`:

```typescript
if (process.platform === 'darwin' || process.platform === 'linux') {
  baseDirs.push('/');  // allows browsing entire filesystem
}
```

Any authenticated WebUI user can browse **any** file on the system (subject to OS permissions). While `validatePath` checks `isSubPath` against these roots, and `realpathSync` resolves symlinks, the attack surface is any file readable by the Node.js process.

**Pitfall:** In shared-hosting or multi-user WebUI deployments, a compromised account can explore the entire filesystem accessible to the server process.

### 4.2 `validatePath` Resolves Symlinks After Normalization, Not Before

`validatePath` (`directoryApi.ts:118`) normalizes the path first (`path.normalize`), then calls `resolveForComparison` which calls `realpathSync` on the normalized path:

```typescript
const normalizedPath = path.normalize(expandedPath);
const resolvedPath = resolveForComparison(normalizedPath, useWin32PathOps);  // realpathSync inside
```

If a symlink is created *after* the allowed-directory check but *before* the `realpathSync` call, a path that was inside an allowed directory could point outside. However, this is mitigated by `realpathSync` being called within the same function before the `isSubPath` check.

**Actual risk:** Low, due to the ordering. The bigger risk is the broad allowed directories (`/` on Unix) making enumeration easy.

### 4.3 `fsBridge.getFilesByDir` Has No Path Validation

`fsBridge.ts:309–316`:

```typescript
ipcBridge.fs.getFilesByDir.provider(async ({ dir }) => {
  try {
    const tree = await readDirectoryRecursive(dir);  // dir is unvalidated
    return tree ? [tree] : [];
  }
});
```

`dir` is passed directly to `readDirectoryRecursive` without any `isPathWithinRoot` or `validatePath` check. This provider is accessible from the renderer via `ipcBridge.fs.getFilesByDir.invoke(...)`.

**Pitfall:** In Electron mode, any renderer code (including compromised extension sandbox code that escaped its bounds) can call this with an arbitrary path. The workspace boundary is not enforced. See CONCERNS.md Section 2.3 — `isPathWithinRoot` (`fsBridge.ts:187`) uses `path.relative` without `realpathSync`.

### 4.4 No Rate Limiting on `fs.getFilesByDir` IPC Call

`directoryApi.ts` applies `fileOperationLimiter` to all three directory routes (`/browse`, `/validate`, `/shortcuts`). However, the equivalent `ipcBridge.fs.getFilesByDir` IPC provider in Electron mode has **no rate limiting**.

**Pitfall:** A malicious extension or compromised renderer can spam `getFilesByDir` calls to enumerate the filesystem rapidly, bypassing the WebUI rate limiter.

### 4.5 Token Middleware Applied After Rate Limiter on Extension Routes

In `apiRoutes.ts:256–261`:

```typescript
const stack: RequestHandler[] = [apiRateLimiter];
if (routeMatch.auth) {
  stack.push(validateApiAccess);
}
stack.push(wrapRouteHandler(handler));
```

The `fileOperationLimiter` is applied at the router level (`app.use('/api/directory', apiRateLimiter, ...)`), but extension API routes have `apiRateLimiter` added **before** `validateApiAccess`. This means unauthenticated requests (if an extension route has `auth: false`) still consume rate limit tokens, potentially enabling a DoS against the rate limiter itself before authentication is checked.

---

## 5. Path Validation Inconsistencies

### 5.1 `isPathWithinRoot` (fsBridge) Does Not Resolve Symlinks

`fsBridge.ts:187–190`:

```typescript
function isPathWithinRoot(root: string, targetPath: string): boolean {
  const relativePath = path.relative(root, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
```

This uses `path.relative` on the logical paths. A symlink inside `root` pointing to `/etc/passwd` would pass this check if `root` contains the symlink's parent directory.

**Pitfall:** Documented in CONCERNS.md Section 2.3. The fix is to use `fs.realpathSync` (as `pathSafety.ts` does correctly with `fs.realpathSync.native`).

### 5.2 `validatePath` Does Not Check Read/Write Permissions

`validatePath` (`directoryApi.ts:118`) only checks **existence** and **containment**. It does not call `fs.accessSync` with `R_OK`/`W_OK` flags. A path that passes validation may still be unreadable or unwritable by the server process.

**Pitfall:** The `/api/directory/validate` POST endpoint returns `valid: true` for a readable-but-not-writable directory, which may confuse clients expecting write access.

### 5.3 Tilde Expansion Only in `validatePath`, Not Globally

`validatePath` (`directoryApi.ts:124`) expands `~`:

```typescript
const expandedPath = trimmedPath.startsWith('~') ? path.join(os.homedir(), trimmedPath.slice(1)) : trimmedPath;
```

Other path-handling code (e.g., `fsBridge.getFilesByDir`, `fsBridge.listWorkspaceFiles`) does not perform tilde expansion. A workspace path entered as `~/project` works in WebUI directory browsing but may fail when passed to Electron-side IPC calls.

### 5.4 Windows Path Separator Mismatch

`resolveForComparison` (`directoryApi.ts:71–85`) conditionally uses `path.win32` APIs based on `shouldUseWin32PathOps`, which returns `true` if `process.platform === 'win32'` OR if the path being checked contains Windows-style segments.

**Pitfall:** On a Windows development machine running Node.js in a Unix environment (WSL, Docker), the server's `process.platform` may be `linux` but a path like `C:/Users/...` would trigger Windows path operations, which may behave unexpectedly.

### 5.5 No Maximum Path Length Validation

`validatePath` does not check `MAX_PATH` on Windows or `PATH_MAX` on Unix. Extremely long paths may pass validation but fail on `fs.readdirSync` or `fs.realpathSync`, producing unhandled exceptions caught only at the top-level error handler.

---

## Summary Table

| Area | Pitfall | Severity | Context |
|------|---------|----------|---------|
| Adapter switching | `dialog.showOpen` has no WebUI implementation | High | `DirInputItem.tsx` |
| Adapter switching | `DirectorySelectionModal` only works with WebUI server | Medium | Modal used in settings |
| IPC race | Non-atomic workspace update in `useWorkspaceSelector` | Medium | Multi-step conversation update |
| IPC race | `adapterWindowList` concurrent modification | Low | Window close during broadcast |
| IPC race | WebSocket queue ordering under reconnect | Low | Exponential backoff delays |
| IPC race | 50MB payload limit with no per-channel quota | Medium | Large workspace responses |
| Web build | WebUI HTTP endpoint hardcoded in modal | Medium | No fallback to IPC |
| Web build | Different path constraints per mode | Medium | Electron vs. WebUI allowed dirs |
| Security | `/` allowed on Unix in WebUI directory browse | High | Any readable file accessible |
| Security | `getFilesByDir` IPC has no path validation | High | fsBridge bypasses workspace boundary |
| Security | No rate limiting on Electron-side fs IPC | Medium | Bypasses WebUI rate limiter |
| Path validation | `isPathWithinRoot` doesn't resolve symlinks | High (known) | CONCERNS.md 2.3 |
| Path validation | `validatePath` doesn't check permissions | Low | Returns `valid` for read-only dirs |
| Path validation | Tilde expansion inconsistent across modules | Low | WebUI works, IPC fails |

---

## Key Files Referenced

- `src/renderer/components/settings/DirectorySelectionModal.tsx` — WebUI HTTP-based directory browser modal
- `src/renderer/hooks/file/useWorkspaceSelector.ts` — Electron IPC-based workspace directory selector
- `src/renderer/components/settings/SettingsModal/contents/SystemModalContent/DirInputItem.tsx` — Settings panel directory input
- `src/process/bridge/dialogBridge.ts` — Electron native dialog bridge provider
- `src/process/webserver/directoryApi.ts` — WebUI Express HTTP directory API
- `src/process/bridge/fsBridge.ts` — Electron-side filesystem IPC bridge
- `src/common/adapter/main.ts` — Electron main process adapter
- `src/common/adapter/browser.ts` — WebUI renderer adapter (WebSocket)
- `src/common/adapter/standalone.ts` — Standalone server adapter (EventEmitter)
- `src/process/extensions/sandbox/pathSafety.ts` — Correct symlink-aware path containment check
