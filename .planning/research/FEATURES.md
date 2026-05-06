# Directory Selection Feature Research

> Generated: 2026-05-06
> Based on: ARCHITECTURE.md, CONCERNS.md, and codebase analysis

---

## Context

Directory selection is a recurring UX pattern across multiple AionUi features:

1. **Workspace directory** — per-conversation working directory for file operations
2. **Extension installation** — local extension directories (extension market, custom paths)
3. **Custom skill paths** — external skill repositories (SkillsHub)
4. **Import/Export** — target directories for data operations

### Existing Implementation

The codebase has a split architecture:

| Context | Implementation | File |
|---------|---------------|------|
| Native (Electron) | `ipcBridge.dialog.showOpen` → Electron `dialog.showOpenDialog` | `src/process/bridge/dialogBridge.ts` |
| In-app (WebUI) | `DirectorySelectionModal` → `/api/directory/browse` | `src/renderer/components/settings/DirectorySelectionModal.tsx` |
| Hook | `useDirectorySelection` + `useWorkspaceSelector` | `src/renderer/hooks/file/useDirectorySelection.tsx` |
| Backend API | `directoryApi.ts` with path allowlisting | `src/process/webserver/directoryApi.ts` |
| Dropdown variant | `WorkspaceFolderSelect` with recent paths | `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` |

Security is enforced server-side via `isPathAllowed()` / `validatePath()` which restrict access to: cwd, homedir, filesystem root (Unix), all drive letters (Windows).

---

## Table-Stakes Features

These are required for any directory selection interaction to meet minimum usability and security standards.

### 1. Platform-Native Dialog (Desktop)

**What:** Use Electron's native `dialog.showOpenDialog` as the primary picker on desktop.

**Why:** Users expect OS-native folder picker behavior. It provides reliable keyboard navigation, drag-drop support, and bookmarked locations out of the box. Custom in-app browsers are a fallback only.

**Implementation:** `ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] })` — already exists in `dialogBridge.ts`.

**Requirement:** Must pass `defaultPath` when editing an existing path so the dialog opens at the current location.

### 2. Path Allowlisting / Security Boundaries

**What:** Restrict directory selection to safe, intended paths. Do not allow arbitrary filesystem access.

**Current state:** `directoryApi.ts` enforces `DEFAULT_ALLOWED_DIRECTORIES` (cwd, homedir, `/` on Unix, all drives on Windows). The `validatePath()` function prevents directory traversal (`..`, null bytes).

**Requirements:**
- Extension directories must be confined to extension-specific sandbox roots (see CONCERNS.md §2 — symlink not resolved via `realpathSync`)
- User-facing directory pickers must never escape the allowlist
- When selecting a directory for an extension install, validate the parent directory is writable and within an allowed scope

### 3. Recent / History记忆

**What:** Remember recently selected directories per context (workspace, extension, skill).

**Why:** Users frequently re-select the same directories. Without history, every selection is a full traversal from scratch.

**Implementation:** `WorkspaceFolderSelect` stores up to 5 recent paths in `localStorage` with a `recentStorageKey` per context. This pattern should be reused/standardized.

**Requirements:**
- Max 5 entries (prevents bloat)
- Deduplication on re-selection
- Display folder name + full path on hover
- Clear individual history entry option

### 4. Validation on Confirm

**What:** Validate the selected path before confirming — check it exists, is a directory, and is readable.

**Backend:** `POST /api/directory/validate` already exists with proper error messages.

**Frontend:** Must disable the confirm button until a valid selection is made. Show inline error if path becomes invalid after selection (e.g., deleted concurrently).

### 5. Cross-Platform Path Display

**What:** Render paths in a platform-appropriate style (`/` vs `\\`) and handle the root path differently per OS.

**Implementation:** `DirectorySelectionModal` handles `__ROOT__` on Windows to show drive letters. Path splitting for display (`value.split(/[\\\/]/).pop()`) works on both platforms.

**Requirement:** Do not assume path separators — use `path` module APIs for all path operations.

---

## Differentiating Behaviors

These features distinguish a polished directory selection UX from a bare-bones one.

### D1. Shortcuts / Quick Access

**What:** Show common locations as one-click shortcuts: Home, Desktop, Documents, Downloads, AionUi working directory.

**Backend:** `GET /api/directory/shortcuts` already provides this list. It filters to only show paths that exist.

**UX:** Display shortcuts as a row or section above/below the directory listing. Emoji icons help scannability. Clicking a shortcut navigates directly to that path.

### D2. Keyboard Navigation

**What:** Full keyboard operability — arrow keys to navigate, Enter to select/open directory, Escape to cancel.

**Current gap:** `DirectorySelectionModal` has no keyboard handling. Native dialogs handle this natively, but the in-app browser does not.

**Requirements:**
- Arrow Up/Down: move selection
- Enter: open directory or select item
- Backspace: go up one level
- Escape: cancel/close
- Tab: cycle through shortcuts, then items

### D3. Search / Filter

**What:** Type to filter items in the current directory by name.

**Why:** For directories with many items (e.g., a large home directory), scrolling is slow. A live filter dramatically speeds up navigation.

**Implementation note:** Filter is client-side on the already-loaded items. No backend change needed for basic filename filtering.

### D4. Creation + Selection in One Flow

**What:** Allow creating a new subfolder directly in the picker, then select it in the same action.

**Native dialog:** `properties: ['openDirectory', 'createDirectory']` already enables this. No extra UX needed.

