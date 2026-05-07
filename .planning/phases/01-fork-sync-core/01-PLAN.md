# Phase 1 Plan — Fork Sync Core

> Part of: v2 — Fork Sync Engine
> Phase: 01 | Fork Sync Core

## Overview

Criar o módulo base de sincronização: estrutura de diretórios, scripts de detecção de release, merge, versioning, e cron job.

---

## Wave 1

### Task 1.1 — Criar estrutura de diretórios

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/` (novo)

**read_first:**
- `~/.fork-sync/` (se existir)

**action:**
```bash
mkdir -p ~/fork-sync/{bin,lib,projects,logs,templates}
mkdir -p ~/.fork-sync/{project}/versions
ls -la ~/fork-sync/
```

**acceptance_criteria:**
- [ ] `~/fork-sync/bin/` existe
- [ ] `~/fork-sync/lib/` existe
- [ ] `~/fork-sync/projects/` existe
- [ ] `~/fork-sync/logs/` existe
- [ ] `~/.fork-sync/` existe

---

### Task 1.2 — Criar sync.yaml do projeto AionUi

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/projects/aionui/sync.yaml` (novo)

**read_first:**
- `.planning/REQUIREMENTS.md` (FSYNC e MOD-02)
- `.planning/phases/01-fork-sync-core/01-CONTEXT.md` (decisões)

**action:**
```bash
mkdir -p ~/fork-sync/projects/aionui
cat > ~/fork-sync/projects/aionui/sync.yaml << 'EOF'
project: AionUi
upstream: https://github.com/QuantumNous/AionUi
upstream_branch: main
origin_branch: main
protected_paths:
  - src/renderer/components/workspace/WorkspaceFolderSelect.tsx
  - src/process/webserver/directoryApi.ts
merge_strategy: merge
auto_push: true
notification_level: all
ai_decision_threshold: conflicts
version_scheme:
  suffix: "-rf"
  counter_dir: "~/.fork-sync/{project}/versions/{upstream_version}"
EOF
cat ~/fork-sync/projects/aionui/sync.yaml
```

**acceptance_criteria:**
- [ ] `~/fork-sync/projects/aionui/sync.yaml` criado
- [ ] `upstream:` aponta para `https://github.com/QuantumNous/AionUi`
- [ ] `protected_paths:` inclui os 2 arquivos customizados
- [ ] `version_scheme.suffix: "-rf"`

---

### Task 1.3 — Criar lib/github.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/lib/github.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/lib/github.sh << 'LIBEOF'
#!/usr/bin/env bash
# github.sh — Funções auxiliares para interação com GitHub via gh CLI

set -euo pipefail

# Get latest release tag from upstream
get_latest_release() {
    local upstream_url="$1"
    local owner repo
    
    # Extract owner/repo from URL
    owner=$(echo "$upstream_url" | sed -n 's|.*github.com/\([^/]*\)/\([^/]*\)\.git|\1|p' | head -1)
    repo=$(echo "$upstream_url" | sed -n 's|.*github.com/\([^/]*\)/\([^/]*\)\.git|\2|p' | head -1)
    
    # Try release first, then tag
    local release=$(gh release view --repo "$owner/$repo" --json tagName --jq '.tagName' 2>/dev/null || true)
    if [ -n "$release" ]; then
        echo "$release"
        return 0
    fi
    
    # Fallback to latest tag
    local tag=$(gh api "repos/$owner/$repo/tags" --jq '.[0].name' 2>/dev/null || true)
    if [ -n "$tag" ]; then
        echo "$tag"
        return 0
    fi
    
    return 1
}

# Get current version from last_sync file
get_last_sync() {
    local project="$1"
    local last_sync_file="$HOME/.fork-sync/$project/last_sync"
    
    if [ -f "$last_sync_file" ]; then
        cat "$last_sync_file"
    fi
}

