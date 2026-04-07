# Optional Group Membership Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a selection's group membership optional by modeling `groupId` as `string | null`, removing the synthetic "default" group, and rendering ungrouped selections alongside user groups in `data-react-grab-group-list`.

**Architecture:** Selection owns membership (`groupId: string | null`). `null` = intentionally ungrouped. No sentinel group. One predicate module (`business/membership.ts`) owns the rule. One writer module (`business/selection-assignment.ts`) owns mutations to `selection.groupId`. `group-list.tsx` composes an `<UngroupedSection/>` above `groups.map(<GroupCollapsible/>)` inside the same container.

**Tech Stack:** SolidJS, TypeScript, Vitest, the existing `features/selection-groups/` module, localStorage persistence.

**Design doc:** `docs/plans/2026-04-08-optional-group-membership-design.md`

**Design reference:** read the design doc before starting — it defines the SSOT rules and folder layout this plan enforces.

---

## Pre-flight

Before Task 1, read these files end-to-end so you understand the current shape:

- `packages/react-grab/src/features/selection-groups/types.ts`
- `packages/react-grab/src/features/selection-groups/index.ts`
- `packages/react-grab/src/features/selection-groups/business/group-operations.ts`
- `packages/react-grab/src/features/selection-groups/store/group-storage.ts`
- `packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx`
- `packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx`
- `packages/react-grab/src/components/sidebar/group-list.tsx`
- `packages/react-grab/src/types.ts` (look for `CommentItem` — it carries `groupId`)
- `packages/react-grab/src/core/index.tsx` (find where selections are created — this is where the default must become `null`)

Run tests once to get a clean baseline:

```bash
pnpm --filter react-grab test -- --run
```

Expected: all green. If not, stop and surface the failure before continuing.

---

## Task 1: Add `isUngrouped` / `belongsTo` predicates (TDD)

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/business/membership.ts`
- Create: `packages/react-grab/src/features/selection-groups/business/membership.test.ts`

**Step 1: Write the failing test**

```ts
// membership.test.ts
import { describe, it, expect } from "vitest";
import { isUngrouped, belongsTo } from "./membership.js";

describe("membership", () => {
  it("isUngrouped is true when groupId is null", () => {
    expect(isUngrouped({ groupId: null } as any)).toBe(true);
  });
  it("isUngrouped is false when groupId is a string", () => {
    expect(isUngrouped({ groupId: "g1" } as any)).toBe(false);
  });
  it("belongsTo matches exact groupId", () => {
    expect(belongsTo({ groupId: "g1" } as any, "g1")).toBe(true);
    expect(belongsTo({ groupId: "g2" } as any, "g1")).toBe(false);
    expect(belongsTo({ groupId: null } as any, "g1")).toBe(false);
  });
});
```

**Step 2: Run test — expect FAIL** (module does not exist)

```bash
pnpm --filter react-grab test -- --run membership.test
```

**Step 3: Implement**

```ts
// membership.ts
import type { CommentItem } from "../../../types.js";

export const isUngrouped = (item: Pick<CommentItem, "groupId">): boolean =>
  item.groupId === null;

export const belongsTo = (
  item: Pick<CommentItem, "groupId">,
  groupId: string,
): boolean => item.groupId === groupId;
```

**Step 4: Run test — expect PASS**

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/business/membership.ts \
        packages/react-grab/src/features/selection-groups/business/membership.test.ts
git commit -m "feat(selection-groups): add membership predicates"
```

---

## Task 2: Widen `CommentItem.groupId` to `string | null`

**Files:**
- Modify: `packages/react-grab/src/types.ts` (change `groupId: string` → `groupId: string | null` on `CommentItem`)

**Step 1: Read current `types.ts`** and locate `CommentItem`.

**Step 2: Change the field type.** Leave everything else untouched.

**Step 3: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: compilation errors in every place that assumes `groupId` is a string. **Write down the list** — those sites are the rest of this plan.

**Step 4: Commit (even if red)**

```bash
git add packages/react-grab/src/types.ts
git commit -m "refactor(types): CommentItem.groupId is string | null"
```

---

## Task 3: Add `selection-assignment.ts` as the sole writer (TDD)

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/business/selection-assignment.ts`
- Create: `packages/react-grab/src/features/selection-groups/business/selection-assignment.test.ts`

**Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { assignSelection, unassignSelectionsInGroup } from "./selection-assignment.js";

const items = [
  { id: "a", groupId: null },
  { id: "b", groupId: "g1" },
  { id: "c", groupId: "g1" },
] as any[];

describe("selection-assignment", () => {
  it("assigns a selection to a group", () => {
    const next = assignSelection(items, "a", "g1");
    expect(next.find((i) => i.id === "a")!.groupId).toBe("g1");
  });
  it("unassigns a selection when groupId is null", () => {
    const next = assignSelection(items, "b", null);
    expect(next.find((i) => i.id === "b")!.groupId).toBeNull();
  });
  it("demotes all selections in a group to null", () => {
    const next = unassignSelectionsInGroup(items, "g1");
    expect(next.filter((i) => i.groupId === null).map((i) => i.id)).toEqual(["a","b","c"]);
  });
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

```ts
import type { CommentItem } from "../../../types.js";

