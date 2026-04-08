# Loose Selection Ticketing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let a single ungrouped selection earn its own JIRA ticket without changing the server contract. The sidebar gains a loose-selection render path; clicking "Create ticket" on a loose card auto-creates a hidden 1-item synthetic group, files the ticket against that group, and continues to render the result as a loose card.

**Architecture:** Strategy 2 (synthetic single-item groups). Add a client-only `synthetic?: boolean` flag to `SelectionGroup` (same pattern as the existing `jiraResolved?: boolean`). One writer module (`business/synthetic-group.ts`) owns synthetic-group creation and the `isSynthetic` predicate. One render predicate (`business/membership.ts/isPresentedAsLoose`) is the single source of truth for "render this item as a loose card." The sidebar gains a `LooseSelectionList` that renders above `GroupList`, and a `LooseSelectionCard` that wraps the existing `SelectionCard` non-clickably + adds a Create-ticket button. Synthetic groups are invisible everywhere user-facing — they don't appear in `GroupList`, the picker, the stats bar, or filters — and are garbage-collected when empty.

**Tech Stack:** SolidJS, TypeScript, Vitest, the existing `features/selection-groups/` module, the existing `JiraCreateDialog`/`JiraCreateForm` Jira pipeline (untouched), the optional-group-membership refactor's `assignSelection` writer.

**Branch:** `feat/loose-selection-ticketing`, cut from the current `feat/optional-group-membership` (inherits the 13-commit refactor + vitest scaffold + delta-clean baseline rule).

**Out of scope:**
- Server contract changes (new `/items/:itemId/jira-ticket` endpoint, Jira fields on `CommentItem`, etc.) — that's Strategy 1, a separate plan.
- Fixing the pre-existing `GroupedEntry`/`SelectionGroupWithJira` blocker in `components/sidebar/group-card.tsx`. The loose-card render path is parallel to `GroupCard` and never reads its broken Jira fields.
- Bundling multiple loose tickets into one group via the picker. If users want this, they create a real group via the existing "New group..." flow.
- Auto-promotion of synthetic groups to "real" groups by accumulating items. Synthetic groups stay synthetic forever, with exactly 1 item. The render rule `synthetic && count === 1` is permanent for any given synthetic group.

---

## Commit discipline & execution rules

**Inherited from the previous plan:**

1. **Delta-clean rule.** Every commit's `pnpm --filter react-grab typecheck` and `pnpm --filter react-grab lint` must produce a typecheck/lint error set **identical** to the captured baseline files (`/tmp/baseline-typecheck.txt`, `/tmp/baseline-lint.txt`). Re-capture them at the start of pre-flight on the new branch — they should match the previous baselines exactly because we're cutting from the same head.
2. **Unit tests are absolute.** `pnpm --filter react-grab exec vitest run` must be 100% green (no baseline tolerance). The current branch ships 12 passing tests in 5 files; that count must only grow.
3. **Verify before every commit.** Run typecheck + lint + vitest before `git add`. If the delta is non-empty, fix before committing.
4. **No partial commits inside an atomic task.** A few tasks (Task 4, Task 8) are bundled — don't commit halfway.
5. **Do not push.** Both branches stay local; the user pushes manually.

---

## Pre-flight

**Step 1 — Cut the new branch.**

```bash
git checkout feat/optional-group-membership
git checkout -b feat/loose-selection-ticketing
git status
```

Expected: clean working tree on `feat/loose-selection-ticketing`. The 13 commits from the previous refactor are in the branch's history.

**Step 2 — Re-capture baselines (they should be unchanged).**

```bash
pnpm --filter react-grab typecheck > /tmp/baseline-typecheck.txt 2>&1
pnpm --filter react-grab lint > /tmp/baseline-lint.txt 2>&1
pnpm --filter react-grab exec vitest run 2>&1 | tail -10
```

Expected:
- Typecheck: 20 errors (all in `sidebar/group-card.tsx` and `features/sidebar/index.ts` — pre-existing)
- Lint: 11 errors (same set as before)
- Vitest: **5 files passed, 12 tests passed**

If any of these are different, stop and surface the change. Something drifted.

**Step 3 — Read these files end-to-end** so you understand the current shape:

