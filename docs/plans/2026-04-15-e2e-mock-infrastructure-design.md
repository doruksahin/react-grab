# E2E Mock Infrastructure Design

**Goal:** Enable Playwright E2E tests to run all sync-server-dependent features (JIRA comments, ticket creation, status display, groups, screenshots) without a real backend — using `page.route()` network interception with deterministic fixtures.

**Deliverable:** Mock infrastructure covering all 15 sync-server endpoints + one complete test file (`jira-comment-write.spec.ts`) as proof of pattern + reusable screenshot helper.

---

## Architecture

### Approach: Playwright `page.route()` with typed fixtures

No MSW, no service worker, no new dependencies. Playwright's built-in `page.route()` intercepts HTTP at the Chromium network layer before requests leave the browser. One `mockSyncServer(page)` function registers handlers for all 15 endpoints with deterministic fixture data. Tests override specific endpoints as needed.

### File structure

```
packages/react-grab/e2e/
  mocks/
    fixtures.ts          — Static JSON responses for all 15 endpoints (typed as wire format)
    routes.ts            — mockSyncServer(page, overrides?) + MockOverrides type
  fixtures.ts            — Extended with mockServer fixture + screenshot helper
  jira-comment-write.spec.ts  — Proof-of-concept test file
```

### Why not MSW?

`page.route()` is sufficient for Playwright and avoids:
- Service worker registration timing issues
- `mockServiceWorker.js` in `public/`
- Cross-context communication complexity
- MSW browser setup / teardown lifecycle

MSW's advantage is in-browser interception for manual dev mode — not needed here.

---

## Mock layer

### `e2e/mocks/routes.ts`

Exports one main function:

```ts
interface MockServerHandle {
  override(endpoint: string, handler: RouteHandler | object | object[]): void;
  requests(endpoint: string): CapturedRequest[];
  reset(): void;
}

async function mockSyncServer(
  page: Page,
  overrides?: Partial<MockOverrides>,
): Promise<MockServerHandle>
```

Registers `page.route()` for all 15 endpoints. Returns a handle with:
- `override(endpoint, handler)` — replace response for a specific endpoint. Accepts static data OR a function `(req) => response` for dynamic behavior (e.g., query-dependent search results).
- `requests(endpoint)` — returns captured request log `[{ url, method, body, params, timestamp }]` for assertion.
- `reset()` — restore all routes to defaults, clear request log.

Route patterns use `**` globs to match any base URL:
```
**/health
**/workspaces/*/comments
**/workspaces/*/groups
**/workspaces/*/screenshots/*/*
**/workspaces/*/groups/*/jira-ticket
**/workspaces/*/groups/*/jira-status
**/workspaces/*/groups/*/jira-comment
**/jira/projects
**/jira/issue-types*
**/jira/priorities
**/jira/labels
**/jira/users*
```

Every handler:
1. Captures the request (URL, method, body, timestamp) into a per-endpoint log array.
2. Checks if an override exists for this endpoint.
3. If override is a function, calls it with the request and fulfills with the result.
4. Otherwise fulfills with static fixture data (or static override data).

Screenshot endpoints (`GET/PUT screenshots`) return/accept binary data, not JSON. The fixture provides a 1x1 transparent PNG buffer as default.

### `e2e/mocks/fixtures.ts`

One coherent dataset representing a realistic workspace:

| Entity | Details |
|--------|---------|
| Workspace | `test-workspace` |
| Group 1 | ID `grp-1`, has JIRA ticket `ATT-101` (In Progress), 2 comments (1 root + 1 threaded reply), assignee Alice |
| Group 2 | ID `grp-2`, has JIRA ticket `ATT-102` (To Do), no comments |
| Group 3 | ID `grp-3`, no JIRA ticket (loose selection) |
| Users | Alice (accountId `user-alice`), Bob (`user-bob`), Charlie (`user-charlie`) |
| Project | ATT — AdCreative Task Tracker |
| Issue types | Bug, Task, Story |
| Priorities | High, Medium, Low |
| Labels | `frontend`, `backend`, `design`, `urgent`, `tech-debt` |

All fixture objects typed as **wire format** (raw JSON matching Zod schemas in `sync-server/src/schemas/`), NOT Orval envelope types. This is because `page.route()` intercepts at the network level before any client-side parsing.

The codebase has two independent fetch clients:
- `customFetch` (Orval-generated) — used by JIRA endpoints
- `createHttpAdapter` (raw fetch) — used by comments, groups, screenshots

Both are intercepted by `page.route()` at the same network layer, but fixture shapes must satisfy the respective Zod schemas on each path.

`listJiraLabels` returns `string[]` (not objects) — fixture accounts for this asymmetry.

---

## Fixture composition

### `mockServer` Playwright fixture

Added to the existing `e2e/fixtures.ts` alongside `reactGrab`:

```ts
type Fixtures = {
  reactGrab: ReactGrabPageObject;
  mockServer: MockServerHandle;
};

export const test = base.extend<Fixtures>({
  mockServer: async ({ page }, use) => {
    const handle = await mockSyncServer(page);
    await use(handle);
  },
  reactGrab: async ({ page, mockServer }, use) => {
    // mockServer resolved first — routes registered before navigation
    // ... existing setup (navigate, wait for __REACT_GRAB__, etc.)
    await use(new ReactGrabPageObject(page, testInfo));
  },
});
```

