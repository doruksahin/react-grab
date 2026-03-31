# Sync Workspace — Design

## Problem

Selections, groups, and revealed states live in sessionStorage (browser tab-scoped). Users can't share their work with colleagues. There's no way for two people to see the same set of selections on the same page.

## Solution

A shared workspace system where multiple users operate on the same selection data. Server is the only source of truth. No auth, no fallback, no offline mode. Opt-in via configuration — without a workspace config, react-grab works exactly as it does today (sessionStorage).

---

## Architecture

### Three pieces

1. **`packages/sync-server/`** — Node.js REST server, file-based JSON storage
2. **`packages/react-grab/src/features/sync/`** — Client feature module, swaps storage layer from sessionStorage to HTTP
3. **Config in `comment-storage.ts` / `group-storage.ts`** — Accept pluggable storage adapter

### Storage layer swap

```
No workspace configured:
  comment-storage.ts → sessionStorage (unchanged)
  group-storage.ts   → sessionStorage (unchanged)

Workspace configured:
  comment-storage.ts → SyncStorage → server (only)
  group-storage.ts   → SyncStorage → server (only)
```

The rest of the system (core, features, UI) doesn't know sync exists. Same function signatures, same synchronous API after initialization.

### Data flow

```
Write:
  User A adds comment
    → addCommentItem()
    → SyncStorage.persist() → PUT /workspaces/:id/comments
    → in-memory cache updated
    → signal fires → UI updates

Read:
  User B loads page
    → SyncStorage.init() → GET /workspaces/:id/comments
    → cache populated → signal initialized → UI renders
```

---

## Server API

```
GET    /workspaces/:id/comments    → CommentItem[]
PUT    /workspaces/:id/comments    → replace all comments (body: CommentItem[])
GET    /workspaces/:id/groups      → SelectionGroup[]
PUT    /workspaces/:id/groups      → replace all groups (body: SelectionGroup[])
GET    /health                     → { status: "ok" }
```

PUT replaces the full array. Matches the existing `persistCommentItems(allItems)` pattern — the client always writes the entire state, not individual operations.

### Server storage

File-based JSON. No database.

```
data/
  workspaces/
    project-x/
      comments.json
      groups.json
    project-y/
      comments.json
      groups.json
```

---

## Client Wiring

### Async initialization, sync operations after

`loadComments()` is currently synchronous (sessionStorage is sync). With a server, the initial load is async. After that, all operations are sync (read from cache, write-through to server).

```
Init (async, happens once):
  1. GET /workspaces/:id/comments → populate in-memory cache
  2. GET /workspaces/:id/groups   → populate in-memory cache
  3. Signals initialize from cache (sync, same as today)

Writes (sync cache + async server):
  1. Update in-memory cache (sync, immediate)
  2. PUT to server (async)
  3. If PUT fails → throw (server is source of truth, no silent swallow)
```

### Configuration

```typescript
// Workspace configured — sync enabled
init({
  sync: {
    serverUrl: "http://localhost:3847",
    workspace: "project-x",
  },
});

// No sync config — sessionStorage only (current behavior)
init({});
```

---

## Package Structure

### Server

```
packages/sync-server/
  src/
    index.ts              ← entry point
    routes/
      comments.ts         ← GET/PUT comments
      groups.ts           ← GET/PUT groups
      health.ts           ← health check
    storage/
      file-storage.ts     ← read/write JSON files to data/
    types.ts              ← API contract types
  package.json
```

### Client

```
packages/react-grab/src/features/sync/
  types.ts                ← SyncConfig, SyncStorageAdapter interface
  index.ts                ← createSyncStorage(config) factory
  adapter.ts              ← HTTP client (fetch wrapper for server API)
```

### Shared types

API contract types (request/response shapes) live in `sync-server/src/types.ts` and are imported by the client. Monorepo workspace makes this a direct import — no npm publish needed.

---

## Environment Isolation

Each environment runs its own server instance. No namespacing.

```
dev:     http://localhost:3847
staging: https://rg-sync-staging.adcreative.ai
prod:    https://rg-sync.adcreative.ai
```

Workspace `project-x` on dev is completely isolated from `project-x` on prod.

---

## What Doesn't Change

- All existing code (core, features, UI) — unaware of sync
- Function signatures in `comment-storage.ts` / `group-storage.ts`
- sessionStorage behavior when no workspace is configured
- MCP server (independent system, not affected)
- Copy flow (copies from in-memory state, doesn't care where it came from)

## Not In Scope

- Real-time sync (WebSocket, SSE) — user refreshes to see colleague's changes
- Auth / access control — anyone with workspace ID can read/write
- Conflict resolution — last-write-wins via PUT
- User identity / attribution — no "who added this comment"
- Offline mode / fallback — server down = error
- Polling for changes — manual refresh only
