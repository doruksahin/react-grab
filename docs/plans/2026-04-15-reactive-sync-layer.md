# Reactive Sync Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the module-level mutable + callback storage system with Solid.js `createResource` + `createStore` + `reconcile`, eliminating the class of timing/reactivity bugs. Document the data flow in `architecture.yml`. Add a lint script to prevent drift.

**Architecture:** A unified `createSyncLayer()` factory inside `features/sync/` that owns all server-loaded state (groups, comments, JIRA statuses) as a single `createStore`. Async loading uses `createResource` with source signals — no callbacks, no module-level mutables. The JIRA poller is a derived resource that auto-runs when ticketed groups appear. Everything is reactive by construction.

**Tech Stack:** Solid.js core (`createResource`, `createStore`, `reconcile`, `createMemo`, `batch`, `onCleanup`), madge (dep graph), ts-morph (AST lint)

**Stdlib reference:** See `/stdlib:find-guide solidjs createResource`, `/stdlib:find-guide solidjs store reconcile`, `/stdlib:find-guide solidjs sync layer`

---

## Architecture Diagram

```
initSync(config)
    │
    ▼
syncConfig signal ──────────────────────────────────────────┐
    │                                                        │
    ▼                                                        ▼
createResource(syncConfig, loadGroups)          createResource(syncConfig, loadComments)
    │                                                        │
    ▼                                                        ▼
setSyncStore("groups", reconcile(data))         setSyncStore("comments", reconcile(data))
    │
    ▼
ticketedGroups = createMemo(groups.filter(g => g.jiraTicketId))
    │
    ▼
createResource(ticketedGroups, fetchJiraStatuses)
    │
    ▼
setSyncStore("groups", idx, { jiraStatus, jiraComments, ... })  ← fine-grained path update
    │
    ▼
setInterval(() => refetchJira(), 30_000) + onCleanup
```

**Key principle:** Data flows DOWN through `createResource` chains. No data flows UP through callbacks. Every consumer reads from the store — one source of truth.

---

## File Structure (SRP)

```
features/sync/
  index.ts                    — public barrel: createSyncLayer, types
  types.ts                    — SyncConfig, SyncLayerAPI, SyncStoreShape (MODIFY)
  schemas.ts                  — Zod schemas (KEEP AS-IS)
  adapter.ts                  — createHttpAdapter (KEEP AS-IS)
  transforms.ts               — revealed-state transforms (KEEP AS-IS)

  sync-layer.ts               — createSyncLayer() factory (NEW)
                                 Creates store, wires resources, returns API

  resources/
    groups-resource.ts         — createResource for groups + reconcile into store (NEW)
    comments-resource.ts       — createResource for comments + reconcile into store (NEW)
    jira-poller.ts             — createResource + interval for JIRA status polling (NEW)

  store/
    sync-store.ts              — createStore<SyncStoreShape> + typed updaters (NEW)

  components/
    sync-indicator.tsx         — (KEEP AS-IS)

--- Files to DELETE after migration ---
  utils/comment-storage.ts                          — replaced by comments-resource.ts
  features/selection-groups/store/group-storage.ts   — replaced by groups-resource.ts
  features/sidebar/jira-status-poller.ts             — replaced by jira-poller.ts
```

### SRP breakdown — one file, one job

| File | Single Responsibility |
|---|---|
| `sync-store.ts` | Owns the reactive store shape and typed update helpers |
| `groups-resource.ts` | Loads groups from server/localStorage, reconciles into store |
| `comments-resource.ts` | Loads comments from server/localStorage, reconciles into store |
| `jira-poller.ts` | Polls JIRA status for ticketed groups, updates store |
| `sync-layer.ts` | Composes the above into a single API surface for core/index.tsx |
| `types.ts` | Type definitions (no logic) |

---

## Phase Plan

### Phase 0: Preparation (non-breaking)