**Critical ordering:** `reactGrab` declares `mockServer` as a dependency (in its parameter list). This guarantees routes are registered before `page.goto('/')` triggers `initSync()` network calls. Playwright fixtures resolve dependencies before dependents.

**Existing tests unaffected:** `mockServer` is a lazy fixture — it only executes when a test destructures it. The 40 existing spec files that don't use `mockServer` continue working unchanged. However, `reactGrab` depends on `mockServer` in the fixture definition, so routes are always registered. This is fine — unmatched `page.route()` patterns are no-ops, and the `mockServer` default fixtures won't interfere with tests that don't trigger server calls.

**Migration of existing inline mocks:** `sidebar.spec.ts` already uses inline `page.route()` for JIRA status. Playwright resolves routes in LIFO order (last registered wins), so inline overrides in existing tests naturally take precedence over the `mockServer` defaults. No migration needed — existing tests can adopt `mockServer` incrementally.

---

## e2e-app `initSync()` initialization

### The problem

The current `packages/e2e-app/src/main.tsx` calls `window.initReactGrab = init` but never calls `initSync()`. Without `initSync({ serverUrl, workspace })`, `syncState` is `undefined`, and all JIRA callbacks in `selection-label/index.tsx` resolve to `undefined`. The comment editor never renders. Mocking the network is useless if the code paths are dead.

### The fix

Add `initSync()` call in e2e-app, gated by env var:

```ts
// packages/e2e-app/src/main.tsx
import { init, initSync } from "react-grab";

window.initReactGrab = init;

const serverUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL;
const workspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE;

if (serverUrl && workspace) {
  initSync({ serverUrl, workspace });
}
```

The e2e-app gets a `.env.test` (or Playwright config `env` override):
```
VITE_REACT_GRAB_SYNC_URL=http://localhost:9999
VITE_REACT_GRAB_SYNC_WORKSPACE=test-workspace
```

The URL doesn't matter — `page.route()` intercepts before any request reaches the network. But it must be set so `initSync()` fires and `syncState` is populated.

---

## Screenshot capture helper

### `reactGrab.screenshot(name, target?)`

Added to the existing `ReactGrabPageObject`:

```ts
async screenshot(
  name: string,
  target: 'overlay' | 'page' = 'overlay',
): Promise<void>
```

- `overlay` (default) — screenshots the shadow DOM host element (`[data-react-grab]`). Captures just the react-grab UI, no host page noise.
- `page` — full page screenshot for context.
- Files saved as `{test-title}/{name}.png` under Playwright's `testInfo.outputDir`.
- Automatically attached to HTML report via `testInfo.attach(name, { path, contentType: 'image/png' })`.

Usage:
```ts
await reactGrab.screenshot('editor-loaded');
await reactGrab.screenshot('mention-picker-open');
await reactGrab.screenshot('comment-posted');
```

After `npx playwright show-report`, screenshots appear inline next to test steps. CI uploads `test-results/` as artifact.

Reusable across all test files — not JIRA-specific.

---

## Proof-of-concept test: `jira-comment-write.spec.ts`

Five scenarios exercising the full mock infrastructure:

### 1. Comment list renders from mock data
- Navigate, activate overlay, open selection label for group 1
- Assert: 2 comments visible (root + threaded reply) from fixture data
- Screenshot: `comment-list-loaded`

### 2. Post a new comment
- Type in TipTap editor, click Save
- Assert: `mockServer.requests('addJiraComment')` has 1 entry with expected body
- Assert: optimistic comment appears in list
- Screenshot: `comment-posted`

### 3. Threaded reply
- Click Reply on existing comment
- Assert: reply context bar visible ("Replying to Alice")
- Type reply, submit
- Assert: request body has `parentId` matching the parent comment ID
- Screenshot: `reply-posted`

### 4. @mention search and selection
- Type `@ali` in editor
- Override: `searchJiraUsers` with function handler that filters fixture users by query
- Assert: mention picker shows "Alice"
- Select Alice, assert mention chip in editor
- Screenshot: `mention-picker-open`, `mention-selected`

### 5. Error handling — API failure
- Override `addJiraComment` to return `{ status: 400, json: { error: "JIRA error" } }`
- Type and submit
- Assert: optimistic comment appears then disappears
- Assert: error state shown, editor content preserved
- Screenshot: `error-state`

---

## Design decisions log

| Decision | Rationale |
|----------|-----------|
| `page.route()` over MSW | No new deps, deterministic, per-test control, no service worker lifecycle |
| Wire format fixtures (not Orval types) | `page.route()` intercepts at network level, before client parsing |
| `mockServer` as dependency of `reactGrab` | Routes must register before navigation triggers `initSync()` calls |
| Function handlers in overrides | Needed for query-dependent responses (mention search) and error simulation |
| Request log capture | Verify request bodies (parentId, mentions) without brittle UI assertions |
| Binary fixture for screenshots | 1x1 PNG buffer — prevents JSON parse errors on screenshot endpoints |
| Env-gated `initSync()` in e2e-app | Activates server-dependent code paths without changing behavior for non-mock tests |
| Screenshot as `testInfo.attach()` | Appears in Playwright HTML report, uploadable as CI artifact |
