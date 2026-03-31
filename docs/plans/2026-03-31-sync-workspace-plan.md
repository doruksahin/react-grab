# Sync Workspace — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multiple users to share selections, groups, and comments via a shared workspace backed by a Node.js server. Server is the only source of truth when a workspace is configured. Without a workspace config, everything works unchanged (sessionStorage).

**Architecture:** A pluggable storage adapter pattern. `comment-storage.ts` and `group-storage.ts` gain an `initStorage(adapter)` function that replaces the default sessionStorage backend with an HTTP adapter. A new `features/sync/` client module provides the HTTP adapter. A new `packages/sync-server/` package provides the REST server with file-based JSON storage. `revealed` state is per-user (stays in sessionStorage), not synced.

**Tech Stack:** Node.js, Hono (lightweight HTTP framework), SolidJS, TypeScript, file-based JSON storage

**Design doc:** `docs/plans/2026-03-31-sync-workspace-design.md`

---

## Phase 1: Storage Adapter Pattern

Make `comment-storage.ts` and `group-storage.ts` accept a pluggable backend, without changing any existing behavior.

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Comment storage | `src/utils/comment-storage.ts` | Module-level `commentItems`, `persistCommentItems`, `loadComments`, `addCommentItem` |
| Group storage | `src/features/selection-groups/store/group-storage.ts` | Module-level `groups`, `persistGroups`, `loadGroups`, `addGroup` |
| Comment type | `src/types.ts:443-456` | `CommentItem` — `revealed` is per-user, rest syncs |
| Group type | `src/features/selection-groups/types.ts:6-11` | `SelectionGroup` — `revealed` is per-user, rest syncs |
| Options type | `src/types.ts:339-353` | `Options` — add `sync` config here |
| init function | `src/core/index.tsx:213` | `init(rawOptions)` — synchronous, returns API |
| createRoot | `src/core/index.tsx:240` | Main reactive root — where signals are created |
| Comment signal | `src/core/index.tsx:323-324` | `commentItems` signal initialized from `loadComments()` |
| Groups module | `src/core/index.tsx` | `createSelectionGroups(deps)` instantiation |
| Renderer import | `src/core/index.tsx:4216` | `void import("../components/renderer.js")` — existing async phase |
| Sync feature (new) | `src/features/sync/` | New feature module |
| Sync server (new) | `packages/sync-server/` | New package |

All paths relative to `packages/react-grab/` unless noted.

---

### Task 1: Define the StorageAdapter interface

**Files:**
- Create: `packages/react-grab/src/features/sync/types.ts`

**Step 1: Create the types file**

This defines the contract that any storage backend must implement. The interface mirrors the existing function signatures so the swap is transparent.

```typescript
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

/**
 * A storage adapter that can be swapped in for sessionStorage.
 * Default implementation: sessionStorage (current behavior).
 * Sync implementation: HTTP to sync-server.
 */
export interface StorageAdapter {
  /** Load all comments. Called once at init. */
  loadComments: () => Promise<CommentItem[]>;
  /** Persist the full comments array. Called on every mutation. */
  persistComments: (items: CommentItem[]) => Promise<CommentItem[]>;
  /** Load all groups. Called once at init. */
  loadGroups: () => Promise<SelectionGroup[]>;
  /** Persist the full groups array. Called on every mutation. */
  persistGroups: (groups: SelectionGroup[]) => Promise<SelectionGroup[]>;
}

/**
 * Configuration for sync. Passed via Options.sync.
 */
export interface SyncConfig {
  serverUrl: string;
  workspace: string;
  onSyncError?: (error: Error) => void;
}
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (standalone file)

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/sync/types.ts
git commit -m "feat(sync): define StorageAdapter interface and SyncConfig type"
```

---

### Task 2: Refactor comment-storage to accept a pluggable adapter

**Files:**
- Modify: `packages/react-grab/src/utils/comment-storage.ts`

The goal: add an `initCommentStorage(adapter)` function. When called, all subsequent reads/writes go through the adapter instead of sessionStorage. When NOT called, everything works exactly as before. No existing function signature changes.

**Step 1: Read the current file**