# Save last sync version
save_last_sync() {
    local project="$1"
    local version="$2"
    mkdir -p "$HOME/.fork-sync/$project"
    echo "$version" > "$HOME/.fork-sync/$project/last_sync"
}

# Create GitHub release
create_release() {
    local owner="$1"
    local repo="$2"
    local tag="$3"
    local name="$4"
    local body="$5"
    
    gh release create "$tag" \
        --repo "$owner/$repo" \
        --title "$name" \
        --notes "$body" \
        --latest
}

LIBEOF
chmod +x ~/fork-sync/lib/github.sh
echo "github.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/lib/github.sh` existe e é executável
- [ ] `get_latest_release` usa `gh release view` e `gh api repos/.../tags`
- [ ] `get_last_sync` lê de `$HOME/.fork-sync/{project}/last_sync`
- [ ] `create_release` usa `gh release create`

---

### Task 1.4 — Criar lib/git.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/lib/git.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/lib/git.sh << 'LIBEOF'
#!/usr/bin/env bash
# git.sh — Funções auxiliares para operações git

set -euo pipefail

# Fetch upstream changes
fetch_upstream() {
    local repo_path="$1"
    local upstream_url="$2"
    
    (
        cd "$repo_path"
        git remote add upstream "$upstream_url" 2>/dev/null || true
        git fetch upstream
    )
}

# Get rf counter for a specific upstream version
get_rf_counter() {
    local project="$1"
    local upstream_version="$2"
    local counter_file="$HOME/.fork-sync/$project/versions/${upstream_version}/rf_counter"
    
    if [ -f "$counter_file" ]; then
        cat "$counter_file"
    else
        echo "1"
    fi
}

# Increment and save rf counter
increment_rf_counter() {
    local project="$1"
    local upstream_version="$2"
    local counter_file="$HOME/.fork-sync/$project/versions/${upstream_version}/rf_counter"
    
    mkdir -p "$(dirname "$counter_file")"
    local current=$(get_rf_counter "$project" "$upstream_version")
    local next=$((current + 1))
    echo "$next" > "$counter_file"
    echo "$next"
}

# Check for merge conflicts
has_conflicts() {
    local repo_path="$1"
    local diff_filter=$(cd "$repo_path" && git diff --name-only --diff-filter=U 2>/dev/null || true)
    [ -n "$diff_filter" ]
}

# Get list of conflicting files
get_conflicting_files() {
    local repo_path="$1"
    cd "$repo_path" && git diff --name-only --diff-filter=U 2>/dev/null || true
}

# Checkout --ours for protected paths in case of conflict
resolve_protected_paths() {
    local repo_path="$1"
    shift
    local protected_paths=("$@")
    
    for path in "${protected_paths[@]}"; do
        if [ -f "$repo_path/$path" ] || [ -d "$repo_path/$path" ]; then
            echo "[fork-sync] Resolving $path with --ours (protected)"
            git -C "$repo_path" checkout --ours -- "$path" 2>/dev/null || true
        fi
    done
}

# Check if there are local changes to commit
has_changes() {
    local repo_path="$1"
    cd "$repo_path"
    git diff --quiet HEAD 2>/dev/null && return 1 || return 0
}

# Commit merge result
commit_merge() {
    local repo_path="$1"
    local version_tag="$2"
    
    (
        cd "$repo_path"
        git add -A
        git commit -m "[fork-sync] Merge upstream changes - $version_tag" || true
    )
}

# Push to origin
push_to_origin() {
    local repo_path="$1"
    local branch="${2:-main}"
    
    (
        cd "$repo_path"
        git push origin "$branch"
    )
}

LIBEOF
chmod +x ~/fork-sync/lib/git.sh
echo "git.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/lib/git.sh` existe e é executável
- [ ] `get_rf_counter` e `increment_rf_counter` funcionam
- [ ] `resolve_protected_paths` faz `git checkout --ours`
- [ ] `has_changes` detecta alterações pendentes