export const assignSelection = (
  items: CommentItem[],
  itemId: string,
  groupId: string | null,
): CommentItem[] =>
  items.map((i) => (i.id === itemId ? { ...i, groupId } : i));

export const unassignSelectionsInGroup = (
  items: CommentItem[],
  groupId: string,
): CommentItem[] =>
  items.map((i) => (i.groupId === groupId ? { ...i, groupId: null } : i));
```

**Step 4: Run — expect PASS**

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/business/selection-assignment.ts \
        packages/react-grab/src/features/selection-groups/business/selection-assignment.test.ts
git commit -m "feat(selection-groups): add selection-assignment writer"
```

---

## Task 4: Remove `DEFAULT_GROUP_ID` from `types.ts`

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/types.ts`

**Step 1:** Delete `DEFAULT_GROUP_ID`, `DEFAULT_GROUP_NAME`, `createDefaultGroup`. Keep `SelectionGroup`, `SelectionGroupsDeps`, `SelectionGroupsAPI`, `SelectionGroupsViewProps`.

**Step 2:** In `SelectionGroupsAPI`, change `handleMoveItem` signature:

```ts
handleMoveItem: (itemId: string, groupId: string | null) => void;
```

Also widen `onMoveItem` in `SelectionGroupsViewProps` to `(itemId: string, groupId: string | null) => void`.

**Step 3:** Delete the re-exports at the bottom of `features/selection-groups/index.ts` for `DEFAULT_GROUP_ID` / `DEFAULT_GROUP_NAME`.

**Step 4: Typecheck — expect many errors.** Record the list.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/types.ts \
        packages/react-grab/src/features/selection-groups/index.ts
git commit -m "refactor(selection-groups): remove DEFAULT_GROUP_ID sentinel"
```

---

## Task 5: Rewrite `features/selection-groups/index.ts` orchestrator

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/index.ts`

**Step 1:** Remove the `groups()` derivation that injected a synthetic Default. `groups` is now just `rawGroups`.

**Step 2:** Change `activeGroupId` initial value from `DEFAULT_GROUP_ID` to `null`. Update its signal type to `string | null`.

**Step 3:** In `handleDeleteGroup`, replace the "remove comments by group" cascade with `unassignSelectionsInGroup` from `business/selection-assignment.ts`. Selections are demoted, not deleted. If `activeGroupId() === groupId`, set it to `null`.

**Step 4:** Replace `handleMoveItem` body with `assignSelection` from `selection-assignment.ts`. Accept `groupId: string | null`.

**Step 5:** Update `SelectionGroupsAPI` return — `activeGroupId` is now `Accessor<string | null>`, `setActiveGroupId` is `Setter<string | null>`. Update `types.ts` accordingly (do in this task).

**Step 6: Typecheck — expect the error list to shrink.**

**Step 7: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/index.ts \
        packages/react-grab/src/features/selection-groups/types.ts
git commit -m "refactor(selection-groups): orchestrator uses nullable groupId"
```

---

## Task 6: Clean up `business/group-operations.ts`

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/business/group-operations.ts`

**Step 1:** Delete `isDefaultGroup`. Delete the `DEFAULT_GROUP_ID` import.

**Step 2:** Leave `getCommentsByGroup`, `countByGroup`, `groupComments`, `fuzzyMatchGroup` untouched — they already use `=== groupId` which is fine for a `string` `groupId`. They should never receive `null` because they're only called for user groups; if in doubt, replace their inline checks with `belongsTo` from `membership.ts` (DRY).

**Step 3:** `removeCommentsByGroup` is no longer called (Task 5 replaced its caller). Delete it.

**Step 4: Typecheck.**

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/business/group-operations.ts
git commit -m "refactor(selection-groups): drop default-group helpers"
```

---

