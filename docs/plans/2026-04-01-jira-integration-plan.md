# JIRA Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **CRITICAL:** Use Serena MCP tools for all codebase read/write operations. Do NOT use Read/Grep/Write for code.

**Goal:** Add JIRA ticket creation from the dashboard — create a ticket from a group, attach screenshots, store the ticket ID on the group, show ticket status.

**Architecture:** sync-server proxies JIRA API using `jira.js` (typed client, SSOT from Atlassian OpenAPI). New `JiraService` in `services/`, new routes in `routes/jira.ts`, new Zod schemas. Group schema extended with `jiraTicketId` and `status`. Dashboard consumes via Orval-generated hooks — never talks to JIRA directly.

**Tech Stack:** `jira.js` (Version3Client), Wrangler secrets for auth, Drizzle migration for group fields, Orval codegen

**Blocked by:** `2026-04-01-dashboard-poc-plan.md` (dashboard pages must exist to add JIRA dialog)

---

## High-level flow

```
Dashboard                        sync-server                          JIRA Cloud
  |                                  |                                    |
  | POST /groups/:id/jira-ticket --> |                                    |
  |  { projectKey, issueType,        | 1. Load group + comments from D1  |
  |    priority, summary }           | 2. Generate ADF description        |
  |                                  | 3. POST /rest/api/3/issue -------> |
  |                                  |    <-- { key: "ATT-123" } ---------|
  |                                  | 4. For each screenshot:            |
  |                                  |    GET from R2                     |
  |                                  |    POST /issue/ATT-123/attach ---> |
  |                                  | 5. Update group in D1:             |
  |                                  |    jiraTicketId = "ATT-123"        |
  |                                  |    status = "ticketed"             |
  | <-- { jiraTicketId, jiraUrl } -- |                                    |
```

## Type chain (SSOT at every layer)

```
jira.js types (from Atlassian OpenAPI)  ← SSOT for JIRA API shapes
  ↓ used by
services/jira.service.ts               ← typed client calls
  ↓ wrapped by
schemas/jira.ts (Zod)                  ← SSOT for our API contract
  ↓ generates
openapi.json → Orval                   ← dashboard hooks + types
```

---

## Task 1: Install jira.js and add secrets config

**Files:**
- Modify: `packages/sync-server/package.json`
- Modify: `packages/sync-server/src/types.ts`
- Modify: `packages/sync-server/wrangler.toml`

**Step 1: Install jira.js**

```bash
pnpm --filter @react-grab/sync-server add jira.js
```

**Step 2: Add JIRA secrets to Bindings type**

In `packages/sync-server/src/types.ts`:

```typescript
/// <reference types="@cloudflare/workers-types" />

import type { SyncRepository, ScreenshotStore } from "./repositories/types.js";
import type { JiraService } from "./services/jira.service.js";

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
  JIRA_BASE_URL: string;      // e.g. "https://appier.atlassian.net"
  JIRA_EMAIL: string;         // e.g. "bot@company.com"
  JIRA_API_TOKEN: string;     // API token (secret)
};

export type Variables = {
  repo: SyncRepository;
  screenshots: ScreenshotStore;
  jira: JiraService;           // NEW
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
```

Note: `JiraService` will be created in Task 3. This will have a type error until then — that's expected.

**Step 3: Add JIRA vars to wrangler.toml**

```toml
[vars]
ENVIRONMENT = "development"
JIRA_BASE_URL = "https://appier.atlassian.net"
JIRA_EMAIL = ""
```

Note: `JIRA_API_TOKEN` is a secret — set via `wrangler secret put JIRA_API_TOKEN`, never in wrangler.toml. `JIRA_EMAIL` can be a var for dev but should also be a secret in production.

**Step 4: Commit**

```bash
git add packages/sync-server/package.json packages/sync-server/src/types.ts packages/sync-server/wrangler.toml pnpm-lock.yaml
git commit -m "chore(sync-server): add jira.js, JIRA bindings and secrets config"
```

---

## Task 2: Add jiraTicketId and status to group schema

**Files:**
- Modify: `packages/sync-server/src/schemas/group.ts`
- Modify: `packages/sync-server/src/db/schema.ts`
- Modify: `packages/sync-server/src/repositories/d1.repo.ts` (row mapper)

**Step 1: Update Zod schema**

In `packages/sync-server/src/schemas/group.ts`:

```typescript
import { z } from "@hono/zod-openapi";

export const GroupStatus = z.enum(["open", "ticketed", "resolved"]).openapi({
  description: "Lifecycle status of a group",
});

export const SelectionGroup = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  revealed: z.boolean().optional(),
  status: GroupStatus.optional(),
  jiraTicketId: z.string().optional(),
});

export const SelectionGroupArray = z.array(SelectionGroup);
```

