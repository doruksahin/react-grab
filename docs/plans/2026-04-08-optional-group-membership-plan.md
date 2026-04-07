# Optional Group Membership Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a selection's group membership optional by modeling `groupId` as `string | null` on the client, removing the synthetic "default" group, and rendering ungrouped selections alongside user groups in the comments dropdown.

**Decisions locked in (do not re-litigate):**
- **Type override:** the generated `ServerCommentItem.groupId: string` is left untouched. The client `CommentItem` overrides it via `Omit<ServerCommentItem, "groupId"> & { groupId: string | null }`. Wire-format translation (`null ↔ ""`) lives in `features/sync/transforms.ts` (or `adapter.ts`) with a comment recording the choice.
- **Test runner:** unit tests run via `pnpm --filter react-grab test:unit -- --run`. The vitest scaffold lands in a separate prep commit before Task 1.
- **Render surface:** the Ungrouped section is added to `components/comments-dropdown.tsx` (where `GroupCollapsible` lives). `components/sidebar/group-list.tsx` is left alone — its `GroupCard` pipeline is a different abstraction and out of scope.
- **Jira callbacks:** `TicketCreatedCallback` and `onJiraResolved` keep `groupId: string`. Ungrouped selections cannot file tickets — guard at call sites (`if (groupId !== null)`) and hide/disable the action when `isUngrouped(selection)`.

**Architecture:** Selection owns membership (`groupId: string | null`). `null` = intentionally ungrouped. No sentinel group. One predicate module (`business/membership.ts`) owns the rule. One writer module (`business/selection-assignment.ts`) owns mutations to `selection.groupId`. `group-list.tsx` composes an `<UngroupedSection/>` above `groups.map(<GroupCollapsible/>)` inside the same container.

**Tech Stack:** SolidJS, TypeScript, Vitest, the existing `features/selection-groups/` module, localStorage persistence.

**Design doc:** `docs/plans/2026-04-08-optional-group-membership-design.md`

**Design reference:** read the design doc before starting — it defines the SSOT rules and folder layout this plan enforces.

---

## Commit discipline

**Every commit must typecheck and pass tests.** No red commits. The type-widening in this refactor touches many call sites that cannot compile independently, so Task 2 bundles them into a single atomic "remove the default-group sentinel" commit. This is a deliberate trade of granularity for a green `git bisect` history.

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
- `packages/react-grab/src/types.ts` (note: `CommentItem.groupId` is currently `groupId?: string` = `string | undefined`, NOT `string`)
- `packages/react-grab/src/core/index.tsx` (find where selections are created)
- `packages/react-grab/src/utils/comment-storage.ts` (hydration path — currently coerces missing `groupId` to `"default"` at lines ~37-40; this is the main offender)

**Pre-flight sweeps — record results before Task 1:**