Read `packages/react-grab/src/utils/comment-storage.ts` in full. Understand the module-level state pattern.

**Step 2: Add adapter state and init function**

At the top, after the imports, add:

```typescript
import type { StorageAdapter } from "../features/sync/types.js";

let activeAdapter: StorageAdapter | null = null;
```

Add the init function (exported):

```typescript
/**
 * Initialize comment storage with a remote adapter.
 * Must be called BEFORE signals are created (before createRoot in core).
 * After calling this, loadComments/persistCommentItems use the adapter.
 */
export const initCommentStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  const remoteItems = await adapter.loadComments();
  commentItems = remoteItems;
};
```

**Step 3: Modify `persistCommentItems` to use adapter when active**

Replace the current `persistCommentItems`:

```typescript
export const persistCommentItems = (nextItems: CommentItem[]): CommentItem[] => {
  commentItems = activeAdapter ? nextItems : trimToSizeLimit(nextItems);

  if (activeAdapter) {
    // Async write to server, fire-and-forget (error via onSyncError callback)
    activeAdapter.persistComments(commentItems).catch(() => {
      // Error handling is done inside the adapter (calls onSyncError)
    });
  } else {
    try {
      sessionStorage.setItem(COMMENT_ITEMS_KEY, JSON.stringify(commentItems));
    } catch (error) {
      logRecoverableError("Failed to save comments to sessionStorage", error);
    }
  }

  return commentItems;
};
```

Key points:
- When adapter is active: skip `trimToSizeLimit` (server has no size limit), write async
- When no adapter: existing sessionStorage behavior unchanged
- `persistCommentItems` still returns `CommentItem[]` synchronously (from cache)
- The async PUT fires in the background; errors surface via the adapter

**Step 4: `loadComments` stays unchanged**

`loadComments` returns the module-level `commentItems` variable. After `initCommentStorage` populates it from the server, `loadComments()` returns the server data. No change needed.

**Step 5: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(comment-storage): add pluggable adapter with initCommentStorage"
```

---

### Task 3: Refactor group-storage to accept a pluggable adapter

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/store/group-storage.ts`

Same pattern as Task 2.

**Step 1: Add adapter state and init function**

```typescript
import type { StorageAdapter } from "../../sync/types.js";

let activeAdapter: StorageAdapter | null = null;

export const initGroupStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  const remoteGroups = await adapter.loadGroups();
  groups = remoteGroups;
};
```

**Step 2: Modify `persistGroups` to use adapter when active**

```typescript
export const persistGroups = (
  nextGroups: SelectionGroup[],
): SelectionGroup[] => {
  groups = nextGroups;

  if (activeAdapter) {
    activeAdapter.persistGroups(groups).catch(() => {
      // Error handling is done inside the adapter
    });
  } else {
    try {
      sessionStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      logRecoverableError("Failed to save groups to sessionStorage", error);
    }
  }

  return groups;
};
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/store/group-storage.ts
git commit -m "feat(group-storage): add pluggable adapter with initGroupStorage"
```

---

### Task 4: Add `sync` to Options and wire init in core

**Files:**
- Modify: `packages/react-grab/src/types.ts:339-353`
- Modify: `packages/react-grab/src/core/index.tsx:213-240`

**Step 1: Add `sync` to `Options`**

```typescript
import type { SyncConfig } from "./features/sync/types.js";

export interface Options {
  // ... existing fields ...
  sync?: SyncConfig;
}
```

**Step 2: Wire async init in core/index.tsx**

The current `init()` is synchronous and returns `ReactGrabAPI`. We can't make it async (would break all consumers). Instead, the async initialization happens inside the `createRoot`, before signals are created.

Find where signals are created (around line 320):

```typescript
const [commentItems, setCommentItems] =
  createSignal<CommentItem[]>(loadComments());
```

Add the async init BEFORE the `createRoot` callback, using a self-invoking async pattern. Actually — the cleaner approach: delay signal creation until after init.

**The pattern:**

