# Group Assignment — Design Doc

**Date:** 2026-03-31
**PoC:** `docs/plans/selection-groups/poc.html`

## Goal

Two UX gaps to close after the selection-groups-v2 implementation:

1. **Group picker in selection label** — when grabbing an element, the user can pick which group the new selection goes into before submitting.
2. **Move-to-group in comments dropdown** — the user can reassign an existing selection to a different group from within the dropdown.

Currently `activeGroupId` defaults to `"default"` permanently — no UI exposes it.

---

## Architecture

### Shared view props (SSOT)

A single interface in `selection-groups/types.ts` becomes the source of truth for all group-related props passed through the renderer chain. Component prop types use `Pick<>` to take only what they need.

```ts
// src/features/selection-groups/types.ts
export interface SelectionGroupsViewProps {
  groups?: SelectionGroup[];
  activeGroupId?: string;
  onActiveGroupChange?: (groupId: string) => void;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
  onMoveItem?: (itemId: string, groupId: string) => void;
}
```

`ReactGrabRendererProps` intersects the full interface. `CommentsDropdownProps` and `SelectionLabelProps` each `Pick<>` their relevant subset.

### `handleMoveItem` in `SelectionGroupsAPI`

Moving an item between groups mutates `CommentItem.groupId`. This belongs in the `selection-groups` feature module since `SelectionGroupsDeps` already injects `commentItems`, `setCommentItems`, and `persistCommentItems`.

```ts
// added to SelectionGroupsAPI
handleMoveItem: (itemId: string, groupId: string) => void;

// implementation in createSelectionGroups
const handleMoveItem = (itemId: string, groupId: string) => {
  const updated = deps.commentItems().map(i =>
    i.id === itemId ? { ...i, groupId } : i
  );
  deps.persistCommentItems(updated);
  deps.setCommentItems(updated);
};
```

---

## New Component: `GroupPickerFlyout`

**Path:** `src/features/selection-groups/components/group-picker-flyout.tsx`

Reusable flyout used by both touchpoints.

```ts
interface GroupPickerFlyoutProps {
  groups: SelectionGroup[];
  activeGroupId?: string;   // shows checkmark — used in label picker
  excludeGroupId?: string;  // filters out current group — used in move flyout
  onSelect: (groupId: string) => void;
  onClose: () => void;
}
```

- Header reads `"Move to group"` when `excludeGroupId` is set, `"Add to group"` otherwise
- Checkmark shown on `activeGroupId` row when provided
- `"New group..."` row omitted in move context (no `onAddGroup` prop needed there)
- Click-outside via `registerOverlayDismiss` (existing util, same as `context-menu.tsx`)

---

## Feature 1: Selection Label Group Row

**File:** `src/components/selection-label/index.tsx`

New props via `Pick<SelectionGroupsViewProps, 'groups' | 'activeGroupId' | 'onActiveGroupChange'>` added to `SelectionLabelProps`.

In the `isPromptMode` block, a group row is inserted between the TagBadge row and `<BottomSection>`:

- Always visible (even with only Default group)
- Shows folder icon + active group name + chevron
- Local `createSignal<boolean>` for `pickerOpen`
- Click opens `GroupPickerFlyout` anchored below the button
- Selecting a group calls `onActiveGroupChange(id)` and closes the picker

---

## Feature 2: Move-to-Group in Comments Dropdown

**File:** `src/components/comments-dropdown.tsx`

New prop: `Pick<SelectionGroupsViewProps, 'onMoveItem'>` added to `CommentsDropdownProps`.

Inside the `renderItem` callback passed to `GroupCollapsible`:

- Two local signals: `hoveredItemId` and `openMoveId`
- On item hover, a move icon button appears (opacity transition)
- Clicking opens `GroupPickerFlyout` with `excludeGroupId={item.groupId}`
- Selecting calls `onMoveItem(item.id, groupId)` and closes the flyout

---

## Core Wiring

**File:** `src/core/index.tsx`

The renderer call gains:
```tsx
activeGroupId={selectionGroups.activeGroupId()}
onActiveGroupChange={selectionGroups.setActiveGroupId}
onMoveItem={selectionGroups.handleMoveItem}
```

**File:** `src/components/renderer.tsx`

Passes the right subset down to each component:
- `SelectionLabel` ← `groups`, `activeGroupId`, `onActiveGroupChange`
- `CommentsDropdown` ← `onMoveItem` (already receives `groups` and other group props)

---

## Data Flow

```
core/index.tsx
  selectionGroups.activeGroupId()   → renderer → SelectionLabel (group row)
  selectionGroups.setActiveGroupId  → renderer → SelectionLabel (onActiveGroupChange)
  selectionGroups.handleMoveItem    → renderer → CommentsDropdown (onMoveItem)
  selectionGroups.groups()          → renderer → SelectionLabel + CommentsDropdown

SelectionLabel: user picks group → onActiveGroupChange → setActiveGroupId signal
addCommentItem: uses activeGroupId() at submit time ✓ (already wired)

CommentsDropdown: user moves item → onMoveItem → handleMoveItem → updates CommentItem.groupId
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/selection-groups/types.ts` | Add `SelectionGroupsViewProps`, add `handleMoveItem` to `SelectionGroupsAPI` |
| `src/features/selection-groups/index.ts` | Implement `handleMoveItem` |
| `src/features/selection-groups/components/group-picker-flyout.tsx` | New component |
| `src/types.ts` | `ReactGrabRendererProps` intersects `SelectionGroupsViewProps`; `SelectionLabelProps` picks its subset; replace duplicate fields in `CommentsDropdownProps` with `Pick<>` |
| `src/components/selection-label/index.tsx` | Add group row in `isPromptMode` block |
| `src/components/comments-dropdown.tsx` | Add move button + flyout per item |
| `src/components/renderer.tsx` | Thread new props to `SelectionLabel` and `CommentsDropdown` |
| `src/core/index.tsx` | Pass `activeGroupId`, `setActiveGroupId`, `handleMoveItem` to renderer |