1. `grep -rn "activeGroupId" packages/react-grab/src` — list every consumer. Any site passing `activeGroupId()` into a `string`-typed slot will need narrowing in Task 2. Keep the list.
2. `grep -rn "onJiraResolved\|TicketCreatedCallback" packages/react-grab/src` — these callbacks take `groupId: string`. **Decision:** Jira resolution is a group-scoped operation. Ungrouped selections cannot trigger it. Every call site must guard with `if (groupId !== null)` before invoking. Record sites that violate this.
3. `grep -rn "groupId" packages/react-grab/src/sync` — identify every serialization boundary. **Decision required up front** (pick one and record in Task 2's sweep notes):
   - Option A: server accepts `null` directly → pass through.
   - Option B: server rejects `null` → omit the field on write, treat absent-on-read as `null`.
4. `grep -rn "DEFAULT_GROUP_ID\|DEFAULT_GROUP_NAME\|createDefaultGroup\|isDefaultGroup\|removeCommentsByGroup" packages/react-grab/src` — complete call-site inventory for the symbols being deleted.

Run tests once to get a clean baseline:

```bash
pnpm --filter react-grab test:unit -- --run
```

Expected: all green. If not, stop and surface the failure before continuing.

---

## Task 1: Add `isUngrouped` / `belongsTo` predicates (TDD)

Standalone green commit. Predicates compile against the current `string | undefined` type as well as the future `string | null` type, so they can safely land first.

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

**Step 2: Run — expect FAIL** (module does not exist).

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

**Step 4: Run — expect PASS. Typecheck.**

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/business/membership.ts \
        packages/react-grab/src/features/selection-groups/business/membership.test.ts
git commit -m "feat(selection-groups): add membership predicates"
```

---

## Task 2: Atomic "remove the default-group sentinel" commit

This is the biggest task by far and must be done as one green commit. Every file change below lands together; do NOT commit partial progress. Work on a feature branch. Run `pnpm --filter react-grab typecheck` repeatedly as you go — you are not done until it is clean.

**Sub-task 2a — write the selection-assignment writer (TDD, staged into the same commit).**

Files:
- Create: `packages/react-grab/src/features/selection-groups/business/selection-assignment.ts`
- Create: `packages/react-grab/src/features/selection-groups/business/selection-assignment.test.ts`

Test:

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

Implementation:

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

**Sub-task 2b — override `CommentItem.groupId` via `Omit`.**

In `packages/react-grab/src/types.ts`, replace:

```ts
export interface CommentItem extends ServerCommentItem {
  previewBounds?: OverlayBounds[];
}
```

with:

```ts
export interface CommentItem extends Omit<ServerCommentItem, "groupId"> {
  /** Client-side override: server type is `string` (required). We treat
   *  `null` as "intentionally ungrouped". Translation to/from the wire
   *  format (`null` ↔ `""`) happens in features/sync/transforms.ts. */
  groupId: string | null;
  previewBounds?: OverlayBounds[];
}
```

Do NOT touch `generated/` or `features/sync/schemas.ts`.

**Sub-task 2c — drop the `DEFAULT_GROUP_*` symbols.**

In `packages/react-grab/src/features/selection-groups/types.ts`:
- Delete `DEFAULT_GROUP_ID`, `DEFAULT_GROUP_NAME`, `createDefaultGroup`.
- In `SelectionGroupsAPI`: change `handleMoveItem` signature to `(itemId: string, groupId: string | null) => void`, change `activeGroupId` to `Accessor<string | null>`, `setActiveGroupId` to `Setter<string | null>`.
- In `SelectionGroupsViewProps`: change `onMoveItem` to `(itemId: string, groupId: string | null) => void`, change `onActiveGroupChange` to `(groupId: string | null) => void`.

In `packages/react-grab/src/features/selection-groups/index.ts`:
- Delete the `DEFAULT_GROUP_ID` / `createDefaultGroup` import.
- Delete the `groups()` derivation that injected a synthetic Default. `groups` is now just `rawGroups`.
- Change `activeGroupId` initial value from `DEFAULT_GROUP_ID` to `null`; signal type is `string | null`.
- Replace `handleDeleteGroup`'s cascade with `unassignSelectionsInGroup` from `business/selection-assignment.ts`. Selections are demoted, not deleted. If `activeGroupId() === groupId`, set it to `null`.
- Replace `handleMoveItem` body with `assignSelection`.
- Delete the `export { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME }` re-export line.

**Sub-task 2d — clean up `business/group-operations.ts`.**

- Delete `isDefaultGroup`. Delete the `DEFAULT_GROUP_ID` import.
- Delete `removeCommentsByGroup` (its only caller was replaced in 2c).
- Leave `getCommentsByGroup`, `countByGroup`, `groupComments`, `fuzzyMatchGroup` untouched — they compare `=== groupId` where `groupId: string`, which is correct.

**Sub-task 2e — `store/group-storage.ts`: drop default, add migration helper.**

- Remove early-returns like `if (groupId === DEFAULT_GROUP_ID) return groups;` from rename/remove paths.
- In `loadGroups`, filter out any persisted entry with `id === "default"` before returning (one-shot idempotent migration for pre-existing localStorage data).
- Remove the `DEFAULT_GROUP_ID` import.
- Add a sibling migration helper for selections:

```ts
export const migrateLegacyDefaultGroup = <T extends { groupId: string | null }>(
  items: T[],
): T[] =>
  items.map((i) => {
    const raw = (i as { groupId?: unknown }).groupId;
    // Legacy data may have: "default" (sentinel), undefined, or missing entirely.
    // Normalize all three to null. Real group IDs pass through.
    if (raw === "default" || raw === undefined || raw === null) {
      return { ...i, groupId: null };
    }
    return i;
  });
```

**Sub-task 2f — `utils/comment-storage.ts`: replace the `"default"` coercion.**

In `loadFromLocalStorage` (around lines 35-45), the current code coerces missing `groupId` to `"default"`:

```ts
groupId:
  typeof commentItem.groupId === "string"
    ? commentItem.groupId
    : "default",
```

Remove this per-field normalization. Pipe the parsed array through `migrateLegacyDefaultGroup(...)` before returning. The migrator handles `"default"`, `undefined`, and missing fields uniformly.

**Sub-task 2g — `core/index.tsx`: new selections default to `null`.**

Find the code that constructs a new `CommentItem` when the user makes a selection. Change the `groupId` initializer from `activeGroupId()` / `"default"` to `null`.

**Sub-task 2h — `group-picker-flyout.tsx`: widen signature (no UI change yet).**

- `onSelect: (groupId: string) => void` → `onSelect: (groupId: string | null) => void`
- `activeGroupId?: string` → `activeGroupId?: string | null`
- Update every caller of `GroupPickerFlyout` to accept the nullable value. Most forward directly into `handleMoveItem`, which is now `string | null`.

The "Ungrouped" row itself is added in Task 5 — this sub-task is signature-only so the atomic commit stays focused on type propagation.

**Sub-task 2i — propagate `string | null` through remaining call sites.**

Walk the typecheck output. Typical sites:
- `comments-dropdown.tsx`, `selection-label/index.tsx`, `overlay-canvas.tsx`, `renderer.tsx` — any read of `item.groupId` expecting `string`.
- The pre-flight `activeGroupId` consumer list — narrow or widen each site.
- Jira callback sites from pre-flight sweep #2 — `TicketCreatedCallback` and `onJiraResolved` keep `groupId: string`. At every site that *invokes* these callbacks, add `if (groupId !== null)` (or `if (selection.groupId !== null)`) guard. Hide/disable the action's UI affordance when `isUngrouped(selection)`.
- `features/sync/transforms.ts` (or `adapter.ts`) — implement the client-side wire translation: on **write**, map `groupId === null` to `""`; on **read**, map `groupId === ""` (and any falsy/missing value) to `null`. Leave a comment at the serialization site recording the decision.

Fix each error by routing through `isUngrouped` / `belongsTo` where the intent is a predicate, or by narrowing (`if (item.groupId) { ... }`) where the code genuinely needs a string.

**Sub-task 2j — verify and commit.**

```bash
pnpm --filter react-grab typecheck    # expect clean
pnpm --filter react-grab test:unit -- --run # expect green
pnpm --filter react-grab lint          # expect clean
```

Then one commit:

```bash
git add -A
git commit -m "refactor(selection-groups): remove default-group sentinel, groupId is nullable

- CommentItem.groupId widened from string? to string | null
- Deleted DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME, createDefaultGroup, isDefaultGroup, removeCommentsByGroup
- New business/selection-assignment.ts owns all writes to selection.groupId
- handleDeleteGroup now demotes selections to null (does not delete)
- Hydration migrates legacy 'default' / undefined groupId to null
- Sync wire format: client-side override; null ↔ \"\" at sync transform boundary"
```

---

## Task 3: Orchestrator test — delete-group demotes instead of deleting

This proves the most important behavioral change in the refactor. It belongs as its own commit so the test name is visible in history.

**Files:**
- Create or extend: `packages/react-grab/src/features/selection-groups/index.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { createSelectionGroups } from "./index.js";

describe("createSelectionGroups.handleDeleteGroup", () => {
  it("demotes selections in the deleted group to groupId: null (does NOT delete them)", () => {
    createRoot((dispose) => {
      const [items, setItems] = createSignal([
        { id: "a", groupId: "g1" },
        { id: "b", groupId: "g1" },
        { id: "c", groupId: "g2" },
      ] as any);
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: () => {},
      } as any);
      // Seed group "g1" via the orchestrator's public add-group path or pre-seed localStorage.
      // ...
      api.handleDeleteGroup("g1");
      const next = items();
      expect(next.map((i) => i.id)).toEqual(["a", "b", "c"]); // nothing deleted
      expect(next.find((i) => i.id === "a")!.groupId).toBeNull();
      expect(next.find((i) => i.id === "b")!.groupId).toBeNull();
      expect(next.find((i) => i.id === "c")!.groupId).toBe("g2");
      dispose();
    });
  });

  it("resets activeGroupId to null when the active group is deleted", () => {
    // api.setActiveGroupId("g1"); api.handleDeleteGroup("g1");
    // expect(api.activeGroupId()).toBeNull();
  });
});
```

Fill in the seeding path based on the actual `SelectionGroupsDeps` shape.

**Step 2: Run — expect PASS** (Task 2 already implemented the behavior).

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/index.test.ts
git commit -m "test(selection-groups): delete-group demotes selections to ungrouped"
```

