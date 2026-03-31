# Sync Server OpenAPI + Orval Pipeline Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the sync-server the single source of truth for API types. Migrate routes to `@hono/zod-openapi`, serve the OpenAPI spec at `/doc`, point Orval at it, and enforce that the dashboard never has hand-written API code.

**Architecture:** Sync-server defines Zod schemas → auto-generates OpenAPI spec at `/doc` → a build script exports spec to JSON → Orval reads it → generates TypeScript client, models, and MSW mocks → dashboard imports only generated code. A lint rule ensures no hand-written fetch calls in the dashboard.

**Tech Stack:** `@hono/zod-openapi`, `@hono/swagger-ui`, Zod, Orval, ESLint (no-restricted-syntax)

---

## Task 1: Install @hono/zod-openapi and zod in sync-server

**Files:**
- Modify: `packages/sync-server/package.json`

**Step 1: Install dependencies**

```bash
pnpm --filter @react-grab/sync-server add @hono/zod-openapi zod @hono/swagger-ui
```

**Step 2: Verify the server still starts**

```bash
pnpm --filter @react-grab/sync-server dev
```

Expected: Server starts on port 3847, existing routes still work (we haven't changed them yet).

**Step 3: Commit**

```bash
git add packages/sync-server/package.json pnpm-lock.yaml
git commit -m "chore(sync-server): add @hono/zod-openapi, zod, @hono/swagger-ui"
```

---

## Task 2: Create shared Zod schemas

**Files:**
- Create: `packages/sync-server/src/schemas/comment.ts`
- Create: `packages/sync-server/src/schemas/group.ts`
- Create: `packages/sync-server/src/schemas/common.ts`
- Create: `packages/sync-server/src/schemas/index.ts`

These schemas are the **single source of truth** for the entire API surface. They define request/response shapes and become the OpenAPI spec automatically.

**Step 1: Create common schemas**

`packages/sync-server/src/schemas/common.ts`:

```typescript
import { z } from "zod";

export const WorkspaceIdParam = z.object({
  id: z.string().openapi({ description: "Workspace ID", example: "my-workspace" }),
});

export const StatusResponse = z.object({
  status: z.enum(["ok"]).openapi({ example: "ok" }),
});

export const ErrorResponse = z.object({
  error: z.string().openapi({ example: "Body must be an array" }),
});
```

**Step 2: Create comment schemas**

`packages/sync-server/src/schemas/comment.ts`:

```typescript
import { z } from "zod";

export const SelectionStatus = z.enum(["open", "ticketed", "resolved"]).openapi({
  description: "Lifecycle status of a selection",
});

export const CommentItem = z.object({
  id: z.string(),
  groupId: z.string(),
  content: z.string().openapi({ description: "Element HTML snapshot" }),
  elementName: z.string(),
  tagName: z.string(),
  componentName: z.string().optional(),
  elementsCount: z.number().int().optional(),
  elementSelectors: z.array(z.string()).optional(),
  commentText: z.string().optional(),
  timestamp: z.number(),
  revealed: z.boolean(),
  status: SelectionStatus.optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional().openapi({ description: "R2 key for full-page screenshot" }),
  screenshotElement: z.string().optional().openapi({ description: "R2 key for element screenshot" }),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const CommentItemArray = z.array(CommentItem);
```

**Step 3: Create group schemas**

`packages/sync-server/src/schemas/group.ts`:

```typescript
import { z } from "zod";

export const SelectionGroup = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  revealed: z.boolean(),
});

export const SelectionGroupArray = z.array(SelectionGroup);
```

**Step 4: Create barrel export**

`packages/sync-server/src/schemas/index.ts`:

```typescript
export { WorkspaceIdParam, StatusResponse, ErrorResponse } from "./common.js";
export { CommentItem, CommentItemArray, SelectionStatus } from "./comment.js";
export { SelectionGroup, SelectionGroupArray } from "./group.js";
```

**Step 5: Verify build**

```bash
pnpm --filter @react-grab/sync-server start
```

Expected: Server starts (schemas aren't used yet, just defined).

**Step 6: Commit**

```bash
git add packages/sync-server/src/schemas/
git commit -m "feat(sync-server): define Zod schemas — single source of truth for API types"
```

---

## Task 3: Migrate health route to OpenAPIHono

**Files:**
- Rewrite: `packages/sync-server/src/routes/health.ts`

Start with the simplest route to validate the pattern.

**Step 1: Rewrite health.ts**

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const healthResponse = z.object({
  status: z.enum(["ok"]),
});

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["health"],
  summary: "Health check",
  operationId: "healthCheck",
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": {
          schema: healthResponse,
        },
      },
    },
  },
});