## Task 7: `store/group-storage.ts` — drop default, add migration

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/store/group-storage.ts`

**Step 1:** Remove any early-returns like `if (groupId === DEFAULT_GROUP_ID) return groups;` on rename/delete — groups are now all equal citizens.

**Step 2:** In the load path (wherever `loadGroups` reads localStorage), filter out any persisted entry with `id === "default"` before returning. Idempotent, one-shot.

**Step 3:** Remove the `DEFAULT_GROUP_ID` import.

**Step 4:** Add a sibling migration helper for selections (called from wherever `CommentItem[]` is hydrated — identify this in `core/index.tsx` or `utils/comment-storage.ts` during Task 8):

```ts
// in store/group-storage.ts or a new store/migrate-selections.ts
export const migrateLegacyDefaultGroup = <T extends { groupId: string | null }>(
  items: T[],
): T[] => items.map((i) => ((i.groupId as unknown) === "default" ? { ...i, groupId: null } : i));
```

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/store/
git commit -m "refactor(selection-groups): drop default group from storage + migration helper"
```

---

## Task 8: Hydration migration + new-selection default

**Files:**
- Modify: `packages/react-grab/src/utils/comment-storage.ts` (or wherever `CommentItem[]` is loaded)
- Modify: `packages/react-grab/src/core/index.tsx` (where new selections are constructed)

**Step 1:** In the selection hydration path, call `migrateLegacyDefaultGroup(...)` on the loaded array before the signal is seeded.

**Step 2:** In `core/index.tsx` find the code that creates a new `CommentItem` when the user makes a selection. Change the `groupId` initializer from `activeGroupId()` / `"default"` to `null`.

**Step 3: Manual smoke test**
- Launch the dev harness (`pnpm --filter react-grab dev` or the demo app).
- In DevTools, seed `localStorage` with a legacy item: `{"id":"x","groupId":"default", ...}`.
- Reload. Confirm via DevTools it rehydrates with `groupId: null`.

**Step 4: Commit**

```bash
git add packages/react-grab/src/utils/comment-storage.ts packages/react-grab/src/core/index.tsx
git commit -m "feat(core): new selections default to ungrouped + migrate legacy default"
```

---

## Task 9: Create `UngroupedSection` component

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/components/ungrouped-section.tsx`

**Step 1:** Write the component. Its contract mirrors `group-collapsible.tsx` but for a flat list. Props:

```ts
interface UngroupedSectionProps {
  selections: CommentItem[];
  // whatever row-level handlers GroupCollapsible receives: onMoveItem, onRevealItem, etc.
}
```

It renders a titled section ("Ungrouped") with the selection rows. Reuse the same row component `group-collapsible.tsx` uses for its items — do NOT duplicate row markup. If the row is inlined inside `group-collapsible.tsx`, extract it into `components/selection-row.tsx` first (DRY) in this task.

**Step 2:** Add `data-react-grab-ungrouped-section` on the wrapper for tests/queries.

**Step 3:** Manual compile check — `pnpm --filter react-grab typecheck`.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/
git commit -m "feat(selection-groups): add UngroupedSection component"
```

---

## Task 10: Compose `group-list.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/group-list.tsx`

**Step 1:** Inside the existing `data-react-grab-group-list` container, render:

```tsx
<div data-react-grab-group-list>
  <UngroupedSection
    selections={props.selections.filter(isUngrouped)}
    {...rowHandlers}
  />
  <For each={props.groups}>
    {(group) => (
      <GroupCollapsible
        group={group}
        selections={props.selections.filter((s) => belongsTo(s, group.id))}
        {...rowHandlers}
      />
    )}
  </For>
</div>
```

Import `isUngrouped` and `belongsTo` from `features/selection-groups/business/membership.js`.

**Step 2:** Conditionally hide the ungrouped section when `ungroupedSelections.length === 0` — YAGNI says show nothing rather than an empty header. (If the design calls for an always-visible header, skip this.)

**Step 3:** Typecheck + visual smoke test in the dev harness.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-list.tsx
git commit -m "feat(sidebar): render ungrouped section in group list"
```

---

## Task 11: Group picker flyout — add "Ungrouped" option

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx`

**Step 1:** Add a top-row item labeled "Ungrouped". On click: `onMoveItem(itemId, null)`.

**Step 2:** Mark the currently selected state: the "Ungrouped" row is active when `isUngrouped(currentItem)`.

**Step 3:** Smoke test: open the picker on a grouped item → choose Ungrouped → verify the item leaves the group card and appears in the ungrouped section.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx
git commit -m "feat(picker): add Ungrouped option"
```

---

## Task 12: `group-collapsible.tsx` — drop `isDefaultGroup` usage

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx`

**Step 1:** Remove the `isDefaultGroup` import and any `<Show when={!isDefaultGroup(...)}>` wrappers around rename/delete controls — all groups are now user groups, so all controls are always visible.

