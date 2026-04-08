---
date: '2026-04-08'
references:
- PRD-006
- ADR-0008
- ADR-0002
- ADR-0003
- SPEC-003
status: implemented
---

# SPEC-011 Loose-Selection Ticketing

## Overview

Implement PRD-006: allow a single ungrouped selection to earn a JIRA ticket without creating a named group first. The sidebar gains a `LooseSelectionList` section above `GroupList` that renders each ungrouped item as a `LooseSelectionCard`. Clicking "+ Create ticket" auto-creates a hidden 1-item synthetic group (`synthetic: true`), moves the item into it, and opens the existing `JiraCreateDialog` against that group. Synthetic groups are invisible on all user-facing surfaces. When the user moves the item out, the synthetic group is garbage-collected.

Architecture follows ADR-0008 (Strategy 2: client-only synthetic groups). The server contract is unchanged. The new `isPresentedAsLoose` predicate in `membership.ts` is the single source of truth for the rendering rule.

Branch: `feat/loose-selection-ticketing`, cut from `feat/optional-group-membership`.

## Technical Design

### Module boundaries (SRP)

```
synthetic-group.ts          ← creates + identifies synthetic groups (pure, no IO)
membership.ts               ← isPresentedAsLoose predicate (single rendering rule)
selection-groups/index.ts   ← GC: handleMoveItem deletes empty synthetic groups
loose-selection-card.tsx    ← visual contract of one loose card (no dialog knowledge)
loose-selection-list.tsx    ← derives loose items, looks up synthetic group Jira data
sidebar/index.tsx           ← mounts LooseSelectionList; hosts second JiraCreateDialog
renderer.tsx                ← userFacingGroups memo for picker surfaces
core/index.tsx              ← handleCreateTicketForLooseItem orchestrator
```

### `SelectionGroup.synthetic` flag

```ts
// features/selection-groups/types.ts
export interface SelectionGroup extends ServerSelectionGroup {
  jiraResolved?: boolean;
  /** Auto-created 1-item container for loose-selection ticketing. Permanent.
   *  Filtered from every user-facing surface. */
  synthetic?: boolean;
}
```

### `synthetic-group.ts`

```ts
// features/selection-groups/business/synthetic-group.ts
export const inferSyntheticGroupName = (item: CommentItem): string =>
  item.componentName || item.elementName || "Untitled";

export const createSyntheticGroupForItem = (item: CommentItem): SelectionGroup => ({
  id: generateId("group"),
  name: inferSyntheticGroupName(item),
  createdAt: Date.now(),
  revealed: false,
  synthetic: true,
});

export const isSynthetic = (group: SelectionGroup): boolean =>
  group.synthetic === true;
```

### `isPresentedAsLoose` predicate

```ts
// features/selection-groups/business/membership.ts
export const isPresentedAsLoose = (
  item: CommentItem,
  groups: SelectionGroup[],
  allItems: CommentItem[],
): boolean => {
  if (item.groupId === null) return true;
  const group = groups.find((g) => g.id === item.groupId);
  if (!group || !isSynthetic(group)) return false;
  const count = allItems.reduce((n, i) => (i.groupId === group.id ? n + 1 : n), 0);
  return count === 1;
};
```

### Filter boundaries

`renderer.tsx` adds:
```ts
const userFacingGroups = createMemo(() =>
  (props.groups ?? []).filter((g) => !isSynthetic(g)),
);
// passed to: SelectionLabel (×2), CommentsDropdown
// NOT passed to: Sidebar (receives full props.groups for LooseSelectionList lookup)
```

`sidebar/index.tsx` adds:
```ts
const userFacingGroups = createMemo(() =>
  props.groups.filter((g) => !isSynthetic(g)),
);
// used for: groupedItems, applyFilters, getDistinct*, empty-state guard
// NOT used for: LooseSelectionList (receives props.groups — full list)
```

### `LooseSelectionList` + `LooseSelectionCard`

