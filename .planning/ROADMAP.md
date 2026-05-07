# AionUi — Roadmap

> Fork: https://github.com/giovannimnz/AionUi

## Overview

**4 phases** | **11 requirements mapped** | All v2 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Fork Sync Core | Script base que detecta release e faz merge do upstream | FSYNC-01, FSYNC-02, FSYNC-03, FSYNC-04 | 4 |
| 2 | AI Decision Engine | IA analisa diffs e detecta impacto em alterações customizadas | AIDEC-01, AIDEC-02, AIDEC-03 | 3 |
| 3 | Telegram Approval Flow | Bot que recebe comandos e processa decisões de merge | TAF-01, TAF-02, TAF-03 | 3 |
| 4 | Module Packaging | Empacotar como módulo reutilizável com setup e templates | MOD-01, MOD-02, MOD-03 | 3 |

---

## Phase 1: Fork Sync Core

**Goal**: Script base que verifica upstream diariamente às 08:00, detecta nova release, e faz merge automático.

### Requirements

- [ ] FSYNC-01: Cron job diário às 08:00
- [ ] FSYNC-02: Detecta nova versão via GitHub API
- [ ] FSYNC-03: Pull + merge preservando overrides locais
- [ ] FSYNC-04: Auto commit e push

### Files to Create

```
~/fork-sync/
├── bin/
│   ├── sync.sh              # entry point
│   ├── detect-release.sh    # verifica release
│   ├── merge-upstream.sh    # merge logic
│   └── push.sh              # commit/push
├── lib/
│   ├── github.sh            # gh API wrappers
│   ├── git.sh               # git helpers
│   └── telegram.sh          # Telegram notifications
└── projects/
    └── aionui/
        └── sync.yaml        # config específico
```

### Files to Modify (AionUi repo)

- `.github/workflows/fork-sync.yml` — GitHub Actions workflow (alternativa ao cron local)

### Success Criteria

1. `~/fork-sync/bin/sync.sh aionui` executa sem erros
2. Cron job ativo (`0 8 * * *`) e logando em `~/fork-sync/logs/`
3. Detecta nova release comparando com `last_sync`
4. Merge aplica sem perder arquivos em `protected_paths`
5. Commits com prefixo `[fork-sync]` e push para origin

---

## Phase 2: AI Decision Engine

**Goal**: IA analisa conflitos e impacto antes de aplicar merge, notifica via Telegram.

### Requirements

- [ ] AIDEC-01: Detecta conflitos de merge automaticamente
- [ ] AIDEC-02: Análise de diff pela IA antes de aplicar merge
- [ ] AIDEC-03: Notificação Telegram com contexto + recomendação

### Files to Create/Modify

- `~/fork-sync/lib/ai-decision.sh` — análise de diff + chamada para Hermes Agent
- `~/fork-sync/lib/analyze-conflict.sh` — prepara contexto de conflito

### Success Criteria

1. Conflito detectado → IA recebe diff completo
2. IA retorna classificação: `approve`, `reject`, ou `needs_review`
3. Notificação Telegram enviada com: versão, arquivos impactados, diff resumido, recomendação
4. Se `approve` → merge continua automaticamente
5. Se `needs_review` → aguarda comando Telegram

---

## Phase 3: Telegram Approval Flow

**Goal**: Bot/listener Telegram processa comandos e executa ações de merge.

### Requirements

- [ ] TAF-01: Comandos `/fork-approve`, `/fork-reject`, `/fork-adjust`
- [ ] TAF-02: Processa decisão e executa ação
- [ ] TAF-03: Feedback loop com resultado

### Files to Create

- `~/fork-sync/bin/telegram-listener.sh` — polling listener para comandos
- `~/fork-sync/lib/commands.sh` — parse e execução de comandos

### Success Criteria

1. Listener recebe comandos e identifica projeto
2. `/fork-approve` → completa merge + push + notifica success
3. `/fork-reject` → aborta merge + mantém alterações locais + notifica
4. `/fork-adjust` → passa instruções para IA re-analisar
5. Resultado final enviado no Telegram após cada ação

---

## Phase 4: Module Packaging

**Goal**: Empacotar como módulo reutilizável com templates e setup rápido.

### Requirements

- [ ] MOD-01: Estrutura completa `~/fork-sync/`
- [ ] MOD-02: Template `sync.yaml` com todas opções
- [ ] MOD-03: Script `setup-project.sh` para novo fork

### Files to Create

```
~/fork-sync/
├── templates/
│   └── sync.yaml.template
└── bin/
    └── setup-project.sh
```

### Success Criteria

1. `setup-project.sh {upstream_url}` cria estrutura completa
2. `sync.yaml.template` cobre todos os cenários
3. Módulo funciona em outro projeto apenas copiando a estrutura
4. Documentação de uso (`README.md`)

---

## Phase Details

### Phase 1: Fork Sync Core

**Goal**: Script base que verifica upstream diariamente às 08:00, detecta nova release, e faz merge automático.

**Files**: `~/fork-sync/bin/*.sh`, `~/fork-sync/lib/*.sh`, `~/fork-sync/projects/aionui/sync.yaml`

**Success criteria**:
1. `~/fork-sync/bin/sync.sh aionui` executa sem erros
2. Cron job ativo (`0 8 * * *`) e logando em `~/fork-sync/logs/`
3. Detecta nova release comparando com `last_sync`
4. Merge aplica sem perder arquivos em `protected_paths`
5. Commits com prefixo `[fork-sync]` e push para origin

### Phase 2: AI Decision Engine

**Goal**: IA analisa conflitos e impacto antes de aplicar merge, notifica via Telegram.

**Files**: `~/fork-sync/lib/ai-decision.sh`, `~/fork-sync/lib/analyze-conflict.sh`

**Success criteria**:
1. Conflito detectado → IA recebe diff completo
2. IA retorna classificação: `approve`, `reject`, ou `needs_review`
3. Notificação Telegram enviada com contexto + recomendação
4. Se `approve` → merge continua automaticamente
5. Se `needs_review` → aguarda comando Telegram

### Phase 3: Telegram Approval Flow

**Goal**: Bot/listener Telegram processa comandos e executa ações de merge.

**Files**: `~/fork-sync/bin/telegram-listener.sh`, `~/fork-sync/lib/commands.sh`

**Success criteria**:
1. Listener recebe comandos e identifica projeto
2. `/fork-approve` → completa merge + push + notifica success
3. `/fork-reject` → aborta merge + mantém alterações locais + notifica
4. `/fork-adjust` → passa instruções para IA re-analisar
5. Resultado final enviado no Telegram após cada ação

### Phase 4: Module Packaging

**Goal**: Empacotar como módulo reutilizável com templates e setup rápido.

**Files**: `~/fork-sync/templates/sync.yaml.template`, `~/fork-sync/bin/setup-project.sh`, `~/fork-sync/README.md`

**Success criteria**:
1. `setup-project.sh {upstream_url}` cria estrutura completa
2. `sync.yaml.template` cobre todos os cenários
3. Módulo funciona em outro projeto apenas copiando a estrutura
4. Documentação de uso (`README.md`)

---

## Build Order

```
Phase 1 (Fork Sync Core)
    ↓
Phase 2 (AI Decision Engine)  ← pode começar após FSYNC-03
    ↓
Phase 3 (Telegram Approval)   ← depende de AIDEC-03
    ↓
Phase 4 (Module Packaging)    ← final, após todos os scripts funcionarem
```

---

*Last updated: 2026-05-06 after v2 roadmap creation*
