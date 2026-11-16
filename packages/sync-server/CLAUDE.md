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

When a release adds a migration, apply it to production before deploying the Worker: `pnpm --filter @react-grab/sync-server db:migrate:prod`, then `wrangler deploy`. A Worker whose schema has a column the database lacks fails every query on that table.

## JIRA service

`src/services/jira.service.ts` is the main JIRA integration point. Capabilities:

- `createTicketFromGroup` — create issue, attach screenshots, save ticket ID. The description is ADF built from the group's comments in D1 by `jira-ticket-description.ts` and checked by `adf-validation.ts` (ADR-0029, SPEC-021); the reporter's note goes through `marklassian`
- `getIssueStatus` — fetch status, comments, flag state, assignee, reporter, avatars
- `addComment` — markdown → ADF conversion with mention injection via `jira-adf-mentions.ts`
- `uploadBase64Images` — upload inline images to JIRA attachments
- `searchUsers` — user search for @mention resolution
- `fetchThreadedComments` — threaded comments via Atlassian GraphQL gateway
- `getMyself` — the Jira user an account signs in as (`GET /rest/api/3/myself`, no redirects), used to verify an account before it is saved
- `hasProject` — whether the account can see a project, checked before a workspace is bound to it

`JiraService` talks to one account. It never chooses one: `services/jira-client-factory.ts` builds it for a workspace's destination (new tickets, pickers) or for a ticket's origin (status, comments, attachments) — ADR-0027. `services/jira-ticket.service.ts` runs the ticket flow through the right account, `jira-account.service.ts` adds and verifies accounts, `workspace.service.ts` binds workspaces, `credential-vault.ts` encrypts tokens (AES-256-GCM, Web Crypto), and `jira-errors.ts` maps every Jira failure to one typed `JiraError` with a `code` the client can show.

## Configuration

Jira accounts live in D1 (`jira_accounts`), entered in the extension's settings; each workspace has an optional destination (`workspaces.jira_account_id`, `jira_project_key`), and each group with a ticket records the account that created it (`groups.jira_account_id`) — ADR-0027. Account tokens are stored only encrypted, with the key ring `JIRA_CREDENTIAL_KEYS` (secret JSON `{version: base64 key}`) and `JIRA_CREDENTIAL_KEY_CURRENT`, validated by `parseCredentialEnv()`. The vault is built only when a request opens an account. To rotate the key: add a version to the ring, make it current, call `POST /jira-accounts/reencrypt` with the admin token, then remove the old version.

There is no Jira account in the environment any more: a workspace without a destination answers `409 jira-destination-missing`, and a ticket is always read through the account that created it. Copy `.dev.vars.example` to `.dev.vars` (gitignored) for local work; in production use `wrangler secret put`, never a committed file. Every part of the environment is a Zod schema in `src/schemas/env.ts` (ADR-0018).

## Access control

Every route under `/workspaces/*` requires `Authorization: Bearer <SYNC_API_TOKEN>` (Hono's `bearerAuth`). The admin routes — `/jira-accounts/*` and `PUT`/`DELETE /workspaces/{id}/jira` — require `SYNC_ADMIN_TOKEN` instead (ADR-0027); the admin token also passes everywhere the sync token does. Host apps hold only the sync token, so a script on their pages cannot add accounts or redirect tickets. Without a configured admin token the admin routes fail closed. CORS allows only local dev servers plus `ALLOWED_ORIGINS` — see `middleware/access-control.ts` and ADR-0020. `/health`, `/doc` and `/ui` stay public. The token is validated by `parseAuthEnv()` in `schemas/env.ts`; if it is missing or shorter than 32 characters, every API request fails closed. Do not add a route outside these prefixes that reads or writes data. The one exception is `GET /r/{shareId}` in `routes/recordings.ts`: a recording's random share id is itself the permission, so a Jira reader can watch it without a token (a capability URL, ADR-0021). It only reads, and only the object named by that id.

## Writes are per item

Comments and groups are written one item at a time — `PUT`/`DELETE` on `/workspaces/{id}/comments/{commentId}` and `/workspaces/{id}/groups/{groupId}`. There is no route that replaces a whole workspace's list, and none should be added: that is what let a stale client erase other people's comments and the server's ticket links (ADR-0019). A group's `status` and `jiraTicketId` are server-owned — set only by `updateGroupJira` — and are absent from the group write schema.

## Tests

`pnpm --filter @react-grab/sync-server exec vitest run`. Tests run inside workerd through Cloudflare's `@cloudflare/vitest-plugin`, against real D1: `vitest.config.ts` reads the drizzle migrations and `src/test/apply-migrations.ts` applies them. Storage is isolated per test file, not per test, so give each test its own workspace id. Route tests call the Worker through `SELF.fetch` and send the token with `authorized()` from `src/test/api-token.ts`. The config supplies fake tokens and a test-only key ring; no test reaches Jira. A test that links a ticket needs a stored account (D1 enforces the foreign key): use `seedJiraAccount()` from `src/test/seed-jira-account.ts`. Service tests for ADR-0027 use `src/test/jira-accounts-setup.ts` (real D1, `JiraService` methods stubbed with `vi.spyOn`); send the admin token with `asAdmin()`.

## Dev server

```bash
pnpm sync:dev    # wrangler dev on :8787 with local D1/R2 emulation
```

Swagger UI available at `http://localhost:8787/swagger`.
Health check at `http://localhost:8787/health`.

## Middleware

`inject-repos.ts` creates repository and service instances from Cloudflare bindings and injects them into Hono context. Routes access them via `c.var.repo`, `c.var.screenshots`, `c.var.ticketLock`, `c.var.jiraTickets`, `c.var.jiraAccounts`, `c.var.workspaces` and `c.var.jiraClients`. A `JiraError` thrown anywhere answers with its status and `{ error, code }` (`app.onError`).