`LooseSelectionList` derives `looseItems` via `isPresentedAsLoose`, looks up each item's backing synthetic group (if any) for Jira status data, and renders one `LooseSelectionCard` per item. Mounted in `sidebar/index.tsx` above `GroupList` (inside the `Show when={userFacingGroups().length > 0}` block).

`LooseSelectionCard` renders: component name, tag name, status pill (inline-styled via `StatusColorConfig`), timestamp, and either a "+ Create ticket" button or a linked ticket ID. Wraps `SelectionCard` for the screenshot/file-path/raw-HTML body.

### Dialog lifting

`sidebar/index.tsx` hosts a second `JiraCreateDialog` instance (the first lives in `GroupDetailView`). It is fully controlled by two new `SidebarProps`:

```ts
looseTicketDialog?: { item: CommentItem; syntheticGroup: SelectionGroupWithJira } | null;
onLooseTicketDialogClose?: () => void;
```

When `looseTicketDialog` is non-null, the dialog opens. `onTicketCreated` is the existing callback (stores `jiraTicketId` + `jiraUrl` on the group via `persistGroups`). On success or cancel, the parent calls `onLooseTicketDialogClose` which sets the signal to `null`.

### Orchestrator (`core/index.tsx`)

```ts
const [looseTicketDialog, setLooseTicketDialog] = createSignal<{
  item: CommentItem;
  syntheticGroup: SelectionGroupWithJira;
} | null>(null);

const handleCreateTicketForLooseItem = (item: CommentItem) => {
  const syntheticGroup = createSyntheticGroupForItem(item);           // 1. create (pure)
  selectionGroups.persistGroups([...selectionGroups.groups(), syntheticGroup]); // 2. persist
  const updated = assignSelection(commentItems(), item.id, syntheticGroup.id);  // 3. move
  persistCommentItems(updated);
  setCommentItems(updated);
  setLooseTicketDialog({ item, syntheticGroup: syntheticGroup as unknown as SelectionGroupWithJira }); // 4. open dialog
};
```

### GC in `handleMoveItem`

```ts
// After the standard assignSelection call:
if (movedFromGroupId !== null && movedFromGroupId !== groupId) {
  const sourceGroup = groups().find((g) => g.id === movedFromGroupId);
  const stillHasItems = updated.some((i) => i.groupId === movedFromGroupId);
  if (sourceGroup && isSynthetic(sourceGroup) && !stillHasItems) {
    const remaining = groups().filter((g) => g.id !== movedFromGroupId);
    persistGroupsToStorage(remaining);
    if (activeGroupId() === movedFromGroupId) setActiveGroupId(null);
    setGroups(remaining);
  }
}
```

## Testing Strategy

### Unit tests (vitest)

All tests live in `packages/react-grab/src`. Baseline before this branch: 5 files, 12 tests.

**`business/synthetic-group.test.ts` (8 tests)**
- `inferSyntheticGroupName`: uses `componentName` when present; falls back to `elementName`; falls back to `'Untitled'` for empty string
- `createSyntheticGroupForItem`: returns `synthetic: true`, inferred name, truthy non-"default" id, numeric `createdAt`, `revealed: false`; returns fresh id on every call
- `isSynthetic`: true when `synthetic === true`; false when flag absent; false when `synthetic === false`

**`business/membership.test.ts` (+5 tests, 8 total)**
- `isPresentedAsLoose`: true when `groupId === null`; false when in real group; true when sole item in synthetic group; false when synthetic group has 2+ items; false when group is missing (orphaned)

**`selection-groups/index.test.ts` (+2 tests, 4 total)**
- GC: deletes synthetic group when its sole item is moved out; does NOT delete real group when emptied

**Final count: 6 files, 27 tests, all passing.**

### Manual smoke tests (browser)