**Step 2: Update Drizzle schema**

In `packages/sync-server/src/db/schema.ts`, add to the `groups` table:

```typescript
status: text("status", { enum: ["open", "ticketed", "resolved"] }),
jiraTicketId: text("jira_ticket_id"),
```

**Step 3: Update row mapper in d1.repo.ts**

In `rowToGroup`, add the new nullable fields:

```typescript
function rowToGroup(row: typeof schema.groups.$inferSelect): Group {
  const { workspaceId, ...rest } = row;
  return {
    ...rest,
    revealed: rest.revealed ?? undefined,
    status: rest.status ?? undefined,
    jiraTicketId: rest.jiraTicketId ?? undefined,
  };
}
```

**Step 4: Add updateGroupJira method to SyncRepository**

In `packages/sync-server/src/repositories/types.ts`:

```typescript
export interface SyncRepository {
  listComments(workspaceId: string): Promise<Comment[]>;
  persistComments(workspaceId: string, items: Comment[]): Promise<void>;
  listGroups(workspaceId: string): Promise<Group[]>;
  persistGroups(workspaceId: string, items: Group[]): Promise<void>;
  updateGroupJira(workspaceId: string, groupId: string, jiraTicketId: string): Promise<void>;
}
```

Implement in `d1.repo.ts`:

```typescript
async updateGroupJira(workspaceId: string, groupId: string, jiraTicketId: string): Promise<void> {
  await this.db
    .update(schema.groups)
    .set({ jiraTicketId, status: "ticketed" })
    .where(
      and(
        eq(schema.groups.id, groupId),
        eq(schema.groups.workspaceId, workspaceId),
      ),
    );
}
```

**Step 5: Generate migration**

```bash
cd packages/sync-server && npx drizzle-kit generate
```

**Step 6: Apply migration locally**

```bash
pnpm --filter @react-grab/sync-server db:migrate:local
```

**Step 7: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: May have errors from Task 1's `JiraService` import — that's OK, fixed in Task 3.

**Step 8: Commit**

```bash
git add packages/sync-server/src/schemas/ packages/sync-server/src/db/ packages/sync-server/src/repositories/ packages/sync-server/drizzle/
git commit -m "feat(sync-server): add jiraTicketId and status to group schema + migration"
```

---

## Task 3: Create JiraService

**Files:**
- Create: `packages/sync-server/src/services/jira.service.ts`

This wraps `jira.js` with our domain logic. All JIRA types come from the library — zero hand-written types.

**Step 1: Create the service**