```typescript
// Inside createRoot callback, BEFORE signal creation:

// If sync is configured, initialize storage adapters
const syncAdapter = initialOptions.sync
  ? createHttpAdapter(initialOptions.sync)
  : null;

if (syncAdapter) {
  // We need to init async but we're inside sync createRoot.
  // Use the same pattern as the renderer: fire async and gate on result.
  // Defer ALL setup until after init completes.
}
```

Actually, the simplest approach: make the init happen before `createRoot`, then pass the result in.

```typescript
export const init = (rawOptions?: Options): ReactGrabAPI => {
  // ... existing checks ...

  if (initialOptions.sync) {
    // Async init path: fetch from server, then create the reactive system
    const adapter = createHttpAdapter(initialOptions.sync);
    void initAsync(adapter, initialOptions, settableOptions).then((api) => {
      // Replace noop API with real one when ready
    });
    return createNoopApi(); // Return noop until async init completes
  }

  // Sync path: unchanged
  return createRoot((dispose) => { ... });
};
```

Wait — this is getting complex and changes the init contract. Let me think of a simpler approach.

**Simpler approach:** The storage `init` functions populate the module-level cache. We call them before `createRoot`, and since `loadComments()` reads from the cache, the signals get the server data.

```typescript
export const init = (rawOptions?: Options): ReactGrabAPI => {
  if (typeof window === "undefined") return createNoopApi();

  // ... existing option merging ...

  if (initialOptions.enabled === false || hasInited) return createNoopApi();
  hasInited = true;
  logIntro();

  const { enabled: _enabled, ...settableOptions } = initialOptions;

  // If sync configured, init async then create the system
  if (initialOptions.sync) {
    const api = createAsyncInitApi();
    void initSyncThenStart(initialOptions.sync, settableOptions, api);
    return api.proxy;
  }

  // No sync: create system synchronously (current behavior)
  return createReactGrabSystem(settableOptions);
};
```

This is still complex. Let me use the **simplest possible approach**: a two-phase init where the async part runs inside `createRoot` before signals, using the existing renderer dynamic import pattern.

**Actually — the simplest approach is:**

The storage init functions return Promises. We call them at the top of `createRoot`, and the signals are created after await. But `createRoot` is synchronous...

**Final approach (cleanest):**

```typescript
export const init = (rawOptions?: Options): ReactGrabAPI => {
  // ... existing checks ...

  if (initialOptions.sync) {
    return initWithSync(initialOptions.sync, settableOptions);
  }

  return createSystem(settableOptions);
};

const initWithSync = (syncConfig: SyncConfig, options: SettableOptions): ReactGrabAPI => {
  // Create a deferred API that queues calls until the system is ready
  let realApi: ReactGrabAPI | null = null;
  const deferredApi = createDeferredApi(() => realApi);

  void (async () => {
    const adapter = createHttpAdapter(syncConfig);
    await initCommentStorage(adapter);
    await initGroupStorage(adapter);
    // Now module-level caches are populated from server
    // loadComments() and loadGroups() return server data
    realApi = createSystem(options);
  })();

  return deferredApi;
};
```

This is the pattern but the deferred API proxy is complex. Let me simplify even further.

**SIMPLEST possible approach:** Don't change `init` at all. Add a separate `initSync` async function that the host app calls before `init`. This is explicit and zero-magic.

```typescript
// Host app:
import { initSync } from "react-grab/core";

await initSync({
  serverUrl: "http://localhost:3847",
  workspace: "project-x",
  onSyncError: console.error,
});

// Now init as normal — storage is already populated from server
const api = init({ enabled: true });
```

This is clean because:
- `init()` stays synchronous
- No deferred proxy complexity
- Host app has full control over the async timing
- The adapter is set up before any storage reads happen

**Step 3: Create `initSync` export in core**

In `core/index.tsx`, add:

```typescript
import { initCommentStorage } from "../utils/comment-storage.js";
import { initGroupStorage } from "../features/selection-groups/store/group-storage.js";
import { createHttpAdapter } from "../features/sync/adapter.js";

export const initSync = async (config: SyncConfig): Promise<void> => {
  const adapter = createHttpAdapter(config);
  await Promise.all([
    initCommentStorage(adapter),
    initGroupStorage(adapter),
  ]);
};
```