No behavior changes. Set up the new files alongside the old ones.

### Task 0.1: Create `sync-store.ts` — the store shape

**Files:**
- Create: `src/features/sync/store/sync-store.ts`

**Step 1: Define the store**

```ts
import { createStore, reconcile } from "solid-js/store";
import type { CommentItem } from "../schemas.js";
import type { SelectionGroup } from "../../selection-groups/types.js";
import type { GetJiraTicketStatus200 } from "../../../generated/sync-api.js";

export interface SyncStoreShape {
  groups: SelectionGroup[];
  comments: CommentItem[];
  workspace: string | null;
  serverUrl: string | null;
  jiraProjectKey: string | null;
  status: "idle" | "loading" | "synced" | "local" | "error";
  error: string | null;
}

const INITIAL_STATE: SyncStoreShape = {
  groups: [],
  comments: [],
  workspace: null,
  serverUrl: null,
  jiraProjectKey: null,
  status: "idle",
  error: null,
};

export const createSyncStore = () => {
  const [store, setStore] = createStore<SyncStoreShape>({ ...INITIAL_STATE });

  return {
    store,

    // --- Config ---
    setConfig: (workspace: string, serverUrl: string, jiraProjectKey: string) => {
      setStore({ workspace, serverUrl, jiraProjectKey });
    },

    setStatus: (status: SyncStoreShape["status"], error?: string) => {
      setStore({ status, error: error ?? null });
    },

    // --- Groups ---
    reconcileGroups: (next: SelectionGroup[]) => {
      setStore("groups", reconcile(next, { key: "id" }));
    },

    updateGroup: (groupId: string, patch: Partial<SelectionGroup>) => {
      setStore("groups", (g) => g.id === groupId, patch);
    },

    setGroups: (next: SelectionGroup[]) => {
      setStore("groups", reconcile(next, { key: "id" }));
    },

    // --- Comments ---
    reconcileComments: (next: CommentItem[]) => {
      setStore("comments", reconcile(next, { key: "id" }));
    },

    setComments: (next: CommentItem[]) => {
      setStore("comments", reconcile(next, { key: "id" }));
    },

    // --- JIRA status (fine-grained per-group update) ---
    updateJiraStatus: (groupId: string, status: GetJiraTicketStatus200) => {
      const resolved = status.statusCategory.toLowerCase() === "done";
      setStore(
        "groups",
        (g) => g.id === groupId,
        {
          jiraStatus: status.status,
          jiraStatusCategory: status.statusCategory,
          jiraAssignee: status.assignee,
          jiraReporter: status.reporter,
          jiraAssigneeAvatar: status.assigneeAvatar,
          jiraReporterAvatar: status.reporterAvatar,
          jiraLabels: status.labels,
          jiraComments: status.comments,
          jiraResolved: resolved,
          jiraUrl: status.jiraUrl,
          jiraFlagged: status.flagged ?? false,
          jiraFlaggedAt: status.flaggedAt ?? null,
          jiraFlaggedBy: status.flaggedBy ?? null,
          jiraFlaggedByAvatar: status.flaggedByAvatar ?? null,
        },
      );
    },
  };
};

export type SyncStoreHandle = ReturnType<typeof createSyncStore>;
```

**Step 2: Commit**
```bash
git add src/features/sync/store/sync-store.ts
git commit -m "feat(sync): add reactive sync store with reconcile updaters"
```

---

### Task 0.2: Create `groups-resource.ts`

**Files:**
- Create: `src/features/sync/resources/groups-resource.ts`

```ts
import { createResource } from "solid-js";
import type { StorageAdapter } from "../types.js";
import type { SyncStoreHandle } from "../store/sync-store.js";

export const createGroupsResource = (
  adapter: () => StorageAdapter | null,
  store: SyncStoreHandle,
) => {
  const [resource, { mutate, refetch }] = createResource(
    adapter,
    async (adptr) => {
      const groups = await adptr.loadGroups();
      store.reconcileGroups(groups);
      return groups;
    },
    { initialValue: [] },
  );

  return { resource, mutate, refetch };
};
```