export const healthRoutes = new OpenAPIHono().openapi(healthRoute, (c) => {
  return c.json({ status: "ok" as const }, 200);
});
```

**Step 2: Test it**

```bash
pnpm --filter @react-grab/sync-server dev
```

Then:

```bash
curl http://localhost:3847/health
```

Expected: `{"status":"ok"}`

**Step 3: Commit**

```bash
git add packages/sync-server/src/routes/health.ts
git commit -m "refactor(sync-server): migrate health route to @hono/zod-openapi"
```

---

## Task 4: Migrate comments routes to OpenAPIHono

**Files:**
- Rewrite: `packages/sync-server/src/routes/comments.ts`

**Step 1: Rewrite comments.ts**

```typescript
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItemArray,
} from "../schemas/index.js";

const COMMENTS_FILE = "comments.json";

const listComments = createRoute({
  method: "get",
  path: "/workspaces/{id}/comments",
  tags: ["comments"],
  summary: "List all comments in a workspace",
  operationId: "listComments",
  request: {
    params: WorkspaceIdParam,
  },
  responses: {
    200: {
      description: "Array of comments",
      content: {
        "application/json": {
          schema: CommentItemArray,
        },
      },
    },
  },
});

const persistComments = createRoute({
  method: "put",
  path: "/workspaces/{id}/comments",
  tags: ["comments"],
  summary: "Replace all comments in a workspace",
  operationId: "persistComments",
  request: {
    params: WorkspaceIdParam,
    body: {
      content: {
        "application/json": {
          schema: CommentItemArray,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: StatusResponse,
        },
      },
    },
    400: {
      description: "Invalid body",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

export const commentsRoutes = new OpenAPIHono()
  .openapi(listComments, async (c) => {
    const { id } = c.req.valid("param");
    const comments = await readJsonFile(id, COMMENTS_FILE, []);
    return c.json(comments, 200);
  })
  .openapi(persistComments, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, COMMENTS_FILE, body);
    return c.json({ status: "ok" as const }, 200);
  });
```

Note: `c.req.valid("param")` and `c.req.valid("json")` replace manual `c.req.param()` and `c.req.json()` — they return typed, validated data. The `Array.isArray()` check is gone because Zod validates the body automatically.

**Step 2: Test**

```bash
curl http://localhost:3847/workspaces/my-workspace/comments
curl -X PUT http://localhost:3847/workspaces/my-workspace/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"test","groupId":"g1","content":"<div/>","elementName":"Div","tagName":"div","timestamp":1234,"revealed":true}]'
```

Expected: GET returns comments, PUT returns `{"status":"ok"}`.

**Step 3: Commit**

```bash
git add packages/sync-server/src/routes/comments.ts
git commit -m "refactor(sync-server): migrate comments routes to @hono/zod-openapi"
```

---

## Task 5: Migrate groups routes to OpenAPIHono

**Files:**
- Rewrite: `packages/sync-server/src/routes/groups.ts`

**Step 1: Rewrite groups.ts**

```typescript
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  SelectionGroupArray,
} from "../schemas/index.js";

const GROUPS_FILE = "groups.json";

const listGroups = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups",
  tags: ["groups"],
  summary: "List all groups in a workspace",
  operationId: "listGroups",
  request: {
    params: WorkspaceIdParam,
  },
  responses: {
    200: {
      description: "Array of groups",
      content: {
        "application/json": {
          schema: SelectionGroupArray,
        },
      },
    },
  },
});

const persistGroups = createRoute({
  method: "put",
  path: "/workspaces/{id}/groups",
  tags: ["groups"],
  summary: "Replace all groups in a workspace",
  operationId: "persistGroups",
  request: {
    params: WorkspaceIdParam,
    body: {
      content: {
        "application/json": {
          schema: SelectionGroupArray,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: StatusResponse,
        },
      },
    },
    400: {
      description: "Invalid body",
      content: {
        "application/json": {
          schema: ErrorResponse,
        },
      },
    },
  },
});

export const groupsRoutes = new OpenAPIHono()
  .openapi(listGroups, async (c) => {
    const { id } = c.req.valid("param");
    const groups = await readJsonFile(id, GROUPS_FILE, []);
    return c.json(groups, 200);
  })
  .openapi(persistGroups, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    await writeJsonFile(id, GROUPS_FILE, body);
    return c.json({ status: "ok" as const }, 200);
  });
