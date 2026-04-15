# E2E Mock Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Playwright E2E tests to run all sync-server-dependent features without a real backend, using `page.route()` network interception with typed deterministic fixtures.

**Architecture:** A `mockSyncServer(page)` function registers `page.route()` handlers for all 15 sync-server endpoints before page navigation. A `mockServer` Playwright fixture wraps this with request capture and per-test overrides. The e2e-app calls `initSync()` (gated by env vars) so JIRA code paths are live. A `screenshot()` helper attaches step screenshots to the Playwright HTML report.

**Tech Stack:** Playwright `page.route()`, Orval-generated types (for fixture typing), `testInfo.attach()` (for screenshots)

**Design doc:** [`docs/plans/2026-04-15-e2e-mock-infrastructure-design.md`](./2026-04-15-e2e-mock-infrastructure-design.md)

---

## Task 1: Update e2e-app to call `initSync()` with env-gated config

The e2e-app currently only exposes `window.initReactGrab = init` but never calls `initSync()`. Without it, `syncState` is null and all JIRA callbacks resolve to `undefined` — the comment editor never renders.

**Files:**
- Modify: `packages/e2e-app/src/main.tsx` (currently 20 lines)

**Step 1: Add `initSync` import and env-gated call**

Update `packages/e2e-app/src/main.tsx` to:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { init, initSync } from "react-grab";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    initReactGrab: typeof init;
  }
}

window.initReactGrab = init;

const serverUrl = import.meta.env.VITE_REACT_GRAB_SYNC_URL as string | undefined;
const workspace = import.meta.env.VITE_REACT_GRAB_SYNC_WORKSPACE as string | undefined;
const jiraProjectKey = import.meta.env.VITE_REACT_GRAB_JIRA_PROJECT_KEY as string | undefined;

