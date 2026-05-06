# AionUi Testing Conventions

**Date:** 2026-05-06  
**Project:** AionUi  
**Version:** 1.9.21

---

## 1. Test Framework

| Framework | Purpose |
|-----------|---------|
| **Vitest** | Unit and integration tests |
| **Playwright** | End-to-end (E2E) tests |
| **Testing Library** | React component/hook testing |
| **@vitest/coverage-v8** | Code coverage with V8 provider |

---

## 2. Test Commands

```bash
npm test                 # Run all unit tests (vitest run)
npm run test:watch       # Watch mode (vitest)
npm run test:coverage    # Run with coverage report
npm run test:contract    # Run contract tests
npm run test:integration # Run integration tests
npm run test:e2e        # Run Playwright E2E tests
npm run bench            # Run benchmarks
npm run bench:db         # Database benchmarks (bun)
```

---

## 3. Test Organization

```
tests/
├── unit/                # Unit tests
│   ├── *.test.ts        # Node environment tests
│   └── *.dom.test.tsx   # DOM/jsdom environment tests (React)
├── integration/         # Integration tests
├── e2e/                 # Playwright E2E tests
│   ├── specs/           # E2E spec files
│   └── features/        # Feature-specific tests
├── bench/               # Benchmark tests
├── regression/           # Regression tests
└── fixtures/             # Test data and fixtures
```

---

## 4. Vitest Configuration

### 4.1 Environment Projects

Vitest uses two environments:

| Project | Environment | Include Patterns |
|---------|-------------|-----------------|
| **node** | `node` | `tests/unit/**/*.test.ts`, `tests/unit/**/test_*.ts`, `tests/integration/**/*.test.ts`, `tests/regression/**/*.test.ts` |
| **dom** | `jsdom` | `tests/unit/**/*.dom.test.ts`, `tests/unit/**/*.dom.test.tsx` |

### 4.2 Setup Files

- **Node setup:** `tests/vitest.setup.ts` - Registers platform services, mocks Electron APIs
- **DOM setup:** `tests/vitest.dom.setup.ts` - Extends setup with React Testing Library, ResizeObserver, IntersectionObserver, localStorage mocks

### 4.3 Test Timeout

- **Default timeout:** 10000ms

### 4.4 Coverage Configuration

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'text-summary', 'html', 'lcov'],
  reportsDirectory: './coverage',
  include: ['src/**/*.{ts,tsx}', 'scripts/prepareBundledBun.js'],
  exclude: [
    'src/**/*.d.ts',
    'src/index.ts',
    'src/preload.ts',
    'src/common/utils/shims/**',
    'src/common/types/**',
    'src/renderer/**/*.json',
    'src/renderer/**/*.svg',
    'src/renderer/**/*.css',
  ],
  thresholds: {
    statements: 0,
    branches: 0,
    functions: 0,
    lines: 0,
  },
}
```

---

## 5. Test File Naming

| Pattern | Environment | Example |
|---------|-------------|---------|
| `*.test.ts` | Node | `transformMessage.test.ts` |
| `*.dom.test.ts` | jsdom/DOM | `useConversations.dom.test.ts` |
| `*.dom.test.tsx` | jsdom/DOM (React) | `team-permission-badge.dom.test.tsx` |
| `test_*.ts` | Node | `test_parser.ts` |

---

## 6. Mocking Patterns

### 6.1 Electron API Mock

```typescript
// In vitest.setup.ts or vitest.dom.setup.ts
(global as any).electronAPI = {
  emit: noop,
  on: () => {},
  windowControls: {
    minimize: noop,
    maximize: noop,
    unmaximize: noop,
    close: noop,
    isMaximized: () => Promise.resolve(false),
    onMaximizedChange: (): (() => void) => () => void 0,
  },
};
```

### 6.2 React Hook Mocks

```typescript
vi.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

vi.mock('../../src/renderer/hooks/context/ConversationHistoryContext', () => ({
  useConversationHistoryContext: () => ({
    conversations: [],
    isConversationGenerating: () => false,
    setActiveConversation: mockSetActiveConversation,
  }),
}));
```

### 6.3 Mocking with `vi.fn()` and `vi.spyOn()`

```typescript
// Creating mock functions
const mockFn = vi.fn();

// Mocking repository methods
vi.mocked(repo.createTask).mockResolvedValue(createdTask);