---

### Task 0.3: Create `comments-resource.ts`

**Files:**
- Create: `src/features/sync/resources/comments-resource.ts`

Same pattern as groups but for comments.

---

### Task 0.4: Create `jira-poller.ts`

**Files:**
- Create: `src/features/sync/resources/jira-poller.ts`

```ts
import { createResource, createMemo, onCleanup } from "solid-js";
import { getJiraTicketStatus } from "../../../generated/sync-api.js";
import type { SyncStoreHandle } from "../store/sync-store.js";

const POLL_INTERVAL_MS = 30_000;

export const createJiraPoller = (store: SyncStoreHandle) => {
  const ticketedGroups = createMemo(() =>
    store.store.groups.filter((g) => g.jiraTicketId),
  );

  const [resource, { refetch }] = createResource(
    () => {
      const workspace = store.store.workspace;
      const tg = ticketedGroups();
      return workspace && tg.length > 0 ? { workspace, groups: tg } : false;
    },
    async ({ workspace, groups }) => {
      await Promise.allSettled(
        groups.map(async (g) => {
          try {
            const result = await getJiraTicketStatus(workspace, g.id);
            if (result.status === 200) {
              store.updateJiraStatus(g.id, result.data);
            }
          } catch {
            // Silent per SPEC-003
          }
        }),
      );
    },
  );

  const intervalId = setInterval(() => {
    if (ticketedGroups().length > 0) refetch();
  }, POLL_INTERVAL_MS);
  onCleanup(() => clearInterval(intervalId));

  return { resource, refetch, ticketedGroups };
};
```

**Key:** No `pollNow()`, no lazy workspace resolution. The resource auto-runs when `workspace` AND `ticketedGroups` are truthy. The reactive graph handles ordering.

---

### Task 0.5: Create `sync-layer.ts` — the composition root

**Files:**
- Create: `src/features/sync/sync-layer.ts`

```ts
import { batch, createSignal } from "solid-js";
import { createSyncStore } from "./store/sync-store.js";
import { createGroupsResource } from "./resources/groups-resource.js";
import { createCommentsResource } from "./resources/comments-resource.js";
import { createJiraPoller } from "./resources/jira-poller.js";
import { createHttpAdapter } from "./adapter.js";
import type { SyncConfig, StorageAdapter } from "./types.js";

export const createSyncLayer = () => {
  const store = createSyncStore();
  const [adapter, setAdapter] = createSignal<StorageAdapter | null>(null);

  const groupsResource = createGroupsResource(adapter, store);
  const commentsResource = createCommentsResource(adapter, store);
  const jiraPoller = createJiraPoller(store);

  const init = async (config: SyncConfig) => {
    batch(() => {
      store.setConfig(config.workspace, config.serverUrl, config.jiraProjectKey);
      store.setStatus("loading");
    });

    if (!config.enabled) {
      // Local-only: load from localStorage
      loadFromLocalStorage(store);
      store.setStatus("local");
      return;
    }

    try {
      setAdapter(createHttpAdapter(config));
      // Resources auto-fetch when adapter signal transitions null → adapter
      store.setStatus("synced");
    } catch (error) {
      loadFromLocalStorage(store);
      store.setStatus("error", String(error));
      config.onSyncError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  return {
    // Reactive accessors (read from store)
    groups: () => store.store.groups,
    comments: () => store.store.comments,
    workspace: () => store.store.workspace,
    status: () => store.store.status,

    // Mutations
    setGroups: store.setGroups,
    setComments: store.setComments,
    updateGroup: store.updateGroup,
    updateJiraStatus: store.updateJiraStatus,

    // Refresh
    refetchGroups: groupsResource.refetch,
    refetchComments: commentsResource.refetch,
    refetchJira: jiraPoller.refetch,

    // Init (called once by host app)
    init,
  };
};

export type SyncLayerAPI = ReturnType<typeof createSyncLayer>;
```