if (serverUrl && workspace && jiraProjectKey) {
  initSync({
    enabled: true,
    serverUrl,
    workspace,
    jiraProjectKey,
    syncRevealedState: false,
    onSyncError: (err) => console.warn("[react-grab e2e] sync error:", err.message),
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

**Step 2: Add env vars to Playwright config**

Modify `packages/react-grab/playwright.config.ts`, add `env` to the `webServer` block:

```ts
webServer: {
  command: "pnpm --filter react-grab build && pnpm dev",
  url: "http://localhost:5175",
  reuseExistingServer: !process.env.CI,
  cwd: path.resolve(__dirname, "../e2e-app"),
  timeout: 30000,
  env: {
    ...process.env,
    VITE_REACT_GRAB_SYNC_URL: "http://localhost:9999",
    VITE_REACT_GRAB_SYNC_WORKSPACE: "test-workspace",
    VITE_REACT_GRAB_JIRA_PROJECT_KEY: "ATT",
  },
},
```

The URL `http://localhost:9999` is arbitrary — `page.route()` intercepts before any request reaches the network.

**Step 3: Verify existing tests still pass**

Run: `cd packages/react-grab && npx playwright test activation.spec.ts --project=chromium`
Expected: PASS — existing tests don't trigger JIRA flows, and `initSync` will either succeed (if mock routes are registered) or fall back to localStorage silently via `onSyncError`.

**Important:** `initSync` with `enabled: true` fetches `GET /workspaces/test-workspace/comments` and `GET /workspaces/test-workspace/groups` during page load. Without mock routes, these fail and `initSync` falls back to localStorage with `status: "error"`. Existing tests that don't need sync will still work — the overlay initializes regardless of sync status. Tests that need JIRA features must use the `mockServer` fixture (Task 4) which registers routes before navigation.

**Step 4: Commit**

```bash
git add packages/e2e-app/src/main.tsx packages/react-grab/playwright.config.ts
git commit -m "feat(e2e): add env-gated initSync() to e2e-app

Enables sync-server-dependent features in E2E tests.
VITE_REACT_GRAB_SYNC_URL + WORKSPACE + JIRA_PROJECT_KEY
env vars gate the initSync call. Without them, behavior
is unchanged. With them, page.route() mocks intercept."
```

---

## Task 2: Create mock fixtures with typed deterministic data

One coherent dataset covering all 15 endpoints. All objects typed as wire format (raw JSON matching the shapes that sync-server returns).

**Files:**
- Create: `packages/react-grab/e2e/mocks/fixtures.ts`

**Step 1: Create the fixtures file**

Create `packages/react-grab/e2e/mocks/fixtures.ts`:

```ts
/**
 * Deterministic fixture data for all sync-server endpoints.
 * Shapes match wire format (raw JSON from sync-server responses).
 * Typed against Orval-generated types for compile-time safety.
 */
import type {
  HealthCheck200,
  ListComments200Item,
  ListGroups200Item,
  GetJiraTicketStatus200,
  GetJiraTicketStatus200CommentsItem,
  CreateJiraTicket200,
  AddJiraComment200,
  SearchJiraUsers200Item,
  ListJiraProjects200Item,
  ListJiraIssueTypes200Item,
  ListJiraPriorities200Item,
} from "../../src/generated/sync-api.js";

// --- Workspace ---

export const WORKSPACE_ID = "test-workspace";
export const JIRA_PROJECT_KEY = "ATT";

// --- Health ---

export const health: HealthCheck200 = { status: "ok" };

// --- Users (for mention search) ---

export const jiraUsers: SearchJiraUsers200Item[] = [
  { accountId: "user-alice", displayName: "Alice Cooper", avatarUrl: "https://avatar.test/alice.png" },
  { accountId: "user-bob", displayName: "Bob Martinez", avatarUrl: "https://avatar.test/bob.png" },
  { accountId: "user-charlie", displayName: "Charlie Park", avatarUrl: null },
];

// --- JIRA comments (for ticket ATT-101) ---

export const jiraCommentsForGroup1: GetJiraTicketStatus200CommentsItem[] = [
  {
    id: "comment-1",
    parentId: null,
    author: "Alice Cooper",
    authorAvatar: "https://avatar.test/alice.png",
    body: "This looks good, let's move forward with the implementation.",
    createdAt: "2026-04-14T10:00:00.000Z",
  },
  {
    id: "comment-2",
    parentId: "comment-1",
    author: "Bob Martinez",
    authorAvatar: "https://avatar.test/bob.png",
    body: "Agreed, I'll start on the frontend changes.",
    createdAt: "2026-04-14T10:30:00.000Z",
  },
];

// --- JIRA ticket status (per group) ---

export const jiraStatusForGroup1: GetJiraTicketStatus200 = {
  status: "In Progress",
  statusCategory: "indeterminate",
  assignee: "Alice Cooper",
  reporter: "Bob Martinez",
  assigneeAvatar: "https://avatar.test/alice.png",
  reporterAvatar: "https://avatar.test/bob.png",
  jiraUrl: "https://adcreative.atlassian.net/browse/ATT-101",
  labels: ["frontend", "urgent"],
  comments: jiraCommentsForGroup1,
  flagged: false,
  flaggedAt: null,
  flaggedBy: null,
  flaggedByAvatar: null,
};

export const jiraStatusForGroup2: GetJiraTicketStatus200 = {
  status: "To Do",
  statusCategory: "new",
  assignee: null,
  reporter: "Charlie Park",
  assigneeAvatar: null,
  reporterAvatar: null,
  jiraUrl: "https://adcreative.atlassian.net/browse/ATT-102",
  labels: [],
  comments: [],
  flagged: false,
  flaggedAt: null,
  flaggedBy: null,
  flaggedByAvatar: null,
};

// --- Groups ---

export const groups: ListGroups200Item[] = [
  {
    id: "grp-1",
    name: "Header Component",
    createdAt: 1713000000000,
    revealed: true,
    status: "ticketed",
    jiraTicketId: "ATT-101",
    synthetic: false,
  },
  {
    id: "grp-2",
    name: "Footer Component",
    createdAt: 1713000060000,
    revealed: true,
    status: "ticketed",
    jiraTicketId: "ATT-102",
    synthetic: false,
  },
  {
    id: "grp-3",
    name: "Sidebar Widget",
    createdAt: 1713000120000,
    revealed: false,
    status: "open",
    synthetic: false,
  },
];

// --- Selections (comments in sync-server terminology) ---

export const selections: ListComments200Item[] = [
  {
    id: "sel-1",
    groupId: "grp-1",
    content: "<div>Header content</div>",
    elementName: "Header",
    tagName: "div",
    componentName: "Header",
    elementsCount: 1,
    elementSelectors: ["[data-testid='header']"],
    timestamp: 1713000000000,
    revealed: true,
    status: "ticketed",
    pageUrl: "http://localhost:5175/",
    pageTitle: "E2E Test App",
  },
  {
    id: "sel-2",
    groupId: "grp-2",
    content: "<footer>Footer content</footer>",
    elementName: "Footer",
    tagName: "footer",
    componentName: "Footer",
    elementsCount: 1,
    elementSelectors: ["footer"],
    timestamp: 1713000060000,
    revealed: true,
    status: "ticketed",
    pageUrl: "http://localhost:5175/",
    pageTitle: "E2E Test App",
  },
  {
    id: "sel-3",
    groupId: "grp-3",
    content: "<aside>Sidebar</aside>",
    elementName: "Sidebar",
    tagName: "aside",
    componentName: "Sidebar",
    elementsCount: 1,
    elementSelectors: ["aside"],
    timestamp: 1713000120000,
    revealed: false,
    status: "open",
    pageUrl: "http://localhost:5175/",
    pageTitle: "E2E Test App",
  },
];

// --- JIRA projects, issue types, priorities, labels ---

export const jiraProjects: ListJiraProjects200Item[] = [
  { key: "ATT", name: "AdCreative Task Tracker" },
];

export const jiraIssueTypes: ListJiraIssueTypes200Item[] = [
  { id: "10001", name: "Bug" },
  { id: "10002", name: "Task" },
  { id: "10003", name: "Story" },
];

export const jiraPriorities: ListJiraPriorities200Item[] = [
  { id: "1", name: "High" },
  { id: "2", name: "Medium" },
  { id: "3", name: "Low" },
];

export const jiraLabels: string[] = [
  "frontend",
  "backend",
  "design",
  "urgent",
  "tech-debt",
];

// --- Mutation responses (defaults for POST/PUT) ---

export const addCommentResponse: AddJiraComment200 = {
  id: "comment-new-1",
  created: "2026-04-15T12:00:00.000Z",
};

export const createTicketResponse: CreateJiraTicket200 = {
  jiraTicketId: "ATT-201",
  jiraUrl: "https://adcreative.atlassian.net/browse/ATT-201",
};

// --- Screenshot placeholder (1x1 transparent PNG) ---

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==";
export const screenshotPng = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
```

**Step 2: Verify types compile**

Run: `cd packages/react-grab && npx tsc --noEmit --project tsconfig.json 2>&1 | head -5`

Note: If the E2E files are excluded from `tsconfig.json`, try:
Run: `cd packages/react-grab && npx tsc --noEmit --strict e2e/mocks/fixtures.ts --moduleResolution bundler --module esnext --target esnext 2>&1 | head -10`

If type imports fail because E2E files can't resolve `src/` paths, add a `tsconfig.e2e.json` that extends the base config with `e2e/` included. Alternatively, use `// @ts-nocheck` and rely on the fixture shapes matching the Orval types by convention — this is acceptable for test infrastructure.

**Step 3: Commit**

```bash
git add packages/react-grab/e2e/mocks/fixtures.ts
git commit -m "test: add deterministic fixture data for all sync-server endpoints

Typed against Orval-generated types. Covers 15 endpoints with
one coherent dataset: 3 groups, 3 users, JIRA tickets, comments,
projects, issue types, priorities, labels, and screenshot binary."
```

---

## Task 3: Create the mock routes module

The core of the infrastructure — registers `page.route()` handlers for all 15 endpoints, captures requests, supports per-test overrides.

**Files:**
- Create: `packages/react-grab/e2e/mocks/routes.ts`

**Step 1: Create the routes module**

Create `packages/react-grab/e2e/mocks/routes.ts`:

```ts
import type { Page, Route, Request } from "@playwright/test";
import * as fixtures from "./fixtures.js";

// --- Types ---

export interface CapturedRequest {
  url: string;
  method: string;
  body: unknown;
  timestamp: number;
}

export type RouteHandler =
  | Record<string, unknown>
  | unknown[]
  | string
  | ((request: Request) => unknown | Promise<unknown>);

export interface MockOverrides {
  health: RouteHandler;
  listComments: RouteHandler;
  persistComments: RouteHandler;
  listGroups: RouteHandler;
  persistGroups: RouteHandler;
  getScreenshot: RouteHandler;
  uploadScreenshot: RouteHandler;
  createJiraTicket: RouteHandler;
  getJiraTicketStatus: RouteHandler;
  addJiraComment: RouteHandler;
  listJiraProjects: RouteHandler;
  listJiraIssueTypes: RouteHandler;
  listJiraPriorities: RouteHandler;
  listJiraLabels: RouteHandler;
  searchJiraUsers: RouteHandler;
}

export interface MockServerHandle {
  /** Replace the response for a specific endpoint. Pass a function for dynamic responses. */
  override<K extends keyof MockOverrides>(endpoint: K, handler: MockOverrides[K]): void;
  /** Get all captured requests for an endpoint. */
  requests(endpoint: keyof MockOverrides): CapturedRequest[];
  /** Reset all overrides to defaults and clear request logs. */
  reset(): void;
}

// --- Route matching helpers ---

type EndpointDef = {
  method: string;
  pattern: string;
  endpoint: keyof MockOverrides;
  defaultResponse: () => unknown;
  contentType?: string;
};

const JIRA_STATUS_BY_GROUP: Record<string, unknown> = {
  "grp-1": fixtures.jiraStatusForGroup1,
  "grp-2": fixtures.jiraStatusForGroup2,
};

function extractGroupId(url: string): string | null {
  const match = url.match(/\/groups\/([^/]+)\//);
  return match ? match[1] : null;
}

const endpoints: EndpointDef[] = [
  {
    method: "GET",
    pattern: "**/health",
    endpoint: "health",
    defaultResponse: () => fixtures.health,
  },
  {
    method: "GET",
    pattern: "**/workspaces/*/comments",
    endpoint: "listComments",
    defaultResponse: () => fixtures.selections,
  },
  {
    method: "PUT",
    pattern: "**/workspaces/*/comments",
    endpoint: "persistComments",
    defaultResponse: () => ({ ok: true }),
  },
  {
    method: "GET",
    pattern: "**/workspaces/*/groups",
    endpoint: "listGroups",
    defaultResponse: () => fixtures.groups,
  },
  {
    method: "PUT",
    pattern: "**/workspaces/*/groups",
    endpoint: "persistGroups",
    defaultResponse: () => ({ ok: true }),
  },
  {
    method: "GET",
    pattern: "**/workspaces/*/screenshots/*/*",
    endpoint: "getScreenshot",
    defaultResponse: () => fixtures.screenshotPng,
    contentType: "image/png",
  },
  {
    method: "PUT",
    pattern: "**/workspaces/*/screenshots/*/*",
    endpoint: "uploadScreenshot",
    defaultResponse: () => ({ ok: true }),
  },
  {
    method: "POST",
    pattern: "**/workspaces/*/groups/*/jira-ticket",
    endpoint: "createJiraTicket",
    defaultResponse: () => fixtures.createTicketResponse,
  },
  {
    method: "GET",
    pattern: "**/workspaces/*/groups/*/jira-status",
    endpoint: "getJiraTicketStatus",
    defaultResponse: () => fixtures.jiraStatusForGroup1,
  },
  {
    method: "POST",
    pattern: "**/workspaces/*/groups/*/jira-comment",
    endpoint: "addJiraComment",
    defaultResponse: () => fixtures.addCommentResponse,
  },
  {
    method: "GET",
    pattern: "**/jira/projects",
    endpoint: "listJiraProjects",
    defaultResponse: () => fixtures.jiraProjects,
  },
  {
    method: "GET",
    pattern: "**/jira/issue-types*",
    endpoint: "listJiraIssueTypes",
    defaultResponse: () => fixtures.jiraIssueTypes,
  },
  {
    method: "GET",
    pattern: "**/jira/priorities",
    endpoint: "listJiraPriorities",
    defaultResponse: () => fixtures.jiraPriorities,
  },
  {
    method: "GET",
    pattern: "**/jira/labels",
    endpoint: "listJiraLabels",
    defaultResponse: () => fixtures.jiraLabels,
  },
  {
    method: "GET",
    pattern: "**/jira/users*",
    endpoint: "searchJiraUsers",
    defaultResponse: () => fixtures.jiraUsers,
  },
];

// --- Main function ---

export async function mockSyncServer(
  page: Page,
  overrides?: Partial<MockOverrides>,
): Promise<MockServerHandle> {
  const requestLog = new Map<keyof MockOverrides, CapturedRequest[]>();
  const activeOverrides = new Map<keyof MockOverrides, RouteHandler>();

  // Seed initial overrides
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      activeOverrides.set(key as keyof MockOverrides, value as RouteHandler);
    }
  }

  // Initialize request logs
  for (const def of endpoints) {
    requestLog.set(def.endpoint, []);
  }

  // Register routes
  for (const def of endpoints) {
    await page.route(def.pattern, async (route: Route) => {
      const request = route.request();

      // Only handle matching HTTP method
      if (request.method() !== def.method) {
        await route.fallback();
        return;
      }

      // Capture request
      let body: unknown = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
      requestLog.get(def.endpoint)!.push({
        url: request.url(),
        method: request.method(),
        body,
        timestamp: Date.now(),
      });

      // Resolve response
      const handler = activeOverrides.get(def.endpoint) ?? def.defaultResponse;
      let responseData: unknown;

      if (typeof handler === "function") {
        responseData = await (handler as (req: Request) => unknown)(request);
      } else {
        responseData = handler;
      }

      // Fulfill
      if (def.contentType === "image/png" && Buffer.isBuffer(responseData)) {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: responseData,
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(responseData),
        });
      }
    });
  }

  // Special handling: getJiraTicketStatus routes based on groupId
  // The generic handler above returns group1 status by default.
  // Override it with a dynamic handler that checks the groupId in the URL.
  activeOverrides.set("getJiraTicketStatus", (request: Request) => {
    const groupId = extractGroupId(request.url());
    if (groupId && groupId in JIRA_STATUS_BY_GROUP) {
      return JIRA_STATUS_BY_GROUP[groupId];
    }
    // Group without JIRA ticket — return 404
    return { __status: 404, error: "No JIRA ticket linked to this group" };
  });

  return {
    override(endpoint, handler) {
      activeOverrides.set(endpoint, handler);
    },
    requests(endpoint) {
      return requestLog.get(endpoint) ?? [];
    },
    reset() {
      activeOverrides.clear();
      for (const [key] of requestLog) {
        requestLog.set(key, []);
      }
      // Restore the groupId-based jira status handler
      activeOverrides.set("getJiraTicketStatus", (request: Request) => {
        const groupId = extractGroupId(request.url());
        if (groupId && groupId in JIRA_STATUS_BY_GROUP) {
          return JIRA_STATUS_BY_GROUP[groupId];
        }
        return { __status: 404, error: "No JIRA ticket linked to this group" };
      });
    },
  };
}
```

**Important note on error responses:** The `__status` convention above is a simplification. For proper error simulation, the `override` function should support returning `{ status: number, body: unknown }` objects. Refine during implementation if needed — the key pattern is that overrides can be functions that inspect the request and return dynamic data.

**Step 2: Commit**

```bash
git add packages/react-grab/e2e/mocks/routes.ts
git commit -m "test: add mockSyncServer with page.route() for all 15 endpoints

Registers deterministic route handlers, captures requests for
assertion, supports per-test overrides (static or function).
Handles binary screenshot endpoints and groupId-based JIRA status."
```

---

## Task 4: Extend Playwright fixtures with `mockServer` and `screenshot()`

Wire the mock layer into the existing fixture system and add the screenshot helper.

**Files:**
- Modify: `packages/react-grab/e2e/fixtures.ts` (lines 2475-2528)

**Step 1: Add imports at the top of fixtures.ts**

Add after the existing import on line 1 (`import { test as base, expect, Page, Locator } from "@playwright/test";`):

```ts
import { mockSyncServer, type MockServerHandle } from "./mocks/routes.js";
```

**Step 2: Add `screenshot` method to `ReactGrabPageObject` interface**

In the `ReactGrabPageObject` interface (starts at line 86), add before the closing brace:

```ts
  /** Take a screenshot and attach it to the test report. */
  screenshot(name: string, target?: "overlay" | "page"): Promise<void>;
```

**Step 3: Implement `screenshot` in the `createReactGrabPageObject` function**

Inside `createReactGrabPageObject` (starts at line 246), add the implementation. This needs access to `testInfo`, so the function signature must be updated.

First, update the function call at line 2523 from:
```ts
const reactGrab = createReactGrabPageObject(page);
```
to:
```ts
const reactGrab = createReactGrabPageObject(page, testInfo);
```

Then update the function signature at line 246 from:
```ts
const createReactGrabPageObject = (page: Page): ReactGrabPageObject => {
```
to:
```ts
const createReactGrabPageObject = (page: Page, testInfo?: import("@playwright/test").TestInfo): ReactGrabPageObject => {
```

Add the screenshot implementation inside the function (alongside the other method implementations):

```ts
  const screenshot = async (name: string, target: "overlay" | "page" = "overlay") => {
    const fileName = `${name}.png`;
    let buffer: Buffer;

    if (target === "overlay") {
      const host = getOverlayHost();
      buffer = await host.screenshot();
    } else {
      buffer = await page.screenshot({ fullPage: true });
    }

    if (testInfo) {
      await testInfo.attach(name, { body: buffer, contentType: "image/png" });
    }
  };
```

Add `screenshot` to the returned object at the end of `createReactGrabPageObject`.

**Step 4: Update the fixture to include `mockServer` and pass `testInfo`**

Replace the test definition at lines 2475-2528 with:

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
          // HACK: brief backoff helps when dev server is under heavy parallel load.
          await new Promise((resolve) => {
            setTimeout(resolve, 250 * (attemptIndex + 1));
          });
        }
      }
    };

    await initializePage();

    const reactGrab = createReactGrabPageObject(page, testInfo);
    await use(reactGrab);
  },
});