---

### Task 1.5 — Criar lib/telegram.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/lib/telegram.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/lib/telegram.sh << 'LIBEOF'
#!/usr/bin/env bash
# telegram.sh — Funções auxiliares para notificações Telegram

set -euo pipefail

# Send Telegram message via Hermes Agent send_message tool
# Note: This script is designed to be called by Hermes Agent which has the send_message tool
# In standalone mode, uses curl to Telegram Bot API

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:--1003797723446}"

send_telegram() {
    local message="$1"
    local bot_token="${TELEGRAM_BOT_TOKEN:-$BOT_TOKEN}"
    
    if [ -z "$bot_token" ]; then
        echo "[telegram] BOT_TOKEN not set, skipping notification"
        echo "$message"
        return 0
    fi
    
    curl -s -X POST "https://api.telegram.org/bot$bot_token/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$message" \
        -d "parse_mode=HTML" \
        > /dev/null 2>&1 || true
}

format_sync_notification() {
    local project="$1"
    local upstream_version="$2"
    local fork_version="$3"
    local status="$4"  # success|conflict|error
    local details="${5:-}"
    
    local emoji="✅"
    case "$status" in
        conflict) emoji="⚠️" ;;
        error) emoji="❌" ;;
    esac
    
    cat << EOF
$emoji <b>Fork Sync:</b> $project

<b>Upstream:</b> $upstream_version
<b>Fork:</b> $fork_version
<b>Status:</b> $status
${details:+
<b>Details:</b> $details}
EOF
}

LIBEOF
chmod +x ~/fork-sync/lib/telegram.sh
echo "telegram.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/lib/telegram.sh` existe e é executável
- [ ] `send_telegram` usa curl para Telegram Bot API
- [ ] `TELEGRAM_CHAT_ID` default é `-1003797723446`
- [ ] `format_sync_notification` formata mensagem HTML

---

### Task 1.6 — Criar bin/detect-release.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/bin/detect-release.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/bin/detect-release.sh << 'BINEOF'
#!/usr/bin/env bash
# detect-release.sh — Verifica se há nova release no upstream

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SOURCE_DIR/lib/github.sh"

usage() {
    echo "Usage: $0 <project_name>"
    echo "  Ex: $0 aionui"
    exit 1
}

