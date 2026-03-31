# Dashboard Architecture & Setup Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up the dashboard app architecture — routing, API layer (Orval + Zod + MSW), layout, and folder structure — so feature pages can be built on a solid foundation.

**Architecture:** Vite SPA with React Router v7 (data mode), TanStack Query for server state, Orval-generated API client with Zod runtime validation and MSW mocks for development. shadcn/ui sidebar layout.

**Tech Stack:** React 19, Vite 7, React Router v7, TanStack Query v5, Orval v7, Zod, MSW v2, shadcn/ui (radix-mira preset, hugeicons)

---

## Pages

The MVP dashboard has **3 pages**:

| Page | Route | Purpose |
|---|---|---|
| Selection list | `/` | Filterable table of all selections in a workspace |
| Selection detail | `/selections/:id` | Full context view — screenshots, component info, JIRA actions |
| Settings | `/settings` | Workspace picker, JIRA config (placeholder for MVP) |

## Target folder structure

```
packages/dashboard/src/
├── api/                          # Orval-generated (DO NOT EDIT)
│   ├── endpoints/                # React Query hooks per tag
│   │   ├── selections/
│   │   │   ├── selections.ts
│   │   │   └── selections.msw.ts
│   │   └── groups/
│   │       ├── groups.ts
│   │       └── groups.msw.ts
│   └── model/                    # Zod schemas + inferred types
│       ├── index.ts
│       ├── selection.zod.ts
│       └── group.zod.ts
├── components/
│   ├── ui/                       # shadcn/ui components (CLI-managed)
│   │   ├── button.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── app-sidebar.tsx       # Sidebar navigation
│   │   └── dashboard-layout.tsx  # Layout shell with sidebar + outlet
│   └── shared/                   # Reusable non-UI components
│       └── status-badge.tsx
├── pages/
│   ├── selections/
│   │   ├── list.tsx              # Selection list page
│   │   └── detail.tsx            # Selection detail page
│   └── settings/
│       └── index.tsx             # Settings page (placeholder)
├── lib/
│   ├── utils.ts                  # shadcn cn() utility (exists)
│   ├── query-client.ts           # TanStack Query client instance
│   └── msw.ts                    # MSW browser worker setup
├── mocks/
│   └── handlers.ts               # Re-exports Orval-generated MSW handlers
├── router.tsx                    # React Router createBrowserRouter
├── App.tsx                       # Providers (QueryClient, Router, Theme)
├── main.tsx                      # Entry point, MSW init
└── index.css                     # Tailwind + shadcn theme (exists)
```

## OpenAPI spec location

```
packages/dashboard/api-spec.yaml    # Single source of truth for the dashboard API
```

This spec describes the sync-server endpoints as consumed by the dashboard. Orval reads this file and generates everything under `src/api/`.

---

## Task 1: Install core dependencies

**Files:**
- Modify: `packages/dashboard/package.json`

**Step 1: Install runtime dependencies**

```bash
pnpm --filter dashboard add react-router @tanstack/react-query zod
```

**Step 2: Install dev dependencies**

```bash
pnpm --filter dashboard add -D orval msw
```

**Step 3: Verify installation**

```bash
pnpm --filter dashboard build
```

Expected: Build succeeds (no code changes yet, just deps).

**Step 4: Commit**

```bash
git add packages/dashboard/package.json pnpm-lock.yaml
git commit -m "chore(dashboard): add react-router, tanstack-query, orval, msw, zod"
```

---

## Task 2: Write the OpenAPI spec

**Files:**
- Create: `packages/dashboard/api-spec.yaml`

**Step 1: Write the spec**

This spec mirrors the existing sync-server routes plus new fields for the dashboard MVP.