```

**Step 2: Test**

```bash
curl http://localhost:3847/workspaces/my-workspace/groups
```

Expected: Returns groups array.

**Step 3: Commit**

```bash
git add packages/sync-server/src/routes/groups.ts
git commit -m "refactor(sync-server): migrate groups routes to @hono/zod-openapi"
```

---

## Task 6: Wire up OpenAPIHono in index.ts, serve /doc and Swagger UI

**Files:**
- Rewrite: `packages/sync-server/src/index.ts`

**Step 1: Update index.ts**

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import { serve } from "@hono/node-server";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";

const app = new OpenAPIHono();

app.use("*", cors());
app.use("*", logger());
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

// OpenAPI spec endpoint — this is the single source of truth
app.doc("/doc", {
  openapi: "3.0.3",
  info: {
    title: "react-grab Sync API",
    version: "0.1.0",
    description: "API for the react-grab dashboard — comments, groups, workspaces.",
  },
  servers: [{ url: "http://localhost:3847", description: "Local" }],
});

// Swagger UI for browsing the spec
app.get("/ui", swaggerUI({ url: "/doc" }));

const PORT = parseInt(process.env.PORT ?? "3847", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[sync-server] listening on http://localhost:${info.port}`);
  console.log(`[sync-server] Swagger UI: http://localhost:${info.port}/ui`);
  console.log(`[sync-server] OpenAPI spec: http://localhost:${info.port}/doc`);
});
```

**Step 2: Test the spec endpoint**

```bash
pnpm --filter @react-grab/sync-server dev
```

Then:

```bash
curl http://localhost:3847/doc | jq .
```

Expected: Full OpenAPI 3.0.3 JSON with all routes, schemas, parameters.

**Step 3: Test Swagger UI**

Open `http://localhost:3847/ui` in a browser. Expected: interactive Swagger UI showing all endpoints.

**Step 4: Test all existing endpoints still work**

```bash
curl http://localhost:3847/health
curl http://localhost:3847/workspaces/my-workspace/comments
curl http://localhost:3847/workspaces/my-workspace/groups
```

Expected: All return the same responses as before.

**Step 5: Commit**

```bash
git add packages/sync-server/src/index.ts
git commit -m "feat(sync-server): serve OpenAPI spec at /doc and Swagger UI at /ui"
```

---

## Task 7: Add spec export script for CI/Orval

**Files:**
- Create: `packages/sync-server/src/export-spec.ts`
- Modify: `packages/sync-server/package.json` (add script)

This script exports the OpenAPI spec to a JSON file **without starting the server**. Orval can read this file in CI or when the server isn't running.

**Step 1: Create export script**

`packages/sync-server/src/export-spec.ts`:

```typescript
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";

const app = new OpenAPIHono();
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

app.doc("/doc", {
  openapi: "3.0.3",
  info: {
    title: "react-grab Sync API",
    version: "0.1.0",
    description: "API for the react-grab dashboard — comments, groups, workspaces.",
  },
  servers: [{ url: "http://localhost:3847", description: "Local" }],
});

// Fetch the spec from the app without starting a server
const response = await app.request("/doc");
const spec = await response.json();
const outPath = join(import.meta.dirname, "..", "openapi.json");
await writeFile(outPath, JSON.stringify(spec, null, 2), "utf-8");
console.log(`[sync-server] OpenAPI spec exported to ${outPath}`);
```

**Step 2: Add scripts to package.json**

Add to `packages/sync-server/package.json` scripts:

```json
"export-spec": "tsx src/export-spec.ts"
```

**Step 3: Run it**

```bash
pnpm --filter @react-grab/sync-server export-spec
```

Expected: Creates `packages/sync-server/openapi.json`.

**Step 4: Add openapi.json to .gitignore**

Create `packages/sync-server/.gitignore`:

```
openapi.json
```

The exported spec is a build artifact — regenerate, don't commit.

**Step 5: Commit**

```bash
git add packages/sync-server/src/export-spec.ts packages/sync-server/package.json packages/sync-server/.gitignore
git commit -m "feat(sync-server): add export-spec script — generates openapi.json without running server"
```

---

## Task 8: Point dashboard Orval at the sync-server spec

**Files:**
- Modify: `packages/dashboard/orval.config.ts`
- Delete: `packages/dashboard/api-spec.yaml`
- Modify: `packages/dashboard/package.json` (update codegen script)

