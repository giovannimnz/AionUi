# AionUi — State

> Fork: https://github.com/giovannimnz/AionUi

## Project Status

| Field | Value |
|-------|-------|
| Status | Active — Initialization complete |
| Milestone | v1 |
| Current Phase | None (not started) |
| Last Updated | 2026-05-06 |

## Milestones

### v1 — Web Directory Selector + Build Pipeline

**Goal**: Enable visual directory selection on WebUI and produce production deployables.

**Requirements**: 9 total (4 WEB-FS, 3 BUILD, 2 SEC)

**Phases**: 2 (Coarse granularity)

| Phase | Name | Status |
|-------|------|--------|
| 1 | Web Directory Selector | Not started |
| 2 | Build Pipeline & Hardening | Not started |

## Session History

| Date | Session | Work Done |
|------|---------|-----------|
| 2026-05-06 | Initial | Codebase mapping (7 docs), project initialization, research (4 docs + SUMMARY), requirements, roadmap |

## Notes

- Fork URL: https://github.com/giovannimnz/AionUi
- WebUI hosted on Apache2 (Linux server)
- `DirectorySelectionModal` already exists and uses `/api/directory/browse`
- Key gap: `WorkspaceFolderSelect` returns text input on web instead of modal
- No new dependencies expected for Phase 1
- Phase 2 may need Apache2 deployment config updates

---

*Last updated: 2026-05-06*