**Note on `adapter` signal vs `let` variable:** The previous plan draft used `let adapter`. This breaks resource reactivity — `createResource(adapter, ...)` wouldn't know when the adapter changes because `let` is invisible to Solid. Using `createSignal` makes the adapter reactive so resources auto-fetch when it transitions from `null` to a real adapter.

**Step 2: Commit**
```bash
git commit -m "feat(sync): add sync-layer composition root with resource wiring"
```

---

### Phase 1: Wire into core/index.tsx

This is the critical migration step. Replace the scattered imports with a single `createSyncLayer()` call.

### Task 1.1: Replace initSync + storage imports in core/index.tsx

**Files:**
- Modify: `src/core/index.tsx`

**Changes:**
1. Remove imports: `initCommentStorage`, `initLocalCommentStorage`, `registerCommentsLoadedCallback`, `loadComments`, `initGroupStorage`, `initLocalGroupStorage`, `registerGroupsLoadedCallback`, `createJiraStatusPoller`
2. Add import: `createSyncLayer` from `../features/sync/sync-layer.js`
3. Replace `initSync()` body with `syncLayer.init(config)`
4. Replace `createSignal<CommentItem[]>(loadComments())` with `syncLayer.comments`
5. Replace `selectionGroups.setGroups` callback wiring with direct store reads
6. Replace `createJiraStatusPoller(...)` block with nothing (poller is inside sync layer)
7. Replace `syncState` module-level variable with `syncLayer.status()` / `syncLayer.workspace()`

**Estimated changes:** ~50 lines removed, ~15 lines added.

**Critical: retain these imports** — they're used for direct mutation, not async loading:
- `isClearConfirmed`, `confirmClear` from `comment-storage.ts` — session flags for clear prompt
- `addCommentItem`, `patchCommentItem`, `removeCommentItem`, `clearComments` — direct CRUD
- `persistCommentItems` — passed to features
- `getActiveAdapter` — screenshot upload

These functions move to the sync layer API or stay as thin wrappers.

### Task 1.2: Update `createSelectionGroups` to accept store accessors

**Files:**
- Modify: `src/features/selection-groups/index.ts`

Replace `loadGroups()` import with a `groups` accessor passed via deps. The factory no longer reads from module-level state.

### Task 1.3: Update `createSelectionVisibility` deps

**Files:**
- Modify: `src/features/selection-visibility/index.ts`

Replace `persistCommentItems` dep with sync layer's `setComments`.

### Task 1.4: Run all E2E tests

```bash
pnpm --filter react-grab exec playwright test --project=chromium-mocked
pnpm --filter react-grab exec playwright test --project=chromium
```

All 22 mocked + 36 overlay tests must pass. The JIRA poller should auto-fire (`getJiraTicketStatus` requests > 0) without `pollNow()`.

### Task 1.5: Commit

```bash
git commit -m "refactor(sync): wire createSyncLayer into core — replaces callback system"
```

---

### Phase 2: Remove old modules

### Task 2.1: Delete old storage files

**Files:**
- Delete: `src/utils/comment-storage.ts`
- Delete: `src/features/selection-groups/store/group-storage.ts`
- Delete: `src/features/sidebar/jira-status-poller.ts`
- Update: `src/features/selection-groups/store/index.ts` (remove group-storage re-exports)

### Task 2.2: Move `migrateLegacyDefaultGroup` to a utility

This pure function is still needed for localStorage reads. Move to `src/utils/migrate-legacy-groups.ts`.

### Task 2.3: Run full test suite + build

```bash
pnpm build
pnpm test
```

### Task 2.4: Commit

```bash
git commit -m "refactor(sync): remove old callback-based storage modules"
```