```typescript
import { Version3Client } from "jira.js";
import type { SyncRepository } from "../repositories/types.js";
import type { ScreenshotStore } from "../repositories/types.js";

interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface CreateTicketParams {
  projectKey: string;
  issueType: string;
  priority: string;
  summary: string;
  description: string;
}

interface CreateTicketResult {
  jiraTicketId: string;
  jiraUrl: string;
}

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = new Version3Client({
      host: config.baseUrl,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });
  }

  async createTicketFromGroup(
    params: CreateTicketParams,
    workspaceId: string,
    groupId: string,
    repo: SyncRepository,
    screenshots: ScreenshotStore,
  ): Promise<CreateTicketResult> {
    // 1. Load comments for this group
    const comments = await repo.listComments(workspaceId);
    const groupComments = comments.filter((c) => c.groupId === groupId);

    // 2. Build description — jira.js auto-converts plain text to ADF
    const descriptionText = this.buildDescription(params.description, groupComments);

    // 3. Create the issue
    const issue = await this.client.issues.createIssue({
      fields: {
        project: { key: params.projectKey },
        summary: params.summary,
        description: descriptionText,
        issuetype: { name: params.issueType },
        priority: { name: params.priority },
        labels: ["react-grab"],
      },
    });

    const ticketId = issue.key!;
    const ticketUrl = `${this.config.baseUrl}/browse/${ticketId}`;

    // 4. Attach screenshots
    for (const comment of groupComments) {
      for (const type of ["element", "full"] as const) {
        const key = type === "element" ? comment.screenshotElement : comment.screenshotFullPage;
        if (!key) continue;

        const screenshot = await screenshots.get(key);
        if (!screenshot) continue;

        // Read the stream into a buffer
        const chunks: Uint8Array[] = [];
        const reader = screenshot.body.getReader();
        let done = false;
        while (!done) {
          const result = await reader.read();
          if (result.value) chunks.push(result.value);
          done = result.done;
        }
        const buffer = Buffer.concat(chunks);

        await this.client.issueAttachments.addAttachment({
          issueIdOrKey: ticketId,
          attachment: {
            filename: `${comment.id}-${type}.png`,
            file: buffer,
          },
        });
      }
    }

    // 5. Update group in D1
    await repo.updateGroupJira(workspaceId, groupId, ticketId);

    return { jiraTicketId: ticketId, jiraUrl: ticketUrl };
  }

  async getProjects() {
    const result = await this.client.projects.searchProjects();
    return result.values?.map((p) => ({
      key: p.key!,
      name: p.name!,
    })) ?? [];
  }

  async getIssueTypes(projectKey: string) {
    const types = await this.client.issueTypes.getIssueAllTypes();
    return types.map((t) => ({
      id: t.id!,
      name: t.name!,
    }));
  }

  async getPriorities() {
    const priorities = await this.client.issuePriorities.getPriorities();
    return priorities.map((p) => ({
      id: p.id!,
      name: p.name!,
    }));
  }

  async getIssueStatus(ticketId: string) {
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: ticketId,
      fields: ["status"],
    });
    return {
      status: issue.fields.status?.name ?? "Unknown",
      statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
    };
  }

  private buildDescription(
    userDescription: string,
    comments: Array<{ id: string; componentName?: string; elementName: string; tagName: string; commentText?: string; elementSelectors?: string[] }>,
  ): string {
    let desc = userDescription + "\n\n---\n\n";
    desc += "## Selections\n\n";
    comments.forEach((c, i) => {
      desc += `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>\n`;
      if (c.commentText) desc += `${c.commentText}\n`;
      if (c.elementSelectors?.[0]) desc += `Selector: \`${c.elementSelectors[0]}\`\n`;
      desc += "\n";
    });
    desc += "\n_Created by react-grab dashboard_";
    return desc;
  }
}
```

**Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/sync-server/src/services/
git commit -m "feat(sync-server): create JiraService — wraps jira.js typed client"
```

---

## Task 4: Add JIRA injection to middleware

**Files:**
- Modify: `packages/sync-server/src/middleware/inject-repos.ts`

**Step 1: Inject JiraService into context**

```typescript
import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema.js";
import { D1SyncRepository } from "../repositories/d1.repo.js";
import { R2ScreenshotStore } from "../repositories/r2.store.js";
import { JiraService } from "../services/jira.service.js";
import type { AppEnv } from "../types.js";

export const injectRepos = createMiddleware<AppEnv>(async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("repo", new D1SyncRepository(db));
  c.set("screenshots", new R2ScreenshotStore(c.env.BUCKET));
  c.set("jira", new JiraService({
    baseUrl: c.env.JIRA_BASE_URL,
    email: c.env.JIRA_EMAIL,
    apiToken: c.env.JIRA_API_TOKEN,
  }));
  await next();
});
```

**Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add packages/sync-server/src/middleware/
git commit -m "feat(sync-server): inject JiraService via middleware"
```

---

## Task 5: Create JIRA Zod schemas and routes

**Files:**
- Create: `packages/sync-server/src/schemas/jira.ts`
- Modify: `packages/sync-server/src/schemas/index.ts`
- Create: `packages/sync-server/src/routes/jira.ts`
- Modify: `packages/sync-server/src/app.ts`

**Step 1: Create Zod schemas for JIRA endpoints**

`packages/sync-server/src/schemas/jira.ts`:

```typescript
import { z } from "@hono/zod-openapi";

export const CreateJiraTicketRequest = z.object({
  projectKey: z.string().openapi({ example: "ATT" }),
  issueType: z.string().openapi({ example: "Bug" }),
  priority: z.string().openapi({ example: "Medium" }),
  summary: z.string().openapi({ example: "CardDescription text overflow on mobile" }),
  description: z.string().openapi({ example: "The tagline text overflows on mobile viewports." }),
});

export const CreateJiraTicketResponse = z.object({
  jiraTicketId: z.string().openapi({ example: "ATT-123" }),
  jiraUrl: z.string().openapi({ example: "https://appier.atlassian.net/browse/ATT-123" }),
});

export const JiraProject = z.object({
  key: z.string(),
  name: z.string(),
});

export const JiraIssueType = z.object({
  id: z.string(),
  name: z.string(),
});

export const JiraPriority = z.object({
  id: z.string(),
  name: z.string(),
});

export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
});