---

## Task 4: Create `UngroupedSection` component

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/components/ungrouped-section.tsx`

**Step 1:** Write the component. Its contract mirrors `group-collapsible.tsx` but for a flat list. Props:

```ts
interface UngroupedSectionProps {
  selections: CommentItem[];
  // whatever row-level handlers GroupCollapsible receives: onMoveItem, onRevealItem, etc.
}
```

It renders a titled section ("Ungrouped") with the selection rows. Reuse the same row component `group-collapsible.tsx` uses — do NOT duplicate row markup. If the row is inlined inside `group-collapsible.tsx`, extract it into `components/selection-row.tsx` first (DRY) in this task.

**Step 2:** Add `data-react-grab-ungrouped-section` on the wrapper for tests/queries.

**Step 3:** `pnpm --filter react-grab typecheck`.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/
git commit -m "feat(selection-groups): add UngroupedSection component"
```

---

## Task 5: Group picker flyout — add "Ungrouped" row

The signature was already widened in Task 2. This task is the UI addition only.

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx`

**Step 1:** Add a top-row item labeled "Ungrouped". On click: `props.onSelect(null)`.

**Step 2:** Mark the currently-selected state: the "Ungrouped" row shows the checkmark when `props.activeGroupId == null` (covers both `null` and `undefined`). Existing group rows continue to check `activeGroupId === group.id`.

**Step 3:** Smoke test: open the picker on a grouped item → choose Ungrouped → item leaves the group card.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx
git commit -m "feat(picker): add Ungrouped option"
```