```yaml
openapi: 3.1.0
info:
  title: react-grab Sync API
  version: 0.1.0
  description: API for the react-grab dashboard — selections, groups, workspaces.

servers:
  - url: http://localhost:3000
    description: Local sync-server

paths:
  /workspaces/{workspaceId}/selections:
    get:
      operationId: listSelections
      tags: [selections]
      summary: List all selections in a workspace
      parameters:
        - $ref: "#/components/parameters/WorkspaceId"
        - name: status
          in: query
          schema:
            $ref: "#/components/schemas/SelectionStatus"
      responses:
        "200":
          description: Array of selections
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Selection"
    put:
      operationId: persistSelections
      tags: [selections]
      summary: Replace all selections in a workspace
      parameters:
        - $ref: "#/components/parameters/WorkspaceId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/Selection"
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StatusResponse"

  /workspaces/{workspaceId}/selections/{selectionId}:
    get:
      operationId: getSelection
      tags: [selections]
      summary: Get a single selection by ID
      parameters:
        - $ref: "#/components/parameters/WorkspaceId"
        - $ref: "#/components/parameters/SelectionId"
      responses:
        "200":
          description: A single selection
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Selection"
        "404":
          description: Selection not found

  /workspaces/{workspaceId}/groups:
    get:
      operationId: listGroups
      tags: [groups]
      summary: List all groups in a workspace
      parameters:
        - $ref: "#/components/parameters/WorkspaceId"
      responses:
        "200":
          description: Array of groups
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/SelectionGroup"
    put:
      operationId: persistGroups
      tags: [groups]
      summary: Replace all groups in a workspace
      parameters:
        - $ref: "#/components/parameters/WorkspaceId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/SelectionGroup"
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/StatusResponse"

  /health:
    get:
      operationId: healthCheck
      tags: [health]
      summary: Health check
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [ok]

components:
  parameters:
    WorkspaceId:
      name: workspaceId
      in: path
      required: true
      schema:
        type: string
    SelectionId:
      name: selectionId
      in: path
      required: true
      schema:
        type: string

  schemas:
    SelectionStatus:
      type: string
      enum: [open, ticketed, resolved]

    Selection:
      type: object
      required:
        - id
        - groupId
        - content
        - elementName
        - tagName
        - timestamp
        - revealed
        - status
      properties:
        id:
          type: string
        groupId:
          type: string
        content:
          type: string
          description: Element HTML snapshot
        elementName:
          type: string
        tagName:
          type: string
        componentName:
          type: string
          nullable: true
        elementsCount:
          type: integer
        elementSelectors:
          type: array
          items:
            type: string
        commentText:
          type: string
          nullable: true
        timestamp:
          type: number
        revealed:
          type: boolean
        status:
          $ref: "#/components/schemas/SelectionStatus"
        pageUrl:
          type: string
          nullable: true
        pageTitle:
          type: string
          nullable: true
        screenshotFullPage:
          type: string
          nullable: true
          description: R2 key for full-page screenshot
        screenshotElement:
          type: string
          nullable: true
          description: R2 key for element screenshot
        jiraTicketId:
          type: string
          nullable: true
        capturedBy:
          type: string
          nullable: true

    SelectionGroup:
      type: object
      required: [id, name, createdAt, revealed]
      properties:
        id:
          type: string
        name:
          type: string
        createdAt:
          type: number
        revealed:
          type: boolean

    StatusResponse:
      type: object
      properties:
        status:
          type: string
          enum: [ok]
```

**Step 2: Commit**

```bash
git add packages/dashboard/api-spec.yaml
git commit -m "docs(dashboard): add OpenAPI spec for sync-server API"
```

---

## Task 3: Configure Orval and generate API client

**Files:**
- Create: `packages/dashboard/orval.config.ts`
- Modify: `packages/dashboard/package.json` (add codegen script)
- Generated: `packages/dashboard/src/api/` (entire directory)

**Step 1: Create Orval config**

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  dashboard: {
    input: {
      target: "./api-spec.yaml",
    },
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/model",
      client: "react-query",
      mock: true,
      override: {
        zod: {
          strict: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
          generate: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
          coerce: {
            param: true,
            query: true,
            header: true,
            body: true,
            response: true,
          },
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
        },
      },
    },
  },
});
```

**Step 2: Add codegen script to package.json**

Add to scripts:
```json
"codegen": "orval",
"codegen:watch": "orval --watch"
```

**Step 3: Run Orval to generate the API client**

```bash
pnpm --filter dashboard codegen
```

Expected: Files generated under `src/api/endpoints/` and `src/api/model/`.

**Step 4: Add generated files to .gitignore or commit them**

Decision: **Commit generated files.** Orval output is deterministic and having them in git means the project builds without running codegen first.

**Step 5: Verify build**

```bash
pnpm --filter dashboard build
```

Expected: Build succeeds with the generated files.

**Step 6: Commit**

```bash
git add packages/dashboard/orval.config.ts packages/dashboard/package.json packages/dashboard/src/api/ pnpm-lock.yaml
git commit -m "feat(dashboard): configure Orval — generate API client, Zod schemas, MSW mocks"
```

---

## Task 4: Set up MSW for development

**Files:**
- Create: `packages/dashboard/src/mocks/handlers.ts`
- Create: `packages/dashboard/src/mocks/browser.ts`
- Modify: `packages/dashboard/src/main.tsx`

**Step 1: Initialize MSW service worker**

```bash
cd packages/dashboard && npx msw init public/ --save
```

This creates `public/mockServiceWorker.js`.

**Step 2: Create mock handlers re-export**

`src/mocks/handlers.ts`:
```typescript
// Re-export all Orval-generated MSW handlers
// Import the generated handler arrays from each tag
// e.g. import { getSelectionsMock } from "../api/endpoints/selections/selections.msw";
// Export combined array
// NOTE: exact imports depend on Orval output — update after codegen