**In-app browser:** The current `DirectorySelectionModal` has no create folder button. Consider adding a "New Folder" action in the footer or context menu.

### D5. Empty State Handling

**What:** Graceful message when a directory is empty or inaccessible.

**Current:** `DirectorySelectionModal` renders no items gracefully (blank area). But the error state relies on an `error` string that requires a failed API call.

**Requirements:**
- Empty directory: show "This folder is empty" message with a subtle icon
- Permission denied: show "Cannot access this folder" with a retry button
- Item count indicator when listing is truncated (current API returns `truncated: true`)

### D6. Breadcrumb Navigation

**What:** Show the full path as clickable breadcrumb segments above the file list.

**Why:** Helps users understand their current location and jump to any parent without repeated "go up" clicks.

**Current:** The modal shows a single-path display in the footer but no breadcrumb bar.

### D7. Multi-Select (Where Appropriate)

**What:** Support selecting multiple directories for batch operations (e.g., adding multiple custom skill paths at once).

**Native dialog:** `properties: ['openDirectory', 'multiSelections']`.

**In-app:** `DirectorySelectionModal` currently returns `string[]` on confirm but the UI only tracks a single `selectedPath`. Multi-select would require checkbox UI and updating the list item rendering.

**Note:** Only needed for skill path management (AddCustomPathModal). Workspace selection is inherently single-select.

---

## Anti-Features to Avoid

These are patterns that seem intuitive but introduce problems.

### AF-1. Double-Click to Select

**Problem:** The codebase has a history of removing double-click behavior (see comment in `DirectorySelectionModal.tsx:93-97` — "Double-click behavior removed — single click now handles directory navigation").

Single-click to navigate + single-click on a "Select" button per item is the correct pattern. Double-click creates ambiguity (is it "open" or "select and close"?). It also breaks keyboard navigation.

**Rule:** Every item shows a visible "Select" button. Navigation is separate from selection.

### AF-2. Full Filesystem Access in In-App Browser

**Problem:** `DirectorySelectionModal` currently allows navigating to `/` on Unix and all drive letters on Windows via the `canGoUp` mechanic. Combined with `showFiles` mode, this exposes the entire filesystem.

**Current policy:** The backend `DEFAULT_ALLOWED_DIRECTORIES` restricts listing to allowed paths, but navigation can reach root. This is acceptable for the in-app browser as a convenience but should never be the primary path — native dialogs should be the default.

**Rule:** The in-app browser is a fallback for non-Electron environments (WebUI mode). Desktop must prefer native dialog.

### AF-3. Persisting Invalid Paths

**Problem:** If a directory is selected, saved, and then deleted or made inaccessible, the saved path becomes stale.

**Current:** No stale-path detection exists.

**Rule:** Validate the path when loading a configuration that contains it. If invalid, show a warning UI (not silent failure) and prompt the user to reselect. Do not block startup, but surface the issue clearly.

### AF-4. Blocking the UI Thread

**Problem:** Directory listing is async via fetch, but the modal shows a full-page `Spin` overlay during loading, which can feel sluggish on large or network-mounted directories.

**Rule:** Load directory contents with pagination or streaming if >500 items (backend caps at `MAX_DIRECTORY_ITEMS = 500`). Show a progress indicator, not a blocking spinner over the entire modal.

### AF-5. No Undo / Confirmation for Destructive Operations

**Problem:** If directory selection is part of an operation that deletes or overwrites (e.g., workspace reset, extension uninstall), users need confirmation.

**Rule:** Directory selection itself is not destructive, but operations triggered after selection must have appropriate confirmation dialogs. Never silently overwrite or delete.

### AF-6. Inconsistent Recent Path Scopes

**Problem:** `WorkspaceFolderSelect` uses `localStorage` with per-key storage (e.g., `aionui:recent-workspaces`). But extension directory selection and skill path selection do not share or normalize this — each context maintains its own isolated history.

**Rule:** Establish a consistent schema for recent paths: `{ scope: 'workspace' | 'extension' | 'skill', paths: string[], updatedAt: number }`. Consider a unified `useRecentPaths(scope)` hook.

### AF-7. Skipping Path Validation Before Save

**Problem:** Some callers of `useWorkspaceSelector` directly save the returned path without calling the validation endpoint.

**Rule:** Always validate a selected path via `POST /api/directory/validate` before persisting. Show specific error if the path is inaccessible rather than a generic save failure.

---

## Feature Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Keyboard navigation in in-app browser | Medium | Medium | P2 |
| Search/filter in modal | Medium | Low | P2 |
| Breadcrumb navigation | Medium | Low | P2 |
| Create folder in modal | Low | Medium | P3 |
| Multi-select for skill paths | Low | Medium | P3 |
| Unified recent paths hook | Low | Medium | P3 |
| Stale path detection | Medium | Low | P2 |

---

## References

- `src/renderer/components/settings/DirectorySelectionModal.tsx` — in-app browser implementation
- `src/renderer/components/workspace/WorkspaceFolderSelect.tsx` — dropdown with recent paths
- `src/renderer/hooks/file/useDirectorySelection.tsx` — bridge hook for in-app dialog
- `src/process/bridge/dialogBridge.ts` — native Electron dialog bridge
- `src/process/webserver/directoryApi.ts` — backend API with security constraints
- `src/renderer/components/settings/SettingsModal/contents/SystemModalContent/DirInputItem.tsx` — form field picker
- `.planning/codebase/CONCERNS.md` — security concerns relevant to filesystem access