export const GroupIdParam = z.object({
  id: z.string().openapi({ description: "Workspace ID" }),
  groupId: z.string().openapi({ description: "Group ID" }),
});
```

**Step 2: Update schemas barrel export**

In `packages/sync-server/src/schemas/index.ts`, add:

```typescript
export {
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  JiraProject,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  GroupIdParam,
} from "./jira.js";
```

**Step 3: Create JIRA routes**

`packages/sync-server/src/routes/jira.ts`:

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "../lib/create-router.js";
import {
  CreateJiraTicketRequest,
  CreateJiraTicketResponse,
  JiraProject,
  JiraIssueType,
  JiraPriority,
  JiraTicketStatus,
  GroupIdParam,
  WorkspaceIdParam,
  ErrorResponse,
} from "../schemas/index.js";

const createTicket = createRoute({
  method: "post",
  path: "/workspaces/{id}/groups/{groupId}/jira-ticket",
  tags: ["jira"],
  summary: "Create a JIRA ticket from a group",
  operationId: "createJiraTicket",
  request: {
    params: GroupIdParam,
    body: {
      content: { "application/json": { schema: CreateJiraTicketRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Ticket created",
      content: { "application/json": { schema: CreateJiraTicketResponse } },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const getTicketStatus = createRoute({
  method: "get",
  path: "/workspaces/{id}/groups/{groupId}/jira-status",
  tags: ["jira"],
  summary: "Get JIRA ticket status for a group",
  operationId: "getJiraTicketStatus",
  request: { params: GroupIdParam },
  responses: {
    200: {
      description: "Ticket status",
      content: { "application/json": { schema: JiraTicketStatus } },
    },
    404: {
      description: "No JIRA ticket linked",
      content: { "application/json": { schema: ErrorResponse } },
    },
  },
});

const listProjects = createRoute({
  method: "get",
  path: "/jira/projects",
  tags: ["jira"],
  summary: "List JIRA projects",
  operationId: "listJiraProjects",
  responses: {
    200: {
      description: "List of projects",
      content: { "application/json": { schema: z.array(JiraProject) } },
    },
  },
});

const listIssueTypes = createRoute({
  method: "get",
  path: "/jira/issue-types",
  tags: ["jira"],
  summary: "List JIRA issue types",
  operationId: "listJiraIssueTypes",
  responses: {
    200: {
      description: "List of issue types",
      content: { "application/json": { schema: z.array(JiraIssueType) } },
    },
  },
});

const listPriorities = createRoute({
  method: "get",
  path: "/jira/priorities",
  tags: ["jira"],
  summary: "List JIRA priorities",
  operationId: "listJiraPriorities",
  responses: {
    200: {
      description: "List of priorities",
      content: { "application/json": { schema: z.array(JiraPriority) } },
    },
  },
});

export const jiraRoutes = createRouter()
  .openapi(createTicket, async (c) => {
    const { id: workspaceId, groupId } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await c.var.jira.createTicketFromGroup(
      body,
      workspaceId,
      groupId,
      c.var.repo,
      c.var.screenshots,
    );
    return c.json(result, 200);
  })
  .openapi(getTicketStatus, async (c) => {
    const { id: workspaceId, groupId } = c.req.valid("param");
    const groups = await c.var.repo.listGroups(workspaceId);
    const group = groups.find((g) => g.id === groupId);
    if (!group?.jiraTicketId) {
      return c.json({ error: "No JIRA ticket linked to this group" }, 404);
    }
    const status = await c.var.jira.getIssueStatus(group.jiraTicketId);
    return c.json(status, 200);
  })
  .openapi(listProjects, async (c) => {
    const projects = await c.var.jira.getProjects();
    return c.json(projects, 200);
  })
  .openapi(listIssueTypes, async (c) => {
    const types = await c.var.jira.getIssueTypes("");
    return c.json(types, 200);
  })
  .openapi(listPriorities, async (c) => {
    const priorities = await c.var.jira.getPriorities();
    return c.json(priorities, 200);
  });
```

**Step 4: Register routes in app.ts**

In `packages/sync-server/src/app.ts`, add:

```typescript
import { jiraRoutes } from "./routes/jira.js";
```

And inside `createApp()`:

```typescript
app.route("/", jiraRoutes);
```