---

### Phase 3: Document data flow in architecture.yml

### Task 3.1: Add `data_flows` section to architecture.yml

Add after the `features` section:

```yaml
data_flows:
  sync_layer:
    description: Server data loading, JIRA polling, and reactive state
    composition_root: packages/react-grab/src/features/sync/sync-layer.ts
    store: packages/react-grab/src/features/sync/store/sync-store.ts
    init_sequence:
      1: "import react-grab → init() auto-runs (sync, creates reactive root)"
      2: "host calls initSync(config) → syncLayer.init(config)"
      3: "setAdapter(httpAdapter) triggers createResource fetchers"
      4: "groups + comments load in parallel → reconcile into store"
      5: "ticketedGroups memo derives from store.groups → triggers jira poller resource"
      6: "30s interval calls refetchJira() → fine-grained store updates"
    sources:
      groups:
        resource: features/sync/resources/groups-resource.ts
        store_path: store.groups
        trigger: adapter signal (null → httpAdapter)
        consumers:
          - components/sidebar/* (group list, detail view)
          - components/selection-label/* (status colors, JIRA meta)
          - components/overlay-canvas.tsx (grabbed boxes, labels)
          - features/selection-groups/index.ts (CRUD operations)
          - features/sync/resources/jira-poller.ts (ticketed group filter)
      comments:
        resource: features/sync/resources/comments-resource.ts
        store_path: store.comments
        trigger: adapter signal (null → httpAdapter)
        consumers:
          - components/selection-label/* (comment text, count)
          - components/comments-dropdown.tsx
          - features/selection-visibility/index.ts (reveal state)
      jira_status:
        resource: features/sync/resources/jira-poller.ts
        store_path: store.groups[i].jiraStatus (fine-grained per-group)
        trigger: ticketedGroups memo (derived from store.groups)
        poll_interval: 30s
        fields_updated:
          - jiraStatus, jiraStatusCategory, jiraUrl
          - jiraAssignee, jiraReporter, jiraAssigneeAvatar, jiraReporterAvatar
          - jiraComments, jiraLabels
          - jiraFlagged, jiraFlaggedAt, jiraFlaggedBy, jiraFlaggedByAvatar
          - jiraResolved
        consumers:
          - components/sidebar/group-card.tsx (status badge, flag icon)
          - components/sidebar/jira-status-banner.tsx (status display)
          - components/selection-label/jira-meta.tsx (inline status)
          - components/jira-comments/* (comment list, editor)
```

### Task 3.2: Update `features.jira-status-polling` to reference new files

Replace the old file paths with the new sync layer paths.

### Task 3.3: Commit

```bash
git commit -m "docs: add data_flows section to architecture.yml"
```

---

### Phase 4: Architecture lint script

### Task 4.1: Create `scripts/arch-lint.ts`

A script that reads `architecture.yml` and verifies:
1. **Stale paths** — every file path in the YAML exists on disk
2. **Unlisted files** — files in `src/features/*/` and `decree/*/` not listed in the YAML
3. **Circular deps** — run madge and fail if any found

**Output format:**
```
STALE PATHS (2):
  features.jira-status-polling.files[0]:
    packages/react-grab/src/features/sidebar/jira-status-poller.ts → NOT FOUND

UNLISTED FILES (1):
  features.sync:
    + packages/react-grab/src/features/sync/store/sync-store.ts

CIRCULAR DEPS: none

OK: 142/145 paths valid, 2 stale, 1 unlisted
```

### Task 4.2: Add pnpm script

```json
"arch:lint": "tsx scripts/arch-lint.ts"
```

### Task 4.3: Add to CLAUDE.md

```bash
# Architecture lint — verify architecture.yml paths are in sync
pnpm arch:lint
```

### Task 4.4: Commit

```bash
git commit -m "chore: add architecture.yml lint script"
```

---

### Phase 5: Add refresh capability

