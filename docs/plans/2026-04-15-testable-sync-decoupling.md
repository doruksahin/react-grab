# Testable Sync Decoupling — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `populate()` to the sync layer, add a readiness gate for sync-dependent UI, and consolidate E2E infrastructure from two Playwright projects into one — so tests control sync state via fixtures, not Vite modes.

**Architecture:** `populate()` is a thin batch-setter on the existing sync layer store. The readiness gate is a `<Show>` wrapper in core/index.tsx. The e2e-app exposes `populate` on `window` (dev-only). Playwright fixtures become opt-in: `syncData` seeds the store, `mockServer` intercepts HTTP.

**Tech Stack:** Solid.js (batch, Show), Playwright (fixtures, addInitScript, page.evaluate), Vite

**Decree reference:** PRD-012, ADR-0011, SPEC-014 (39 acceptance criteria)

---

## Test file classification

Before starting, know which tests go where:

| File | Current fixture | Migration | Why |
|---|---|---|---|
| `selection-label-visual.spec.ts` | implicit mockServer (no direct usage) | → `syncData` | UI-only, no HTTP assertions |
| `jira-comment-sidebar-visual.spec.ts` | implicit mockServer (comment only) | → `syncData` | UI-only, no HTTP assertions |
| `jira-selection-label-visual.spec.ts` | `mockServer` (7 refs) | → `syncData` | Visual, but check if any `mockServer.requests()` — if so, split |
| `reveal-test.spec.ts` | `mockServer.requests()` (2 refs) | → `mockServer` + manual `initSync` | Asserts on HTTP request counts |
| `jira-comment-write.spec.ts` | `mockServer` heavy (overrides, requests) | → `mockServer` + manual `initSync` | HTTP behavior tests |
| `verify-spec-013.spec.ts` | `mockServer` heavy (overrides, requests) | → `mockServer` + manual `initSync` | HTTP behavior tests |
| `sync-refresh.spec.ts` | `mockServer` heavy (13 refs) | → `mockServer` + manual `initSync` | Mid-test override + refresh |

---

## Phase 1: populate() + readiness gate (library changes)

### Task 1.1: Add `populate()` to sync layer

**Files:**
- Modify: `packages/react-grab/src/features/sync/sync-layer.ts:189-222`

**Step 1: Add the populate method before the return statement**

In `sync-layer.ts`, add this method after the `dispose` function (around line 193) and before the `return {` block:

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

Make sure `batch` is imported from `solid-js` (check existing imports at top of file).

**Step 2: Add `populate` to the return object**

Add after the `dispose,` line in the return block:

```ts
    populate,
```

**Step 3: Verify build**

Run: `pnpm build`
Expected: SUCCESS — no type errors, `populate` is on the return type.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sync/sync-layer.ts
git commit -m "feat(sync): add populate() for test seeding without HTTP"
```

---

### Task 1.2: Add readiness gate in core/index.tsx

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Find the Sidebar render site**

Search for the `<Sidebar` JSX in core/index.tsx (around line 4500+). It's inside a `createEffect` that calls `render()`. The Sidebar is passed as a child to the renderer.

**Step 2: Wrap Sidebar in `<Show>`**

Wrap the `<Sidebar ... />` block with:

```tsx
<Show when={syncLayer.status() !== "idle"}>
  <Sidebar
    syncStatus={derivedSyncStatus()}
    ...all existing props...
  />
</Show>
```

Make sure `Show` is imported from `solid-js`. Check existing imports — it's likely already imported.

**Step 3: Verify build**

Run: `pnpm build`
Expected: SUCCESS

**Step 4: Run existing overlay tests to verify no regression**

Run: `pnpm --filter react-grab exec playwright test --project=chromium --headed`
Expected: All existing overlay tests pass. The sidebar was never visible in these tests anyway (no `initSync`), so the `<Show>` gate changes nothing for them.

**Step 5: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(sync): add readiness gate — sidebar waits for sync data"
```

---

## Phase 2: e2e-app changes

### Task 2.1: Remove auto-initSync, expose window API

**Files:**
- Modify: `packages/e2e-app/src/main.tsx`