export const handlers = [
  // ...spread generated handlers here after codegen
];
```

**Step 3: Create browser worker**

`src/mocks/browser.ts`:
```typescript
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

**Step 4: Update main.tsx to start MSW in development**

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

async function enableMocking() {
  if (import.meta.env.MODE !== "development") {
    return;
  }

  const { worker } = await import("./mocks/browser");
  return worker.start({
    onUnhandledRequest: "bypass",
  });
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
```

**Step 5: Verify dev server starts with mocking**

```bash
pnpm --filter dashboard dev
```

Expected: Console shows "[MSW] Mocking enabled." in the browser.

**Step 6: Commit**

```bash
git add packages/dashboard/src/mocks/ packages/dashboard/public/mockServiceWorker.js packages/dashboard/src/main.tsx
git commit -m "feat(dashboard): set up MSW for development mocking"
```

---

## Task 5: Set up React Router with layout

**Files:**
- Create: `packages/dashboard/src/router.tsx`
- Create: `packages/dashboard/src/pages/selections/list.tsx`
- Create: `packages/dashboard/src/pages/selections/detail.tsx`
- Create: `packages/dashboard/src/pages/settings/index.tsx`
- Create: `packages/dashboard/src/components/layout/dashboard-layout.tsx`
- Modify: `packages/dashboard/src/App.tsx`

**Step 1: Create placeholder pages**

`src/pages/selections/list.tsx`:
```tsx
export default function SelectionListPage() {
  return <div>Selection List — TODO</div>;
}
```

`src/pages/selections/detail.tsx`:
```tsx
import { useParams } from "react-router";

export default function SelectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <div>Selection Detail: {id} — TODO</div>;
}
```

`src/pages/settings/index.tsx`:
```tsx
export default function SettingsPage() {
  return <div>Settings — TODO</div>;
}
```

**Step 2: Create dashboard layout**

`src/components/layout/dashboard-layout.tsx`:
```tsx
import { Outlet } from "react-router";

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-border bg-sidebar p-4">
        <nav className="space-y-2">
          <a href="/" className="block text-sm font-medium">
            Selections
          </a>
          <a href="/settings" className="block text-sm text-muted-foreground">
            Settings
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

Note: This is a minimal layout. We will replace the `<aside>` with shadcn's Sidebar component in a later task.

**Step 3: Create router**

`src/router.tsx`:
```tsx
import { createBrowserRouter } from "react-router";
import DashboardLayout from "./components/layout/dashboard-layout";
import SelectionListPage from "./pages/selections/list";
import SelectionDetailPage from "./pages/selections/detail";
import SettingsPage from "./pages/settings";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: SelectionListPage },
      { path: "selections/:id", Component: SelectionDetailPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
```

**Step 4: Update App.tsx**

```tsx
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/theme-provider";
import { queryClient } from "./lib/query-client";
import { router } from "./router";

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

**Step 5: Create query client**

`src/lib/query-client.ts`:
```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
    },
  },
});
```

**Step 6: Verify dev server and routing**

```bash
pnpm --filter dashboard dev
```

Navigate to:
- `/` → shows "Selection List — TODO"
- `/selections/test-123` → shows "Selection Detail: test-123 — TODO"
- `/settings` → shows "Settings — TODO"

**Step 7: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 8: Commit**

```bash
git add packages/dashboard/src/
git commit -m "feat(dashboard): set up React Router, TanStack Query, layout shell, placeholder pages"
```

---

## Task 6: Install shadcn/ui components needed for MVP

**Files:**
- Created by shadcn CLI under `src/components/ui/`

**Step 1: Install table, badge, card, separator, input, select components**

```bash
npx shadcn@latest add table badge card separator input select dropdown-menu -c packages/dashboard
```

These are the minimum components for the selection list and detail pages.

**Step 2: Verify build**

```bash
pnpm --filter dashboard build
```

**Step 3: Commit**

```bash
git add packages/dashboard/src/components/ui/ packages/dashboard/package.json pnpm-lock.yaml
git commit -m "chore(dashboard): install shadcn table, badge, card, separator, input, select, dropdown-menu"
```

---

## Summary

After all 6 tasks, the dashboard has:

| Layer | What's set up |
|---|---|
| **Routing** | React Router v7 with 3 pages (list, detail, settings) |
| **API client** | Orval-generated React Query hooks + Zod validation |
| **Mocking** | MSW with Orval-generated handlers — dev works without a server |
| **Layout** | Dashboard shell with sidebar nav + content outlet |
| **Components** | shadcn/ui table, badge, card, and form components |
| **State** | TanStack Query with 30s stale time |

Next plan: Implement the selection list page (Task #4 from the PoC task list) and selection detail page (Task #5) using this architecture.
