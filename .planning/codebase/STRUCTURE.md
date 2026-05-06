# AionUi Directory Structure

> Generated: 2026-05-06

## Top-Level Structure

```
AionUi/
├── src/                        # Source code
│   ├── index.ts               # Electron main entry
│   ├── server.ts             # Express server (--webui mode)
│   ├── preload/               # Preload scripts
│   │   └── main.ts           # Main preload (contextBridge)
│   ├── renderer/              # React frontend
│   │   ├── index.html
│   │   ├── main.tsx           # React bootstrap
│   │   ├── pages/             # Route pages
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # Renderer services
│   │   └── styles/             # CSS/styles
│   ├── process/               # Main process (Node.js backend)
│   │   ├── index.ts           # Process entry
│   │   ├── agent/             # Agent implementations
│   │   ├── bridge/            # IPC bridge modules
│   │   ├── channels/          # Messaging platform plugins
│   │   ├── extensions/        # Extension system
│   │   ├── resources/         # Skills, assistants, builtin MCP
│   │   ├── services/          # Database, cron, etc.
│   │   ├── task/              # Task management
│   │   ├── team/              # Team features, MCP
│   │   ├── utils/             # Utilities
│   │   ├── webserver/         # Express + WebSocket server
│   │   ├── worker/            # Fork-based workers
│   │   ├── acp/               # Agent Client Protocol
│   │   └── pet/                # PET (Prompt Engineering Toolkit?)
│   ├── common/                # Shared types and adapters
│   │   ├── adapter/           # Bridge adapters (main, browser, standalone)
│   │   ├── config/            # i18n, theme config
│   │   ├── types/             # Shared TypeScript types
│   │   └── utils/             # Common utilities
│   └── types.d.ts             # Global type declarations
├── docs/                      # Project documentation
│   ├── architecture/          # Architecture decision records
│   ├── specs/                 # Specifications (ACP, extensions, etc.)
│   ├── contributing/          # Contributing guidelines
│   └── ...
├── tests/                     # Test suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── bench/
├── scripts/                   # Build and utility scripts
├── out/                       # Build output
│   ├── main/
│   ├── preload/
│   └── renderer/
├── dist-server/               # Server build output
├── electron.vite.config.ts    # Main build config
├── uno.config.ts              # UnoCSS config
├── vitest.config.ts           # Test config
├── package.json
└── tsconfig.json
```

## Key Directories

### `src/process/agent/`
Agent implementations. Key files:
- `AgentRegistry.ts` — Detects and manages all available agents
- `aionrs/envBuilder.ts` — AionRS Rust agent
- `gemini/cli/` — Gemini CLI integration
- `acp/` — ACP protocol implementation
- `openclaw/index.ts` — OpenClaw agent

### `src/process/channels/`
Messaging platform integration. Structure:
```
channels/
├── ChannelManager.ts     # Manages all channel instances
├── SessionManager.ts    # Manages user sessions per channel
├── PluginManager.ts     # Loads/discovers channel plugins
├── PairingService.ts    # Device pairing for WebUI
└── plugins/             # Per-platform plugins
    ├── telegram/
    ├── dingtalk/
    ├── lark/
    ├── wecom/
    └── weixin/
```

### `src/process/extensions/`
Extension market system. Key files:
- `ExtensionLoader.ts` — Loads extensions from disk/remote
- `ExtensionRegistry.ts` — Extension state management
- `sandbox/sandboxWorker.ts` — Sandboxed worker for extension execution
- `resolvers/ChannelPluginResolver.ts` — Resolves channel plugin extensions

### `src/process/webserver/`
Express + WebSocket server for `--webui` mode.
- JWT auth, QR code login, rate limiting
- Routes: `/auth`, `/api`, `/user-settings`

### `src/process/services/database/`
SQLite repositories:
- `SqliteConversationRepository` — Conversation persistence
- `SqliteAcpSessionRepository` — ACP session persistence
- `SqliteChannelRepository` — Channel state
- `SqliteCronRepository` — Scheduled task persistence
- `schema.ts` — Database schema
- `migrations.ts` — Migration runner

### `src/renderer/pages/`
React Router pages:
- `conversation/` — Chat interface
- `settings/` — App settings
- `extensions/` — Extension management
- `team/` — Team features

### `src/process/resources/`
Bundled skills and assistants:
```
resources/
├── skills/                    # Built-in skills (officecli-*, morph-ppt, etc.)
├── builtinMcp/               # Built-in MCP servers
└── assistants/               # Assistant presets
```

### `src/common/adapter/`
Bridge adapters for different runtime contexts:
- `main.ts` — Electron main process adapter
- `browser.ts` — WebUI/browser adapter
- `standalone.ts` — Standalone server adapter

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `Button.tsx`, `Modal.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Hooks | camelCase + `use` prefix | `useTheme.ts` |
| Constants | camelCase | `constants.ts` |
| Types | camelCase | `types.ts` |
| Style files | kebab-case or `ComponentName.module.css` |
| Process modules | camelCase | `signalProcessor.ts` |
| Python modules | snake_case | `divap.py` |
| Test files | `*.test.ts` or `*.dom.test.tsx` |

## Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@process/*` | `src/process/*` |
| `@renderer/*` | `src/renderer/*` |
| `@worker/*` | `src/process/worker/*` |
| `@common/*` | `src/common/*` |