export { expect };
```

**Key change:** `reactGrab` declares `mockServer` as `_mockServer` in its parameter list. This makes Playwright resolve `mockServer` first (routes registered) before `reactGrab` navigates with `page.goto("/")`. The `_` prefix indicates we don't use the handle directly — it's a dependency for ordering only.

**Step 5: Verify existing tests still pass**

Run: `cd packages/react-grab && npx playwright test activation.spec.ts --project=chromium`
Expected: PASS — `mockServer` is resolved for every test (routes registered as no-ops for unmatched methods), but existing tests don't use `mockServer` in assertions.

**Step 6: Commit**

```bash
git add packages/react-grab/e2e/fixtures.ts
git commit -m "test: add mockServer fixture + screenshot helper to E2E fixtures

mockServer resolves before reactGrab (dependency ordering ensures
routes are registered before page.goto). screenshot() attaches
overlay or full-page PNGs to the Playwright HTML report."
```

---

## Task 5: Write the proof-of-concept test file

One complete test file exercising the full mock infrastructure: fixtures, route overrides, request capture, and screenshots.

**Files:**
- Create: `packages/react-grab/e2e/jira-comment-write.spec.ts`

**Step 1: Write the test file**

Create `packages/react-grab/e2e/jira-comment-write.spec.ts`:

```ts
import { test, expect } from "./fixtures.js";
import { jiraUsers, addCommentResponse } from "./mocks/fixtures.js";

