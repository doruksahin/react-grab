# Orval Types for react-grab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hand-written `CommentItem` and `SelectionGroup` interfaces in react-grab with Orval-generated types from the sync-server's OpenAPI spec. Single source of truth, zero manual sync.

**Architecture:** Orval generates type-only output (no hooks, no fetch functions) into `src/generated/`. Existing hand-written interfaces become re-exports of generated types, extended with react-grab-only fields (like `previewBounds`) that don't exist on the server. SRP: sync-server owns the API shape, react-grab extends it for UI concerns.

**Tech Stack:** Orval (type generation only), sync-server `openapi.json`

**Blocked by:** `2026-03-31-sync-server-openapi-plan.md` (must be complete — needs `openapi.json` to exist)

---

## Principles

1. **SSOT:** The sync-server Zod schemas define all API fields. react-grab never invents API fields.
2. **SRP:** react-grab adds UI-only fields (`previewBounds`, `revealed` when local-only) via type extension, not by duplicating the server schema.
3. **DRY:** `CommentItem` and `SelectionGroup` are defined once (server), generated once (Orval), extended once (react-grab).
4. **Non-breaking:** Existing public API types (`CommentItem`, `SelectionGroup`) keep the same shape. Internal imports are redirected to generated types.

---

## Task 1: Install Orval in react-grab

**Files:**
- Modify: `packages/react-grab/package.json`

**Step 1: Install**

```bash
pnpm --filter react-grab add -D orval
```

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build passes, no code changes yet.

**Step 3: Commit**

```bash
git add packages/react-grab/package.json pnpm-lock.yaml
git commit -m "chore(react-grab): add orval for type generation"
```

---

## Task 2: Create Orval config for type-only generation

**Files:**
- Create: `packages/react-grab/orval.config.ts`
- Modify: `packages/react-grab/package.json` (add codegen script)

**Step 1: Create orval.config.ts**

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  syncTypes: {
    input: {
      target: "../sync-server/openapi.json",
    },
    output: {
      mode: "single",
      target: "src/generated/sync-api.ts",
      client: "fetch",
      override: {
        // We only want the types — the generated fetch functions won't be used
        // but "fetch" is the lightest client option with no extra dependencies
      },
    },
  },
});
```

**Step 2: Add codegen script**

In `packages/react-grab/package.json`, add to scripts:

```json
"codegen": "pnpm --filter @react-grab/sync-server export-spec && orval"
```

**Step 3: Run codegen**

```bash
pnpm --filter react-grab codegen
```

Expected: Creates `src/generated/sync-api.ts` with generated types and fetch functions.

**Step 4: Add generated dir to .gitignore or decide to commit**

Decision: **Commit generated files** — same as the dashboard. The project builds without running codegen.

**Step 5: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build passes. Generated file exists but nothing imports it yet.

**Step 6: Commit**

```bash
git add packages/react-grab/orval.config.ts packages/react-grab/package.json packages/react-grab/src/generated/
git commit -m "feat(react-grab): configure Orval for type generation from sync-server spec"
```

---

## Task 3: Create type bridge — re-export generated types with UI extensions

**Files:**
- Create: `packages/react-grab/src/generated/types.ts`

This is the bridge between server-generated types and react-grab's UI-only fields. It re-exports the generated types, extended where needed.

**Step 1: Inspect what Orval generates**

Read `src/generated/sync-api.ts` and find the generated type names for CommentItem and SelectionGroup. They'll be named based on the operationId (e.g., `ListComments200Item`, `PersistGroupsBodyItem`).

**Step 2: Create the bridge file**

`packages/react-grab/src/generated/types.ts`:

```typescript
// Re-export server types as the canonical API shapes
// The exact import names depend on Orval output — update after codegen
export type { ListComments200Item as ServerCommentItem } from "./sync-api";
export type { ListGroups200Item as ServerSelectionGroup } from "./sync-api";
```

Note: The exact type names come from the Orval output. Inspect `sync-api.ts` after generation and use the correct names.

**Step 3: Commit**

```bash
git add packages/react-grab/src/generated/types.ts
git commit -m "feat(react-grab): create type bridge for server-generated types"
```

---

## Task 4: Migrate CommentItem to use generated type

**Files:**
- Modify: `packages/react-grab/src/types.ts:445-458`

**Step 1: Replace hand-written CommentItem with extended generated type**

In `packages/react-grab/src/types.ts`, replace:

```typescript
export interface CommentItem {
  id: string;
  groupId: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  previewBounds?: OverlayBounds[];
  elementSelectors?: string[];
  commentText?: string;
  timestamp: number;
  revealed: boolean;
}
```

With:

```typescript
import type { ServerCommentItem } from "../generated/types.js";

/**
 * CommentItem extends the server-defined shape with UI-only fields.
 * Server fields come from Orval (SSOT: sync-server Zod schemas).
 * UI-only fields are added here.
 */
