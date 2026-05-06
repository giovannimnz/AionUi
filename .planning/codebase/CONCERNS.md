# AionUi — Codebase Concerns

> Generated: 2026-05-06

## 1. ACP Rewrite — acp_session Persistence Disabled

**Severity:** High | **Status:** Known, documented

The `acp_session` database table has all write operations commented out. Persistence cannot be restored until two problems are resolved:

### 1.1 agent_id Semantic Error
`typeBridge.ts` sets `agentId = old.id` (the conversation_id), so `acp_session` stores the same value for both `conversation_id` and `agent_id` columns. The `agent_id` column should identify the agent implementation (e.g., `"claude"`, `"ext:my-extension:adapter-1"`), not the conversation.

**Files affected:**
- `src/process/acp/compat/typeBridge.ts:97` — `agentId: old.id`
- `src/process/acp/types.ts` — `AgentConfig.agentId` field definition

**Fix:** Use `old.extra?.customAgentId ?? old.backend` instead of `old.id`.

### 1.2 acp_session Has No Read Consumers
`IAcpSessionRepository` defines read methods (`getSession`, `getSuspendedSessions`) that are never called. The table has writes but no reads — currently dead code.

**Files with commented persistence code (all marked `TODO(ACP Discovery)`):**
- `src/process/acp/compat/AcpAgentV2.ts` — constructor param, upsert, updateSessionId, updateStatus, deleteSession
- `src/process/acp/runtime/AcpRuntime.ts` — constructor param, upsert, delete, touchLastActive, updateSessionId, updateSessionConfig, persistStatus

---

## 2. Extension System — Security Gaps

**Severity:** High | **Market blocker**

### 2.1 Runtime Permission Enforcement Not Implemented
The extension manifest declares permissions (`storage`, `network`, `shell`, `filesystem`, `clipboard`, `activeUser`, `events`) but **no enforcement exists at runtime**. Extensions can access undeclared capabilities.

**Status:** P0 market blocker.

**Evidence:**
- `src/process/extensions/sandbox/sandboxWorker.ts:24` — TODO: "Enforce remaining declared permissions at runtime"
- `docs/specs/extension-market/research/security-model.md:28` — "RuntimeEnforce — TODO (P2)"

### 2.2 ChannelPlugin Runs in Main Process
`ChannelPluginResolver.ts:158` runs channel plugin code in the Electron main process with full Node.js + Electron privileges, instead of inside a sandboxed Worker Thread.

```typescript
// TODO: Migrate to SandboxHost (Worker Thread) instead of running in main process.
```

### 2.3 Path Safety — Symlink Not Resolved
`isPathWithinDirectory()` checks logical paths but does not call `fs.realpathSync()`. A symlink inside an extension directory could point outside the sandbox boundary.

### 2.4 Extension Market Gaps
- Extension developer Wiki not written
- `ExtensionStorage` implemented but not connected to sandbox API handlers
- `onUIMessage` IPC bridge from worker to renderer not implemented
- Network filtering (allowedDomains) only declared, not enforced

### 2.5 macOS Entitlements — Disabled Security Flags
`entitlements.plist` contains flags that reduce macOS security protections. These are likely needed for Electron/Node.js integration but represent a significant attack surface.

---

## 3. File References — Binary Content Sent as Unicode Escape

**Severity:** High

When a user sends an image or binary file, the content is read and concatenated into a text message as raw bytes converted to `\u0000\u0002...` unicode escape sequences. The agent receives a text block with what looks like binary garbage, not an image.

**Root cause:** File references use pure text blocks instead of SDK `ContentBlock` types (`file`, `image`).

**Files in send chain:** renderer file collection → IPC → `AcpAgentManager.sendMessage` → `AcpSession.sendMessage`

---

## 4. tool_call Incremental Update — Shallow Merge Loses Data

**Severity:** Medium

`src/renderer/pages/conversation/Messages/hooks.ts:137` — SDK's `tool_call_update` is incremental. The renderer does a shallow spread which loses the initial `tool_call` fields (`title`, `kind`, `rawInput`).

```typescript
// TODO(acp-rewrite): When AcpAgentV2 compat layer is removed, change the merge below
// to deep-merge content.update instead of shallow-spreading content.
```

**Fix:** Renderer must deep merge `tool_call_update` into existing `tool_call` state.

---

## 5. Type Safety — Missing ts-pattern, Unsafe Casts

### 5.1 Switch Statements Not Exhaustive
`src/renderer/hooks/chat/useSendBoxDraft.ts:77, 137` — Two switch statements handle `Draft._type` but explicitly note `// TODO import ts-pattern for exhaustive check`. Adding a new `Draft` variant will not produce a compile-time error.

### 5.2 Widespread `as any` Casts
Multiple files use `as any` to suppress type errors:
- `src/renderer/components/layout/Layout.tsx:504` — spread into ArcoLayout
- `src/renderer/components/media/WebviewHost.tsx:99` — webviewRef cast
- `src/renderer/components/layout/PwaPullToRefresh.tsx:50-53` — scrollTop access
- `src/renderer/pet/pet.d.ts:17-22` — PetConfirmAPI interface uses `any`

---

## 6. officecli Skill — Documented Fragile Areas

### 6.1 DOCX
- `--prop shd.fill=XXXXXX` emits `<w:shd>` without required `w:val` attribute
- `ind.firstLine=` dotted form emits `<w:ind>` in wrong position after `<w:jc>`
- `border.bottom=...` on table cells emits `<w:tcBorders>` in wrong position
- Page number field not properly implemented
- Multi-line cells via `\n` literal don't work
- Files open in Word produce schema errors — must close first

### 6.2 PPTX
- `chartType=pareto` produces invalid XML — must use `column` or `boxWhisker` instead
- Empty brackets in chart titles must never appear
- Shapes must not overflow 16:9 slide boundaries

### 6.3 XLSX
- `###` in cells means column is too narrow
- Charts anchored over empty cells look broken
- Pie/doughnut slices with same color are unreadable

---

## 7. Claude Session Fork — Workaround Implementation

**Severity:** Medium

`src/process/acp/infra/ProcessAcpClient.ts:185` — Claude does not support the standard ACP `session/fork` method. Falls back to `session/new` with Claude-specific `_meta.claudeCode.options.resume`.

```typescript
// TODO(acp-fork): The current implementation is a workaround.
```

---

## 8. Openclaw Permission Cache Not Persisted

**Severity:** Low-Medium

`src/process/agent/openclaw/index.ts:261` — "Always allow" permission decisions are cached in memory but not written to a persistent store.

```typescript
// TODO: Store in approval store
```

---

## 9. Test Coverage — Zero Enforcement

**Severity:** Informational

`tests/vitest.config.ts` — All coverage thresholds are set to 0. The testing conventions acknowledge this. All new files require "appropriate tests" per convention, but there is no automated enforcement.

---

## Summary Table

| Area | Severity | Blocker |
|------|----------|---------|
| acp_session persistence disabled | High | Yes |
| agent_id semantic error | High | Yes |
| Extension runtime permission enforcement | High | Yes (market) |
| ChannelPlugin in main process | High | Yes |
| File refs as unicode escape text | High | No |
| tool_call shallow merge | Medium | No |
| ts-pattern not used | Medium | No |
| `as any` casts | Medium | No |
| officecli broken command forms | Medium | No |
| Claude session/fork workaround | Medium | No |
| openclaw permission cache not persisted | Low-Medium | No |
| macOS relaxed entitlements | Low | No |
| Test coverage zero threshold | Informational | No |
