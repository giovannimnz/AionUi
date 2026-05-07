# AionUi Fork — by Atius

> **Original:** [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi)

Fork do AionUi com customizações para deployment em produção e integração com Hermes Agent via ACP (Agent Client Protocol).

---

## O que diferencia este fork

### 🌐 Web Directory Selection
Seletor visual de diretório (pasta) na WebUI — não precisa digitar caminho manualmente. Implementação completa com modal de navegação, validação server-side e suporte a múltiplas plataformas (desktop + web).

### 🎨 Server-side Theme Persistence
Persistência de tema (claro/escuro) no servidor. Elimina o "flash" de tema na carga inicial da página.

### 🔧 Network & Deployment Configs
Configurações ajustadas para deployment em servidor Linux com Apache2 proxy reverso:
- `host: 0.0.0.0` para aceitar conexões externas
- `allowedHosts` configurado para produção
- Service Worker com cache inteligente e exclusão de `/_next`

### 📦 PM2 Deployment
Configs prontas para deployment com PM2:
- `ecosystem.config.js` — Electron desktop
- `ecosystem.aionui-web.config.js` — WebUI server

### 🤖 Hermes Agent Integration
Integração completa com Hermes Agent via ACP:
- Skills (180+) carregadas automaticamente
- Slash commands funcionais
- ACP adapter customizado em `~/.hermes/hermes-agent/acp_adapter/server.py`

---

## Quick Start

```bash
# Dependências
bun install

# Development
bun run dev

# Build Web (Apache2)
bun run build:renderer:web
bun run build:server

# Build Desktop (Electron)
bun run build:electron

# Start WebUI em produção
pm2 start ecosystem.aionui-web.config.js
```

---

## Estrutura de Customizações

Todas as customizações são protegidas contra sobrescrita por upstream merge via `fork-sync`:

```
protected_paths:
  # Web Directory Selection
  - src/renderer/components/workspace/WorkspaceFolderSelect.tsx
  - src/renderer/pages/guid/components/GuidActionRow.tsx
  - src/renderer/components/settings/DirectorySelectionModal.tsx
  - src/process/webserver/directoryApi.ts
  - tests/unit/renderer/components/WorkspaceFolderSelect.dom.test.tsx

  # Theme Persistence
  - src/renderer/hooks/system/useTheme.ts
  - src/process/webserver/routes/staticRoutes.ts
  - src/process/services/UserSettingsService.ts
  - src/process/webserver/routes/userSettingsRoutes.ts
  - src/process/webserver/setup.ts
  - src/process/webserver/index.ts

  # API Route Refactor
  - src/process/webserver/routes/apiRoutes.ts

  # Network/Deployment
  - electron.vite.config.ts
  - public/sw.js
  - ecosystem.aionui-web.config.js
  - ecosystem.config.js
  - start-aionui.sh

  # Documentation
  - HERMES.md
```

---

## Fork Sync

Este fork é sincronizado automaticamente com o upstream `iOfficeAI/AionUi` diariamente às 08:00 via `fork-sync`.

**Pipeline:**
1. Detecta nova release no upstream via GitHub API
2. Faz merge preservando customizações (`protected_paths` usa `--ours`)
3. Cria release com schema `{upstream_version}-rf{n}`
4. Notifica via Telegram em caso de conflitos

Ver: `.planning/` para documentação completa do projeto.

---

## Agradecimento

Agradecemos profundamente à equipe do **AionUi** por criar e manter este projeto excepcional. O AionUi representa o melhor do software livre — uma ferramenta que empodera desenvolvedores a ter controle total sobre seus agentes de IA, com flexibilidade para personalizar cada aspecto da experiência.

A arquitetura do projeto, a qualidade do código e a visão de longo prazo foram fontes de inspiração constante para este fork. Estamos honrados em poder contribuir com a comunidade.

**Obrigado por fazerem isso possível.**

---

## Links

| Recurso | URL |
|---------|-----|
| Este Fork | https://github.com/giovannimnz/AionUi |
| Original | https://github.com/iOfficeAI/AionUi |
| Documentação | [.planning/](.planning/) |
| Hermes Agent | [nosyresearch/Hermes](https://github.com/nosyresearch/Hermes) |

---

*Fork mantenido por Atius — 2026*
