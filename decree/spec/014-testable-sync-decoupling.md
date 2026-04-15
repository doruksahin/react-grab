---
date: '2026-04-15'
references:
- PRD-012
- ADR-0011
status: approved
---

# SPEC-014 Testable Sync Decoupling

## Overview

Adds a `populate()` method to the sync layer, a readiness gate for sync-dependent UI, and consolidates the E2E test infrastructure from two Playwright projects into one. Tests control sync state via Playwright fixtures instead of Vite modes and environment variables.

The change builds on the reactive sync layer refactor (already implemented) which separated `SyncStore` from transport. The store already has public `reconcileGroups()`, `reconcileComments()`, and `setConfig()` — `populate()` composes them in a single `batch()`.

## Technical Design

### Layer 1 — `populate()` method on sync layer

**File:** `packages/react-grab/src/features/sync/sync-layer.ts`

Add `populate()` to the return object of `createSyncLayer`:

```ts
const populate = (data: {
  workspace: string;
  serverUrl: string;
  jiraProjectKey: string;
  groups?: SelectionGroup[];
  comments?: CommentItem[];
}) => {
  batch(() => {
    storeHandle.setConfig(data.workspace, data.serverUrl, data.jiraProjectKey);
    if (data.groups) storeHandle.setGroups(data.groups);
    if (data.comments) storeHandle.setComments(data.comments);
    storeHandle.setStatus("local");
  });
};
```

Key decisions:
- Uses `setGroups`/`setComments` (plain set), not `reconcileGroups`/`reconcileComments` (diff) — seeding populates from empty, no diff needed
- Sets status to `"local"` — semantically correct (data is present but not synced to server)
- Single `batch()` — one render update, no intermediate states
- Does NOT set the adapter signal — no `createResource` fetchers fire, no HTTP

### Layer 2 — Readiness gate in core/index.tsx

**File:** `packages/react-grab/src/core/index.tsx`

Wrap sync-dependent UI with a `<Show>` gate:

```tsx
<Show when={syncLayer.status() !== "idle"}>
  <Sidebar
    syncStatus={derivedSyncStatus()}
    syncWorkspace={syncLayer.workspace() ?? undefined}
    ...
  />
</Show>
```

The overlay itself (activation, selection, toolbar, context menu) renders unconditionally — it doesn't depend on sync state.

Conditional JIRA callbacks (`syncLayer.workspace() ? callback : undefined`) remain as-is — they're already correct. The readiness gate prevents the sidebar from rendering before those signals have values.

### Layer 3 — e2e-app window exposure

**File:** `packages/e2e-app/src/main.tsx`

Replace the env-var-gated `initSync()` auto-call with a dev-only window property:

```ts
// Before (remove):
const serverUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL;
const workspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE;
const jiraProjectKey = import.meta.env.VITE_REACT_GRAB_JIRA_PROJECT_KEY;
if (serverUrl && workspace && jiraProjectKey) {
  initSync({ enabled: true, serverUrl, workspace, jiraProjectKey, ... });
}

// After (add):
if (import.meta.env.DEV) {
  window.__reactGrabSync = {
    populate: syncLayer.populate,
    initSync,
  };
}
```

The e2e-app imports `populate` via a deep path: `import { syncLayer } from "react-grab/src/features/sync/sync-layer.js"`. This avoids exposing `populate` through the library's barrel export. The deep import is acceptable because the e2e-app is a test target, not a published consumer.

**Critical constraint:** `initSync()` must never auto-fire on page load. The env-var-gated auto-call is removed entirely. For HTTP behavior tests, `initSync()` is called manually from within the test body via `page.evaluate()`, after `page.route()` handlers are registered.

### Layer 4 — Playwright fixture refactor

**File:** `packages/react-grab/e2e/fixtures.ts`

Replace the dual-fixture system with opt-in fixtures:

```ts
export const test = base.extend<{
  reactGrab: ReactGrabPageObject;
  syncData: SyncDataHandle;
  mockServer: MockServerHandle;
}>({
  // Opt-in: only created when test declares `syncData` in signature.
  // Injects seed data via addInitScript so it's available before app JS runs.
  syncData: [async ({ page }, use) => {
    let seedPayload: SeedPayload = { ...DEFAULT_SEED };

    const handle: SyncDataHandle = {
      seed: (overrides: Partial<SeedPayload>) => {
        Object.assign(seedPayload, overrides);
      },
    };

    await page.addInitScript((data) => {
      (window as any).__REACT_GRAB_SEED__ = data;
    }, seedPayload);

    await use(handle);
  }, { auto: false }],

  // Opt-in: only created when test declares `mockServer` in signature.
  // Registers page.route() handlers for HTTP behavior tests.
  mockServer: [async ({ page }, use) => {
    const handle = await mockSyncServer(page);
    await use(handle);
  }, { auto: false }],

  // Always created. After navigation, checks for seed data and populates.
  reactGrab: async ({ page }, use, testInfo) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => (window as any).__REACT_GRAB__ !== undefined, undefined, {
      timeout: PAGE_SETUP_API_TIMEOUT_MS,
    });

    // If syncData fixture injected seed data, populate the store
    await page.evaluate(() => {
      const seed = (window as any).__REACT_GRAB_SEED__;
      if (seed) {
        (window as any).__reactGrabSync.populate(seed);
        delete (window as any).__REACT_GRAB_SEED__;
      }
    });

    const reactGrab = createReactGrabPageObject(page, testInfo);
    await use(reactGrab);
  },
});
```

**Fixture types:**

```ts
interface SeedPayload {
  workspace: string;
  serverUrl: string;
  jiraProjectKey: string;
  groups: SelectionGroup[];
  comments: CommentItem[];
}

interface SyncDataHandle {
  seed: (overrides: Partial<SeedPayload>) => void;
}
```

`DEFAULT_SEED` uses the existing mock fixtures data from `e2e/mocks/fixtures.ts`.

### Layer 5 — Playwright config simplification

**File:** `packages/react-grab/playwright.config.ts`

```ts
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5175",
    trace: "on-first-retry",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/touch-mode\.spec\.ts/],
    },
    {
      name: "chromium-touch",
      use: { ...devices["Desktop Chrome"], hasTouch: true },
      testMatch: /touch-mode\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm --filter react-grab build && pnpm dev",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname, "../e2e-app"),
    timeout: 30000,
  },
});
```

Removed: `chromium-mocked` project, second `webServer` entry.

### Layer 6 — Migrate mocked tests

**Directory:** `packages/react-grab/e2e/mocked/`

Tests in `e2e/mocked/` currently use `mockServer` for everything. After migration:

- **UI-only tests** (visual rendering, sidebar display, selection labels): replace `mockServer` with `syncData` in function signature. Remove `page.route()` setup. Keep assertions unchanged.
- **HTTP behavior tests** (comment write-back payload, polling, error handling): use `mockServer` only — call `initSync()` manually via `page.evaluate()` after routes are registered. Do NOT mix `syncData` + `initSync()` in the same test — `populate()` sets status to `"local"` and `initSync()` would overwrite the store, create an adapter, and start polling, resulting in undefined state.

Example migration for a visual test:

```ts
// Before:
test('shows JIRA status', async ({ reactGrab, mockServer }) => {
  // mockServer already intercepted initSync HTTP calls
  await reactGrab.activate();
  ...
});

// After:
test('shows JIRA status', async ({ reactGrab, syncData }) => {
  // syncData seeded the store directly — no HTTP
  await reactGrab.activate();
  ...
});
```

### Layer 7 — Cleanup

**Delete:**
- `packages/e2e-app/.env.mock`
- `packages/e2e-app/package.json` `dev:mock` script

**Update:**
- `CLAUDE.md` — remove `chromium-mocked` references, update test commands
- `TESTING.md` — update architecture table

### Video recording

Tests in `e2e/mocked/` that previously had video via the `chromium-mocked` project config can enable it per-file:

```ts
test.use({ video: "on" });
```

## Testing Strategy

### Verification approach

1. **All existing overlay tests pass unchanged** — they don't use `syncData` or `mockServer`, so the readiness gate keeps the sidebar hidden and nothing changes
2. **Migrated UI tests pass with `syncData`** — sidebar renders with seeded data, same visual assertions
3. **HTTP behavior tests pass with `mockServer` + manual `initSync()`** — `page.route()` intercepts all HTTP, `initSync()` called from test body, same assertion pattern as today
4. **No test uses two Vite modes** — single port, single web server
5. **Readiness gate prevents empty sidebar** — add a test that verifies sidebar is not visible when no sync data is provided

### Acceptance Criteria

#### populate() method
- [ ] `populate()` method exists on sync layer return object
- [ ] `populate()` sets workspace, serverUrl, jiraProjectKey via `setConfig()`
- [ ] `populate()` sets groups via `setGroups()` (not reconcile)
- [ ] `populate()` sets comments via `setComments()` (not reconcile)
- [ ] `populate()` sets status to `"local"`
- [ ] All setters are wrapped in a single `batch()` call
- [ ] `populate()` does NOT set the adapter signal (no HTTP fetchers fire)
- [ ] `populate()` does NOT start JIRA polling

#### Readiness gate
- [ ] Sidebar gated by `syncLayer.status() !== "idle"` — passed as `syncReady` prop from core/index.tsx to renderer
- [ ] Overlay (activation, selection, toolbar) renders regardless of sync status
- [ ] Sidebar does not render when `populate()` has not been called and `initSync()` has not been called
- [ ] Sidebar renders immediately (no loading flash) after `populate()` is called
- [ ] Sidebar components with `onMount`-based setup (poller, listeners) function correctly with delayed mount via readiness gate

#### e2e-app changes
- [ ] `main.tsx` no longer reads sync env vars or auto-calls `initSync()`
- [ ] `window.__reactGrabSync.populate` exposed behind `import.meta.env.DEV` guard
- [ ] `window.__reactGrabSync.initSync` exposed behind `import.meta.env.DEV` guard
- [ ] `initSync()` never auto-fires on page load — only called manually from test body via `page.evaluate()`
- [ ] `populate` imported via deep path (`react-grab/src/features/sync/sync-layer.js`), not barrel export
- [ ] `.env.mock` file deleted
- [ ] `dev:mock` script removed from e2e-app `package.json`

#### Playwright fixtures
- [ ] `syncData` fixture is opt-in (`{ auto: false }`)
- [ ] `mockServer` fixture is opt-in (`{ auto: false }`)
- [ ] `reactGrab` fixture checks for `__REACT_GRAB_SEED__` and calls `populate()` if present
- [ ] Tests using only `reactGrab` (no syncData) see no sidebar
- [ ] Tests using `syncData` see sidebar with seeded groups and comments
- [ ] No test uses both `syncData` and `initSync()` — these are mutually exclusive paths
- [ ] HTTP behavior tests use `mockServer` + manual `initSync()` (no `syncData`)
- [ ] `SyncDataHandle.seed()` allows per-test data overrides before navigation

#### Playwright config
- [ ] Single `chromium` project (plus `chromium-touch`)
- [ ] Single `webServer` entry on port 5175
- [ ] `chromium-mocked` project removed
- [ ] `testIgnore` for `mocked/` directory removed (tests run in `chromium`)

#### Test migration
- [ ] All existing overlay tests pass without changes
- [ ] Visual sidebar tests migrated from `mockServer` to `syncData`
- [ ] HTTP behavior tests use `mockServer` + manual `initSync()` (no `syncData`)
- [ ] `@SPEC-xxx` tags preserved on all migrated tests
- [ ] Video recording enabled per-file where previously provided by project config

#### Documentation
- [ ] `CLAUDE.md` updated — single project, updated commands, no `chromium-mocked` references
- [ ] `TESTING.md` updated — architecture table reflects single project