**Step 1: Replace the env-var block**

Current code (lines 16-29):

```ts
const serverUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL as string | undefined;
const workspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE as string | undefined;
const jiraProjectKey = import.meta.env.VITE_REACT_GRAB_JIRA_PROJECT_KEY as string | undefined;

if (serverUrl && workspace && jiraProjectKey) {
  initSync({
    enabled: true,
    serverUrl,
    workspace,
    jiraProjectKey,
    syncRevealedState: true,
    onSyncError: (err) => console.warn("[react-grab e2e] sync error:", err.message),
  });
}
```

Replace with:

```ts
// Expose sync controls for E2E tests — tests call populate() or initSync() manually.
// No auto-initSync on boot. See SPEC-014 (ADR-0011).
if (import.meta.env.DEV) {
  (window as any).__reactGrabSync = {
    populate: (data: any) => {
      // Deep import to avoid exposing populate via barrel export
      const { syncLayer } = require("react-grab/src/features/sync/sync-layer.js");
      syncLayer.populate(data);
    },
    initSync,
  };
}
```

**Important:** The deep import approach depends on how the e2e-app resolves `react-grab`. Since it's a `workspace:*` dependency, Vite resolves it through the symlink. We need to check if the deep path works. If not, the alternative is to export `populate` alongside `initSync` from `react-grab`'s entry point and import it in main.tsx:

```ts
import { init, initSync, populate } from "react-grab";
```

If using this approach, add `populate` to the package's public exports in `packages/react-grab/src/index.ts` (or wherever `initSync` is exported from). The `populate` function is then technically public, but documented as internal-only.

**The simpler approach** (recommended): since `initSync` is already imported from `react-grab`, and `populate` lives on the same `syncLayer` object, just expose it alongside `initSync`:

```ts
import { init, initSync } from "react-grab";
```

Then in the window exposure, call `initSync` with a special config for populate. Actually, the cleanest way is to add a second export from the react-grab package entry:

In `packages/react-grab/src/core/index.tsx`, add after `initSync`:

```ts
export const populateSync = syncLayer.populate;
```

Then in `packages/e2e-app/src/main.tsx`:

```ts
import { init, initSync, populateSync } from "react-grab";

window.initReactGrab = init;

if (import.meta.env.DEV) {
  (window as any).__reactGrabSync = {
    populate: populateSync,
    initSync,
  };
}
```

This is a named export, not in the documented API, and only used by the e2e-app.

**Step 2: Verify the e2e-app builds**

Run: `pnpm --filter @react-grab/e2e-app build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add packages/e2e-app/src/main.tsx packages/react-grab/src/core/index.tsx
git commit -m "feat(e2e): expose populate + initSync on window for test control"
```

---

### Task 2.2: Delete .env.mock and dev:mock script

**Files:**
- Delete: `packages/e2e-app/.env.mock`
- Modify: `packages/e2e-app/package.json`

**Step 1: Delete .env.mock**

```bash
rm packages/e2e-app/.env.mock
```

**Step 2: Remove dev:mock script from package.json**

Remove the line:
```json
"dev:mock": "vite --mode mock --port 5176",
```

**Step 3: Commit**

```bash
git add -u packages/e2e-app/
git commit -m "chore(e2e): remove .env.mock and dev:mock script"
```

---

## Phase 3: Playwright fixture refactor

### Task 3.1: Add SyncDataHandle type and DEFAULT_SEED

**Files:**
- Modify: `packages/react-grab/e2e/fixtures.ts`

**Step 1: Add types and default seed near the top of fixtures.ts (after imports)**

```ts
import * as mockFixtures from "./mocks/fixtures.js";

interface SeedPayload {
  workspace: string;
  serverUrl: string;
  jiraProjectKey: string;
  groups: typeof mockFixtures.groups;
  comments: typeof mockFixtures.comments;
}

interface SyncDataHandle {
  seed: (overrides: Partial<SeedPayload>) => void;
}

const DEFAULT_SEED: SeedPayload = {
  workspace: "test-workspace",
  serverUrl: "http://localhost:9999",
  jiraProjectKey: "ATT",
  groups: mockFixtures.groups,
  comments: mockFixtures.comments,
};
```