- `packages/react-grab/src/features/selection-groups/types.ts` (where `SelectionGroup` lives — note the existing `jiraResolved?: boolean` extension pattern you'll mirror)
- `packages/react-grab/src/features/selection-groups/index.ts` (orchestrator — `handleDeleteGroup`, `handleMoveItem`, `handleAddGroup`)
- `packages/react-grab/src/features/selection-groups/business/membership.ts` (existing `isUngrouped` / `belongsTo` — you'll add `isPresentedAsLoose`)
- `packages/react-grab/src/features/selection-groups/business/selection-assignment.ts` (existing `assignSelection`, `unassignSelectionsInGroup`)
- `packages/react-grab/src/features/selection-groups/store/group-storage.ts` (note `addGroup` only takes a `name` — you'll need a new `addSyntheticGroup` or extend it)
- `packages/react-grab/src/components/sidebar/index.tsx` (the `Sidebar` component — note `groupedItems` memo at line 93–94 and `GroupList` mount at line 185)
- `packages/react-grab/src/components/sidebar/group-detail-view.tsx` (note how `JiraCreateDialog` is opened from a `dialogOpen` signal at line 27 — this is the pattern we'll lift up to `Sidebar` for loose cards)
- `packages/react-grab/src/components/sidebar/jira-create-dialog.tsx` (note the prop shape — synthetic groups will satisfy this)
- `packages/react-grab/src/components/sidebar/jira-create-form.tsx` (note `defaultSummary(group)` and `defaultDescription(group, items)` from `features/sidebar/jira-defaults.ts` — synthetic groups need a `name` good enough for `defaultSummary`)
- `packages/react-grab/src/components/sidebar/selection-card.tsx` (the card you'll wrap non-clickably)
- `packages/react-grab/src/core/index.tsx` lines 4485–4503 (`onTicketCreated` callback — works as-is for synthetic groups)
- `packages/react-grab/src/components/sidebar/group-list.tsx` (note `GroupedEntry[]` prop — synthetic 1-item groups must be filtered out before reaching here)
- `packages/react-grab/src/features/sidebar/jira-types.ts` (note `SelectionGroupWithJira` extends `SelectionGroup` with runtime Jira fields — synthetic groups satisfy `SelectionGroup` cleanly; the dialog will accept them with default empty Jira fields)

**Step 4 — Pre-flight sweeps. Record the results before Task 1.**

1. `grep -rn "loadGroups\|addGroup\|persistGroups" packages/react-grab/src/features/selection-groups/store` — you need to know every storage entry point that handles `SelectionGroup` so the new synthetic-group writer goes through one of them.
2. `grep -rn "groupComments\|groupedItems" packages/react-grab/src` — every consumer of "all groups paired with their items." Each one needs to filter out `synthetic && items.length === 1` so synthetic groups don't double-render as both a loose card AND a group card.
3. `grep -rn "GroupPickerFlyout" packages/react-grab/src` — every place that lists groups in a picker. Synthetic groups must be filtered out of all of them.
4. `grep -rn "props.groups\b" packages/react-grab/src/components/sidebar` — every sidebar consumer of `groups`. Some will need a "user-facing groups" derivation that excludes synthetic ones.

Record the lists in your task notes — Task 4 walks them.

---

## Task 1: Add `synthetic?: boolean` to `SelectionGroup`

Standalone trivial commit. Type-only change with no consumers yet.

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/types.ts`

**Step 1: Edit the type**

```ts
export interface SelectionGroup extends ServerSelectionGroup {
  /** True when JIRA polling confirms statusCategory === "done". Persisted so it
   *  survives page refresh without waiting for the next poll cycle. */
  jiraResolved?: boolean;
  /** True if this group was auto-created when a loose selection earned a
   *  ticket. Synthetic groups are filtered out of every user-facing surface
   *  (GroupList, picker, stats, filters); their single item renders as a
   *  loose card via `isPresentedAsLoose`. The flag is permanent — synthetic
   *  groups never become "real" by accumulating items, because we filter
   *  them out of the picker. */
  synthetic?: boolean;
}
```

**Step 2: Verify**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"
pnpm --filter react-grab exec vitest run 2>&1 | tail -5
```

Expected: 20 typecheck errors (unchanged), 11 lint errors (unchanged), 12 tests passing.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/types.ts
git commit -m "feat(selection-groups): add synthetic flag to SelectionGroup

Client-only field, mirrors the existing jiraResolved? extension pattern.
Marks groups that were auto-created as 1-item containers for loose-
selection ticketing. Permanent flag — synthetic groups never become real."
```

---

## Task 2: TDD `synthetic-group.ts` writer module

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/business/synthetic-group.ts`
- Create: `packages/react-grab/src/features/selection-groups/business/synthetic-group.test.ts`

**Step 1: Write the failing test**

```ts
// synthetic-group.test.ts
import { describe, it, expect } from "vitest";
import {
  createSyntheticGroupForItem,
  isSynthetic,
  inferSyntheticGroupName,
} from "./synthetic-group.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";

const item = {
  id: "item-a",
  groupId: null,
  componentName: "CardTitle",
  elementName: "h3",
  tagName: "h3",
} as unknown as CommentItem;

describe("synthetic-group", () => {
  describe("inferSyntheticGroupName", () => {
    it("uses componentName when present", () => {
      expect(inferSyntheticGroupName(item)).toBe("CardTitle");
    });
    it("falls back to elementName when componentName is missing", () => {
      const noComp = { ...item, componentName: undefined } as CommentItem;
      expect(inferSyntheticGroupName(noComp)).toBe("h3");
    });
    it("falls back to 'Untitled' when both are missing", () => {
      const bare = { ...item, componentName: undefined, elementName: "" } as CommentItem;
      expect(inferSyntheticGroupName(bare)).toBe("Untitled");
    });
  });

  describe("createSyntheticGroupForItem", () => {
    it("returns a SelectionGroup with synthetic=true and the inferred name", () => {
      const g = createSyntheticGroupForItem(item);
      expect(g.synthetic).toBe(true);
      expect(g.name).toBe("CardTitle");
      expect(g.id).toBeTruthy();
      expect(g.id).not.toBe("default");
      expect(typeof g.createdAt).toBe("number");
      expect(g.revealed).toBe(false);
    });
    it("returns a fresh id on every call", () => {
      const g1 = createSyntheticGroupForItem(item);
      const g2 = createSyntheticGroupForItem(item);
      expect(g1.id).not.toBe(g2.id);
    });
  });

  describe("isSynthetic", () => {
    it("is true for groups with synthetic === true", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false, synthetic: true } as SelectionGroup;
      expect(isSynthetic(g)).toBe(true);
    });
    it("is false for groups without the flag", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false } as SelectionGroup;
      expect(isSynthetic(g)).toBe(false);
    });
    it("is false for groups with synthetic === false", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false, synthetic: false } as SelectionGroup;
      expect(isSynthetic(g)).toBe(false);
    });
  });
});
```

**Step 2: Run — expect FAIL** (module does not exist).

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/business/synthetic-group.test.ts
```

**Step 3: Implement**

```ts
// synthetic-group.ts
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";

/**
 * Synthetic-group operations. A synthetic group is auto-created when a
 * loose selection earns a JIRA ticket: it exists purely as a backing store
 * for the ticket fields (jiraTicketId, jiraStatus, etc.) that the rest of
 * the system expects to live on a SelectionGroup. Synthetic groups are
 * filtered out of every user-facing surface; their single item renders as
 * a loose card via `isPresentedAsLoose`.
 *
 * SRP: this module owns the *creation* and *identification* of synthetic
 * groups. It does NOT own:
 *   - the rendering rule (that's `business/membership.ts/isPresentedAsLoose`)
 *   - the dialog flow (that's wired in `core/index.tsx` and the sidebar)
 *   - persistence (that's `store/group-storage.ts`)
 */

/**
 * Best-effort name inferred from the item being ticketed. Used as the
 * synthetic group's `name`, which feeds `defaultSummary(group)` in the
 * Jira create form.
 */
export const inferSyntheticGroupName = (item: CommentItem): string =>
  item.componentName ?? item.elementName ?? "Untitled";

/**
 * Build a fresh SelectionGroup tagged as synthetic. Pure function — does
 * NOT persist. The caller is responsible for storing the result via the
 * orchestrator's `setGroups` / `persistGroups`.
 */
export const createSyntheticGroupForItem = (
  item: CommentItem,
): SelectionGroup => ({
  id: generateId("group"),
  name: inferSyntheticGroupName(item),
  createdAt: Date.now(),
  revealed: false,
  synthetic: true,
});

/**
 * Predicate for "is this a synthetic group?" — used by every filter that
 * needs to hide synthetic groups from user-facing lists.
 */
export const isSynthetic = (group: SelectionGroup): boolean =>
  group.synthetic === true;
```

**Step 4: Run — expect PASS.**

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/business/synthetic-group.test.ts
```

Expected: 7 tests pass.

**Step 5: Delta check + commit**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11

git add packages/react-grab/src/features/selection-groups/business/synthetic-group.ts \
        packages/react-grab/src/features/selection-groups/business/synthetic-group.test.ts
git commit -m "feat(selection-groups): synthetic-group writer + isSynthetic predicate

createSyntheticGroupForItem builds a fresh SelectionGroup with synthetic=true,
the name inferred from componentName / elementName / 'Untitled'. isSynthetic
is the single predicate every filter consults to hide synthetic groups from
user-facing lists. Pure functions, no persistence — caller wires them in."
```

---

## Task 3: Extend `membership.ts` with `isPresentedAsLoose` (TDD)

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/business/membership.ts`
- Modify: `packages/react-grab/src/features/selection-groups/business/membership.test.ts`

**Step 1: Add the failing test**

Append to `membership.test.ts`:

```ts
import { isPresentedAsLoose } from "./membership.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";

describe("isPresentedAsLoose", () => {
  const realGroup = { id: "g1", name: "Real", createdAt: 0, revealed: false } as SelectionGroup;
  const synthGroup = { id: "g2", name: "Synth", createdAt: 0, revealed: false, synthetic: true } as SelectionGroup;
  const groups = [realGroup, synthGroup];

  it("is true when groupId is null (genuinely loose)", () => {
    const item = { id: "a", groupId: null } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(true);
  });

  it("is false when item is in a real group", () => {
    const item = { id: "a", groupId: "g1" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(false);
  });

  it("is true when item is the only one in a synthetic group", () => {
    const item = { id: "a", groupId: "g2" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(true);
  });

  it("is false when a synthetic group has 2+ items (defensive — picker prevents this in practice)", () => {
    const a = { id: "a", groupId: "g2" } as unknown as CommentItem;
    const b = { id: "b", groupId: "g2" } as unknown as CommentItem;
    expect(isPresentedAsLoose(a, groups, [a, b])).toBe(false);
    expect(isPresentedAsLoose(b, groups, [a, b])).toBe(false);
  });

  it("is false when the item points at a missing group (orphaned)", () => {
    const item = { id: "a", groupId: "missing" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(false);
  });
});
```

**Step 2: Run — expect FAIL** (function does not exist).

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/business/membership.test.ts
```

**Step 3: Implement**

Append to `membership.ts`:

```ts
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isSynthetic } from "./synthetic-group.js";

/**
 * Single source of truth for "should this item be rendered as a loose card?"
 *
 * An item is presented as loose when:
 *   - it has no group at all (`groupId === null`), OR
 *   - it lives in a synthetic group that contains exactly this one item.
 *
 * This predicate is the only place that knows about the synthetic-group
 * rendering rule. Every render path (sidebar's loose-selection-list,
 * comments-dropdown's UngroupedSection if extended, etc.) consults this
 * function rather than reimplementing the check.
 */
export const isPresentedAsLoose = (
  item: CommentItem,
  groups: SelectionGroup[],
  allItems: CommentItem[],
): boolean => {
  if (item.groupId === null) return true;
  const group = groups.find((g) => g.id === item.groupId);
  if (!group || !isSynthetic(group)) return false;
  const count = allItems.reduce(
    (n, i) => (i.groupId === group.id ? n + 1 : n),
    0,
  );
  return count === 1;
};
```

Note the `import type { CommentItem }` and `SelectionGroup` — the existing `membership.ts` only has the `HasMembership` structural type. Adding these brings real types in for the new predicate; the old `isUngrouped`/`belongsTo` keep their structural type so they don't regress.

**Step 4: Run — expect PASS.**

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/business/membership.test.ts
```

Expected: 8 tests pass (3 existing + 5 new).

**Step 5: Delta check + commit**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11

git add packages/react-grab/src/features/selection-groups/business/membership.ts \
        packages/react-grab/src/features/selection-groups/business/membership.test.ts
git commit -m "feat(selection-groups): add isPresentedAsLoose predicate

Single source of truth for the rendering rule 'this item should appear as
a loose card.' Returns true for genuinely-ungrouped items (groupId === null)
and for items in a 1-item synthetic group. Used by every render path so the
synthetic-group fiction lives in exactly one predicate."
```

---

## Task 4: Filter synthetic groups out of every user-facing groups list (atomic)

This is the second-biggest task. It must be one commit because the filters touch multiple consumers and partial commits would either double-render or hide real groups. Walk the pre-flight sweep #4 list and gate every consumer.

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` (the sidebar's `groupedItems` and `props.groups` consumers)
- Modify: `packages/react-grab/src/components/sidebar/sidebar.tsx` if separate (some helpers iterate `props.groups` for filter-distinct values)
- Modify: any other site found by the sweep that iterates `groups` and shouldn't include synthetic ones

**Strategy:** add a single derivation `userFacingGroups = props.groups.filter((g) => !isSynthetic(g))` near the top of `Sidebar` and route every consumer through it. Do NOT mutate `props.groups` itself — synthetic groups must remain in the source so the loose render path can find them.

**Step 1: Identify call sites in `sidebar/index.tsx`**

Read the file and list every place that uses `props.groups`:
- Line 65 (the existence guard in the orphan-detail effect)
- Line 93–94 (`groupedItems` memo passing `props.groups` into `groupComments`)
- Line 158–160 (`getDistinctAssignees(props.groups)`, `getDistinctReporters`, `getDistinctLabels` for filter chips)
- Line 169 (`props.groups.length > 0` empty-state guard)
- Line 59 (`activeGroup` lookup — fine to keep on full list since detail view targets a specific id)

**Step 2: Add the derivation**

Near the top of `Sidebar`, after the imports section (around line 50–53), add:

```ts
import { isSynthetic } from "../../features/selection-groups/business/synthetic-group.js";
// ...

const userFacingGroups = createMemo(() =>
  props.groups.filter((g) => !isSynthetic(g)),
);
```

**Step 3: Replace the call sites**

- Line 65 orphan guard: **leave alone** — uses full `props.groups` because detail view can target any id (defensive).
- Line 93–94 `groupedItems`: change to `groupComments(userFacingGroups(), props.commentItems)`.
- Line 158–160 filter distincts: change to `getDistinctAssignees(userFacingGroups())` etc.
- Line 169 empty-state guard: change to `userFacingGroups().length > 0`.
- Line 59 `activeGroup`: **leave alone** (defensive, see above).

**Step 4: Filter `GroupPickerFlyout` callers**

`grep -rn "GroupPickerFlyout" packages/react-grab/src` returns sites in:
- `components/comments-dropdown.tsx` (move-item picker)
- `features/selection-groups/components/active-group-picker.tsx` (Content subcomponent)
- `components/selection-label/index.tsx` (via ActiveGroupPicker)

Check each and ensure the `groups={...}` it passes is filtered. The `ActiveGroupPicker.Content` already takes `groups` from context — its source is `props.groups` from the selection-label, which traces up to core's `selectionGroups.groups()`. To keep the synthetic flag out of pickers without filtering at every leaf, the **right place** to filter is at the source: in `core/index.tsx` where `groups` is forwarded into the renderer, derive a `userFacingGroups` accessor and pass that to the renderer instead of the raw signal.

**4a:** In `core/index.tsx` near where `selectionGroups.groups()` flows into the renderer (search for `groups={selectionGroups.groups()}` or similar), wrap with a memo:

```ts
import { isSynthetic } from "./features/selection-groups/business/synthetic-group.js";

const userFacingGroups = createMemo(() =>
  selectionGroups.groups().filter((g) => !isSynthetic(g)),
);
```

And pass `userFacingGroups()` (or the accessor) to the renderer's `groups` prop instead of `selectionGroups.groups()`.

**4b:** Confirm `comments-dropdown.tsx`'s `props.groups` and `selection-label/index.tsx`'s `props.groups` now receive the filtered list (because they're descendants of the renderer that just got rewired).

**4c:** The Sidebar gets `props.groups: SelectionGroupWithJira[]` from a different code path (the sidebar consumes a *polled* version with Jira metadata merged in). Find that path — search for `groups={` going into `<Sidebar`. The polling layer should also filter, OR the Sidebar's local `userFacingGroups` derivation from Step 2 covers it. Step 2's derivation is sufficient as long as Sidebar does its own filtering — it does, so no extra work here.

**Step 5: Delta check**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11
pnpm --filter react-grab exec vitest run 2>&1 | tail -5       # → 13/13 (8 from Task 3)
```

If typecheck has new errors, walk them — most likely a missing import of `isSynthetic` or a misplaced parenthesis on the new memo.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(selection-groups): filter synthetic groups out of user-facing lists

Synthetic groups are persisted alongside real ones but are invisible
everywhere a user might see them: GroupList, picker flyouts, stats bar,
filter distincts. Single derivation 'userFacingGroups' added at two
boundaries (Sidebar, core/index.tsx) so every downstream consumer
inherits the filter.

The full props.groups list is preserved at the source so the loose
render path can still look up synthetic groups by id."
```

---

## Task 5: Build `LooseSelectionCard` component

Non-clickable wrapper around `SelectionCard` that adds:
- A status pill in the top-right (same colors / placement as `GroupCard`)
- A meta row with timestamp + ticket id (when ticketed) or "Create ticket" button (when not)
- Same screenshot rendering as the existing `SelectionCard` (which it wraps directly)

**Files:**
- Create: `packages/react-grab/src/components/sidebar/loose-selection-card.tsx`

**Step 1: Implement**

```tsx
// packages/react-grab/src/components/sidebar/loose-selection-card.tsx
import { type Component, Show } from "solid-js";
import type { CommentItem } from "../../types.js";
import { SelectionCard } from "./selection-card.jsx";
import { Button } from "../ui/button.jsx";
import { cn } from "../../utils/cn.js";

interface LooseSelectionCardProps {
  item: CommentItem;
  /** Optional Jira status (from a synthetic group's polled data). */
  jiraStatus?: string;
  /** Status label rendered in the right pill — 'No Task' when no ticket. */
  statusLabel: string;
  /** Status color class — matches the GroupCard pill colors. */
  statusColorClass: string;
  /** Ticket id when ticketed. */
  jiraTicketId?: string;
  /** Click handler for the "Create ticket" button — fires only when no ticket. */
  onCreateTicket: (item: CommentItem) => void;
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
}

/**
 * Loose-selection card variant. Renders the same SelectionCard markup
 * (component name, screenshots, file path, raw HTML) inside a
 * non-clickable wrapper, with a status pill aligned to match GroupCard
 * and a Create-ticket affordance when no ticket exists yet.
 *
 * SRP: this component owns the *visual contract* of a loose card. It
 * does NOT know about synthetic groups, the dialog, or the orchestrator
 * — those live one level up in `loose-selection-list.tsx` /
 * `core/index.tsx`. The Create-ticket button just calls `onCreateTicket`.
 */
export const LooseSelectionCard: Component<LooseSelectionCardProps> = (props) => {
  const hasTicket = () => Boolean(props.jiraTicketId);

  return (
    <div
      data-react-grab-loose-selection-card
      class="pl-4"
      style={{ "pointer-events": "auto" }}
    >
      <div class="bg-muted rounded-lg border border-border p-3 mb-1.5 cursor-default">
        {/* Row 1: header — comp name from inner card, status pill on right */}
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-[13px] font-semibold text-foreground truncate">
              {props.item.componentName || props.item.elementName}
            </span>
            <span class="px-1.5 py-0.5 rounded bg-accent text-muted-foreground text-[10px] font-mono shrink-0">
              {props.item.tagName}
            </span>
          </div>
          <span
            class={cn(
              "text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0",
              props.statusColorClass,
            )}
          >
            {props.statusLabel}
          </span>
        </div>

        {/* Row 2: meta — timestamp + ticket id (or Create-ticket button) */}
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[10px] text-muted-foreground">
            {/* Use the same relativeTime util the SelectionCard uses internally */}
            {new Date(props.item.timestamp).toLocaleString()}
          </span>
          <Show when={hasTicket()} fallback={
            <Button
              variant="outline"
              class="ml-auto h-6 px-2 text-[10px] border-dashed"
              onClick={() => props.onCreateTicket(props.item)}
            >
              + Create ticket
            </Button>
          }>
            <span class="text-neutral-700">·</span>
            <a class="text-[10px] font-medium text-blue-400">{props.jiraTicketId}</a>
          </Show>
        </div>

        {/* Inner SelectionCard — reuses its screenshot, file-path, raw-HTML rendering. */}
        {/* We render only the body (skip its own header) by passing the same item; */}
        {/* the duplication is acceptable because we control the wrapper above. */}
        {/* If duplicating row 1 looks bad in practice, we extract a body-only sub-component in a follow-up. */}
        <div class="mt-2">
          <SelectionCard
            item={props.item}
            syncServerUrl={props.syncServerUrl}
            syncWorkspace={props.syncWorkspace}
            scrollRoot={props.scrollRoot}
          />
        </div>
      </div>
    </div>
  );
};
```

**Note on the duplication:** `SelectionCard` renders its own row 1 (component + tag + timestamp). `LooseSelectionCard` also renders a row 1 because we need the status pill aligned. This is acceptable for the first cut — if it looks bad in the smoke test, the follow-up is to extract a `selection-card-body.tsx` (everything below row 1) and have both cards compose it. That refactor lives in a separate commit, not this plan.

**Step 2: Verify it compiles**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20 (unchanged)
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/loose-selection-card.tsx
git commit -m "feat(sidebar): add LooseSelectionCard component

Non-clickable wrapper around SelectionCard with a status pill aligned
on the right and a Create-ticket button (or ticket id when ticketed)
in the meta row. Knows nothing about synthetic groups or dialogs —
calls onCreateTicket(item) and lets its parent handle the rest.

Reuses SelectionCard's screenshot/file-path/raw-HTML body verbatim.
Header row 1 is currently duplicated; extracting a body-only inner
component is a follow-up if the duplication shows in smoke testing."
```

---

## Task 6: Build `LooseSelectionList` component

Derives the loose items via `isPresentedAsLoose` and renders one `LooseSelectionCard` per item.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/loose-selection-list.tsx`

**Step 1: Implement**

```tsx
// packages/react-grab/src/components/sidebar/loose-selection-list.tsx
import { type Component, For, Show, createMemo } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import { isPresentedAsLoose } from "../../features/selection-groups/business/membership.js";
import { LooseSelectionCard } from "./loose-selection-card.jsx";
import { getStatusLabel, getStatusColor } from "../../features/sidebar/status-colors.js";

interface LooseSelectionListProps {
  /** Full unfiltered groups list — needed for synthetic-group lookup. */
  allGroups: SelectionGroupWithJira[];
  /** Full unfiltered comment items list. */
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
  onCreateTicket: (item: CommentItem) => void;
}

/**
 * Renders loose selections (genuinely ungrouped + synthetic-1-item) above
 * the GroupList. SRP: derives the loose list and forwards each item to
 * LooseSelectionCard along with the right Jira status data (looked up
 * from the backing synthetic group, when present).
 */
export const LooseSelectionList: Component<LooseSelectionListProps> = (props) => {
  const looseItems = createMemo(() =>
    props.commentItems.filter((item) =>
      isPresentedAsLoose(item, props.allGroups, props.commentItems),
    ),
  );

  // For a loose item that lives in a synthetic group, find that group so we
  // can read its Jira fields (jiraTicketId, jiraStatus, etc.) for the pill.
  const backingGroupFor = (item: CommentItem) =>
    item.groupId === null
      ? undefined
      : props.allGroups.find((g) => g.id === item.groupId);

  return (
    <Show when={looseItems().length > 0}>
      <div data-react-grab-loose-selection-list class="px-2 pt-2">
        <For each={looseItems()}>
          {(item) => {
            const group = backingGroupFor(item);
            const statusLabel = group ? getStatusLabel(group) : "No Task";
            const statusColorClass = getStatusColor(group?.jiraStatus);
            return (
              <LooseSelectionCard
                item={item}
                jiraStatus={group?.jiraStatus}
                statusLabel={statusLabel}
                statusColorClass={statusColorClass}
                jiraTicketId={group?.jiraTicketId}
                onCreateTicket={props.onCreateTicket}
                syncServerUrl={props.syncServerUrl}
                syncWorkspace={props.syncWorkspace}
                scrollRoot={props.scrollRoot}
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
};
```

**Step 2: Verify**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/loose-selection-list.tsx
git commit -m "feat(sidebar): add LooseSelectionList component

Derives loose items via isPresentedAsLoose and renders one
LooseSelectionCard per item, looking up the backing synthetic group
(when present) to feed Jira status data to the card. Knows nothing
about how the parent opens the create-ticket dialog."
```

---

## Task 7: Mount `LooseSelectionList` in `Sidebar`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Add the orchestrator hook prop**

Add to `SidebarProps`:

```ts
onCreateTicketForLooseItem?: (item: CommentItem) => void;
```

**Step 2: Mount the component**

In the JSX, **above** `<GroupList ... />` (around line 185), add:

```tsx
<LooseSelectionList
  allGroups={props.groups}
  commentItems={props.commentItems}
  syncServerUrl={props.syncServerUrl}
  syncWorkspace={props.syncWorkspace}
  scrollRoot={() => containerRef ?? null}
  onCreateTicket={(item) => props.onCreateTicketForLooseItem?.(item)}
/>
```

Note: `allGroups={props.groups}` is the **full** list (synthetic groups included) because the loose list needs to find synthetic groups by id. `<GroupList groupedItems={filteredGroups()} />` keeps using the user-facing filtered list.

**Step 3: Import**

```ts
import { LooseSelectionList } from "./loose-selection-list.jsx";
```

**Step 4: Verify**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11
pnpm --filter react-grab exec vitest run 2>&1 | tail -5       # → still 13/13
```

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat(sidebar): mount LooseSelectionList above GroupList

Loose selections now appear in the sidebar. The Create-ticket button
fires onCreateTicketForLooseItem(item), which the parent (core) wires
to the synthetic-group orchestrator in Task 9."
```

---

## Task 8: Lift the `JiraCreateDialog` open state up to `Sidebar` (atomic)

The dialog is currently opened only from `GroupDetailView` (a child of `Sidebar` shown in detail mode). Loose cards live in the *list* mode of `Sidebar`, so we need a second dialog instance — or we lift the dialog state to `Sidebar` itself and open it from either place.

**Cleaner option:** keep `GroupDetailView`'s dialog as-is (it's coupled to its detail flow) and add a **second** dialog at the `Sidebar` level for loose-item ticketing. Two dialogs in the tree, one mounted at a time, each driven by its own signal. Simpler than lifting state across two unrelated flows.

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Add dialog signal + handler**

Inside `Sidebar`, after the existing signals (around line 56):

```ts
const [looseTicketDialogState, setLooseTicketDialogState] = createSignal<{
  item: CommentItem;
  syntheticGroup: SelectionGroupWithJira;
} | null>(null);
```

The orchestrator (Task 9) will populate `syntheticGroup` after it creates one.

**Step 2: Mount the second dialog**

At the bottom of the `Sidebar` JSX, **outside** the list/detail Show (so it's available in both modes), add:

```tsx
<Show when={looseTicketDialogState()}>
  {(state) => (
    <JiraCreateDialog
      open={true}
      workspaceId={props.syncWorkspace ?? ""}
      groupId={state().syntheticGroup.id}
      group={state().syntheticGroup}
      commentItems={[state().item]}
      jiraProjectKey={props.jiraProjectKey ?? ""}
      onTicketCreated={(groupId, ticketId, ticketUrl) => {
        props.onTicketCreated?.(groupId, ticketId, ticketUrl);
        setLooseTicketDialogState(null);
      }}
      onClose={() => setLooseTicketDialogState(null)}
    />
  )}
</Show>
```

**Step 3: Add the parent prop** to receive the orchestrator's "ready" signal

Replace the simple `onCreateTicketForLooseItem?: (item: CommentItem) => void;` from Task 7 with a richer one that the parent can use to push state:

```ts
/** Called when the user clicks "Create ticket" on a loose card.
 *  Parent must (a) create a synthetic group, (b) move the item into it,
 *  (c) call back via onLooseTicketDialogReady with the synthetic group. */
onCreateTicketForLooseItem?: (item: CommentItem) => void;

/** Imperative handle the parent uses to open the dialog after the
 *  synthetic group is created. */
ref?: (api: { openLooseTicketDialog: (state: { item: CommentItem; syntheticGroup: SelectionGroupWithJira }) => void }) => void;
```

Hmm — the `ref` callback API is awkward. Cleaner: have the parent (core) drive the dialog state via a prop, not an imperative ref.

**Revised step 3:** add a controlled prop instead:

```ts
/** When set, the dialog is open with this state. Parent controls open/close
 *  by setting/clearing this prop. */
looseTicketDialog?: { item: CommentItem; syntheticGroup: SelectionGroupWithJira } | null;
onLooseTicketDialogClose?: () => void;
```

And in `Sidebar`, replace `looseTicketDialogState` (the local signal) with `props.looseTicketDialog`:

```tsx
<Show when={props.looseTicketDialog}>
  {(state) => (
    <JiraCreateDialog
      open={true}
      workspaceId={props.syncWorkspace ?? ""}
      groupId={state().syntheticGroup.id}
      group={state().syntheticGroup}
      commentItems={[state().item]}
      jiraProjectKey={props.jiraProjectKey ?? ""}
      onTicketCreated={(groupId, ticketId, ticketUrl) => {
        props.onTicketCreated?.(groupId, ticketId, ticketUrl);
        props.onLooseTicketDialogClose?.();
      }}
      onClose={() => props.onLooseTicketDialogClose?.()}
    />
  )}
</Show>
```

This makes `Sidebar` purely declarative — the parent owns the state.

**Step 4: Verify**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
```

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat(sidebar): mount loose-ticket JiraCreateDialog driven by parent

A second JiraCreateDialog instance lives at the Sidebar level (in
addition to the one inside GroupDetailView) so loose cards can open
the existing Jira create flow. The dialog is fully controlled — its
open state is a prop the parent (core) sets after creating the
synthetic group in Task 9."
```

---

## Task 9: Wire the orchestrator in `core/index.tsx`

The orchestrator is the bridge: clicking the loose-card button → create synthetic group → persist it → set the sidebar's dialog prop.

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Find the Sidebar mount**

Search for `<Sidebar` in `core/index.tsx`. It's in the same render tree as the renderer mount — find the props it receives.

**Step 2: Add the orchestrator state and handler**

Near the existing `selectionGroups` signals, add:

```ts
import { createSyntheticGroupForItem } from "./features/selection-groups/business/synthetic-group.js";
import { assignSelection } from "./features/selection-groups/business/selection-assignment.js";
// ...

const [looseTicketDialog, setLooseTicketDialog] = createSignal<
  { item: CommentItem; syntheticGroup: SelectionGroup } | null
>(null);

const handleCreateTicketForLooseItem = (item: CommentItem) => {
  // 1. Create the synthetic group (pure).
  const syntheticGroup = createSyntheticGroupForItem(item);

  // 2. Persist the new group.
  selectionGroups.persistGroups([
    ...selectionGroups.groups(),
    syntheticGroup,
  ]);

  // 3. Move the item into it via the existing writer.
  const updatedItems = assignSelection(
    commentItems(),
    item.id,
    syntheticGroup.id,
  );
  persistCommentItems(updatedItems);
  setCommentItems(updatedItems);

  // 4. Open the dialog with the freshly-created group.
  // Note: at this moment the polling-merged SelectionGroupWithJira shape isn't
  // available yet (no Jira data yet), so we cast — the dialog only reads
  // group.name (for default summary) and group.id (for the API call), both of
  // which exist on the bare SelectionGroup.
  setLooseTicketDialog({
    item,
    syntheticGroup: syntheticGroup as unknown as SelectionGroupWithJira,
  });
};
```

**Step 3: Wire `Sidebar` props**

In the `<Sidebar` element, add:

```tsx
onCreateTicketForLooseItem={handleCreateTicketForLooseItem}
looseTicketDialog={looseTicketDialog()}
onLooseTicketDialogClose={() => setLooseTicketDialog(null)}
```

The existing `onTicketCreated` callback already updates the group's `jiraTicketId` — it works for synthetic groups too.

**Step 4: Verify**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11
pnpm --filter react-grab exec vitest run 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): orchestrate Create-ticket for loose selections

handleCreateTicketForLooseItem creates a synthetic group, persists it,
moves the loose item into it via assignSelection, then opens the
JiraCreateDialog (mounted in Sidebar) against the new group. The
existing onTicketCreated callback handles the Jira-id persistence
without modification — synthetic groups are just SelectionGroups
with a flag, and the existing Jira pipeline doesn't care."
```

---

## Task 10: Garbage-collect empty synthetic groups (TDD)

When the user removes the loose item (via "Move to group" or via delete), the synthetic group becomes empty and should be deleted to avoid leaking persistent state.

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/index.ts` (orchestrator)
- Modify: `packages/react-grab/src/features/selection-groups/index.test.ts` (add coverage)

**Step 1: Write the failing test**

Append to `index.test.ts`:

```ts
import { isSynthetic } from "./business/synthetic-group.js";

describe("createSelectionGroups synthetic-group GC", () => {
  it("deletes a synthetic group when its sole item is moved out", () => {
    createRoot((dispose) => {
      const synth = { id: "synth-1", name: "X", createdAt: 0, revealed: false, synthetic: true };
      const real = { id: "real-1", name: "Real", createdAt: 0, revealed: false };
      const initialItems = [
        { id: "a", groupId: "synth-1" },
      ] as unknown as CommentItem[];
      const [items, setItems] = createSignal<CommentItem[]>(initialItems);
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });
      api.setGroups([synth, real]);

      // Move the loose item out of the synthetic group.
      api.handleMoveItem("a", "real-1");

      // Synthetic group should be gone.
      expect(api.groups().find((g) => g.id === "synth-1")).toBeUndefined();
      // Real group untouched.
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });

  it("does NOT delete a real group when emptied", () => {
    createRoot((dispose) => {
      const real = { id: "real-1", name: "Real", createdAt: 0, revealed: false };
      const [items, setItems] = createSignal<CommentItem[]>(
        [{ id: "a", groupId: "real-1" }] as unknown as CommentItem[],
      );
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });
      api.setGroups([real]);
      api.handleMoveItem("a", null);
      // Real group still there even though empty.
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });
});
```

**Step 2: Run — expect FAIL** (no GC logic yet).

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/index.test.ts
```

**Step 3: Implement the GC**

In `packages/react-grab/src/features/selection-groups/index.ts`, modify `handleMoveItem` to garbage-collect synthetic groups left empty by the move:

```ts
import { isSynthetic } from "./business/synthetic-group.js";

const handleMoveItem = (itemId: string, groupId: string | null) => {
  const before = deps.commentItems();
  const movedFromGroupId = before.find((i) => i.id === itemId)?.groupId ?? null;

  const updated = assignSelection(before, itemId, groupId);
  deps.persistCommentItems(updated);
  deps.setCommentItems(updated);

  // GC: if we just moved the last item out of a synthetic group, delete it.
  if (movedFromGroupId !== null && movedFromGroupId !== groupId) {
    const sourceGroup = groups().find((g) => g.id === movedFromGroupId);
    const stillHasItems = updated.some((i) => i.groupId === movedFromGroupId);
    if (sourceGroup && isSynthetic(sourceGroup) && !stillHasItems) {
      const remaining = removeGroupFromStorage(movedFromGroupId);
      if (activeGroupId() === movedFromGroupId) setActiveGroupId(null);
      setGroups(remaining);
    }
  }
};
```

**Step 4: Run — expect PASS.**

```bash
pnpm --filter react-grab exec vitest run src/features/selection-groups/index.test.ts
```

Expected: 4 tests pass (2 existing + 2 new).

**Step 5: Delta check + commit**

```bash
pnpm --filter react-grab typecheck 2>&1 | grep -c "error TS"  # → 20
pnpm --filter react-grab lint 2>&1 | grep -E "Found.*errors"  # → 11

git add packages/react-grab/src/features/selection-groups/index.ts \
        packages/react-grab/src/features/selection-groups/index.test.ts
git commit -m "feat(selection-groups): garbage-collect empty synthetic groups

When handleMoveItem removes the last item from a synthetic group, the
synthetic group is deleted to avoid leaking orphaned state. Real groups
are unaffected and remain even when empty."
```

---

## Task 11: Full verification

**Step 1: Typecheck / lint / vitest delta-clean**

```bash
pnpm --filter react-grab typecheck > /tmp/now-typecheck.txt 2>&1
pnpm --filter react-grab lint > /tmp/now-lint.txt 2>&1
pnpm --filter react-grab exec vitest run

diff <(grep "error TS" /tmp/baseline-typecheck.txt | sort) \
     <(grep "error TS" /tmp/now-typecheck.txt | sort)
# Expected: empty (delta-clean)

diff <(grep -oE '\[src/[^]]+\]' /tmp/baseline-lint.txt | sed -E 's/:[0-9]+:[0-9]+\]/]/' | sort -u) \
     <(grep -oE '\[src/[^]]+\]' /tmp/now-lint.txt | sed -E 's/:[0-9]+:[0-9]+\]/]/' | sort -u)
# Expected: empty
```

Vitest expected count: **17 tests passing in 7 files** (12 from previous branch + 5 new: 7 from synthetic-group, 5 from membership extension, 2 from index.test.ts extension — wait, that's 14 new. Recount: synthetic-group adds 7, membership adds 5, index.test adds 2 → 14 new → 26 total.) Actually let me recount in execution: each task adds tests, so the total at the end should be every test file adds up to whatever vitest reports. Don't pre-commit to a number — just verify it's `> 12` and the new test files are listed.

**Step 2: Manual smoke script** (your turn — Claude can't run the dev harness):

- [ ] Fresh load with no selections → no loose section, no groups, no synthetic groups.
- [ ] Make 1 selection → it appears as a loose card in the sidebar with a `No Task` pill and a `+ Create ticket` button.
- [ ] Click `+ Create ticket` → JiraCreateDialog opens with the inferred name as the default summary.
- [ ] Submit the dialog → ticket is created, dialog closes, the same loose card now shows the ticket id and the polled status pill (after the next polling cycle).
- [ ] Check `localStorage` (`react-grab-selection-groups`) → there's a synthetic group with `synthetic: true` and the ticket id, but it does NOT appear in the sidebar's group list, picker, or stats.
- [ ] Make a second selection → another loose card appears.
- [ ] Use "Move to group" picker on the second card → only real groups (and any non-synthetic existing groups) appear in the picker; the synthetic group from step 4 is hidden.
- [ ] Move the first (ticketed) card into a real group via the picker → the loose card disappears from the loose list, the synthetic group is garbage-collected (gone from `localStorage`), the ticketed item appears inside the real group's card.
- [ ] Reload → state persists; ticketed loose cards still ticketed, synthetic groups still hidden from user-facing surfaces.
- [ ] `git bisect` sanity: every commit on `feat/loose-selection-ticketing` should still typecheck/lint/test delta-clean. Spot-check 2-3 commits.

---

## Recap of artifacts

After Task 11, the branch contains 11 new commits beyond `feat/optional-group-membership`:

1. `feat(selection-groups): add synthetic flag to SelectionGroup`
2. `feat(selection-groups): synthetic-group writer + isSynthetic predicate`
3. `feat(selection-groups): add isPresentedAsLoose predicate`
4. `feat(selection-groups): filter synthetic groups out of user-facing lists`
5. `feat(sidebar): add LooseSelectionCard component`
6. `feat(sidebar): add LooseSelectionList component`
7. `feat(sidebar): mount LooseSelectionList above GroupList`
8. `feat(sidebar): mount loose-ticket JiraCreateDialog driven by parent`
9. `feat(core): orchestrate Create-ticket for loose selections`
10. `feat(selection-groups): garbage-collect empty synthetic groups`
11. *(Task 11 has no commit — verification only)*

Each commit is delta-clean against the baseline; each is independently green for typecheck, lint, and vitest.

---

## SRP boundaries summary (the "screaming architecture" answer)

- `features/selection-groups/business/synthetic-group.ts` — **owns:** synthetic group creation + identification. **Knows nothing about:** UI, dialogs, persistence, ticketing flow.
- `features/selection-groups/business/membership.ts` — **owns:** the rendering predicate `isPresentedAsLoose`. The single source of truth that the synthetic-group fiction is hidden behind. **Knows nothing about:** UI, ticketing.
- `features/selection-groups/index.ts` (orchestrator) — **owns:** the GC of empty synthetic groups inside `handleMoveItem`. **Knows nothing about:** UI, dialogs.
- `components/sidebar/loose-selection-card.tsx` — **owns:** the visual contract of a single loose card (status pill + meta row + Create-ticket button + body). **Knows nothing about:** synthetic groups, dialogs.
- `components/sidebar/loose-selection-list.tsx` — **owns:** deriving loose items via the predicate and looking up their backing synthetic group's Jira data. **Knows nothing about:** dialogs.
- `components/sidebar/index.tsx` — **owns:** mounting the second `JiraCreateDialog` instance, declaratively driven by the parent's `looseTicketDialog` prop. **Knows nothing about:** synthetic group creation.
- `core/index.tsx` `handleCreateTicketForLooseItem` — **owns:** the orchestration of "create synthetic group → move item → open dialog → persist." This is the only place where all four primitives meet.

Each module has one job. The synthetic-group concept lives in exactly one writer + one predicate. The dialog flow is unchanged. The sidebar UI is parallel to `GroupCard`, never touching the pre-existing `GroupedEntry`/`SelectionGroupWithJira` blocker.
