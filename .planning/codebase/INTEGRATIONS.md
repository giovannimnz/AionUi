# AionUi External Integrations

> Generated: 2026-05-06

## AI/LLM Providers

### Anthropic (Claude)
- **SDK**: `@anthropic-ai/sdk` (^0.71.2)
- **Usage**: AI conversation and text generation
- **Env Var**: `ANTHROPIC_API_KEY`

### OpenAI (GPT-4, GPT-4o, etc.)
- **SDK**: `openai` (^5.12.2)
- **Usage**: AI conversation and text generation

### Google Gemini
- **SDK**: `@google/genai` (^1.16.0)
- **Usage**: AI conversation and Gemini-specific features
- **File**: `src/process/worker/gemini.ts`

### AWS Bedrock
- **SDK**: `@aws-sdk/client-bedrock` (^3.987.0)
- **Usage**: Claude on AWS Bedrock, Titan, etc.
- **Env Vars**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_PROFILE`

## Agent/MCP Protocols

### Model Context Protocol (MCP)
- **SDK**: `@modelcontextprotocol/sdk` (^1.20.0)
- **Files**: `src/process/services/mcpServices/`, `src/process/team/mcp/`
- **Builtin MCP Agents**: Claude, Gemini, Codex, Qwen, Aionui, Codebuddy, Opencode

### Agent Client Protocol (ACP)
- **SDK**: `@agentclientprotocol/sdk` (^0.18.2)
- **Files**: `src/process/acp/` (infra, session, compat)

## Chat/Messaging Platforms

### Telegram
- **SDK**: `grammy` (^1.39.3)
- **Throttler**: `@grammyjs/transformer-throttler` (^1.2.1)
- **Plugin**: `src/process/channels/plugins/telegram/`

### DingTalk (Alibaba)
- **SDK**: `dingtalk-stream` (^2.1.4)
- **Plugin**: `src/process/channels/plugins/dingtalk/`

### Lark/Feishu (ByteDance)
- **SDK**: `@larksuiteoapi/node-sdk` (^1.58.0)
- **Plugin**: `src/process/channels/plugins/lark/`

### WeCom (Tencent)
- **SDK**: `@wecom/aibot-node-sdk` (^1.0.6)
- **Plugin**: `src/process/channels/plugins/wecom/`

### WeChat
- **Plugin**: `src/process/channels/plugins/weixin/`

## Databases

### SQLite
- **Primary Driver**: `better-sqlite3` (^12.4.1)
- **Alternative**: Bun's native SQLite driver
- **Schema**: `src/process/services/database/schema.ts`
- **Migrations**: `src/process/services/database/migrations.ts`
- **Repositories**:
  - `SqliteConversationRepository`
  - `SqliteAcpSessionRepository`
  - `SqliteChannelRepository`
  - `SqliteCronRepository`

## Authentication Systems

### JWT Authentication
- **Library**: `jsonwebtoken` (^9.0.2)

### Password Hashing
- **Library**: `bcryptjs` (^2.4.3)

### CSRF Protection
- **Library**: `tiny-csrf` (^1.1.6)

### Rate Limiting
- **Library**: `express-rate-limit` (^7.5.1)

## Office Document Processing

### Word Documents
- **Libraries**: `docx` (^9.5.1), `mammoth` (^1.11.0)

### Excel/Spreadsheets
- **Library**: `xlsx-republish` (^0.20.3)

### PowerPoint
- **Library**: `pptx2json` (^0.0.10)

### General Document Parsing
- **Library**: `officeparser` (^5.2.2)

## Monitoring & Error Tracking

### Sentry
- **SDK**: `@sentry/electron` (^7.10.0)
- **Vite Plugin**: `@sentry/vite-plugin` (^5.1.1)
- **Env Vars**: `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

### Electron Logging
- **Library**: `electron-log` (^5.4.3)

### Auto Updates
- **Library**: `electron-updater` (^6.6.2)

## Web Server Endpoints

### Express Server
- **Port**: Configurable via `AIONUI_PORT`
- **Features**: REST API, WebSocket support, file uploads (multer)
- **CORS**: Enabled with configurable origins

### WebSocket
- **Library**: `ws` (^8.18.3)

## Image Processing
- **Library**: `sharp` (^0.34.3)
- **Env Vars**: `AIONUI_IMG_API_KEY`, `AIONUI_IMG_BASE_URL`, `AIONUI_IMG_MODEL`, `AIONUI_IMG_PLATFORM`, `AIONUI_IMG_PROXY`

## Skill System & Plugins

### Built-in Skills
- Located in: `src/process/resources/skills/`
- **Types**: `officecli-*` skills (docx, xlsx, pitch-deck, financial-model, academic-paper, data-dashboard), `morph-ppt*`, `star-office-helper`, `story-roleplay`, `openclaw-setup`, `x-recruiter`, `mermaid`, `pdf`, `_builtin/skill-creator`

### MCP Skill Server
- **File**: `src/process/resources/builtinMcp/imageGenServer.ts`
- **Built-in MCP Agents**: ClaudeMcpAgent, GeminiMcpAgent, CodexMcpAgent, QwenMcpAgent, AionuiMcpAgent, CodebuddyMcpAgent, OpencodeMcpAgent

## Cron/Scheduled Tasks
- **Library**: `croner` (^9.1.0)
- **Files**: `src/process/services/cron/`
- **Repositories**: `SqliteCronRepository`
- **Executors**: `WorkerTaskManagerJobExecutor`, `CronService`
