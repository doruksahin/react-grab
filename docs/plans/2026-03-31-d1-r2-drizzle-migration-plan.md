# D1 + R2 + Drizzle Storage Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the sync-server's file-based JSON storage with Cloudflare D1 (relational) + R2 (blob screenshots), using Drizzle ORM for type-safe queries. Deploy as a Cloudflare Worker.

**Architecture:** Drizzle schema mirrors the existing Zod schemas from `src/schemas/`. Routes swap `readJsonFile`/`writeJsonFile` for Drizzle queries. Screenshots go to R2. The server runs as a Cloudflare Worker (Hono already supports this natively). Local dev uses `wrangler dev` which emulates D1 + R2 locally.

**Tech Stack:** Drizzle ORM (`drizzle-orm`, `drizzle-kit`), Cloudflare D1, Cloudflare R2, Wrangler, Hono on Workers

---

## Current state (after OpenAPI migration)

```
packages/sync-server/
  src/schemas/           ← Zod schemas (source of truth for API types)
  src/routes/            ← OpenAPIHono routes using createRouter()
  src/storage/
    file-storage.ts      ← readJsonFile / writeJsonFile (TO BE REPLACED)
  src/lib/
    create-router.ts     ← OpenAPIHono factory with validation hook
  src/index.ts           ← Hono app with @hono/node-server
  src/export-spec.ts     ← Exports OpenAPI spec to JSON
```

**What changes:** `file-storage.ts` → Drizzle queries, `@hono/node-server` → Cloudflare Worker export, add `wrangler.toml`, add Drizzle schema + migrations.

**What stays the same:** Zod schemas, OpenAPI routes, route definitions, export-spec script. The API contract is unchanged.

---

## Task 1: Install Drizzle and Wrangler

**Files:**
- Modify: `packages/sync-server/package.json`

**Step 1: Install dependencies**

```bash
pnpm --filter @react-grab/sync-server add drizzle-orm
pnpm --filter @react-grab/sync-server add -D drizzle-kit wrangler
```

**Step 2: Verify the server still starts with existing file storage**

```bash
pnpm --filter @react-grab/sync-server dev
```

Expected: Server starts on port 3847, everything works as before.

**Step 3: Commit**

```bash
git add packages/sync-server/package.json pnpm-lock.yaml
git commit -m "chore(sync-server): add drizzle-orm, drizzle-kit, wrangler"
```

---

## Task 2: Create Drizzle schema

**Files:**
- Create: `packages/sync-server/src/db/schema.ts`
- Create: `packages/sync-server/drizzle.config.ts`

The Drizzle schema maps directly to the Zod schemas in `src/schemas/`. Two tables: `comments` and `groups`, scoped by `workspace_id`.

**Step 1: Create the schema**

`packages/sync-server/src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  groupId: text("group_id").notNull(),
  content: text("content").notNull(),
  elementName: text("element_name").notNull(),
  tagName: text("tag_name").notNull(),
  componentName: text("component_name"),
  elementsCount: integer("elements_count"),
  elementSelectors: text("element_selectors", { mode: "json" }).$type<string[]>(),
  commentText: text("comment_text"),
  timestamp: real("timestamp").notNull(),
  revealed: integer("revealed", { mode: "boolean" }).notNull(),
  status: text("status", { enum: ["open", "ticketed", "resolved"] }),
  pageUrl: text("page_url"),
  pageTitle: text("page_title"),
  screenshotFullPage: text("screenshot_full_page"),
  screenshotElement: text("screenshot_element"),
  jiraTicketId: text("jira_ticket_id"),
  capturedBy: text("captured_by"),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  createdAt: real("created_at").notNull(),
  revealed: integer("revealed", { mode: "boolean" }).notNull(),
});
```

Key decisions:
- `workspaceId` is a column, not a separate table — simple, flat, queryable
- `elementSelectors` uses JSON mode — stored as a JSON string in SQLite, parsed as `string[]`
- `timestamp` and `createdAt` are `real` (float) — matches the JavaScript `Date.now()` values
- `revealed` is `integer` with boolean mode — SQLite has no native boolean
- `status` is an enum text column — matches the Zod enum

