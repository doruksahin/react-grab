# sync-server — Package Guide

Cloudflare Worker backend — Hono + D1 (Drizzle ORM) + R2. Persists selections, screenshots, and proxies JIRA API.

## Layered pattern

Don't create feature folders on the server. Follow the existing layers:

```
src/
  schemas/<resource>.ts         — Zod schemas (SSOT for the API contract)
  routes/<resource>.ts          — Hono route handlers (thin — validate, delegate, respond)
  services/<name>.service.ts    — business logic (external API calls, data transforms)
  services/__tests__/           — service unit tests
  repositories/                 — data access (D1, R2)
  middleware/                   — request middleware (repo injection, auth)
  db/schema.ts                  — Drizzle ORM table definitions
```

### Layer rules

- **Schemas** are the single source of truth. Routes, services, and generated clients all derive from them.
- **Routes** are thin glue — validate input with Zod, call the service, return the response. No business logic in routes.
- **Services** own business logic. They receive typed inputs, call external APIs (JIRA, etc.), and return typed outputs. Services don't know about Hono request/response objects.
- **Repositories** abstract storage (D1 queries, R2 reads/writes). Services call repositories, not D1/R2 directly.

## Zod → OpenAPI → Codegen flow

Schemas are defined with `@hono/zod-openapi` decorators. When you add or modify a schema:

```bash
# 1. Export updated OpenAPI spec
pnpm --filter @react-grab/sync-server export-spec

# 2. Regenerate react-grab typed client
pnpm --filter react-grab codegen

# 3. Regenerate dashboard typed client
pnpm --filter dashboard codegen

# 4. Verify everything is in sync
pnpm check:codegen
```

## Database (D1 + Drizzle)

Schema in `src/db/schema.ts`. Migrations in `drizzle/`.

```bash
# Generate migration from schema changes
pnpm --filter @react-grab/sync-server db:generate

# Apply migrations to local D1
pnpm --filter @react-grab/sync-server db:migrate:local

# Reset local D1 (destructive)
pnpm --filter @react-grab/sync-server db:reset:local
```

## JIRA service

`src/services/jira.service.ts` is the main JIRA integration point. Capabilities:

- `createTicketFromGroup` — create issue, attach screenshots, save ticket ID
- `getIssueStatus` — fetch status, comments, flag state, assignee, reporter, avatars
- `addComment` — markdown → ADF conversion with mention injection via `jira-adf-mentions.ts`
- `uploadBase64Images` — upload inline images to JIRA attachments
- `searchUsers` — user search for @mention resolution
- `fetchThreadedComments` — threaded comments via Atlassian GraphQL gateway

## Configuration

`JIRA_BASE_URL` is a non-secret `[vars]` entry in `wrangler.toml` and decides which Jira site every ticket lands on. `JIRA_EMAIL` and `JIRA_API_TOKEN` are per-developer: copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill them in. In production set them on the deployed Worker with `wrangler secret put`, never in a committed file.

All three are described by `src/schemas/env.ts` — the sixth schema in that folder — and validated by `parseJiraEnv()` in `middleware/inject-repos.ts`, the one place the configuration is read. A missing or malformed value fails the first request with every problem named, instead of an opaque Jira 401 later. See ADR-0018 for why this is a Zod schema rather than an env library.

## Writes are per item

Comments and groups are written one item at a time — `PUT`/`DELETE` on `/workspaces/{id}/comments/{commentId}` and `/workspaces/{id}/groups/{groupId}`. There is no route that replaces a whole workspace's list, and none should be added: that is what let a stale client erase other people's comments and the server's ticket links (ADR-0019). A group's `status` and `jiraTicketId` are server-owned — set only by `updateGroupJira` — and are absent from the group write schema.

## Tests

`pnpm --filter @react-grab/sync-server exec vitest run`. Tests run inside workerd through Cloudflare's `@cloudflare/vitest-plugin`, against real D1: `vitest.config.ts` reads the drizzle migrations and `src/test/apply-migrations.ts` applies them. Storage is isolated per test file, not per test, so give each test its own workspace id. Route tests call the Worker through `SELF.fetch`; the config supplies fake Jira credentials so the env schema passes, and no test reaches Jira.

## Dev server

```bash
pnpm sync:dev    # wrangler dev on :8787 with local D1/R2 emulation
```

Swagger UI available at `http://localhost:8787/swagger`.
Health check at `http://localhost:8787/health`.

## Middleware

`inject-repos.ts` creates repository and service instances from Cloudflare bindings and injects them into Hono context. Routes access them via `c.var.syncRepo`, `c.var.screenshotStore`, `c.var.jiraService`.