const ATTR = "data-react-grab";

/**
 * Helper: query inside the shadow DOM.
 */
const queryShadow = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      return root?.querySelector(sel) !== null;
    },
    { attrName: ATTR, sel: selector },
  );

/**
 * Helper: get text content from shadow DOM element.
 */
const getShadowText = (page: import("@playwright/test").Page, selector: string) =>
  page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      return root?.querySelector(sel)?.textContent ?? null;
    },
    { attrName: ATTR, sel: selector },
  );

test.describe("JIRA Comment Write-Back", () => {
  test.beforeEach(async ({ reactGrab }) => {
    // Wait for overlay to be ready
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5_000 })
      .toBe(true);
  });

  test("comment list renders from mock data", async ({ page, reactGrab, mockServer }) => {
    // TODO: Navigate to selection label for group 1 (grp-1)
    // This depends on how the sidebar/selection-label is opened in E2E tests.
    // The exact flow is: activate overlay → click an element → open sidebar → expand group → see comments.
    // Implement the exact steps based on the existing sidebar.spec.ts patterns.

    // Assert: comment list should show 2 comments from fixtures
    // Assert: "Alice Cooper" and "Bob Martinez" author names visible

    await reactGrab.screenshot("comment-list-loaded");
  });

  test("post a new comment", async ({ page, reactGrab, mockServer }) => {
    // TODO: Open selection label for group 1
    // TODO: Focus the TipTap editor (click the composer area)
    // TODO: Type comment text

    // TODO: Click Save button
    // Selector: [data-react-grab-comment-submit]

    // Assert: API was called with correct body
    const requests = mockServer.requests("addJiraComment");
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      body: expect.stringContaining("test comment"),
    });

    await reactGrab.screenshot("comment-posted");
  });

  test("threaded reply", async ({ page, reactGrab, mockServer }) => {
    // TODO: Open selection label for group 1
    // TODO: Click Reply on the first comment (comment-1)
    // Selector: [data-react-grab-comment-reply]

    // Assert: reply context bar visible
    // Selector: [data-react-grab-reply-context]

    // TODO: Type reply text
    // TODO: Click Save

    // Assert: request body has parentId
    const requests = mockServer.requests("addJiraComment");
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      parentId: "comment-1",
    });

    await reactGrab.screenshot("reply-posted");
  });

  test("@mention search and selection", async ({ page, reactGrab, mockServer }) => {
    // Override searchJiraUsers with query-dependent response
    mockServer.override("searchJiraUsers", (request) => {
      const url = new URL(request.url());
      const query = url.searchParams.get("query")?.toLowerCase() ?? "";
      return jiraUsers.filter((u) =>
        u.displayName.toLowerCase().includes(query),
      );
    });

    // TODO: Open selection label for group 1
    // TODO: Focus editor
    // TODO: Type "@ali" to trigger mention search

    // Assert: mention picker visible
    // Selector: [data-react-grab-mention-picker]

    // TODO: Select Alice from the picker (Enter key or click)

    // Assert: mention chip rendered in editor

    await reactGrab.screenshot("mention-picker-open");
    // (take this screenshot BEFORE selecting — need to reorder steps during implementation)

    await reactGrab.screenshot("mention-selected");
  });

  test("error handling — API failure", async ({ page, reactGrab, mockServer }) => {
    // Override addJiraComment to return an error
    mockServer.override("addJiraComment", () => {
      // Return error shape — the route handler needs to support status overrides.
      // For now, return the error body. During implementation, refine the
      // override API to support { status: 400, body: { error: "..." } }.
      return { error: "JIRA API rate limit exceeded" };
    });

    // TODO: Open selection label for group 1
    // TODO: Type and submit a comment

    // Assert: error state shown (toast or inline error)
    // Assert: editor content preserved (not cleared)

    await reactGrab.screenshot("error-state");
  });
});
```

**Note:** The test file has `TODO` placeholders for UI navigation steps. These depend on the exact shadow DOM structure and existing fixture helpers (e.g., how to open sidebar, expand a group, focus the comment editor). During implementation, fill these in by following the patterns from `sidebar.spec.ts` and `selection-label` component structure. The `data-react-grab-*` attributes on comment components (from SPEC-013) are the test selectors.

**Step 2: Run the test to verify infrastructure works**

Run: `cd packages/react-grab && npx playwright test jira-comment-write.spec.ts --project=chromium`
Expected: Tests run (may skip/fail on TODO steps) but the mock infrastructure initializes correctly — no network errors, no timeouts on route registration.

**Step 3: Commit**

```bash
git add packages/react-grab/e2e/jira-comment-write.spec.ts
git commit -m "test: add jira-comment-write E2E spec with mock infrastructure

