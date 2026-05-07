# AionUi — Milestones

> Fork: https://github.com/giovannimnz/AionUi

---

## v1 — Web Directory Selector + Build Pipeline

**Status**: In progress (Phase 1 not started)

**Completed**: 2026-05-06 — Initialization, requirements, roadmap

**Goal**: Enable visual directory selection on WebUI and produce production deployables.

**Requirements**: 9 total (WEB-FS-01..04, BUILD-01..03, SEC-01..02)

**Phases**:
| Phase | Name | Status |
|-------|------|--------|
| 1 | Web Directory Selector | Not started |
| 2 | Build Pipeline & Hardening | Not started |

---

## v2 — Fork Sync Engine

**Status**: Planning

**Started**: 2026-05-06

**Goal**: Módulo reutilizável de sincronização automática de fork com upstream oficial, merge automático em nova release, e intervenção de IA via Telegram para conflitos.

**Target features**:
1. Fork Sync Core — detect new upstream releases, pull changes, preserve custom overrides
2. Auto Merge/Commit/Push — automatic merge of non-conflicting changes
3. AI Decision Engine — analyze conflicts and impact, notify via Telegram
4. Approval Flow — Telegram commands to approve/reject/adjust merges
5. Reusable Module — standalone `~/fork-sync/` package usable across projects
6. Per-project Config — `sync.yaml` per fork with upstream URL, protected paths, etc.

**Trigger**: Daily at 08:00 (cron), sync+merge only when new upstream release detected

**Requirements**: 11 total (FSYNC-01..11)

**Phases**:
| Phase | Name | Status |
|-------|------|--------|
| 1 | Fork Sync Core | Not started |
| 2 | AI Decision Engine | Not started |
| 3 | Telegram Approval Flow | Not started |
| 4 | Module Packaging | Not started |

---

*Last updated: 2026-05-06 after v2 milestone initialization*