export interface CommentItem extends ServerCommentItem {
  /** Preview bounds for overlay rendering — UI-only, not persisted to server */
  previewBounds?: OverlayBounds[];
}
```

Note: Check which fields in the current `CommentItem` are already in `ServerCommentItem` (they should all be, except `previewBounds`). If `revealed` is not in the server type (because it's stripped via `syncRevealedState`), it needs to stay as a UI extension too.

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build passes. All 15 files that import `CommentItem` continue to work because the shape is the same.

**Step 3: Verify — run the design-system to test**

```bash
pnpm --filter design-system dev
```

Expected: react-grab works normally. Selections, comments, groups — all functional.

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "refactor(react-grab): derive CommentItem from Orval-generated server type"
```

---

## Task 5: Migrate SelectionGroup to use generated type

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/types.ts:6-11`

**Step 1: Replace hand-written SelectionGroup**

```typescript
import type { ServerSelectionGroup } from "../../generated/types.js";

/**
 * SelectionGroup extends the server-defined shape.
 * All fields come from the server type (SSOT).
 * Add UI-only fields here if needed in the future.
 */
export interface SelectionGroup extends ServerSelectionGroup {}
```

If `revealed` is a UI-only field (not on the server type), extend it:

```typescript
export interface SelectionGroup extends ServerSelectionGroup {
  revealed: boolean;
}
```

**Step 2: Verify build**

```bash
pnpm --filter react-grab build
```

Expected: Build passes. All 13 files that import `SelectionGroup` continue to work.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/types.ts
git commit -m "refactor(react-grab): derive SelectionGroup from Orval-generated server type"
```

---

## Task 6: Verification — add a field on server and confirm it flows through

This is a dry-run of the intended workflow. Add a test field on the server, regenerate, and confirm react-grab sees it without manual type changes.

**Step 1: Add a test field to server schema**

In `packages/sync-server/src/schemas/comment.ts`, add:

```typescript
_testField: z.string().optional(),
```

**Step 2: Export spec and regenerate**

```bash
pnpm --filter @react-grab/sync-server export-spec
pnpm --filter react-grab codegen
pnpm --filter dashboard codegen
```

**Step 3: Verify the field appears in react-grab's generated types**

```bash
grep "_testField" packages/react-grab/src/generated/sync-api.ts
```

Expected: `_testField` appears in the generated type.

**Step 4: Verify react-grab's CommentItem includes it**

Since `CommentItem extends ServerCommentItem`, the field is automatically available. No manual change needed.

**Step 5: Verify the field appears in dashboard's generated types**

```bash
grep "_testField" packages/dashboard/src/api/model/*.ts
```

Expected: `_testField` appears.

**Step 6: Remove the test field**

Revert the change in `schemas/comment.ts` and re-run codegen for both packages.

**Step 7: Commit (if you want to keep the verification as a record)**

```bash
git checkout -- packages/sync-server/src/schemas/comment.ts
pnpm --filter @react-grab/sync-server export-spec
pnpm --filter react-grab codegen
pnpm --filter dashboard codegen
git add packages/react-grab/src/generated/ packages/dashboard/src/api/
git commit -m "verify: confirmed SSOT field flow from server → react-grab + dashboard via Orval"
```

---

## Task 7: Add CI guardrail — codegen freshness check

**Files:**
- Modify: root `package.json` or CI config

Add a script that verifies generated code is up-to-date:

**Step 1: Add check script to root package.json**

```json
"check:codegen": "pnpm --filter @react-grab/sync-server export-spec && pnpm --filter react-grab codegen && pnpm --filter dashboard codegen && git diff --exit-code packages/react-grab/src/generated/ packages/dashboard/src/api/"
```

This runs codegen and checks if there are any uncommitted changes to the generated files. If the generated output differs from what's committed, CI fails.

**Step 2: Test it**

```bash
pnpm check:codegen
```

Expected: Exits 0 if generated code is up-to-date, exits 1 if stale.

**Step 3: Commit**

```bash
git add package.json
git commit -m "ci: add codegen freshness check — ensures generated types match server spec"
```

---

## Summary

After all 7 tasks:

```
sync-server/src/schemas/ (Zod)          ← SSOT — edit HERE
  ↓ export-spec
sync-server/openapi.json                ← derived
  ↓ Orval                ↓ Orval
react-grab/              dashboard/
  src/generated/           src/api/
    sync-api.ts              endpoints/ (hooks + mocks)
    types.ts (bridge)        model/ (types)
  src/types.ts
    CommentItem extends ServerCommentItem
  src/features/selection-groups/types.ts
    SelectionGroup extends ServerSelectionGroup
```

**Adding a new field workflow:**
1. Add field to `sync-server/src/schemas/*.ts`
2. Run `pnpm check:codegen` (or codegen scripts individually)
3. Both react-grab and dashboard see the field automatically
4. If react-grab needs a UI-only extension, add it to the `extends` interface

**Blast radius for the migration:**
- 15 files import `CommentItem` — none need changes (shape is preserved via `extends`)
- 13 files import `SelectionGroup` — none need changes
- 0 public API changes — consumers of `react-grab` see the same types