Proof-of-concept: 5 scenarios covering comment post, threaded reply,
@mention search, and error handling. Uses mockServer fixture for
route interception and request capture. Screenshot helper captures
UI state at key steps for report review."
```

---

## Task 6: Verify end-to-end and fix issues

Run the full existing test suite to confirm nothing is broken, then run the new test to validate the infrastructure.

**Step 1: Run existing tests (smoke check)**

Run: `cd packages/react-grab && npx playwright test activation.spec.ts copy-feedback.spec.ts toolbar.spec.ts --project=chromium`
Expected: All PASS — existing tests unaffected by the new `mockServer` fixture.

**Step 2: Run the new test**

Run: `cd packages/react-grab && npx playwright test jira-comment-write.spec.ts --project=chromium --reporter=html`
Expected: Infrastructure works — routes intercept, fixtures load, screenshots attach. Individual test steps may need refinement based on actual shadow DOM structure.

**Step 3: Open the HTML report to verify screenshots**

Run: `cd packages/react-grab && npx playwright show-report`
Expected: Screenshots appear inline next to test steps in the report.

**Step 4: Fix any issues found**

Common issues to watch for:
- `initSync` timing: if `__REACT_GRAB__` API isn't ready before `initSync` completes, the page setup may time out. Solution: increase `PAGE_SETUP_API_TIMEOUT_MS` or ensure `initSync` doesn't block page readiness.
- Route pattern conflicts: if `**/workspaces/*/groups` matches `**/workspaces/*/groups/*/jira-status`, Playwright uses LIFO ordering. Ensure more specific patterns are registered after generic ones (the `endpoints` array order in `routes.ts` handles this).
- Screenshot of shadow DOM: `getOverlayHost().screenshot()` may fail if the overlay isn't visible. Guard with a visibility check.

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify E2E mock infrastructure end-to-end

Existing tests pass. Mock routes intercept correctly.
Screenshots attach to HTML report."
```

---

## Summary

| Task | Files | What it does |
|------|-------|-------------|
| 1 | `e2e-app/main.tsx`, `playwright.config.ts` | Enable `initSync()` so JIRA code paths are live |
| 2 | `e2e/mocks/fixtures.ts` | Deterministic fixture data for all 15 endpoints |
| 3 | `e2e/mocks/routes.ts` | `mockSyncServer()` with request capture + overrides |
| 4 | `e2e/fixtures.ts` | `mockServer` fixture (ordered before navigation) + `screenshot()` |
| 5 | `e2e/jira-comment-write.spec.ts` | Proof-of-concept: 5 test scenarios |
| 6 | — | End-to-end verification |