**Step 2: Typecheck + smoke test.**

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx
git commit -m "refactor(group-collapsible): drop default-group special casing"
```

---

## Task 13: Sweep remaining type errors

**Step 1:** `pnpm --filter react-grab typecheck`. Walk every remaining error. Typical sites:
- `comments-dropdown.tsx`, `selection-label/index.tsx`, `overlay-canvas.tsx`, `renderer.tsx`, `sync/adapter.ts`, `sync/transforms.ts` — anywhere that reads `item.groupId` expecting a string.

**Step 2:** Fix by routing through `isUngrouped` / `belongsTo` where the intent is a predicate, or by narrowing (`if (item.groupId) { ... }`) where the code genuinely needs a string.

**Sync layer note:** if the sync adapter serializes `groupId` to the server, confirm the server contract accepts `null`. If not, map `null` → omit-field on write and absent-field → `null` on read. Record this decision as a comment at the serialization site.

**Step 3:** `pnpm --filter react-grab test -- --run` — all tests green.

**Step 4: Commit** as one sweep or logically grouped:

```bash
git commit -m "refactor: propagate nullable groupId through call sites"
```

---

## Task 14: `group-list` integration test

**Files:**
- Create: `packages/react-grab/src/components/sidebar/group-list.test.tsx` (if a test already exists, extend it)

**Step 1: Failing test**

```tsx
import { render, screen } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { GroupList } from "./group-list.jsx";

describe("group-list", () => {
  it("renders ungrouped selections and user groups under one container", () => {
    const selections = [
      { id: "u1", groupId: null, /* ...min fields */ },
      { id: "g1-item", groupId: "g1", /* ... */ },
    ] as any;
    const groups = [{ id: "g1", name: "Alpha", createdAt: 0, revealed: false }];

    render(() => (
      <GroupList selections={selections} groups={groups} /* required handlers as noops */ />
    ));

    const container = screen.getByTestId
      ? screen.getByTestId("react-grab-group-list")
      : document.querySelector("[data-react-grab-group-list]")!;
    expect(container).toBeTruthy();
    expect(container.querySelector("[data-react-grab-ungrouped-section]")).toBeTruthy();
    expect(container.textContent).toContain("Alpha");
  });
});
```

**Step 2:** Run — expect FAIL if any wiring is wrong, then fix.

**Step 3:** Run — expect PASS.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-list.test.tsx
git commit -m "test(group-list): ungrouped section renders inside container"
```

---

## Task 15: Migration test

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/store/migrate.test.ts`

**Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { migrateLegacyDefaultGroup } from "./group-storage.js"; // or wherever it lives

describe("migrateLegacyDefaultGroup", () => {
  it("maps legacy 'default' groupId to null", () => {
    const items = [
      { id: "a", groupId: "default" },
      { id: "b", groupId: "g1" },
      { id: "c", groupId: null },
    ] as any[];
    const out = migrateLegacyDefaultGroup(items);
    expect(out[0].groupId).toBeNull();
    expect(out[1].groupId).toBe("g1");
    expect(out[2].groupId).toBeNull();
  });
  it("is idempotent", () => {
    const once = migrateLegacyDefaultGroup([{ id: "a", groupId: "default" }] as any);
    const twice = migrateLegacyDefaultGroup(once);
    expect(twice).toEqual(once);
  });
});
```

**Step 2:** Run — expect PASS (migrator already exists from Task 7).

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/store/migrate.test.ts
git commit -m "test(selection-groups): migrate legacy default groupId"
```

---

## Task 16: Full verification

**Step 1: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: clean.

**Step 2: Tests**

```bash
pnpm --filter react-grab test -- --run
```

Expected: all green.

**Step 3: Lint**

```bash
pnpm --filter react-grab lint
```

Expected: clean.

**Step 4: Manual smoke script** (run in dev harness, tick each):
- [ ] Fresh load, no selections → sidebar shows no ungrouped section, no groups.
- [ ] Make one selection → it appears under "Ungrouped".
- [ ] Create a group "Alpha" → empty "Alpha" card appears under ungrouped section.
- [ ] Move the selection into "Alpha" via picker → it leaves ungrouped, appears in Alpha.
- [ ] Move it back via picker → "Ungrouped" option at top of flyout → appears in ungrouped section.
- [ ] Delete "Alpha" while it contains an item → the item is demoted to ungrouped (not deleted).
- [ ] Reload → state persists; no "Default" group ever appears.
- [ ] Seed `localStorage` with a legacy `{groupId: "default"}` item → reload → item is under Ungrouped; no "default" group entry in persisted groups.

**Step 5: Final commit (if needed) and push**

```bash
git status
# If everything is committed, you're done.
```

---

## Out of scope for this plan

- Auto-assigning new selections to the currently-active sidebar group.
- Drag-and-drop between ungrouped section and groups.
- Server-side schema updates for the sync layer beyond the serialize/deserialize null handling noted in Task 13.