// Spying on console methods
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('message'));
warnSpy.mockRestore();
```

### 6.4 Mocking Platform Services

```typescript
import { registerPlatformServices } from '../src/common/platform';
import { NodePlatformServices } from '../src/common/platform/NodePlatformServices';
registerPlatformServices(new NodePlatformServices());
```

### 6.5 Shared Reference for Hoisted Mocks

```typescript
// Use a shared object so mock factory can access latest value
const testState = { sections: [] as TimelineSection[] };

vi.mock('../../src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync', () => ({
  useConversationListSync: () => ({
    conversations: [],
    timelineSections: testState.sections,
  }),
}));
```

---

## 7. Test Structure Patterns

### 7.1 Helper Functions (Factory Pattern)

```typescript
function makeTask(overrides: Partial<TeamTask> = {}): TeamTask {
  return {
    id: 'task-1',
    teamId: 'team-1',
    subject: 'Do something',
    status: 'pending',
    blockedBy: [],
    blocks: [],
    metadata: {},
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeRepo(): ITeamRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    // ...
  } as unknown as ITeamRepository;
}
```

### 7.2 Describe Blocks Organization

```typescript
describe('TaskManager', () => {
  let repo: ITeamRepository;
  let taskManager: TaskManager;

  beforeEach(() => {
    repo = makeRepo();
    taskManager = new TaskManager(repo);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a task with auto-generated ID', async () => {
      // test implementation
    });
  });

  describe('update', () => {
    // nested describe blocks
  });
});
```

### 7.3 Testing Async Operations

```typescript
it('creates a task with auto-generated ID', async () => {
  const createdTask = makeTask({ id: 'generated-id' });
  vi.mocked(repo.createTask).mockResolvedValue(createdTask);

  const result = await taskManager.create({
    teamId: 'team-1',
    subject: 'Do something',
  });

  expect(repo.createTask).toHaveBeenCalledOnce();
  expect(result).toBe(createdTask);
});
```

### 7.4 Testing React Hooks with renderHook

```typescript
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useConversations());
await act(async () => {});

act(() => {
  result.current.handleToggleWorkspace('/ws/a');
});

expect(result.current.expandedWorkspaces).toContain('/ws/a');
```

---

## 8. Assertion Patterns

### 8.1 Common Assertions

```typescript
expect(result).toBeDefined();
expect(result).toBe(expectedValue);
expect(result).toEqual(expect.objectContaining({ key: value }));
expect(fn).toHaveBeenCalledOnce();
expect(fn).toHaveBeenCalledWith(arg1, arg2);
expect(array).toHaveLength(2);
expect(array).toEqual(expect.arrayContaining(['a', 'b']));
```

### 8.2 Async Assertions

```typescript
await expect(taskManager.create(params)).resolves.toEqual(expectedTask);
await expect(Promise.all([promise1, promise2])).resolves.toEqual([result1, result2]);
```

---

## 9. E2E Testing with Playwright

### 9.1 Playwright Config

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  // ...
});
```

### 9.2 E2E Test Commands

```bash
npm run test:e2e                                    # Run all E2E tests
npm run test:e2e:conv:acp                           # Run ACP conversation tests
npm run test:e2e:team                               # Run team E2E tests
npm run test:e2e:team:create                       # Run team creation E2E
npm run test:e2e:team:lifecycle                    # Run team lifecycle E2E
```

---

## 10. Coverage Expectations

Current coverage thresholds are set to 0 (informational). The goal is to increase coverage across all files over time. New files should include appropriate tests.

**Excluded from coverage:**
- Type declaration files (`.d.ts`)
- Electron entry points (`src/index.ts`, `src/preload.ts`)
- Shims/polyfills
- Static assets (SVG, CSS, JSON)
- Type-only files

---

## 11. Best Practices

1. **Test behavior, not implementation** - Focus on public API
2. **Use descriptive test names** - `it('creates a task with auto-generated ID')` not `it('test1')`
3. **One assertion concept per test** - Multiple `expect` statements for the same concept is fine
4. **Clean up mocks** - Use `vi.clearAllMocks()` in `beforeEach` and `mockRestore()` when needed
5. **Avoid test interdependence** - Each test should run independently
6. **Use `async/await`** - Always await async operations in tests
7. **Prefer `toHaveBeenCalledOnce()`** over `toHaveBeenCalledTimes(1)`
