# AionUi — State

> Fork: https://github.com/giovannimnz/AionUi

## Project Status

| Field | Value |
|-------|-------|
| Status | Active — Milestone v2 started |
| Milestone | v2 — Fork Sync Engine |
| Current Phase | Phase 1 — Fork Sync Core (COMPLETE) |
| Last Updated | 2026-05-06 |

## Milestones

### v2 — Fork Sync Engine

**Goal**: Módulo reutilizável de sincronização automática de fork com upstream oficial — verificação diária às 08:00, merge automático ao detectar nova release, e intervenção de IA via Telegram para conflitos.

**Requirements**: 11 total (FSYNC-01 a FSYNC-11)

**Phases**: 4

| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork Sync Core | Complete |
| 2 | AI Decision Engine | Not started |
| 3 | Telegram Approval Flow | Not started |
| 4 | Module Packaging | Not started |

### v1 — Web Directory Selector + Build Pipeline

**Status**: In progress (Phase 1 not started)

| Phase | Name | Status |
|-------|------|--------|
| 1 | Web Directory Selector | Not started |
| 2 | Build Pipeline & Hardening | Not started |

## Session History

| Date | Session | Work Done |
|------|---------|-----------|
| 2026-05-06 | Initial | Codebase mapping, project initialization, research, requirements, roadmap |
| 2026-05-06 | v2 init | Fork Sync Engine milestone initialized |
| 2026-05-07 | Phase 1 | Fork Sync Core implemented + validated |

## Notes

- Fork URL: https://github.com/giovannimnz/AionUi
- Upstream official: https://github.com/iOfficeAI/AionUi
- gh CLI disponível na máquina ubuntu
- Telegram: Atius Capital Group (chat_id=-1003797723446)
- Cron: `0 8 * * *` (diário às 08:00)
- Sync só dispara merge quando nova release é detectada no upstream

---

*Last updated: 2026-05-07*