[ $# -lt 1 ] && usage

PROJECT="$1"
SYNC_YAML="$SOURCE_DIR/projects/$PROJECT/sync.yaml"

if [ ! -f "$SYNC_YAML" ]; then
    echo "[detect] ERROR: sync.yaml not found for project: $PROJECT"
    exit 1
fi

# Load config
UPSTREAM_URL=$(grep '^upstream:' "$SYNC_YAML" | sed 's/upstream: *//')
LAST_SYNCED=$(get_last_sync "$PROJECT")
LATEST=$(get_latest_release "$UPSTREAM_URL")

if [ -z "$LATEST" ]; then
    echo "[detect] ERROR: Could not fetch latest release from $UPSTREAM_URL"
    exit 1
fi

echo "[detect] Last synced: ${LAST_SYNCED:-none}"
echo "[detect] Latest upstream: $LATEST"

if [ "$LATEST" != "$LAST_SYNCED" ]; then
    echo "NEW_RELEASE=true"
    echo "VERSION=$LATEST"
else
    echo "NEW_RELEASE=false"
    echo "VERSION=$LATEST"
fi
BINEOF
chmod +x ~/fork-sync/bin/detect-release.sh
echo "detect-release.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/bin/detect-release.sh` existe e é executável
- [ ] Retorna `NEW_RELEASE=true` ou `NEW_RELEASE=false`
- [ ] Lê upstream URL de `sync.yaml`
- [ ] Compara com `last_sync`

---

### Task 1.7 — Criar bin/merge-upstream.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/bin/merge-upstream.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/bin/merge-upstream.sh << 'BINEOF'
#!/usr/bin/env bash
# merge-upstream.sh — Executa merge do upstream para o fork

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SOURCE_DIR/lib/github.sh"
source "$SOURCE_DIR/lib/git.sh"

usage() {
    echo "Usage: $0 <project_name> <repo_path> <upstream_version>"
    echo "  Ex: $0 aionui /home/ubuntu/GitHub/forks/AionUi v1.9.25"
    exit 1
}

[ $# -lt 3 ] && usage

PROJECT="$1"
REPO_PATH="$2"
UPSTREAM_VERSION="$3"
SYNC_YAML="$SOURCE_DIR/projects/$PROJECT/sync.yaml"

# Load config
UPSTREAM_BRANCH=$(grep '^upstream_branch:' "$SYNC_YAML" | sed 's/upstream_branch: *//')
ORIGIN_BRANCH=$(grep '^origin_branch:' "$SYNC_YAML" | sed 's/origin_branch: *//')
PROTECTED_PATHS_RAW=$(grep '^protected_paths:' -A 20 "$SYNC_YAML" | grep '^  - ' | sed 's/^  - //')

# Parse protected paths into array
PROTECTED_PATHS=()
while IFS= read -r line; do
    [ -n "$line" ] && PROTECTED_PATHS+=("$line")
done <<< "$PROTECTED_PATHS_RAW"

echo "[merge] Starting merge for $PROJECT"
echo "[merge] Upstream version: $UPSTREAM_VERSION"
echo "[merge] Repo: $REPO_PATH"
echo "[merge] Branch: $ORIGIN_BRANCH"

# Fetch upstream
fetch_upstream "$REPO_PATH" "$(grep '^upstream:' "$SYNC_YAML" | sed 's/upstream: *//')"

# Merge upstream into current branch
(
    cd "$REPO_PATH"
    echo "[merge] Executing: git merge upstream/$UPSTREAM_BRANCH"
    git merge "upstream/$UPSTREAM_BRANCH" -m "[fork-sync] Merge upstream/$UPSTREAM_BRANCH"
) || {
    echo "[merge] Merge conflict detected"
    
    if has_conflicts "$REPO_PATH"; then
        CONFLICTING_FILES=$(get_conflicting_files "$REPO_PATH")
        echo "[merge] Conflicting files: $CONFLICTING_FILES"
        
        # Separate protected vs non-protected
        NON_PROTECTED_CONFLICTS=""
        for file in $CONFLICTING_FILES; do
            IS_PROTECTED=false
            for protected in "${PROTECTED_PATHS[@]}"; do
                if [ "$file" = "$protected" ]; then
                    IS_PROTECTED=true
                    break
                fi
            done
            if [ "$IS_PROTECTED" = false ]; then
                NON_PROTECTED_CONFLICTS="$NON_PROTECTED_CONFLICTS $file"
            fi
        done
        
        if [ -n "$NON_PROTECTED_CONFLICTS" ]; then
            echo "[merge] Non-protected conflicts require AI decision: $NON_PROTECTED_CONFLICTS"
            echo "NEEDS_AI_REVIEW=true"
            echo "CONFLICT_FILES=$NON_PROTECTED_CONFLICTS"
        fi
        
        # Resolve protected paths with --ours
        resolve_protected_paths "$REPO_PATH" "${PROTECTED_PATHS[@]}"
        git -C "$REPO_PATH" add -A
    fi
}

echo "[merge] Merge completed"
BINEOF
chmod +x ~/fork-sync/bin/merge-upstream.sh
echo "merge-upstream.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/bin/merge-upstream.sh` existe e é executável
- [ ] Faz `git merge upstream/$branch`
- [ ] Detecta conflitos
- [ ] `checkout --ours` em `protected_paths`
- [ ]输出 `NEEDS_AI_REVIEW=true` se conflitos não-protegidos

---

### Task 1.8 — Criar bin/create-release.sh

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/bin/create-release.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/bin/create-release.sh << 'BINEOF'
#!/usr/bin/env bash
# create-release.sh — Cria release e tag no GitHub com schema {version}-rf{n}

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SOURCE_DIR/lib/github.sh"
source "$SOURCE_DIR/lib/git.sh"

usage() {
    echo "Usage: $0 <project_name> <repo_path> <upstream_version> [fork_repo_url]"
    echo "  Ex: $0 aionui /home/ubuntu/GitHub/forks/AionUi v1.9.25 https://github.com/giovannimnz/AionUi"
    exit 1
}

[ $# -lt 3 ] && usage

PROJECT="$1"
REPO_PATH="$2"
UPSTREAM_VERSION="$3"
FORK_REPO_URL="${4:-}"

# Get or increment rf counter
RF_COUNTER=$(increment_rf_counter "$PROJECT" "$UPSTREAM_VERSION")
FORK_VERSION="${UPSTREAM_VERSION}-rf${RF_COUNTER}"
TAG_NAME="v${FORK_VERSION}"

echo "[release] Creating release: $TAG_NAME"
echo "[release] Based on upstream: $UPSTREAM_VERSION"
echo "[release] RF counter: $RF_COUNTER"

# Commit changes if any
if has_changes "$REPO_PATH"; then
    commit_merge "$REPO_PATH" "$FORK_VERSION"
    push_to_origin "$REPO_PATH"
else
    echo "[release] No changes to commit"
fi

# Create GitHub release if we have fork repo URL
if [ -n "$FORK_REPO_URL" ]; then
    OWNER=$(echo "$FORK_REPO_URL" | sed -n 's|.*github.com/\([^/]*\)/\([^/]*\)\.git|\1|p' | head -1)
    REPO=$(echo "$FORK_REPO_URL" | sed -n 's|.*github.com/\([^/]*\)/\([^/]*\)\.git|\2|p' | head -1)
    
    # Create tag
    (
        cd "$REPO_PATH"
        git tag -a "v$FORK_VERSION" -m "[fork-sync] Release $FORK_VERSION based on upstream $UPSTREAM_VERSION"
        git push origin "v$FORK_VERSION"
    )
    
    # Create release
    RELEASE_BODY="## Fork Sync Release

- Upstream version: $UPSTREAM_VERSION
- Fork version: $FORK_VERSION
- RF counter: $RF_COUNTER

Generated automatically by fork-sync."
    
    create_release "$OWNER" "$REPO" "v$FORK_VERSION" "Fork Sync $FORK_VERSION" "$RELEASE_BODY"
    echo "[release] GitHub release created: $OWNER/$REPO @ v$FORK_VERSION"
fi

# Save last sync version
save_last_sync "$PROJECT" "$UPSTREAM_VERSION"

echo "RELEASE_TAG=v$FORK_VERSION"
echo "RF_COUNTER=$RF_COUNTER"
BINEOF
chmod +x ~/fork-sync/bin/create-release.sh
echo "create-release.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/bin/create-release.sh` existe e é executável
- [ ] Schema de versão: `{upstream_version}-rf{counter}`
- [ ] `increment_rf_counter` incrementa e salva
- [ ] Cria tag `v{version}-rf{n}` e push
- [ ] `gh release create` para GitHub
- [ ] `save_last_sync` salva versão

---

### Task 1.9 — Criar bin/sync.sh (entry point)

**Type:** execute  
**Autonomous:** true  
**Files modified:** `~/fork-sync/bin/sync.sh` (novo)

**action:**
```bash
cat > ~/fork-sync/bin/sync.sh << 'BINEOF'
#!/usr/bin/env bash
# sync.sh — Entry point principal do fork-sync

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SOURCE_DIR/../logs"

usage() {
    cat << EOF
Usage: $0 <project_name> [repo_path] [--dry-run]

Examples:
  $0 aionui /home/ubuntu/GitHub/forks/AionUi
  $0 aionui /home/ubuntu/GitHub/forks/AionUi --dry-run

EOF
    exit 1
}

[ $# -lt 1 ] && usage

PROJECT="$1"
REPO_PATH="${2:-}"
DRY_RUN=false

if [ "$#" -ge 2 ] && [ "$2" = "--dry-run" ]; then
    DRY_RUN=true
    REPO_PATH="${3:-}"
elif [ "$#" -ge 3 ] && [ "$3" = "--dry-run" ]; then
    DRY_RUN=true
fi

SYNC_YAML="$SOURCE_DIR/projects/$PROJECT/sync.yaml"

if [ ! -f "$SYNC_YAML" ]; then
    echo "[sync] ERROR: sync.yaml not found for project: $PROJECT"
    echo "[sync] Expected: $SYNC_YAML"
    exit 1
fi

if [ -z "$REPO_PATH" ]; then
    echo "[sync] ERROR: repo_path required"
    usage
fi

# Setup logging
DATE=$(date +%Y%m%d)
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/sync-${PROJECT}-${DATE}.log"

log() {
    local level="$1"
    shift
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
    echo "$msg" | tee -a "$LOG_FILE"
}

log "INFO" "Starting fork-sync for project: $PROJECT"
log "INFO" "Repo path: $REPO_PATH"

# Step 1: Detect new release
log "INFO" "Checking for new releases..."
DETECT_OUTPUT=$("$SOURCE_DIR/detect-release.sh" "$PROJECT")
NEW_RELEASE=$(echo "$DETECT_OUTPUT" | grep '^NEW_RELEASE=' | cut -d= -f2)
VERSION=$(echo "$DETECT_OUTPUT" | grep '^VERSION=' | cut -d= -f2)

log "INFO" "Detection result: NEW_RELEASE=$NEW_RELEASE, VERSION=$VERSION"

if [ "$NEW_RELEASE" = "false" ]; then
    log "INFO" "No new release detected. Skipping sync."
    exit 0
fi

# Step 2: Merge upstream
log "INFO" "Merging upstream version: $VERSION"
MERGE_OUTPUT=$("$SOURCE_DIR/merge-upstream.sh" "$PROJECT" "$REPO_PATH" "$VERSION" 2>&1)
log "INFO" "Merge output: $MERGE_OUTPUT"

# Step 3: Check if AI review needed
if echo "$MERGE_OUTPUT" | grep -q "NEEDS_AI_REVIEW=true"; then
    CONFLICT_FILES=$(echo "$MERGE_OUTPUT" | grep '^CONFLICT_FILES=' | cut -d= -f2-)
    log "WARN" "Conflicts require AI review: $CONFLICT_FILES"
    log "WARN" "Phase 2 (AI Decision Engine) will handle this notification"
    # For now, we stop here - Phase 2 will resume this
    echo "SYNC_STATUS=needs_review"
    echo "CONFLICT_FILES=$CONFLICT_FILES"
    exit 0
fi

# Step 4: Create release
FORK_REPO_URL=$(grep '^upstream:' "$SYNC_YAML" | sed 's/upstream: *//' | sed 's|QuantumNous|giovannimnz|g')
log "INFO" "Creating fork release..."
RELEASE_OUTPUT=$("$SOURCE_DIR/create-release.sh" "$PROJECT" "$REPO_PATH" "$VERSION" "$FORK_REPO_URL" 2>&1)
log "INFO" "Release output: $RELEASE_OUTPUT"

RELEASE_TAG=$(echo "$RELEASE_OUTPUT" | grep '^RELEASE_TAG=' | cut -d= -f2)
RF_COUNTER=$(echo "$RELEASE_OUTPUT" | grep '^RF_COUNTER=' | cut -d= -f2)

log "INFO" "Sync completed successfully!"
log "INFO" "Fork version: $RELEASE_TAG (rf$RF_COUNTER)"

echo "SYNC_STATUS=success"
echo "RELEASE_TAG=$RELEASE_TAG"
echo "LOG_FILE=$LOG_FILE"
BINEOF
chmod +x ~/fork-sync/bin/sync.sh
echo "sync.sh criado"
```

**acceptance_criteria:**
- [ ] `~/fork-sync/bin/sync.sh` existe e é executável
- [ ] Detecta nova release via `detect-release.sh`
- [ ] Executa merge via `merge-upstream.sh`
- [ ] Cria release via `create-release.sh`
- [ ] Log em `~/fork-sync/logs/sync-{project}-{date}.log`
- [ ] Flag `--dry-run` funcional

---

### Task 1.10 — Configurar cron job

**Type:** execute  
**Autonomous:** true  
**Files modified:** crontab

**action:**
```bash
# Verify cron is available
which cron || echo "cron not installed - will configure crontab entry"

# Add cron job (daily at 08:00)
CRON_ENTRY="0 8 * * * /home/ubuntu/fork-sync/bin/sync.sh aionui /home/ubuntu/GitHub/forks/AionUi >> /home/ubuntu/fork-sync/logs/cron.log 2>&1"

# Check if already exists
(crontab -l 2>/dev/null | grep -q "fork-sync/bin/sync.sh") && {
    echo "[cron] Cron job already exists"
} || {
    (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
    echo "[cron] Cron job added: $CRON_ENTRY"
}

# Show current crontab
echo "[cron] Current crontab:"
crontab -l 2>/dev/null || echo "(empty)"
```

**acceptance_criteria:**
- [ ] Cron job `0 8 * * *` configurado
- [ ] Aponta para `/home/ubuntu/fork-sync/bin/sync.sh aionui ...`
- [ ] Log em `/home/ubuntu/fork-sync/logs/cron.log`

---

## Verification

### Must Haves (from phase goal)

1. `~/fork-sync/bin/sync.sh aionui /home/ubuntu/GitHub/forks/AionUi` executa sem erro
2. Cron job ativo (`0 8 * * *`)
3. Detecta nova release comparando com `last_sync`
4. Merge aplica sem perder arquivos em `protected_paths`
5. Commits com prefixo `[fork-sync]` e push para origin
6. Tag `v{version}-rf{n}` criada e pushada
7. Release GitHub criada via `gh release create`

### Test Scenarios

```bash
# Teste 1: Detecção (sem nova release)
~/fork-sync/bin/detect-release.sh aionui

# Teste 2: Versão atual (sem changes)
cd /home/ubuntu/GitHub/forks/AionUi && git status

# Teste 3: Help do sync
~/fork-sync/bin/sync.sh

# Teste 4: Dry run
~/fork-sync/bin/sync.sh aionui /home/ubuntu/GitHub/forks/AionUi --dry-run
```

---

## Files Created

```
~/fork-sync/
├── bin/
│   ├── sync.sh              # Entry point
│   ├── detect-release.sh    # Verifica release
│   ├── merge-upstream.sh    # Merge logic
│   └── create-release.sh    # Release + tag
├── lib/
│   ├── github.sh            # gh API wrappers
│   ├── git.sh               # git helpers
│   └── telegram.sh          # Telegram notifications
├── projects/
│   └── aionui/
│       └── sync.yaml        # Config AionUi
├── logs/
└── templates/

~/.fork-sync/
└── aionui/
    ├── last_sync
    └── versions/
        └── {version}/
            └── rf_counter
```

---

## Dependencies

- Phase 2 (AI Decision Engine) usa `~/fork-sync/lib/` para análise de diff
- Phase 3 (Telegram Approval) usa `~/fork-sync/bin/` para comandos

---

*Plan created: 2026-05-06*
*Phase: 01 — Fork Sync Core*