---

## Task 6: Compose ungrouped section into `comments-dropdown.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1:** Inside the scroll container that holds the `<For each={filteredGroupedItems()}>{GroupCollapsible}` block (around line 313–317), prepend a `<Show when={ungroupedItems().length > 0}><UngroupedSection .../></Show>`. Compute `ungroupedItems = () => props.items.filter(isUngrouped)` near `groupedItems`. Import `isUngrouped` from `features/selection-groups/business/membership.js`.

**Step 2:** Add a `data-react-grab-group-list` attribute to the scroll container (the `div` with `ref={highlightContainerRef}` if it's the right surface, otherwise the parent). This is the hook Task 8's integration test queries against.

**Step 3:** `pnpm --filter react-grab typecheck` + visual smoke test.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(comments-dropdown): render ungrouped section above group list"
```

**Note:** `components/sidebar/group-list.tsx` is intentionally untouched. Its `GroupCard` pipeline is a different abstraction and out of scope.

---

## Task 7: `group-collapsible.tsx` — drop any `isDefaultGroup` remnants

If Task 2 caught every usage, this task is a no-op. Otherwise:

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx`

**Step 1:** Remove any `<Show when={!isDefaultGroup(...)}>` wrappers around rename/delete controls — all groups are user groups now.

**Step 2:** Typecheck + smoke test.

**Step 3: Commit** (skip if no changes)

```bash
git add packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx
git commit -m "refactor(group-collapsible): drop default-group special casing"
```

---

## Task 8: comments-dropdown integration test

**Files:**
- Create: `packages/react-grab/src/components/comments-dropdown.test.tsx` (or, if rendering the full dropdown is too heavy, create a thin wrapper around the grouped-list section and test that).

**Step 1: Write the test**

```tsx
import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import { GroupList } from "./group-list.jsx";

describe("group-list", () => {
  it("renders ungrouped selections and user groups under one container", () => {
    const selections = [
      { id: "u1", groupId: null, /* ...min fields */ },
      { id: "g1-item", groupId: "g1", /* ... */ },
    ] as any;
    const groups = [{ id: "g1", name: "Alpha", createdAt: 0, revealed: false }];

    const { container } = render(() => (
      <GroupList selections={selections} groups={groups} /* required handlers as noops */ />
    ));

    const list = container.querySelector("[data-react-grab-group-list]");
    expect(list).toBeTruthy();
    expect(list!.querySelector("[data-react-grab-ungrouped-section]")).toBeTruthy();
    expect(list!.textContent).toContain("Alpha");
  });
});
```

**Step 2:** Run — fix any wiring issues — expect PASS.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-list.test.tsx
git commit -m "test(group-list): ungrouped section renders inside container"
```

---

## Task 9: Migration test

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/store/migrate.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { migrateLegacyDefaultGroup } from "./group-storage.js";

describe("migrateLegacyDefaultGroup", () => {
  it("maps legacy 'default' / undefined / missing groupId to null", () => {
    const items = [
      { id: "a", groupId: "default" },
      { id: "b", groupId: "g1" },
      { id: "c", groupId: null },
      { id: "d", groupId: undefined },
      { id: "e" }, // field entirely missing
    ] as any[];
    const out = migrateLegacyDefaultGroup(items);
    expect(out[0].groupId).toBeNull();
    expect(out[1].groupId).toBe("g1");
    expect(out[2].groupId).toBeNull();
    expect(out[3].groupId).toBeNull();
    expect(out[4].groupId).toBeNull();
  });
  it("is idempotent", () => {
    const once = migrateLegacyDefaultGroup([{ id: "a", groupId: "default" }] as any);
    const twice = migrateLegacyDefaultGroup(once);
    expect(twice).toEqual(once);
  });
});
```

**Step 2:** Run — expect PASS.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/store/migrate.test.ts
git commit -m "test(selection-groups): migrate legacy default groupId"
```

---

## Task 10: Full verification

**Step 1: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

**Step 2: Tests**

```bash
pnpm --filter react-grab test:unit -- --run
```

**Step 3: Lint**

```bash
pnpm --filter react-grab lint
```

**Step 4: Manual smoke script** (run in dev harness, tick each):
- [ ] Fresh load, no selections → sidebar shows no ungrouped section, no groups.
- [ ] Make one selection → appears under "Ungrouped".
- [ ] Create a group "Alpha" → empty "Alpha" card appears.
- [ ] Move the selection into "Alpha" via picker → leaves ungrouped, appears in Alpha.
- [ ] Move it back via picker → "Ungrouped" row at top → appears in ungrouped section.
- [ ] Delete "Alpha" while it contains an item → item is demoted to ungrouped (not deleted).
- [ ] Reload → state persists; no "Default" group ever appears.
- [ ] Seed `localStorage` with a legacy `{groupId: "default"}` item → reload → item is under Ungrouped.
- [ ] Seed `localStorage` with a legacy item missing `groupId` entirely → reload → item is under Ungrouped.
- [ ] `git bisect` sanity: `git log --oneline` and confirm every commit message corresponds to a green build.

---

## Out of scope for this plan

- Auto-assigning new selections to the currently-active sidebar group.
- Drag-and-drop between ungrouped section and groups.
- Server-side schema updates beyond the serialize/deserialize `null` handling decided in Task 2.
- **Pre-existing baseline issues (do NOT fix in this refactor):**
  - `GroupedEntry.group` is typed as `SelectionGroup` (`features/sidebar/derive-status.ts`), but `components/sidebar/group-card.tsx` reads `jiraStatus` / `jiraAssignee` / `jiraReporter` / `jiraLabels` — fields that only exist on `SelectionGroupWithJira` (`features/sidebar/jira-types.ts`). This produces ~11 TS2339 errors that were masked until 2026-04-08 by upstream `nodenext` extension errors (TS2835/TS2834) on the same file's imports. Needs a product decision on whether `GroupedEntry` should always carry `SelectionGroupWithJira` or `GroupCard` should receive Jira data via a separate prop. Out of scope: lives in the sidebar pipeline, which Blocker 3 already declared out of scope for this refactor.
  - 11 pre-existing oxlint errors (mostly `no-unused-vars` in `features/sync/transforms.ts` and similar). Captured in `/tmp/baseline-lint.txt` for the duration of this refactor; delta-clean rule applies.
  - Execution rule: every commit must produce a typecheck/lint output identical (as a set) to `/tmp/baseline-typecheck.txt` and `/tmp/baseline-lint.txt`. Unit tests (`pnpm --filter react-grab test:unit -- --run`) must be fully green with zero baseline tolerance.
