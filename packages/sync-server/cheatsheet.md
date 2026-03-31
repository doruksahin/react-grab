# sync-server cheatsheet

## Production URL

```
https://react-grab-sync-server.doruksahin98.workers.dev
```

## Setup

```bash
# Install deps (already done)
pnpm install

# Apply local D1 migrations (run once, or after schema changes)
pnpm db:migrate:local
```

## Dev Modes

```bash
pnpm dev        # Wrangler — D1 + R2, http://localhost:8787
pnpm dev:node   # Node.js  — file storage, http://localhost:3847
```

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

## curl Examples

```bash
# Health
curl http://localhost:8787/health

# List comments (empty on fresh DB)
curl http://localhost:8787/workspaces/test/comments

# Persist comments
curl -X PUT http://localhost:8787/workspaces/test/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"c1","groupId":"g1","content":"<div/>","elementName":"Div","tagName":"div","timestamp":1234,"revealed":true}]'

# List groups
curl http://localhost:8787/workspaces/test/groups

# Persist groups
curl -X PUT http://localhost:8787/workspaces/test/groups \
  -H "Content-Type: application/json" \
  -d '[{"id":"g1","name":"My Group","createdAt":1234,"revealed":true}]'

# Upload screenshot (jpeg)
curl -X PUT http://localhost:8787/workspaces/test/screenshots/c1/element \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/image.jpg

# Upload screenshot (png)
curl -X PUT http://localhost:8787/workspaces/test/screenshots/c1/full \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/image.png

# Get screenshot (save to file)
curl http://localhost:8787/workspaces/test/screenshots/c1/element -o retrieved.jpg

# Get screenshot (open in browser)
open http://localhost:8787/workspaces/test/screenshots/c1/element
```

## Database

```bash
pnpm db:generate        # Generate new migration after schema changes
pnpm db:migrate:local   # Apply migrations to local D1
```

Schema: `src/db/schema.ts`
Migrations: `drizzle/`

## Production Deploy

```bash
# 0. Login (once)
wrangler login

# 1. Create D1 database (once)
wrangler d1 create react-grab-sync
# → paste the returned database_id into wrangler.toml:
#   database_id = "xxxx-xxxx-xxxx-xxxx"  (replace "local")

# 2. Create R2 bucket (once)
wrangler r2 bucket create react-grab-screenshots

# 3. Apply migrations to production D1
cd packages/sync-server
wrangler d1 migrations apply react-grab-sync

# 4. Deploy — outputs a *.workers.dev URL
wrangler deploy
```

## Export OpenAPI spec + Dashboard codegen

```bash
pnpm export-spec                              # generates openapi.json
pnpm --filter dashboard codegen              # regenerates Orval hooks
```

## Known TODOs

- Squash 3 migrations into 1 before first production deploy
- Replace `database_id = "local"` in `wrangler.toml` with real D1 ID
- Extract duplicate route definitions from `index.ts` into shared `route-defs.ts`
- Fix Swagger UI server URL (hardcoded port 3847, Wrangler uses 8787)
