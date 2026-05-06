# AionUi Code Conventions

**Date:** 2026-05-06  
**Project:** AionUi  
**Version:** 1.9.21

---

## 1. Code Style

### 1.1 Linting & Formatting

| Tool | Purpose |
|------|---------|
| **oxlint** | Linter (oxc project). Run via `npm run lint` |
| **oxfmt** | Formatter. Run via `npm run format` |

- **Lint strictness levels:**
  - `correctness`: error (mandatory)
  - `suspicious`: warn
  - `perf`: warn
  - `style`: off
  - `pedantic`: off
  - `nursery`: off

### 1.2 TypeScript Configuration

- **Target:** ES6
- **Module:** esnext with bundler resolution
- **Strictness:** `noImplicitAny: true`
- **JSX:** react (React 19)

### 1.3 Path Aliases

```json
"@/*": ["./src/*"]
"@process/*": ["./src/process/*"]
"@renderer/*": ["./src/renderer/*"]
"@worker/*": ["./src/process/worker/*"]
"@mcp/models/": ["./src/common/models"]
"@mcp/types/": ["./src/common"]
"@mcp/": ["./src/common"]
```

### 1.4 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case or original | `chatLib.ts`, `team-TaskManager.test.ts` |
| Classes | PascalCase | `TaskManager`, `TeamMcpServer` |
| Functions | camelCase | `transformMessage`, `checkUnblocks` |
| Types/Interfaces | PascalCase | `IResponseMessage`, `TeamTask` |
| Constants | camelCase or SCREAMING_SNAKE | `storageMap`, `MAX_RETRIES` |
| Test files | `*.test.ts` or `*.dom.test.ts` | `useConversations.dom.test.ts` |

### 1.5 Import Conventions

- Use `type` imports for type-only imports (enforced by `consistent-type-imports`)
- Group imports: external, internal, relative
- Use path aliases for internal imports

```typescript
// Type imports (preferred)
import type { ITeamRepository } from '@process/team/repository/ITeamRepository';
import type { TeamTask } from '@process/team/types';

// Value imports
import { TaskManager } from '@process/team/TaskManager';
```

### 1.6 License Header

Every source file should include:

```typescript
/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
```

### 1.7 ESLint Rules (oxlint)

- **no-unused-vars:** warn (ignore patterns: `^_` for args and vars)
- **no-explicit-any:** warn
- **no-empty-pattern:** warn
- **no-constant-condition:** warn
- **no-floating-promises:** error (disabled for test files)
- **no-await-thenable:** error (disabled for test files)

### 1.8 Error Handling

- Use `try/catch` for async operations
- Prefer returning `undefined` over throwing for unknown message types (with `console.warn`)
- Use `vi.spyOn(console, 'warn').mockImplementation(() => {})` to suppress expected warnings in tests

---

## 2. Project Structure

```
src/
├── common/           # Shared types, utilities, config
│   ├── adapter/       # IPC bridge adapters
│   ├── chat/          # Chat-related logic
│   ├── config/        # Configuration files
│   ├── models/        # Data models
│   ├── platform/      # Platform abstraction
│   ├── types/         # Type definitions
│   └── utils/         # Utility functions
├── process/          # Backend services (Node.js)
│   ├── acp/           # ACP protocol
│   ├── agent/         # Agent implementation
│   ├── bridge/        # IPC bridges
│   ├── channels/      # Communication channels
│   ├── extensions/    # Extension system
│   ├── services/      # Business services
│   ├── task/          # Task management
│   ├── team/          # Team functionality
│   ├── webserver/     # Express server
│   └── worker/        # Worker processes
├── renderer/         # Frontend (React)
│   ├── hooks/         # React hooks
│   ├── pages/         # Page components
│   ├── services/      # Frontend services
│   ├── styles/        # CSS/styles
│   └── utils/         # Frontend utilities
├── preload/          # Electron preload scripts
└── main/             # Electron main process
```

---

## 3. Node.js & Engine Requirements

- **Node.js:** `>=22 <25`
- **Electron:** `^37.10.3`
- **React:** `^19.1.0`
- **TypeScript:** `^5.8.3`

---

## 4. File Organization Guidelines

1. **Single responsibility:** Each file should have one primary purpose
2. **Colocation:** Keep related files together (e.g., `TaskManager.ts` and `TaskManager.test.ts`)
3. **Barrel exports:** Use `index.ts` files for public API surfaces of modules
4. **Type definitions:** Place `.d.ts` files adjacent to their implementation
