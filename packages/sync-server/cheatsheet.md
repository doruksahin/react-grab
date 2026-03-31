# sync-server cheatsheet

## Production URL

```
https://react-grab-sync-server.doruksahin98.workers.dev
```

## Architecture

```
src/
  app.ts                    ← createApp() — single route composition
  worker.ts                 ← Cloudflare Worker entry (4 lines)
  export-spec.ts            ← Generates openapi.json without running server

  schemas/                  ← Zod schemas (SSOT for all API types)
  db/schema.ts              ← Drizzle tables (mirrors Zod schemas)

  repositories/
    types.ts                ← SyncRepository + ScreenshotStore interfaces
    d1.repo.ts              ← D1 implementation (Drizzle queries)
    r2.store.ts             ← R2 implementation (blob storage)

  middleware/
    inject-repos.ts         ← DI: creates repo + store from Cloudflare bindings

  routes/                   ← OpenAPIHono routes, handlers use c.var.repo
  lib/                      ← createRouter(), doc-config
  types.ts                  ← AppEnv (Bindings + Variables)
```

## Setup

```bash
pnpm install
pnpm db:migrate:local       # Apply D1 migrations locally (run once, or after schema changes)
```

## Dev

```bash
pnpm dev                    # Wrangler — D1 + R2 emulated locally, http://localhost:8787
```

## Type flow (SSOT)

```
schemas/*.ts (Zod)          ← EDIT HERE to add/change fields
  ↓ pnpm export-spec
openapi.json                ← derived artifact
  ↓ pnpm --filter dashboard codegen
dashboard/src/api/          ← Orval-generated hooks + types + MSW mocks
  ↓ pnpm --filter react-grab codegen (planned)
react-grab/src/generated/   ← Orval-generated types (planned)
```

One source of truth. Never hand-write API types in dashboard or react-grab.

## Scripts

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Start with Wrangler (D1 + R2 local emulation) |
| `pnpm export-spec` | Generate `openapi.json` from Zod schemas |
| `pnpm db:generate` | Generate Drizzle migration after schema changes |
| `pnpm db:migrate:local` | Apply migrations to local D1 |
| `pnpm db:migrate:prod` | Apply migrations to production D1 |
| `pnpm publish:worker` | Deploy to Cloudflare Workers |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/doc` | OpenAPI JSON spec |
| GET | `/ui` | Swagger UI |
| GET | `/workspaces/:id/comments` | List comments |
| PUT | `/workspaces/:id/comments` | Replace all comments |
| GET | `/workspaces/:id/groups` | List groups |
| PUT | `/workspaces/:id/groups` | Replace all groups |
| PUT | `/workspaces/:id/screenshots/:selectionId/:type` | Upload screenshot (`type`: `full` or `element`) |
| GET | `/workspaces/:id/screenshots/:selectionId/:type` | Get screenshot |

## curl examples

```bash
# Health
curl http://localhost:8787/health

# List comments
curl http://localhost:8787/workspaces/my-workspace/comments

# Persist comments
curl -X PUT http://localhost:8787/workspaces/my-workspace/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"c1","groupId":"g1","content":"<div/>","elementName":"Div","tagName":"div","timestamp":1234,"revealed":true}]'

# List groups
curl http://localhost:8787/workspaces/my-workspace/groups

# Persist groups
curl -X PUT http://localhost:8787/workspaces/my-workspace/groups \
  -H "Content-Type: application/json" \
  -d '[{"id":"g1","name":"My Group","createdAt":1234,"revealed":true}]'

# Upload screenshot
curl -X PUT http://localhost:8787/workspaces/my-workspace/screenshots/c1/element \
  -H "Content-Type: image/png" \
  --data-binary @screenshot.png

# Get screenshot
curl http://localhost:8787/workspaces/my-workspace/screenshots/c1/element -o retrieved.png

# OpenAPI spec
curl http://localhost:8787/doc | jq .

# Swagger UI (browser)
open http://localhost:8787/ui
```

## Database

```bash
pnpm db:generate            # Generate new migration after schema changes
pnpm db:migrate:local       # Apply migrations to local D1
pnpm db:migrate:prod        # Apply migrations to production D1
```

- Schema: `src/db/schema.ts`
- Migrations: `drizzle/`

## Adding a new field

1. Add to Zod schema in `src/schemas/*.ts`
2. Add to Drizzle schema in `src/db/schema.ts`
3. `pnpm db:generate` → new migration file
4. `pnpm db:migrate:local` → apply locally
5. `pnpm export-spec` → update `openapi.json`
6. `pnpm --filter dashboard codegen` → regenerate dashboard types
7. Update repository if needed (`repositories/d1.repo.ts`)

## Production deploy

```bash
# First time only
wrangler login
wrangler r2 bucket create react-grab-screenshots

# Deploy
pnpm db:migrate:prod        # Apply migrations to production D1
pnpm publish:worker         # Deploy worker

# Verify
curl https://react-grab-sync-server.doruksahin98.workers.dev/health
```

## Known TODOs

- Squash 3 migrations into 1 before first production deploy