**Step 2: Commit**

```bash
git add packages/react-grab/e2e/fixtures.ts
git commit -m "feat(e2e): add SyncDataHandle type and DEFAULT_SEED"
```

---

### Task 3.2: Refactor test.extend to opt-in fixtures

**Files:**
- Modify: `packages/react-grab/e2e/fixtures.ts`

**Step 1: Replace the current `test.extend` block**

Current code (around line 2503-2569):

```ts
export const test = base.extend<{
  reactGrab: ReactGrabPageObject;
  mockServer: MockServerHandle;
}>({
  mockServer: async ({ page }, use) => {
    const handle = await mockSyncServer(page);
    await use(handle);
  },
  reactGrab: async ({ page, mockServer: _mockServer }, use, testInfo) => {
    // ... navigation + page object creation
  },
});
```

Replace with:

```ts
export const test = base.extend<{
  reactGrab: ReactGrabPageObject;
  syncData: SyncDataHandle;
  mockServer: MockServerHandle;
}>({
  // Opt-in: only created when test declares `syncData` in its function signature.
  // Stashes seed data on window via addInitScript — available before app JS runs.
  syncData: [async ({ page }, use) => {
    let seedPayload: SeedPayload = { ...DEFAULT_SEED };

    const handle: SyncDataHandle = {
      seed: (overrides: Partial<SeedPayload>) => {
        Object.assign(seedPayload, overrides);
      },
    };

    // Inject seed data before any page script executes
    await page.addInitScript((data: SeedPayload) => {
      (window as any).__REACT_GRAB_SEED__ = data;
    }, seedPayload);

    await use(handle);
  }, { auto: false }],

  // Opt-in: only created when test declares `mockServer` in its function signature.
  // Registers page.route() handlers for all 15 sync-server endpoints.
  mockServer: [async ({ page }, use) => {
    const handle = await mockSyncServer(page);
    await use(handle);
  }, { auto: false }],

  // Always created. Navigates, waits for API, seeds if data was injected.
  reactGrab: async ({ page }, use, testInfo) => {
    const waitForApiReady = async () => {
      await page.waitForFunction(
        () => {
          const api = (window as { __REACT_GRAB__?: unknown }).__REACT_GRAB__;
          return api !== undefined;
        },
        undefined,
        { timeout: PAGE_SETUP_API_TIMEOUT_MS },
      );
    };

    const initializePage = async () => {
      let lastError: unknown;
      for (
        let attemptIndex = 0;
        attemptIndex < PAGE_SETUP_MAX_ATTEMPTS;
        attemptIndex++
      ) {
        if (page.isClosed()) {
          throw new Error("Browser page closed during reactGrab fixture setup");
        }
        try {
          await page.goto("/", {
            waitUntil: "domcontentloaded",
            timeout: PAGE_SETUP_NAVIGATION_TIMEOUT_MS,
          });
          await waitForApiReady();
          return;
        } catch (error) {
          lastError = error;
          if (page.isClosed()) {
            throw lastError;
          }
          if (attemptIndex === PAGE_SETUP_MAX_ATTEMPTS - 1) {
            throw lastError;
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 250 * (attemptIndex + 1));
          });
        }
      }
    };

    await initializePage();

    // If syncData fixture injected seed data, populate the store now.
    // This happens AFTER navigation but BEFORE tests interact with the page.
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

Key changes from the old version:
- `mockServer` is now opt-in (`{ auto: false }`) — not created unless test declares it
- `syncData` is new, also opt-in
- `reactGrab` no longer depends on `mockServer` — it's independent
- After navigation, `reactGrab` checks for seed data and calls `populate()` if present

**Step 2: Run a single overlay test to sanity check**

Run: `pnpm --filter react-grab exec playwright test e2e/activation.spec.ts --project=chromium`
Expected: PASS — no `syncData`, no `mockServer`, overlay works as before.

**Step 3: Commit**

```bash
git add packages/react-grab/e2e/fixtures.ts
git commit -m "refactor(e2e): opt-in syncData and mockServer fixtures"
```

---

## Phase 4: Playwright config simplification

### Task 4.1: Remove chromium-mocked project and second web server

**Files:**
- Modify: `packages/react-grab/playwright.config.ts`

**Step 1: Replace the entire config**

```ts
import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
      },
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