**Step 2: Create Drizzle config**

`packages/sync-server/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
```

**Step 3: Generate the initial migration**

```bash
cd packages/sync-server && npx drizzle-kit generate
```

Expected: Creates `packages/sync-server/drizzle/0000_initial.sql` with CREATE TABLE statements.

**Step 4: Verify the generated SQL looks correct**

Read the generated migration file and confirm it has `comments` and `groups` tables with all columns.

**Step 5: Commit**

```bash
git add packages/sync-server/src/db/ packages/sync-server/drizzle.config.ts packages/sync-server/drizzle/
git commit -m "feat(sync-server): add Drizzle schema — comments and groups tables"
```

---

## Task 3: Create wrangler.toml with D1 + R2 bindings

**Files:**
- Create: `packages/sync-server/wrangler.toml`

**Step 1: Create wrangler config**

`packages/sync-server/wrangler.toml`:

```toml
name = "react-grab-sync-server"
main = "src/worker.ts"
compatibility_date = "2024-12-01"

[vars]
ENVIRONMENT = "development"

# D1 database binding
[[d1_databases]]
binding = "DB"
database_name = "react-grab-sync"
database_id = "local"  # placeholder — real ID set after `wrangler d1 create`

# R2 bucket binding
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "react-grab-screenshots"
```

Note: `database_id = "local"` is a placeholder. For local dev, `wrangler dev` creates a local SQLite file. For production, you run `wrangler d1 create react-grab-sync` and paste the real ID.

**Step 2: Define the Bindings type**

Create `packages/sync-server/src/types.ts`:

```typescript
export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
};
```

**Step 3: Commit**

```bash
git add packages/sync-server/wrangler.toml packages/sync-server/src/types.ts
git commit -m "feat(sync-server): add wrangler.toml with D1 and R2 bindings"
```

---

## Task 4: Create D1 storage layer (replacing file-storage)

**Files:**
- Create: `packages/sync-server/src/storage/d1-storage.ts`

This replaces `file-storage.ts` with Drizzle queries against D1.

**Step 1: Create d1-storage.ts**

```typescript
import { eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";

export type Database = DrizzleD1Database<typeof schema>;

export const createDb = (d1: D1Database): Database =>
  drizzle(d1, { schema });

export const listComments = async (db: Database, workspaceId: string) => {
  const rows = await db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.workspaceId, workspaceId));

  return rows.map(rowToComment);
};

export const persistComments = async (
  db: Database,
  workspaceId: string,
  items: schema.CommentInsert[],
) => {
  // Delete all existing comments for this workspace, then insert new ones
  await db.batch([
    db.delete(schema.comments).where(eq(schema.comments.workspaceId, workspaceId)),
    ...items.map((item) =>
      db.insert(schema.comments).values({ ...item, workspaceId }),
    ),
  ]);
};

export const listGroups = async (db: Database, workspaceId: string) => {
  const rows = await db
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.workspaceId, workspaceId));

  return rows.map(rowToGroup);
};

export const persistGroups = async (
  db: Database,
  workspaceId: string,
  items: schema.GroupInsert[],
) => {
  await db.batch([
    db.delete(schema.groups).where(eq(schema.groups.workspaceId, workspaceId)),
    ...items.map((item) =>
      db.insert(schema.groups).values({ ...item, workspaceId }),
    ),
  ]);
};

// --- Row mappers: strip workspaceId, match API shape ---

function rowToComment(row: typeof schema.comments.$inferSelect) {
  const { workspaceId, ...rest } = row;
  return {
    ...rest,
    // Convert snake_case DB columns to camelCase API shape
    elementName: rest.elementName,
    tagName: rest.tagName,
    componentName: rest.componentName ?? undefined,
    elementsCount: rest.elementsCount ?? undefined,
    elementSelectors: rest.elementSelectors ?? undefined,
    commentText: rest.commentText ?? undefined,
    status: rest.status ?? undefined,
    pageUrl: rest.pageUrl ?? undefined,
    pageTitle: rest.pageTitle ?? undefined,
    screenshotFullPage: rest.screenshotFullPage ?? undefined,
    screenshotElement: rest.screenshotElement ?? undefined,
    jiraTicketId: rest.jiraTicketId ?? undefined,
    capturedBy: rest.capturedBy ?? undefined,
  };
}

function rowToGroup(row: typeof schema.groups.$inferSelect) {
  const { workspaceId, ...rest } = row;
  return rest;
}
```