- [ ] Fresh load with no selections → no loose section visible, no synthetic groups in localStorage
- [ ] Make 1 selection → loose card appears with "No Task" pill and "+ Create ticket" button
- [ ] Click "+ Create ticket" → `JiraCreateDialog` opens with inferred component name as summary
- [ ] Submit dialog → dialog closes; loose card shows ticket ID; after poll cycle, status pill updates
- [ ] Check localStorage `react-grab-selection-groups` → synthetic group present with `synthetic: true` and `jiraTicketId`; does NOT appear in group list, picker, stats, or filters
- [ ] Make a second selection → second loose card appears independently
- [ ] Open "Move to group" picker on second card → only real groups appear (synthetic group hidden)
- [ ] Move first (ticketed) loose card into a real group via picker → loose card disappears from loose section; synthetic group absent from localStorage; item appears in real group card
- [ ] Reload → ticketed loose cards persist; synthetic groups remain hidden on all surfaces
- [ ] Git bisect: spot-check 3 commits on branch — each typecheck/lint/test delta-clean

## Acceptance Criteria

- [x] `SelectionGroup.synthetic?: boolean` field exists, mirrors `jiraResolved?` extension pattern
- [x] `createSyntheticGroupForItem(item)` returns a `SelectionGroup` with `synthetic: true` and name inferred from `componentName || elementName || 'Untitled'`
- [x] `isSynthetic(group)` returns `true` iff `group.synthetic === true`
- [x] `inferSyntheticGroupName` falls back through `componentName → elementName → 'Untitled'` (treats empty string as falsy)
- [x] `isPresentedAsLoose(item, groups, allItems)` returns `true` for `groupId === null` items
- [x] `isPresentedAsLoose` returns `true` for items in a 1-item synthetic group
- [x] `isPresentedAsLoose` returns `false` for items in a real group
- [x] `isPresentedAsLoose` returns `false` for items in a synthetic group with 2+ items
- [x] `isPresentedAsLoose` returns `false` for orphaned items (group id not found)
- [x] `LooseSelectionCard` renders component name, tag name, timestamp, status pill, and "+ Create ticket" button when no ticket
- [x] `LooseSelectionCard` renders ticket ID (linked) instead of button when `jiraTicketId` is present
- [x] Status pill on `LooseSelectionCard` uses `getStatusColor` / `getStatusLabel` — same colors as `GroupCard`
- [x] `LooseSelectionList` renders above `GroupList` in the sidebar list view
- [x] `LooseSelectionList` renders nothing when there are no loose items
- [x] `LooseSelectionList` receives `allGroups={props.groups}` (full list, including synthetic)
- [x] `userFacingGroups` in `renderer.tsx` filters synthetic groups from `SelectionLabel` and `CommentsDropdown`
- [x] `userFacingGroups` in `sidebar/index.tsx` filters synthetic groups from `groupedItems`, filter distincts, and empty-state guard
- [x] `Sidebar` `props.groups` is NOT filtered — full list preserved for `LooseSelectionList` lookup
- [x] Second `JiraCreateDialog` in `Sidebar` is controlled by `looseTicketDialog` prop (fully declarative)
- [x] Dialog opens with `group.name` = inferred name as default summary
- [x] `onTicketCreated` stores `jiraTicketId` + `jiraUrl` on the synthetic group via existing `persistGroups` callback
- [x] `handleCreateTicketForLooseItem` in `core/index.tsx` creates group → persists → moves item → opens dialog in that order
- [x] `handleMoveItem` GC: deletes empty synthetic group from signal and storage when its last item is moved out
- [x] `handleMoveItem` GC: does NOT delete real groups when emptied
- [x] Synthetic group absent from `GroupPickerFlyout` in `ActiveGroupPicker` (via `SelectionLabel`)
- [x] Synthetic group absent from `GroupPickerFlyout` in `CommentsDropdown`
- [x] Synthetic group absent from `GroupList` entries
- [x] Synthetic group absent from stats bar counts
- [x] Synthetic group absent from filter chip distinct lists (assignees, reporters, labels)
- [x] Typecheck delta: 0 new errors vs `feat/optional-group-membership` baseline (20 pre-existing errors unchanged)
- [x] Lint delta: 0 new errors vs baseline (11 pre-existing errors unchanged)
- [x] Vitest: 27 tests passing in 6 files (up from 12 in 5)