Also export it from the package entry point.

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors — `createHttpAdapter` doesn't exist yet. Created in Task 6.

**Step 5: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/core/index.tsx
git commit -m "feat(sync): add initSync export and SyncConfig to Options"
```

---

### Task 5: Handle `revealed` field stripping and merging

**Files:**
- Create: `packages/react-grab/src/features/sync/transforms.ts`

The `revealed` field on `CommentItem` and `SelectionGroup` is per-user view state. It must be stripped before sending to the server and merged from local sessionStorage on load.

**Step 1: Create transform functions**

```typescript
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

const REVEALED_COMMENTS_KEY = "react-grab-revealed-comments";
const REVEALED_GROUPS_KEY = "react-grab-revealed-groups";

/**
 * Strip `revealed` from comments before sending to server.
 */
export const stripRevealedFromComments = (
  items: CommentItem[],
): Omit<CommentItem, "revealed">[] =>
  items.map(({ revealed, ...rest }) => rest);

/**
 * Strip `revealed` from groups before sending to server.
 */
export const stripRevealedFromGroups = (
  groups: SelectionGroup[],
): Omit<SelectionGroup, "revealed">[] =>
  groups.map(({ revealed, ...rest }) => rest);

/**
 * Save revealed states locally (sessionStorage) so they survive server round-trips.
 */
export const saveLocalRevealedStates = (
  items: CommentItem[],
  groups: SelectionGroup[],
): void => {
  try {
    const commentRevealed: Record<string, boolean> = {};
    for (const item of items) {
      if (item.revealed) commentRevealed[item.id] = true;
    }
    sessionStorage.setItem(REVEALED_COMMENTS_KEY, JSON.stringify(commentRevealed));

    const groupRevealed: Record<string, boolean> = {};
    for (const group of groups) {
      if (group.revealed) groupRevealed[group.id] = true;
    }
    sessionStorage.setItem(REVEALED_GROUPS_KEY, JSON.stringify(groupRevealed));
  } catch {
    // sessionStorage may be unavailable
  }
};

/**
 * Merge local revealed states onto server data.
 */