Note: We also need to add insert types to the schema. Update `packages/sync-server/src/db/schema.ts` to export inferred types:

Add at the bottom of `schema.ts`:

```typescript
export type CommentInsert = typeof comments.$inferInsert;
export type GroupInsert = typeof groups.$inferInsert;
```

**Step 2: Commit**

```bash
git add packages/sync-server/src/storage/d1-storage.ts packages/sync-server/src/db/schema.ts
git commit -m "feat(sync-server): create D1 storage layer with Drizzle queries"
```

---

## Task 5: Create Worker entry point

**Files:**
- Create: `packages/sync-server/src/worker.ts`

This replaces `@hono/node-server` with a Cloudflare Worker export. The existing `index.ts` stays for the `export-spec` script.

**Step 1: Create worker.ts**

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { swaggerUI } from "@hono/swagger-ui";
import type { Bindings } from "./types.js";
import { createDb } from "./storage/d1-storage.js";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.use("*", cors());
app.use("*", logger());

// Make db available in context
app.use("*", async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  await next();
});

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
});

app.get("/ui", swaggerUI({ url: "/doc" }));

export default app;
```

**Step 2: Commit**

```bash
git add packages/sync-server/src/worker.ts
git commit -m "feat(sync-server): add Cloudflare Worker entry point"
```

---

## Task 6: Update routes to use D1 storage

**Files:**
- Modify: `packages/sync-server/src/routes/comments.ts`
- Modify: `packages/sync-server/src/routes/groups.ts`

Replace `readJsonFile`/`writeJsonFile` with D1 storage functions. The route definitions (createRoute) stay exactly the same — only the handlers change.

**Step 1: Update comments.ts**

Replace the handler implementations:

```typescript
import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import { listComments, persistComments } from "../storage/d1-storage.js";
import {
  WorkspaceIdParam,
  StatusResponse,
  ErrorResponse,
  CommentItemArray,
} from "../schemas/index.js";

// ... route definitions stay exactly the same ...

export const commentsRoutes = createRouter()
  .openapi(listComments_route, async (c) => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const comments = await listComments(db, id);
    return c.json(comments, 200);
  })
  .openapi(persistComments_route, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db");
    await persistComments(db, id, body);
    return c.json({ status: "ok" as const }, 200);
  });
```

Note: Rename the createRoute constants to avoid naming collision with the storage functions (e.g., `listComments` route def → `listCommentsRoute`).

**Step 2: Update groups.ts**

Same pattern — swap `readJsonFile`/`writeJsonFile` for `listGroups`/`persistGroups` from d1-storage.

**Step 3: Update createRouter to accept Bindings type**

In `packages/sync-server/src/lib/create-router.ts`, update the generic:

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "../types.js";

export function createRouter() {
  return new OpenAPIHono<{ Bindings: Bindings; Variables: { db: Database } }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: result.error.issues.map((i) => i.message).join(", ") },
          400,
        );
      }
    },
  });
}
```

**Step 4: Verify with wrangler dev**

```bash
cd packages/sync-server && npx wrangler dev
```

Expected: Worker starts locally with D1 emulation. Endpoints return empty arrays (fresh DB).

**Step 5: Apply migration to local D1**

```bash
cd packages/sync-server && npx wrangler d1 migrations apply react-grab-sync --local
```

Expected: Tables created in local D1.

**Step 6: Test endpoints**

