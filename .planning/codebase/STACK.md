# AionUi Tech Stack

> Generated: 2026-05-06

## Languages & Runtimes

| Category | Technology | Version |
|----------|------------|---------|
| Language | TypeScript | ^5.8.3 |
| Language | JSX/TSX | React 19 |
| Desktop Runtime | Electron | ^37.10.3 |
| Node.js | Server/Bundler | >=22 <25 |
| Bun | Server Runtime | (used for dist-server) |

## Core Frameworks

| Category | Technology | Version |
|----------|------------|---------|
| UI Framework | React | ^19.1.0 |
| UI Framework | React DOM | ^19.1.0 |
| Routing | React Router DOM | ^7.8.0 |
| Desktop Build | electron-vite | ^5.0.0 |
| Build Tool | Vite | ^6.4.1 |
| Bundler | esbuild | ^0.25.11 |

## CSS & Styling

| Category | Technology | Version |
|----------|------------|---------|
| CSS Framework | UnoCSS | ^66.3.3 |
| UI Component Library | @arco-design/web-react | ^2.66.1 |
| Icon Library | @icon-park/react | ^1.4.2 |
| Drag & Drop | @dnd-kit/core, @dnd-kit/sortable | ^6.3.1, ^10.0.0 |
| Floating UI | @floating-ui/react | ^0.27.16 |

## State & Data

| Category | Technology | Version |
|----------|------------|---------|
| Data Fetching | SWR | ^2.3.6 |
| Virtual List | react-virtuoso | ^4.18.1 |
| Class Utilities | classnames | ^2.5.1 |
| Event Emitter | eventemitter3 | ^5.0.1 |

## AI/ML Integrations

| Category | Technology | Version |
|----------|------------|---------|
| Anthropic SDK | @anthropic-ai/sdk | ^0.71.2 |
| OpenAI SDK | openai | ^5.12.2 |
| Google GenAI | @google/genai | ^1.16.0 |
| AWS Bedrock | @aws-sdk/client-bedrock | ^3.987.0 |
| MCP Protocol | @modelcontextprotocol/sdk | ^1.20.0 |
| Agent Protocol | @agentclientprotocol/sdk | ^0.18.2 |

## Databases

| Category | Technology | Version |
|----------|------------|---------|
| SQLite | better-sqlite3 | ^12.4.1 |
| SQLite (Bun) | Bun native driver | — |

## Authentication & Security

| Category | Technology | Version |
|----------|------------|---------|
| Password Hashing | bcryptjs | ^2.4.3 |
| JWT | jsonwebtoken | ^9.0.2 |
| CSRF | tiny-csrf | ^1.1.6 |
| Cookie Parsing | cookie, cookie-parser | ^1.0.2, ^1.4.7 |
| Rate Limiting | express-rate-limit | ^7.5.1 |

## Web Server

| Category | Technology | Version |
|----------|------------|---------|
| HTTP Server | Express | ^5.1.0 |
| CORS | cors | ^2.8.5 |
| WebSocket | ws | ^8.18.3 |
| File Upload | multer | ^2.1.1 |
| Serverless | bun | (dist-server) |

## Office Document Processing

| Category | Technology | Version |
|----------|------------|---------|
| Word (docx) | docx | ^9.5.1 |
| Word (docx) | mammoth | ^1.11.0 |
| Excel | xlsx-republish | ^0.20.3 |
| PowerPoint | pptx2json | ^0.0.10 |
| Document Parsing | officeparser | ^5.2.2 |

## Markdown & Documentation

| Category | Technology | Version |
|----------|------------|---------|
| Markdown Renderer | react-markdown | ^10.1.0 |
| GFM Support | remark-gfm | ^4.0.1 |
| Math Rendering | remark-math, rehype-katex | ^6.0.0, ^7.0.1 |
| Syntax Highlighting | react-syntax-highlighter | ^16.1.0 |
| Diagrams | mermaid | ^11.13.0 |

## Messaging/Chat Platforms

| Category | Technology | Version |
|----------|------------|---------|
| Telegram | grammy | ^1.39.3 |
| DingTalk Stream | dingtalk-stream | ^2.1.4 |
| Lark/Feishu | @larksuiteoapi/node-sdk | ^1.58.0 |
| WeCom | @wecom/aibot-node-sdk | ^1.0.6 |

## DevOps & Monitoring

| Category | Technology | Version |
|----------|------------|---------|
| Error Tracking | @sentry/electron | ^7.10.0 |
| Sentry Vite Plugin | @sentry/vite-plugin | ^5.1.1 |
| Logging | electron-log | ^5.4.3 |
| Auto Updates | electron-updater | ^6.6.2 |

## Testing

| Category | Technology | Version |
|----------|------------|---------|
| Unit/Integration | Vitest | ^4.0.18 |
| Coverage | @vitest/coverage-v8 | ^4.0.18 |
| E2E Testing | Playwright | ^1.58.2 |
| React Testing | @testing-library/react | ^16.3.2 |

## Code Quality

| Category | Technology | Version |
|----------|------------|---------|
| Linter | oxlint | ^1.56.0 |
| Formatter | oxfmt | ^0.41.0 |
| Git Hooks | husky | ^9.1.7 |
| Lint Staged | lint-staged | ^16.2.7 |

## Build Configuration

### Path Aliases
- `@/*` → `./src/*`
- `@process/*` → `./src/process/*`
- `@renderer/*` → `./src/renderer/*`
- `@worker/*` → `./src/process/worker/*`
- `@common/*` → `./src/common/*`

### Build Outputs
- Main process: `out/main/`
- Preload: `out/preload/`
- Renderer: `out/renderer/`
- Server: `dist-server/`

### Environment Variables Used
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `ANTHROPIC_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_PROFILE`
- `AIONUI_PORT`, `AIONUI_HOST`, `AIONUI_MULTI_INSTANCE`
- `AION_MCP_PORT`, `AION_MCP_TOKEN`
- `ALLOW_REMOTE`, `NODE_ENV`