export const mergeRevealedIntoComments = (
  serverItems: Omit<CommentItem, "revealed">[],
): CommentItem[] => {
  let revealedMap: Record<string, boolean> = {};
  try {
    const stored = sessionStorage.getItem(REVEALED_COMMENTS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  return serverItems.map((item) => ({
    ...item,
    revealed: revealedMap[item.id] ?? false,
  }));
};

/**
 * Merge local revealed states onto server groups.
 */
export const mergeRevealedIntoGroups = (
  serverGroups: Omit<SelectionGroup, "revealed">[],
): SelectionGroup[] => {
  let revealedMap: Record<string, boolean> = {};
  try {
    const stored = sessionStorage.getItem(REVEALED_GROUPS_KEY);
    if (stored) revealedMap = JSON.parse(stored);
  } catch {
    // ignore
  }
  return serverGroups.map((group) => ({
    ...group,
    revealed: revealedMap[group.id] ?? false,
  }));
};
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/sync/transforms.ts
git commit -m "feat(sync): add revealed state strip/merge transforms for per-user view state"
```

---

### Task 6: Create the HTTP adapter

**Files:**
- Create: `packages/react-grab/src/features/sync/adapter.ts`
- Create: `packages/react-grab/src/features/sync/index.ts`

**Step 1: Create the HTTP adapter**

```typescript
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type { StorageAdapter, SyncConfig } from "./types.js";
import {
  stripRevealedFromComments,
  stripRevealedFromGroups,
  mergeRevealedIntoComments,
  mergeRevealedIntoGroups,
  saveLocalRevealedStates,
} from "./transforms.js";

export const createHttpAdapter = (config: SyncConfig): StorageAdapter => {
  const baseUrl = `${config.serverUrl}/workspaces/${encodeURIComponent(config.workspace)}`;

  const handleError = (error: unknown): never => {
    const err = error instanceof Error ? error : new Error(String(error));
    config.onSyncError?.(err);
    throw err;
  };

  return {
    loadComments: async (): Promise<CommentItem[]> => {
      try {
        const response = await fetch(`${baseUrl}/comments`);
        if (!response.ok) {
          throw new Error(`GET /comments failed: ${response.status}`);
        }
        const serverItems = (await response.json()) as Omit<CommentItem, "revealed">[];
        return mergeRevealedIntoComments(serverItems);
      } catch (error) {
        return handleError(error);
      }
    },

    persistComments: async (items: CommentItem[]): Promise<CommentItem[]> => {
      // Save revealed states locally before stripping
      saveLocalRevealedStates(items, []);
      const stripped = stripRevealedFromComments(items);
      try {
        const response = await fetch(`${baseUrl}/comments`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stripped),
        });
        if (!response.ok) {
          throw new Error(`PUT /comments failed: ${response.status}`);
        }
        return items;
      } catch (error) {
        return handleError(error);
      }
    },

    loadGroups: async (): Promise<SelectionGroup[]> => {
      try {
        const response = await fetch(`${baseUrl}/groups`);
        if (!response.ok) {
          throw new Error(`GET /groups failed: ${response.status}`);
        }
        const serverGroups = (await response.json()) as Omit<SelectionGroup, "revealed">[];
        return mergeRevealedIntoGroups(serverGroups);
      } catch (error) {
        return handleError(error);
      }
    },

    persistGroups: async (groups: SelectionGroup[]): Promise<SelectionGroup[]> => {
      saveLocalRevealedStates([], groups);
      const stripped = stripRevealedFromGroups(groups);
      try {
        const response = await fetch(`${baseUrl}/groups`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stripped),
        });
        if (!response.ok) {
          throw new Error(`PUT /groups failed: ${response.status}`);
        }
        return groups;
      } catch (error) {
        return handleError(error);
      }
    },
  };
};
```

**Step 2: Create `index.ts`**

```typescript
export { createHttpAdapter } from "./adapter.js";
export type { StorageAdapter, SyncConfig } from "./types.js";
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sync/
git commit -m "feat(sync): implement HTTP storage adapter with revealed state transforms"
```

---

## Phase 2: Sync Server

---

### Task 7: Initialize the sync-server package

**Files:**
- Create: `packages/sync-server/package.json`
- Create: `packages/sync-server/tsconfig.json`
- Create: `packages/sync-server/src/index.ts`

**Step 1: Create `package.json`**

```json
{
  "name": "@react-grab/sync-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 3: Create placeholder `src/index.ts`**

```typescript
console.log("sync-server placeholder");
```

**Step 4: Install dependencies**

```bash
cd packages/sync-server && pnpm install
```

**Step 5: Commit**

```bash
git add packages/sync-server/
git commit -m "feat(sync-server): initialize package with hono"
```

---

### Task 8: Create file-based storage

**Files:**
- Create: `packages/sync-server/src/storage/file-storage.ts`

**Step 1: Implement file storage**

```typescript
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const DATA_DIR = join(process.cwd(), "data", "workspaces");

const workspacePath = (workspaceId: string): string =>
  join(DATA_DIR, workspaceId);

const ensureWorkspaceDir = async (workspaceId: string): Promise<void> => {
  const dir = workspacePath(workspaceId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};

export const readJsonFile = async <T>(
  workspaceId: string,
  filename: string,
  defaultValue: T,
): Promise<T> => {
  const filePath = join(workspacePath(workspaceId), filename);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
};

export const writeJsonFile = async <T>(
  workspaceId: string,
  filename: string,
  data: T,
): Promise<void> => {
  await ensureWorkspaceDir(workspaceId);
  const filePath = join(workspacePath(workspaceId), filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};
```

**Step 2: Commit**

```bash
git add packages/sync-server/src/storage/
git commit -m "feat(sync-server): add file-based JSON storage"
```

---

### Task 9: Create server routes

**Files:**
- Create: `packages/sync-server/src/routes/comments.ts`
- Create: `packages/sync-server/src/routes/groups.ts`
- Create: `packages/sync-server/src/routes/health.ts`

**Step 1: Create comments routes**

```typescript
import { Hono } from "hono";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";

const COMMENTS_FILE = "comments.json";

export const commentsRoutes = new Hono()
  .get("/workspaces/:id/comments", async (c) => {
    const workspaceId = c.req.param("id");
    const comments = await readJsonFile(workspaceId, COMMENTS_FILE, []);
    return c.json(comments);
  })
  .put("/workspaces/:id/comments", async (c) => {
    const workspaceId = c.req.param("id");
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Body must be an array" }, 400);
    }
    await writeJsonFile(workspaceId, COMMENTS_FILE, body);
    return c.json({ status: "ok" });
  });
```

**Step 2: Create groups routes**

```typescript
import { Hono } from "hono";
import { readJsonFile, writeJsonFile } from "../storage/file-storage.js";

const GROUPS_FILE = "groups.json";

export const groupsRoutes = new Hono()
  .get("/workspaces/:id/groups", async (c) => {
    const workspaceId = c.req.param("id");
    const groups = await readJsonFile(workspaceId, GROUPS_FILE, []);
    return c.json(groups);
  })
  .put("/workspaces/:id/groups", async (c) => {
    const workspaceId = c.req.param("id");
    const body = await c.req.json();
    if (!Array.isArray(body)) {
      return c.json({ error: "Body must be an array" }, 400);
    }
    await writeJsonFile(workspaceId, GROUPS_FILE, body);
    return c.json({ status: "ok" });
  });
```

**Step 3: Create health route**

```typescript
import { Hono } from "hono";

export const healthRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "ok" }));
```

**Step 4: Commit**

```bash
git add packages/sync-server/src/routes/
git commit -m "feat(sync-server): add REST routes for comments, groups, and health"
```

---

### Task 10: Create server entry point

**Files:**
- Modify: `packages/sync-server/src/index.ts`

**Step 1: Wire routes into Hono app**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { commentsRoutes } from "./routes/comments.js";
import { groupsRoutes } from "./routes/groups.js";
import { healthRoutes } from "./routes/health.js";

const app = new Hono();

app.use("*", cors());
app.route("/", healthRoutes);
app.route("/", commentsRoutes);
app.route("/", groupsRoutes);

const PORT = parseInt(process.env.PORT ?? "3847", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[sync-server] listening on http://localhost:${info.port}`);
});
```

**Step 2: Test the server**

```bash
cd packages/sync-server && pnpm dev
```

In another terminal:

```bash
# Health check
curl http://localhost:3847/health

