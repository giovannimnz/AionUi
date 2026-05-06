# AionUi — Requirements

> Fork: https://github.com/giovannimnz/AionUi

## v1 Requirements

### Workspace Selection (WEB-FS)

- [ ] **WEB-FS-01**: WebUI displays visual directory selector on session start
  - Currently renders a plain `<Input>` text field on web (no browse button)
  - Should render the same browse button as desktop
  - Clicking browse opens `DirectorySelectionModal` instead of native OS dialog

- [ ] **WEB-FS-02**: `WorkspaceFolderSelect` renders full browse UI on web, not fallback `<Input>`
  - Remove the `if (!isDesktop) { return <Input ... /> }` guard in `src/renderer/components/workspace/WorkspaceFolderSelect.tsx`
  - Import and render `DirectorySelectionModal` for web path
  - Desktop behavior unchanged (native OS dialog via `ipcBridge.dialog.showOpen`)

- [ ] **WEB-FS-03**: Directory selection uses `DirectorySelectionModal` on web, native dialog on desktop
  - `handleBrowse()` must branch on `isElectronDesktop()`:
    - Desktop → `ipcBridge.dialog.showOpen({ properties: ['openDirectory', 'createDirectory'] })`
    - Web → `setShowDirectorySelector(true)` (opens `DirectorySelectionModal`)
  - Modal's `onConfirm` calls `onChange(path)` to update the selected path

- [ ] **WEB-FS-04**: `DirectorySelectionModal` accepts and returns valid server paths
  - Modal communicates with `GET /api/directory/browse?path=...` and `POST /api/directory/validate`
  - Path returned from modal must be validated before being passed to `onChange`

### Build & Deployment (BUILD)

- [ ] **BUILD-01**: Web renderer builds to deployable assets
  - `bun run build:renderer:web` produces static assets in `dist-renderer-web/`
  - Assets deployable to Apache2 web root

- [ ] **BUILD-02**: Server builds to deployable bundle
  - `bun run build:server` produces server bundle in `dist-server/`
  - Server serves WebUI static files and WebSocket API

- [ ] **BUILD-03**: Desktop build produces installable Electron app
  - `bun run build:electron` (or equivalent) produces `.AppImage` / `.dmg` / `.exe`

### Security (SEC)

- [ ] **SEC-01**: WebUI directory browser validates paths server-side
  - `GET /api/directory/browse` must restrict listing to allowed root directories
  - Prevent traversal beyond configured root (`isPathWithinRoot` check)

- [ ] **SEC-02**: Path allowlist enforced before workspace is saved
  - `POST /api/directory/validate` validates selected path
  - Invalid paths rejected with clear error message

---

## v2 Requirements (Deferred)

- [ ] **MULTI-SELECT-01**: Multi-select directories for batch operations (e.g., skill paths)
- [ ] **RECENT-PATHS-01**: Recent path history (up to 5 entries, per-context storage)
- [ ] **BREADCRUMB-01**: Breadcrumb navigation bar in `DirectorySelectionModal`
- [ ] **SEARCH-01**: Live search/filter within directory modal

---

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Native mobile apps | Not in scope for this phase |
| Real-time sync between web and desktop sessions | Separate feature |
| Custom directory browsing UI beyond existing modal | Reuse `DirectorySelectionModal` |
| Extension filesystem access | Separate security concern |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEB-FS-01 | Phase 1 | — |
| WEB-FS-02 | Phase 1 | — |
| WEB-FS-03 | Phase 1 | — |
| WEB-FS-04 | Phase 1 | — |
| BUILD-01 | Phase 2 | — |
| BUILD-02 | Phase 2 | — |
| BUILD-03 | Phase 2 | — |
| SEC-01 | Phase 2 | — |
| SEC-02 | Phase 2 | — |

---

*Last updated: 2026-05-06 after requirements definition*
