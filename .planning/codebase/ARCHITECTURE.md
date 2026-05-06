# AionUi Architecture

> Generated: 2026-05-06

## System Overview

AionUi is a desktop AI agent application built with Electron, React 19, and TypeScript. It provides a unified interface for interacting with multiple AI providers (Claude, GPT, Gemini, Bedrock) through a plugin-based channel system (Telegram, DingTalk, Lark, WeCom, WeChat) and supports extensibility via a custom extension market. The system follows a three-process architecture (Main/Preload/Renderer) with an extensive bridge layer for IPC communication.

## Architecture Pattern

**Three-Layer Electron Architecture** with adapter-based IPC bridge system:

```
src/
├── index.ts          → Main process (Electron main, BrowserWindow)
├── preload/main.ts   → Preload script (contextBridge → ipcRenderer)
├── renderer/         → React 19 SPA (UI layer)
├── process/          → Main process modules (business logic)
└── common/           → Shared types, adapters, utilities
```

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Main | `src/index.ts` | Electron main: window creation, app lifecycle, deep-link handling, single-instance lock |
| Preload | `src/preload/main.ts` | contextBridge exposing `electronAPI` (IPC emit/on, WeChat login, WebUI auth) |
| Renderer | `src/renderer/index.html` + `src/renderer/main.tsx` | React 19 app with Arco Design, i18n, theme providers |
| Server | `src/server.ts` | Express server for `--webui` mode |

## Key Architectural Patterns

### 1. IPC Bridge System (`src/process/bridge/`, `src/common/adapter/`)
- `initAllBridges()` wires ~35 bridge modules (conversation, gemini, auth, mcp, cron, channels, etc.)
- Three adapters: `main.ts` (Electron), `browser.ts` (WebUI), `standalone.ts` (server)
- `ipcBridge` exported from `src/common/index.ts` as the unified communication layer

### 2. Agent Registry (`src/process/agent/AgentRegistry.ts`)
- Detects and manages execution engines: Gemini CLI, Aion CLI (Rust), ACP builtins, OpenClaw, Nanobot, Remote WebSocket agents, Custom ACP agents
- Seven detection sources merged and deduplicated by backend kind

### 3. Channel System (`src/process/channels/`)
- Plugin-based messaging integration: Telegram, DingTalk, Weixin, WeCom
- `ChannelManager`, `SessionManager`, `PluginManager`, `PairingService`

### 4. Extension System (`src/process/extensions/`)
- NocoBase-inspired: `ExtensionLoader`, `ExtensionRegistry`, lifecycle hooks, state persistence, sandbox isolation
- Figma-inspired: permissions analysis, engine compatibility validation
- UI protocol for dual-thread communication

### 5. Web Server (`src/process/webserver/`)
- Express + WebSocket (WSS) server for `--webui` mode
- Auth: JWT tokens, QR code login, rate limiting
- Routes: `/auth`, `/api`, `/user-settings`, static files

### 6. Database (`src/process/services/database/`)
- SQLite via `better-sqlite3` (bundled) or `bun:sqlite` (runtime detection)
- Repositories: `SqliteConversationRepository`, `SqliteAcpSessionRepository`, `SqliteChannelRepository`, `SqliteCronRepository`
- Schema migrations, streaming message buffer

### 7. Worker System (`src/process/worker/`)
- Fork-based worker tasks via `workerTaskManagerSingleton`
- Separate entry: `gemini.ts`, `lifecycleRunner.ts`

## Data Flow

### Message Flow (Channel → Agent → Response)
```
Chat Platform (Telegram/DingTalk/Lark/WeCom/WeChat)
    ↓
ChannelPlugin (src/process/channels/plugins/{platform}/)
    ↓
ChannelManager → SessionManager
    ↓
AcpAgentManager.sendMessage() → AcpSession.sendMessage()
    ↓
Bridge System (ipcBridge → renderer or direct)
    ↓
AI Provider (Claude/GPT/Gemini/Bedrock via @anthropic-ai/sdk, openai, @google/genai, @aws-sdk/client-bedrock)
    ↓
Response streamed back through bridge
    ↓
SessionManager → ChannelPlugin → Chat Platform
```

### WebUI Flow
```
Browser → Express Web Server (/auth, /api)
    ↓
JWT verification → Session lookup
    ↓
AcpSession.sendMessage() → AI Provider
    ↓
WebSocket push → Browser
```

## Build System

- **electron.vite.config.ts**: Three environments (main/preload/renderer), UnoCSS, IconPark transform plugin, Sentry source maps
- **Renderer chunks**: vendor-react, vendor-arco, vendor-markdown, vendor-editor, vendor-icons, vendor-diff, vendor-katex
- **Build builtin MCP servers** after main process bundle via `scripts/build-mcp-servers.js`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Electron main entry |
| `src/preload/main.ts` | Preload bridge |
| `src/renderer/main.tsx` | React app bootstrap |
| `src/process/bridge/` | IPC bridge modules |
| `src/process/agent/AgentRegistry.ts` | Agent detection/management |
| `src/process/channels/` | Messaging platform plugins |
| `src/process/extensions/` | Extension system |
| `src/process/webserver/` | Express + WebSocket server |
| `src/process/services/database/` | SQLite repositories |
| `src/process/worker/` | Fork-based worker tasks |
| `src/common/adapter/` | Bridge adapters |