# PUT comments
curl -X PUT http://localhost:3847/workspaces/test/comments \
  -H "Content-Type: application/json" \
  -d '[{"id":"c1","groupId":"default","content":"<div>test</div>","elementName":"div","tagName":"div","timestamp":1234}]'

# GET comments
curl http://localhost:3847/workspaces/test/comments

# Verify file exists
cat data/workspaces/test/comments.json
```

**Step 3: Commit**

```bash
git add packages/sync-server/src/index.ts
git commit -m "feat(sync-server): wire routes and start server on port 3847"
```

---

## Phase 3: Integration and Export

---

### Task 11: Export `initSync` from package entry point

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`
- Modify: `packages/react-grab/src/index.ts` (or wherever the package entry point is)

**Step 1: Implement `initSync` in core**

Find the imports at the top of `core/index.tsx` and add:

```typescript
import { initCommentStorage } from "../utils/comment-storage.js";
import { initGroupStorage } from "../features/selection-groups/store/group-storage.js";
import { createHttpAdapter } from "../features/sync/index.js";
import type { SyncConfig } from "../features/sync/types.js";
```

Add the export:

```typescript
export const initSync = async (config: SyncConfig): Promise<void> => {
  const adapter = createHttpAdapter(config);
  await Promise.all([
    initCommentStorage(adapter),
    initGroupStorage(adapter),
  ]);
};
```

**Step 2: Export from package entry point**

Find the main entry file (check `package.json` `exports` field) and add:

```typescript
export { initSync } from "./core/index.js";
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/index.ts
git commit -m "feat(sync): export initSync from package entry point"
```

---

### Task 12: Save revealed states on every visibility toggle

**Files:**
- Modify: `packages/react-grab/src/features/selection-visibility/index.ts`