Changes:
- Removed `chromium-mocked` project entirely
- Removed second `webServer` entry (port 5176)
- Removed `testIgnore: [/mocked\//]` from `chromium` project — mocked tests now run here

**Step 2: Commit**

```bash
git add packages/react-grab/playwright.config.ts
git commit -m "refactor(e2e): single Playwright project, remove chromium-mocked"
```

---

## Phase 5: Migrate mocked tests

### Task 5.1: Migrate UI-only tests to syncData

**Files:**
- Modify: `packages/react-grab/e2e/mocked/selection-label-visual.spec.ts`
- Modify: `packages/react-grab/e2e/mocked/jira-comment-sidebar-visual.spec.ts`

These tests don't use `mockServer` at all — they just rely on `initSync` having populated the store. Replace implicit dependency on `initSync` with explicit `syncData`.

**Step 1: In each file, update the test function signatures**

If the test function has `({ reactGrab })` — add `syncData`:

```ts
// Before:
test("shows comment section", async ({ reactGrab }) => {

// After:
test("shows comment section", async ({ reactGrab, syncData }) => {
```

The mere presence of `syncData` in the signature triggers the fixture, which seeds data. The test body doesn't need to call `syncData.seed()` unless it needs custom data.

**Step 2: Update file header comments**

Remove references to `chromium-mocked project (port 5176, initSync enabled)`. Replace with:

```ts
/**
 * Visual verification of [feature].
 * Uses syncData fixture to seed the store — no HTTP mocking needed.
 */
```

**Step 3: Add video per-file**

At the top of each migrated file (after imports, before test.describe):

```ts
test.use({ video: "on" });
```

**Step 4: Run the migrated tests**

Run: `pnpm --filter react-grab exec playwright test e2e/mocked/selection-label-visual.spec.ts --project=chromium --headed`
Run: `pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-sidebar-visual.spec.ts --project=chromium --headed`
Expected: PASS — sidebar renders with seeded data, same visual assertions.

**Step 5: Commit**

```bash
git add packages/react-grab/e2e/mocked/selection-label-visual.spec.ts packages/react-grab/e2e/mocked/jira-comment-sidebar-visual.spec.ts
git commit -m "test(e2e): migrate UI-only mocked tests to syncData fixture"
```

---

### Task 5.2: Migrate jira-selection-label-visual.spec.ts

**Files:**
- Modify: `packages/react-grab/e2e/mocked/jira-selection-label-visual.spec.ts`

This file has 7 `mockServer` references. Read the file to classify each usage — if all are just `mockServer` in the function signature (fixture dependency) with no `mockServer.requests()` or `mockServer.override()` calls, migrate to `syncData`. If any are HTTP assertions, keep `mockServer` for those specific tests.

**Step 1: Read the file and classify**

**Step 2: Replace `mockServer` with `syncData` in test signatures (for UI-only tests)**

**Step 3: Add `test.use({ video: "on" })`**

**Step 4: Run and verify**

Run: `pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium --headed`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/react-grab/e2e/mocked/jira-selection-label-visual.spec.ts
git commit -m "test(e2e): migrate jira-selection-label-visual to syncData fixture"
```

---

### Task 5.3: Migrate HTTP behavior tests to mockServer + manual initSync

**Files:**
- Modify: `packages/react-grab/e2e/mocked/reveal-test.spec.ts`
- Modify: `packages/react-grab/e2e/mocked/jira-comment-write.spec.ts`
- Modify: `packages/react-grab/e2e/mocked/verify-spec-013.spec.ts`
- Modify: `packages/react-grab/e2e/mocked/sync-refresh.spec.ts`

These tests use `mockServer.requests()` and `mockServer.override()` — they need real HTTP interception.

**Step 1: In each test's `beforeEach` or at test start, add manual initSync call**

Since `initSync` no longer auto-fires on boot, these tests need to trigger it manually after `mockServer` routes are registered. The `mockServer` fixture registers routes before `reactGrab` navigates, so add an `initSync` call after navigation:

```ts
test.beforeEach(async ({ reactGrab, mockServer }) => {
  // mockServer routes are registered. Now trigger initSync manually.
  await reactGrab.page.evaluate(() => {
    return (window as any).__reactGrabSync.initSync({
      enabled: true,
      serverUrl: "http://localhost:9999",
      workspace: "test-workspace",
      jiraProjectKey: "ATT",
      syncRevealedState: true,
      onSyncError: (err: Error) => console.warn("[e2e] sync error:", err.message),
    });
  });

  // Wait for sidebar to be visible (initSync has completed)
  await expect
    .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
    .toBe(true);
});
```

**Step 2: Update file header comments**

```ts
/**
 * HTTP behavior tests for [feature].
 * Uses mockServer fixture for page.route() interception.
 * initSync() called manually after routes are registered — see SPEC-014.
 */