**Step 5: Verify tsc**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add packages/sync-server/src/schemas/ packages/sync-server/src/routes/jira.ts packages/sync-server/src/app.ts
git commit -m "feat(sync-server): add JIRA routes — create ticket, status, projects, issue types, priorities"
```

---

## Task 6: Export spec + regenerate Orval for dashboard and react-grab

**Files:**
- Generated: `packages/sync-server/openapi.json`
- Generated: `packages/dashboard/src/api/`
- Generated: `packages/react-grab/src/generated/`

**Step 1: Export updated spec**

```bash
pnpm --filter @react-grab/sync-server export-spec
```

**Step 2: Regenerate dashboard types**

```bash
pnpm --filter dashboard codegen
```

**Step 3: Regenerate react-grab types**

```bash
pnpm --filter react-grab codegen
```

**Step 4: Verify new hooks exist**

```bash
grep "useCreateJiraTicket\|useListJiraProjects\|useListJiraPriorities\|useGetJiraTicketStatus" packages/dashboard/src/api/endpoints/jira/jira.ts
```

Expected: All four hooks generated.

**Step 5: Verify builds**

```bash
pnpm --filter dashboard build
pnpm --filter react-grab build
```

**Step 6: Run codegen freshness check**

```bash
pnpm check:codegen
```

**Step 7: Commit**

```bash
git add packages/sync-server/openapi.json packages/dashboard/src/api/ packages/react-grab/src/generated/
git commit -m "feat: regenerate Orval types — JIRA hooks now available in dashboard"
```

---

## Task 7: Set JIRA secrets and test end-to-end

**Step 1: Set local JIRA secrets**

For local development with `wrangler dev`, create `.dev.vars` in `packages/sync-server/`:

```
JIRA_API_TOKEN=your-api-token-here
JIRA_EMAIL=your-email@company.com
```

Add `.dev.vars` to `.gitignore`:

```
openapi.json
.wrangler/
retrieved.jpg
.dev.vars
```

**Step 2: Create an API token**

Go to https://id.atlassian.com/manage-profile/security/api-tokens and create a token.

**Step 3: Start sync-server**

```bash
pnpm --filter @react-grab/sync-server dev
```

**Step 4: Test JIRA connection — list projects**

```bash
curl -s http://localhost:8787/jira/projects | jq .
```

Expected: List of JIRA projects from `appier.atlassian.net`.

**Step 5: Test ticket creation**

```bash
curl -s -X POST http://localhost:8787/workspaces/my-workspace/groups/default/jira-ticket \
  -H "Content-Type: application/json" \
  -d '{
    "projectKey": "ATT",
    "issueType": "Task",
    "priority": "Medium",
    "summary": "Test from react-grab dashboard",
    "description": "Testing JIRA integration"
  }' | jq .
```

Expected: `{ "jiraTicketId": "ATT-xxx", "jiraUrl": "https://appier.atlassian.net/browse/ATT-xxx" }`

**Step 6: Verify the ticket exists in JIRA**

Open `https://appier.atlassian.net/browse/ATT-xxx` — should see the ticket with attached screenshots.

**Step 7: Verify group updated in D1**

```bash
curl -s http://localhost:8787/workspaces/my-workspace/groups | jq '.[] | select(.id == "default") | {id, jiraTicketId, status}'
```

Expected: `{ "id": "default", "jiraTicketId": "ATT-xxx", "status": "ticketed" }`

**Step 8: Commit**

```bash
git add packages/sync-server/.gitignore
git commit -m "feat(sync-server): JIRA integration tested end-to-end"
```

---

## Summary

After all 7 tasks:

| New in sync-server | What |
|---|---|
| `services/jira.service.ts` | `jira.js` wrapper — create ticket, attach, get status, list projects/types/priorities |
| `schemas/jira.ts` | Zod schemas for JIRA request/response |
| `routes/jira.ts` | 5 OpenAPI routes |
| Group schema + migration | `jiraTicketId`, `status` fields |
| `inject-repos.ts` updated | Injects `JiraService` |
| Bindings updated | JIRA secrets |

| Generated for dashboard | What |
|---|---|
| `useCreateJiraTicket` | Mutation hook — POST /groups/:id/jira-ticket |
| `useGetJiraTicketStatus` | Query hook — GET /groups/:id/jira-status |
| `useListJiraProjects` | Query hook — GET /jira/projects |
| `useListJiraIssueTypes` | Query hook — GET /jira/issue-types |
| `useListJiraPriorities` | Query hook — GET /jira/priorities |

**Type SSOT chain:**
- `jira.js` types → `JiraService` methods (typed from Atlassian OpenAPI)
- Our Zod schemas → OpenAPI → Orval → dashboard hooks (typed from our API)
- Dashboard never knows JIRA exists — it calls sync-server hooks

**Next plan needed:** Dashboard JIRA create dialog — uses the generated `useCreateJiraTicket` + `useListJiraProjects` + `useListJiraPriorities` hooks to render the form from the PoC HTML.