The `saveLocalRevealedStates` function needs to be called whenever revealed states change, so they persist in sessionStorage even though the comments/groups go to the server.

**Step 1: Add revealed state saving to the reveal effect**

Import the transform:

```typescript
import { saveLocalRevealedStates } from "../sync/transforms.js";
```

In the `createEffect` that watches `commentItems` + `disconnectedItemIds`, add a call to save revealed states:

```typescript
createEffect(
  on(
    () => [deps.commentItems(), deps.disconnectedItemIds()] as const,
    () => {
      clearRevealedPreviews();
      showRevealedPreviews();
      // Persist revealed states locally for sync round-trip survival
      saveLocalRevealedStates(deps.commentItems(), deps.groups());
    },
  ),
);
```

This ensures that every time revealed states change (parent toggle, group toggle, item toggle), the local sessionStorage is updated.

**Note:** This requires `groups` accessor in deps. Check if it's already there from the groups integration. If not, add it to `SelectionVisibilityDeps`.

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/index.ts
git commit -m "feat(sync): save revealed states to sessionStorage on every visibility change"
```

---

### Task 13: Build and verify end-to-end

**Step 1: Start the sync server**

```bash
cd packages/sync-server && pnpm dev
```

**Step 2: Build react-grab**

```bash
cd packages/react-grab && pnpm build
```

**Step 3: Configure the host app**

In AdCreative-Frontend-V2, where react-grab is initialized:

```typescript
import { initSync, init } from "react-grab/core";

// Call before init
await initSync({
  serverUrl: "http://localhost:3847",
  workspace: "test-workspace",
  onSyncError: (error) => console.error("[sync]", error),
});

const api = init({ enabled: true });
```

**Step 4: Test all scenarios**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Start server, load app | No errors, empty workspace |
| 2 | Add a comment | Comment appears, `data/workspaces/test-workspace/comments.json` created |
| 3 | Refresh page | Comment still there (loaded from server) |
| 4 | Open in second browser tab | Same comments visible |
| 5 | Add comment in tab 2, refresh tab 1 | Tab 1 sees tab 2's comment |
| 6 | Create group in tab 1, refresh tab 2 | Tab 2 sees the group |
| 7 | Reveal selection in tab 1, refresh tab 2 | Tab 2 does NOT see tab 1's revealed state (per-user) |
| 8 | Toggle revealed in tab 2 | Tab 2's revealed state saved locally |
| 9 | Server not running, load app | Error via `onSyncError` callback |
| 10 | No sync config | sessionStorage behavior, no HTTP calls |
| 11 | Check `data/workspaces/test-workspace/comments.json` | No `revealed` field in server data |

**Step 5: Commit if fixes needed**

---

## File Change Summary

### New files

| File | Purpose |
|------|---------|
| `src/features/sync/types.ts` | `StorageAdapter`, `SyncConfig` interfaces |
| `src/features/sync/transforms.ts` | Strip/merge `revealed` field for per-user state |
| `src/features/sync/adapter.ts` | HTTP adapter implementing `StorageAdapter` |
| `src/features/sync/index.ts` | Re-export |
| `packages/sync-server/src/index.ts` | Server entry point |
| `packages/sync-server/src/storage/file-storage.ts` | File-based JSON storage |
| `packages/sync-server/src/routes/comments.ts` | GET/PUT comments |
| `packages/sync-server/src/routes/groups.ts` | GET/PUT groups |
| `packages/sync-server/src/routes/health.ts` | Health check |
| `packages/sync-server/package.json` | Package config |
| `packages/sync-server/tsconfig.json` | TypeScript config |

### Modified files

| File | Change |
|------|--------|
| `src/utils/comment-storage.ts` | Add `activeAdapter`, `initCommentStorage`, adapter-aware `persistCommentItems` |
| `src/features/selection-groups/store/group-storage.ts` | Add `activeAdapter`, `initGroupStorage`, adapter-aware `persistGroups` |
| `src/types.ts` | Add `sync?: SyncConfig` to `Options` |
| `src/core/index.tsx` | Add `initSync` export |
| `src/features/selection-visibility/index.ts` | Save revealed states on toggle |
| `src/index.ts` | Export `initSync` |