**Step 1: Update orval.config.ts**

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  dashboard: {
    input: {
      target: "../sync-server/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "src/api/endpoints",
      schemas: "src/api/model",
      client: "react-query",
      mock: true,
      override: {
        query: {
          useQuery: true,
          useSuspenseQuery: true,
        },
      },
    },
  },
});
```

Note: Removed the `zod` override block — it was dead code with the `react-query` client. Zod validation lives on the server now (where it belongs).

**Step 2: Update codegen script in package.json**

Update the `codegen` script in `packages/dashboard/package.json`:

```json
"codegen": "pnpm --filter @react-grab/sync-server export-spec && orval",
"codegen:watch": "orval --watch"
```

The codegen script first exports the spec from the server, then runs Orval. One command, always fresh.

**Step 3: Delete the hand-written spec**

```bash
rm packages/dashboard/api-spec.yaml
```

**Step 4: Regenerate the API client**

```bash
pnpm --filter dashboard codegen
```

Expected: Orval reads `../sync-server/openapi.json` and regenerates all files under `src/api/`.

**Step 5: Verify build**

```bash
pnpm --filter dashboard build
```

Expected: Build succeeds with the regenerated types.

**Step 6: Commit**

```bash
git add packages/dashboard/orval.config.ts packages/dashboard/package.json packages/dashboard/src/api/
git rm packages/dashboard/api-spec.yaml
git commit -m "feat(dashboard): point Orval at sync-server spec — delete hand-written api-spec.yaml"
```

---

## Task 9: Add guardrails — no hand-written API code in dashboard

**Files:**
- Modify: `packages/dashboard/eslint.config.js`
- Create: `packages/dashboard/src/api/README.md`

The guardrails enforce: **no manual fetch calls, no hand-written API types** in the dashboard. Everything comes from Orval.

**Step 1: Add ESLint rule to ban raw fetch in src/ (except in generated api/)**

In `packages/dashboard/eslint.config.js`, add a rule:

```javascript
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/api/**"],
  rules: {
    "no-restricted-globals": [
      "error",
      {
        name: "fetch",
        message: "Use generated API hooks from src/api/ instead of raw fetch. Run 'pnpm codegen' to regenerate.",
      },
    ],
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "axios",
            message: "Use generated API hooks from src/api/. No direct HTTP clients.",
          },
          {
            name: "ky",
            message: "Use generated API hooks from src/api/. No direct HTTP clients.",
          },
        ],
        patterns: [
          {
            group: ["**/api/model/*", "**/api/endpoints/*"],
            message: "Import from '@/api/model' or '@/api/endpoints' barrel exports, not deep paths.",
          },
        ],
      },
    ],
  },
},
```

**Step 2: Add README to src/api/**

`packages/dashboard/src/api/README.md`:

```markdown
# Generated API Code — DO NOT EDIT

This directory is 100% generated by [Orval](https://orval.dev/) from the sync-server's OpenAPI spec.

## To regenerate

```bash
pnpm codegen
```

This runs `export-spec` on the sync-server, then Orval generates:
- `endpoints/` — React Query hooks (useQuery, useMutation)
- `model/` — TypeScript types
- `*.msw.ts` — MSW mock handlers

## Rules

1. **Never edit files in this directory** — your changes will be overwritten
2. **Never write fetch/axios calls outside this directory** — use the generated hooks
3. **Never hand-write API types** — import from `@/api/model`
4. **To add a new endpoint** — add it to the sync-server routes, run `pnpm codegen`
```

**Step 3: Add src/api to .prettierignore**

In `packages/dashboard/.prettierignore`, add:

```
src/api/
```

Generated code shouldn't be reformatted.

**Step 4: Verify lint catches a raw fetch**

Create a temporary test file:

```bash
echo 'const data = await fetch("/api/test");' > packages/dashboard/src/test-guardrail.ts
pnpm --filter dashboard lint
```

Expected: ESLint error about using raw fetch.

Then delete the test file:

```bash
rm packages/dashboard/src/test-guardrail.ts
```

**Step 5: Commit**

```bash
git add packages/dashboard/eslint.config.js packages/dashboard/src/api/README.md packages/dashboard/.prettierignore
git commit -m "feat(dashboard): add guardrails — ESLint bans raw fetch, generated API is the only API layer"
```

---

## Summary

After all 9 tasks:

```
packages/sync-server/
  src/schemas/          ← Zod schemas (SINGLE SOURCE OF TRUTH)
  src/routes/           ← OpenAPIHono routes using those schemas
  src/index.ts          ← Serves /doc (OpenAPI JSON) and /ui (Swagger)
  src/export-spec.ts    ← Exports spec to openapi.json without running server

packages/dashboard/
  orval.config.ts       ← Points at ../sync-server/openapi.json
  src/api/              ← 100% Orval-generated (hooks, types, MSW mocks)
  eslint.config.js      ← Bans raw fetch outside src/api/
```

**The flow:**

```
1. Developer adds/changes a route in sync-server (Zod schema + OpenAPIHono)
2. Run: pnpm --filter dashboard codegen
3. Orval regenerates TypeScript client + types + MSW mocks
4. Dashboard gets type-safe hooks automatically
5. ESLint ensures nobody bypasses the generated layer
```

**For any future API** (e.g., JIRA integration service): same pattern — define routes with `@hono/zod-openapi`, export spec, add a second entry in `orval.config.ts`, generated code lands in `src/api/`.