```bash
curl http://localhost:8787/workspaces/my-workspace/comments
curl -X PUT http://localhost:8787/workspaces/my-workspace/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"c1","groupId":"g1","content":"<div/>","elementName":"Div","tagName":"div","timestamp":1234,"revealed":true}]'
curl http://localhost:8787/workspaces/my-workspace/comments
```

Expected: First GET returns `[]`, PUT returns `{"status":"ok"}`, second GET returns the comment.

**Step 7: Commit**

```bash
git add packages/sync-server/src/routes/ packages/sync-server/src/lib/
git commit -m "feat(sync-server): migrate routes from file storage to D1 via Drizzle"
```

---

## Task 7: Add screenshot routes with R2

**Files:**
- Create: `packages/sync-server/src/routes/screenshots.ts`
- Modify: `packages/sync-server/src/worker.ts` (register route)

**Step 1: Create screenshots.ts**

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";

const ScreenshotParams = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  selectionId: z.string().openapi({ description: "Selection/comment ID" }),
  type: z.enum(["full", "element"]).openapi({ description: "Screenshot type" }),
});

const uploadScreenshot = createRoute({
  method: "put",
  path: "/workspaces/{id}/screenshots/{selectionId}/{type}",
  tags: ["screenshots"],
  summary: "Upload a screenshot",
  operationId: "uploadScreenshot",
  request: {
    params: ScreenshotParams,
    body: {
      content: {
        "image/png": { schema: z.any() },
        "image/jpeg": { schema: z.any() },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Upload success",
      content: {
        "application/json": {
          schema: z.object({ key: z.string() }),
        },
      },
    },
  },
});

const getScreenshot = createRoute({
  method: "get",
  path: "/workspaces/{id}/screenshots/{selectionId}/{type}",
  tags: ["screenshots"],
  summary: "Get a screenshot",
  operationId: "getScreenshot",
  request: {
    params: ScreenshotParams,
  },
  responses: {
    200: { description: "Screenshot image" },
    404: { description: "Not found" },
  },
});

export const screenshotsRoutes = createRouter()
  .openapi(uploadScreenshot, async (c) => {
    const { id, selectionId, type } = c.req.valid("param");
    const contentType = c.req.header("Content-Type") ?? "image/png";
    const extension = contentType.includes("jpeg") ? "jpg" : "png";
    const key = `${id}/screenshots/${selectionId}/${type}.${extension}`;

    const body = await c.req.arrayBuffer();
    await c.env.BUCKET.put(key, body, {
      httpMetadata: { contentType },
    });

    return c.json({ key }, 200);
  })
  .openapi(getScreenshot, async (c) => {
    const { id, selectionId, type } = c.req.valid("param");

    // Try both extensions
    for (const ext of ["png", "jpg"]) {
      const key = `${id}/screenshots/${selectionId}/${type}.${ext}`;
      const object = await c.env.BUCKET.get(key);
      if (object) {
        const headers = new Headers();
        headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/png");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(object.body, { headers });
      }
    }

    return c.json({ error: "Screenshot not found" }, 404);
  });
```

**Step 2: Register in worker.ts**

Add import and route:

```typescript
import { screenshotsRoutes } from "./routes/screenshots.js";
// ...
app.route("/", screenshotsRoutes);
```

**Step 3: Test with wrangler dev**

```bash
cd packages/sync-server && npx wrangler dev
```

```bash
# Upload a test screenshot
echo "fake-png-data" | curl -X PUT http://localhost:8787/workspaces/my-workspace/screenshots/c1/element \
  -H "Content-Type: image/png" --data-binary @-

# Retrieve it
curl http://localhost:8787/workspaces/my-workspace/screenshots/c1/element
```

Expected: Upload returns `{"key":"my-workspace/screenshots/c1/element.png"}`, GET returns the data.

**Step 4: Commit**

```bash
git add packages/sync-server/src/routes/screenshots.ts packages/sync-server/src/worker.ts
git commit -m "feat(sync-server): add screenshot upload/serve routes with R2"
```

---

## Task 8: Keep Node.js dev server working (dual mode)

**Files:**
- Modify: `packages/sync-server/src/index.ts`
- Modify: `packages/sync-server/package.json`

Keep `index.ts` working with `@hono/node-server` + file storage for the `export-spec` script and quick local dev without Wrangler. Add scripts for both modes.

**Step 1: Update package.json scripts**

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "dev:node": "tsx watch src/index.ts",
    "start": "wrangler dev",
    "export-spec": "tsx src/export-spec.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply react-grab-sync --local"
  }
}
```

- `dev` / `start` → Wrangler (D1 + R2, the real thing)
- `dev:node` → Node.js with file storage (lightweight, no Wrangler needed)
- `export-spec` → still works without D1 (only needs route definitions)

**Step 2: Ensure index.ts still works independently**

`index.ts` uses `readJsonFile`/`writeJsonFile` (file storage). It's the Node.js fallback. Don't touch it — it stays as-is for `export-spec` and `dev:node`.

`worker.ts` uses D1 storage. It's the Cloudflare Worker entry point.

Two entry points, same routes, different storage backends.

**Step 3: Commit**

```bash
git add packages/sync-server/package.json
git commit -m "chore(sync-server): add wrangler scripts, keep node dev mode as fallback"
```

---

## Task 9: Delete file-storage for Worker routes, clean up

**Files:**
- Keep: `packages/sync-server/src/storage/file-storage.ts` (used by index.ts / export-spec)
- Verify: `packages/sync-server/src/storage/d1-storage.ts` is used by worker.ts routes

Note: We keep file-storage.ts because `index.ts` (Node.js mode) still uses it. The Worker (`worker.ts`) uses D1 only. This is intentional — two backends, same API.

**Step 1: Verify the full flow end-to-end**

```bash
# Start with Wrangler (D1 + R2)
cd packages/sync-server && npx wrangler d1 migrations apply react-grab-sync --local && npx wrangler dev
```

Test all endpoints:
- `GET /health` → `{"status":"ok"}`
- `GET /doc` → OpenAPI JSON
- `GET /ui` → Swagger UI
- `GET /workspaces/test/comments` → `[]`
- `PUT /workspaces/test/comments` with body → `{"status":"ok"}`
- `GET /workspaces/test/comments` → returns the comment
- `PUT /workspaces/test/screenshots/c1/element` with image → `{"key":"..."}`
- `GET /workspaces/test/screenshots/c1/element` → returns image

**Step 2: Verify export-spec still works (Node.js mode)**

```bash
pnpm --filter @react-grab/sync-server export-spec
```

Expected: `openapi.json` generated (includes screenshot routes now).

**Step 3: Verify dashboard codegen picks up new endpoints**

```bash
pnpm --filter dashboard codegen
```

Expected: Orval regenerates with screenshot endpoints included.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(sync-server): D1 + R2 storage migration complete — dual mode (Worker + Node.js)"
```

---

## Summary

After all 9 tasks:

| Before | After |
|---|---|
| `@hono/node-server` only | Worker mode (D1+R2) + Node.js fallback |
| `file-storage.ts` (JSON files on disk) | `d1-storage.ts` (Drizzle + D1) |
| Screenshots not supported | R2 bucket with upload/serve routes |
| No migrations | Drizzle migrations in `drizzle/` |
| No type-safe queries | Drizzle schema with full type inference |

**Two modes:**

```
pnpm dev        → wrangler dev (D1 + R2, production-like)
pnpm dev:node   → tsx watch (file storage, lightweight)
pnpm export-spec → generates openapi.json (Node.js, no D1 needed)
```

**Storage mapping:**

| Data | D1 table | R2 key pattern |
|---|---|---|
| Comments | `comments` (filtered by `workspace_id`) | — |
| Groups | `groups` (filtered by `workspace_id`) | — |
| Screenshots | — | `{workspace}/{screenshots}/{selectionId}/{type}.png` |
| JIRA links | `comments.jira_ticket_id` column | — |

**Next:** The dashboard can now query real data from D1 via the same Orval-generated hooks. Screenshot upload from react-grab → R2 → dashboard displays them.