With `createResource`, adding a refresh button is trivial.

### Task 5.1: Expose `refetch` in the API

The `SyncLayerAPI` already exposes `refetchGroups`, `refetchComments`, `refetchJira`. Wire these to a UI button or keyboard shortcut.

### Task 5.2: Add E2E test for refresh

```ts
test("refresh button re-fetches groups and JIRA status", {
  tag: ["@SPEC-XXX"],
}, async ({ reactGrab, mockServer }) => {
  // Override groups mid-test
  mockServer.override("listGroups", [...fixtures.groups, newGroup]);
  // Trigger refresh
  await reactGrab.clickRefresh();
  // Assert new group appears
});
```

---

## Blast Radius — Files Affected

| File | Change type | Phase |
|---|---|---|
| `src/features/sync/store/sync-store.ts` | Create | 0 |
| `src/features/sync/resources/groups-resource.ts` | Create | 0 |
| `src/features/sync/resources/comments-resource.ts` | Create | 0 |
| `src/features/sync/resources/jira-poller.ts` | Create | 0 |
| `src/features/sync/sync-layer.ts` | Create | 0 |
| `src/features/sync/types.ts` | Modify (add SyncLayerAPI) | 0 |
| `src/features/sync/index.ts` | Modify (barrel exports) | 0 |
| `src/core/index.tsx` | Modify (~50 lines removed, ~15 added) | 1 |
| `src/features/selection-groups/index.ts` | Modify (deps interface) | 1 |
| `src/features/selection-visibility/index.ts` | Modify (deps interface) | 1 |
| `src/utils/comment-storage.ts` | Delete | 2 |
| `src/features/selection-groups/store/group-storage.ts` | Delete | 2 |
| `src/features/sidebar/jira-status-poller.ts` | Delete | 2 |
| `src/features/selection-groups/store/index.ts` | Modify (remove re-exports) | 2 |
| `src/utils/migrate-legacy-groups.ts` | Create (extracted) | 2 |
| `architecture.yml` | Modify (add data_flows) | 3 |
| `scripts/arch-lint.ts` | Create | 4 |
| `package.json` (root) | Modify (add arch:lint) | 4 |
| `CLAUDE.md` | Modify (add arch:lint docs) | 4 |

**Total: ~19 files across 5 phases**

---

## Migration Safety

| Risk | Mitigation |
|---|---|
| Store updates don't trigger existing component re-renders | `reconcile` with `{ key: "id" }` preserves referential identity for unchanged items |
| localStorage fallback breaks | `loadFromLocalStorage` helper reads same keys, reconciles into store |
| Persist-to-server flow changes | `adapter.persistGroups()` / `adapter.persistComments()` are unchanged — only the trigger point moves |
| E2E mock routes don't match | Routes intercept by URL pattern, not by caller — unchanged |
| `createResource` Suspense triggers unwanted loading UI | Pass `initialValue: []` to skip Suspense boundary |
| `adapter` as `let` instead of signal | **Fixed in this plan** — use `createSignal` so resources react to adapter changes |
| Comment CRUD functions (`addCommentItem`, `patchCommentItem`, etc.) lost during migration | **Explicitly called out in Task 1.1** — retain or move to sync layer API |
| `architecture.yml` drifts after refactor | **Phase 4** adds lint script to CI/pre-commit |

## What This Eliminates

- `registerGroupsLoadedCallback` / `registerCommentsLoadedCallback` — gone
- Module-level `let groups = []` / `let commentItems = []` — gone
- `pollNow()` escape hatch — gone
- Eager vs lazy workspace resolution — gone (store is reactive)
- `syncState` module-level variable — gone (lives in store)
- Init ordering sensitivity between `init()` and `initSync()` — gone (resource source signals gate execution)
- Undocumented data flow — gone (`data_flows` section in architecture.yml)
- Architecture drift — gone (arch:lint catches stale paths)
