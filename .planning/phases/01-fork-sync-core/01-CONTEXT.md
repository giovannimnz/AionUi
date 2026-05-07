# Phase 1 Context — Fork Sync Core

> Part of: v2 — Fork Sync Engine
> Phase: 01 | Fork Sync Core

## Domain

Script base que verifica upstream diariamente às 08:00, detecta nova release via GitHub API, faz merge automático preservando overrides locais, e push para o fork.

## Decisions

### GitHub Interaction
- **Use `gh CLI`** — `gh api`, `gh repo clone`, `gh auth` já configurados no sistema
- Não usar tokens hardcoded ou curl direto — gh CLI gerencia auth automaticamente

### Merge Strategy
- **Use `git merge` (not rebase)** — preserva o branch upstream como merge commit
- Commits de merge com prefixo `[fork-sync]: `
- Evita reescrever histórico local

### Release Versioning Scheme (CRITICAL)
- **Schema**: `{upstream_version}-rf{counter}`
- **Exemplo**:
  - Upstream `v1.9.25` → Fork `v1.9.25-rf1` (primeira release)
  - Mais alterações no fork (sem nova upstream) → `v1.9.25-rf2`, `v1.9.25-rf3`, etc.
- **Contador**: Cada `upstream_version` tem seu próprio contador rf
- **Arquivo de controle**: `~/.fork-sync/{project}/versions/{upstream_version}/rf_counter`
- **Tag format**: `v{upstream_version}-rf{n}` (ex: `v1.9.25-rf1`)
- **Release GitHub**: Criada via `gh release create` com tag
- **Decisão importante**: O `-rf` é o identificador interno do fork — NUNCA é resetado a menos que upstream version mude

### Protected Paths Handling
- **Auto `git checkout --ours`** em conflitos de arquivos listados em `protected_paths`
- NÃO notifica automaticamente — override é direto
- Apenas arquivos EM `protected_paths` usam esta estratégia
- Arquivos FORA de `protected_paths` com conflito disparam AI Decision Engine (Phase 2)

### Script Structure
- **Modular** — `bin/`, `lib/`, `projects/` conforme template do MOD-01
- Entry point: `~/fork-sync/bin/sync.sh {project}`
- Suporte a múltiplos projetos via `~/fork-sync/projects/{project}/sync.yaml`

### Log Location
- `~/fork-sync/logs/sync-{project}-{YYYYMMDD}.log`
- Formato: timestamp + level (INFO/WARN/ERROR) + mensagem

### Last Sync Tracking
- Arquivo: `~/.fork-sync/{project}/last_sync`
- Conteúdo: última tag/release detectada (e.g., `v1.2.3`)
- Verificado antes de iniciar merge

## Requirements Covered

- FSYNC-01: Cron job diário às 08:00
- FSYNC-02: Detecta nova versão via GitHub API (`gh api repos/{owner}/{repo}/releases`)
- FSYNC-03: Pull + merge preservando overrides (`git checkout --ours` para protected_paths)
- FSYNC-04: Auto commit e push (`git push origin main`)

## Canonical Refs

- `.planning/REQUIREMENTS.md` — requisitos FSYNC-01 a FSYNC-04
- `.planning/ROADMAP.md` — fase 1 описана
- `~/fork-sync/` — destino final dos scripts (criar)

## Out of Scope

- AI Decision Engine (Phase 2)
- Telegram listener (Phase 3)
- Module packaging reutilizável (Phase 4)

## Deferred Ideas

(Nenhuma por enquanto — foco estrito em Phase 1)

---

*Created: 2026-05-06*