```

**Step 3: Add `test.use({ video: "on" })`**

**Step 4: Run each file individually**

Run: `pnpm --filter react-grab exec playwright test e2e/mocked/reveal-test.spec.ts --project=chromium --headed`
Run: `pnpm --filter react-grab exec playwright test e2e/mocked/jira-comment-write.spec.ts --project=chromium --headed`
Run: `pnpm --filter react-grab exec playwright test e2e/mocked/verify-spec-013.spec.ts --project=chromium --headed`
Run: `pnpm --filter react-grab exec playwright test e2e/mocked/sync-refresh.spec.ts --project=chromium --headed`
Expected: PASS for all.

**Step 5: Commit**

```bash
git add packages/react-grab/e2e/mocked/
git commit -m "test(e2e): migrate HTTP behavior tests to manual initSync"
```

---

## Phase 6: Full test suite verification

### Task 6.1: Run all tests

**Step 1: Run all overlay tests**

Run: `pnpm --filter react-grab exec playwright test --project=chromium`
Expected: ALL PASS — both existing overlay tests and migrated mocked tests.

**Step 2: Run touch tests**

Run: `pnpm --filter react-grab exec playwright test --project=chromium-touch`
Expected: PASS

**Step 3: Build the library**

Run: `pnpm build`
Expected: SUCCESS

**Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: SUCCESS

---

## Phase 7: Documentation + cleanup

### Task 7.1: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Remove all references to `chromium-mocked`, `dev:mock`, `.env.mock`, port 5176, and the two-project architecture table. Update test commands:

- Remove: `pnpm --filter react-grab test:e2e:mocked`
- Remove: `--project=chromium-mocked` from all examples
- Update the "Architecture — two Playwright projects" table to "Architecture — single Playwright project"
- Update the fixture documentation to describe `syncData` and `mockServer` as opt-in

### Task 7.2: Update TESTING.md

**Files:**
- Modify: `TESTING.md`

Same updates as CLAUDE.md — remove two-project references, document the fixture-based approach.

### Task 7.3: Commit docs

```bash
git add CLAUDE.md TESTING.md
git commit -m "docs: update E2E docs for single Playwright project (SPEC-014)"
```

---

## Blast Radius

| File | Change | Phase |
|---|---|---|
| `packages/react-grab/src/features/sync/sync-layer.ts` | Add `populate()` method + export | 1 |
| `packages/react-grab/src/core/index.tsx` | `<Show>` readiness gate + `populateSync` export | 1-2 |
| `packages/e2e-app/src/main.tsx` | Remove auto-initSync, add window exposure | 2 |
| `packages/e2e-app/.env.mock` | Delete | 2 |
| `packages/e2e-app/package.json` | Remove `dev:mock` script | 2 |
| `packages/react-grab/e2e/fixtures.ts` | Refactor to opt-in fixtures + SyncDataHandle | 3 |
| `packages/react-grab/playwright.config.ts` | Single project, single web server | 4 |
| `packages/react-grab/e2e/mocked/*.spec.ts` | Migrate fixture usage (7 files) | 5 |
| `CLAUDE.md` | Remove two-project docs | 7 |
| `TESTING.md` | Remove two-project docs | 7 |

**Total: ~12 files across 7 phases**
