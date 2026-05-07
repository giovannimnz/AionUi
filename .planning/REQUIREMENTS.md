# AionUi — Requirements

> Fork: https://github.com/giovannimnz/AionUi

## v2 Requirements

### Fork Sync Core (FSYNC)

- [ ] **FSYNC-01**: Cron job diário às 08:00 que executa o script de verificação
  - Configurado via `crontab -e` ou cron tool
  - Log de execução em `~/fork-sync/logs/sync-{project}-{date}.log`
  - Não envia notificação se não houver nova release

- [ ] **FSYNC-02**: Detecta nova versão/release no upstream via GitHub API
  - Usa `gh api` para buscar tags e releases do repositório upstream
  - Compara com última versão processada (armazenada em `~/.fork-sync/{project}/last_sync`)
  - Detecta tanto releases formais (GitHub Releases) quanto tags novas

- [ ] **FSYNC-03**: Pull das changes upstream com merge preservando overrides locais
  - `git fetch upstream`
  - `git merge upstream/main` (ou branch configurado)
  - Arquivos em `protected_paths` no `sync.yaml` são preservados via `git checkout --ours` em caso de conflito
  - Marca commits de merge com prefixo `[fork-sync]`

- [ ] **FSYNC-04**: Auto commit e push para branch do fork
  - Commits only if there are changes after merge
  - Push para `origin/main` (ou branch configurado)
  - Usa `gh auth` token do sistema (sem hardcoded credentials)

---

### AI Decision Engine (AIDEC)

- [ ] **AIDEC-01**: Detecta conflitos de merge automaticamente
  - Após `git merge`, verifica `git diff --name-only --diff-filter=U`
  - Se há arquivos em conflito que NÃO estão em `protected_paths` → aciona intervenção IA
  - Se há arquivos em conflito EM `protected_paths` → usa estratégia de override configurada

- [ ] **AIDEC-02**: Análise de diff pela IA antes de aplicar merge
  - Prepara contexto: diff completo, arquivos modificados, histórico de commits
  - Envia para Hermes Agent (via send_message ou cron job com contexto)
  - IA retorna: `approve`, `reject`, ou `needs_review` com justificativa

- [ ] **AIDEC-03**: Notificação via Telegram quando há impacto ou conflito
  - Monta mensagem com: projeto, versão upstream, arquivos impactados, diff resumido
  - Inclui recomendação da IA (approve/reject/adjust)
  - Inclui comandos: `/fork-approve`, `/fork-reject`, `/fork-adjust`
  - Só envia se `needs_review` ou conflito em `protected_paths`

---

### Telegram Approval Flow (TAF)

- [ ] **TAF-01**: Bot/listener Telegram recebe comandos de approval
  - Polling ou webhook configurável
  - Comandos: `/fork-approve`, `/fork-reject`, `/fork-adjust [instruções]`
  - Identifica projeto pelo contexto da conversa (ou prefixo: `/fork-approve aionui`)

- [ ] **TAF-02**: Processa decisão do usuário e executa ação
  - `approve` → completa o merge, commit, push
  - `reject` → aborta merge, notifica no Telegram
  - `adjust` → aplica instruções via IA, re-analisa, notifica resultado

- [ ] **TAF-03**: Feedback loop — resultado do merge notificado no Telegram
  - Success: "✅ Merge completo! Versão X.Y.Z applied"
  - Conflict: "⚠️ Conflito em {files}. aguardando sua decisão"
  - Rejected: "🛑 Merge abortado. Suas alterações mantidas."

---

### Module Packaging (MOD)

- [ ] **MOD-01**: Módulo reutilizável em `~/fork-sync/`
  - Estrutura de diretórios:
    ```
    ~/fork-sync/
    ├── bin/
    │   ├── sync.sh              # entry point principal
    │   ├── detect-release.sh    # verifica nova release
    │   ├── merge-upstream.sh    # executa merge
    │   └── push.sh              # commit e push
    ├── lib/
    │   ├── github.sh            # funções gh API
    │   ├── git.sh               # funções git
    │   └── telegram.sh          # funções Telegram
    ├── projects/
    │   └── {project}/
    │       └── sync.yaml        # config por projeto
    ├── logs/
    └── templates/
        └── sync.yaml.template
    ```

- [ ] **MOD-02**: Config por projeto (`sync.yaml`)
  ```yaml
  project: AionUi
  upstream: https://github.com/QuantumNous/AionUi
  upstream_branch: main
  origin_branch: main
  protected_paths:
    - src/renderer/components/workspace/WorkspaceFolderSelect.tsx
    - src/process/webserver/directoryApi.ts
  merge_strategy: rebase  # or merge
  auto_push: true
  notification_level: all  # all | conflicts | none
  ai_decision_threshold: conflicts  # always | conflicts | never
  ```

- [ ] **MOD-03**: Comando de setup rápido para novo fork
  - `~/fork-sync/bin/setup-project.sh {upstream_url}`
  - Clona repo, cria `sync.yaml`, adiciona remote upstream
  - Gera crontab entry opcional

---

## v3 Requirements (Deferred)

- [ ] **MULTI-FORK-01**: Sincronizar múltiplos forks em paralelo
- [ ] **DRY-RUN-01**: Modo dry-run para testar sem aplicar mudanças
- [ ] **ROLLBACK-01**: Rollback para versão anterior do fork em caso de problema
- [ ] **WEBUI-01**: Dashboard web para monitorar status de todos os forks

---

## Out of Scope

| Exclusion | Reason |
|-----------|--------|
| Sync bidirecional (push para upstream) | Apenas fork → upstream (pull only) |
| Autenticação customizada (sem gh auth) | Usa gh CLI que já gerencia tokens |
| GitLab/Bitbucket | Apenas GitHub por enquanto |
| Merge strategy diferente de rebase/merge | Apenas这两个 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FSYNC-01 | Phase 1 | — |
| FSYNC-02 | Phase 1 | — |
| FSYNC-03 | Phase 1 | — |
| FSYNC-04 | Phase 1 | — |
| AIDEC-01 | Phase 2 | — |
| AIDEC-02 | Phase 2 | — |
| AIDEC-03 | Phase 2 | — |
| TAF-01 | Phase 3 | — |
| TAF-02 | Phase 3 | — |
| TAF-03 | Phase 3 | — |
| MOD-01 | Phase 4 | — |
| MOD-02 | Phase 4 | — |
| MOD-03 | Phase 4 | — |

---

*Last updated: 2026-05-06 after v2 requirements definition*
