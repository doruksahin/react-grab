# Group Assignment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add group selection to the creation flow (group row in selection label) and allow moving existing selections between groups (move flyout in comments dropdown).

**Architecture:** `handleMoveItem` lives in `selection-groups` feature module (already has all deps). A shared `SelectionGroupsViewProps` interface is the SSOT for all group-related props — component interfaces `extend` or `Pick<>` from it. A new `GroupPickerFlyout` component is reused for both the label picker and the move flyout.

**Tech Stack:** SolidJS (signals, Show, For, onMount, onCleanup), Tailwind CSS, TypeScript

**Design doc:** `docs/plans/2026-03-31-group-assignment-design.md`
**PoC:** `docs/plans/selection-groups/poc.html`

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Groups API types | `src/features/selection-groups/types.ts:33-42` | `SelectionGroupsAPI` — add `handleMoveItem` here |
| Groups factory | `src/features/selection-groups/index.ts:39-62` | `handleDeleteGroup` pattern to copy for `handleMoveItem` |
| Renderer props | `src/types.ts:559-572` | Group fields on `ReactGrabRendererProps` — replace with `extends SelectionGroupsViewProps` |
| Label props | `src/types.ts:646-691` | `SelectionLabelProps` — add `Pick<SelectionGroupsViewProps, ...>` |
| Dropdown props | `src/components/comments-dropdown.tsx:42-52` | `CommentsDropdownProps` — add `onMoveItem`, use `Pick<>` for group fields |
| Selection label prompt mode | `src/components/selection-label/index.tsx:602-668` | `isPromptMode` block — insert group row between TagBadge and BottomSection |
| GroupCollapsible renderItem | `src/components/comments-dropdown.tsx:310-390` | `renderItem` callback — add hover move button |
| Renderer wiring | `src/components/renderer.tsx:126-157` | SelectionLabel props — add groups/activeGroupId/onActiveGroupChange |
| Renderer CommentsDropdown | `src/components/renderer.tsx:251-269` | CommentsDropdown props — add onMoveItem |
| Core renderer call | `src/core/index.tsx:4355-4362` | Add `onMoveItem={selectionGroups.handleMoveItem}` |
| registerOverlayDismiss | `src/utils/register-overlay-dismiss.ts` | Pattern for click-outside + Escape dismiss |
| Existing flyout component | `src/features/selection-groups/components/group-collapsible.tsx` | Import/style patterns |
| icon pattern | `src/components/icons/icon-check.tsx` | SVG icon component to reuse in GroupPickerFlyout |

All paths relative to `packages/react-grab/`.

---

## Task 1: Add `SelectionGroupsViewProps` and `handleMoveItem` to types

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/types.ts`

**Step 1: Add `SelectionGroupsViewProps` and `handleMoveItem` to `SelectionGroupsAPI`**

Append after the closing `}` of `SelectionGroupsAPI` (after line 42):

```typescript
/**
 * All group-related props passed through the renderer chain.
 * ReactGrabRendererProps extends this. Component props Pick<> their subset.
 */
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

Add `handleMoveItem` to `SelectionGroupsAPI` (after `handleDeleteGroup` on line 41):

```typescript
  handleMoveItem: (itemId: string, groupId: string) => void;
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Error in `index.ts` — `handleMoveItem` not yet in the return value. That's fine, fixed in Task 2.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/types.ts
git commit -m "feat(selection-groups): add SelectionGroupsViewProps SSOT and handleMoveItem to API"
```

---

## Task 2: Implement `handleMoveItem` in `createSelectionGroups`

**Files:**
- Modify: `packages/react-grab/src/features/selection-groups/index.ts`

**Step 1: Add `handleMoveItem` implementation**

After `handleDeleteGroup` (after line 51), add:

```typescript
  const handleMoveItem = (itemId: string, groupId: string) => {
    const updated = deps.commentItems().map((i) =>
      i.id === itemId ? { ...i, groupId } : i,
    );
    deps.persistCommentItems(updated);
    deps.setCommentItems(updated);
  };
```

**Step 2: Add `handleMoveItem` to the return object**

In the return block (after `handleDeleteGroup` on line 61):

```typescript
    handleMoveItem,
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/index.ts
git commit -m "feat(selection-groups): implement handleMoveItem in createSelectionGroups"
```

---

## Task 3: Create `GroupPickerFlyout` component

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx`

**Step 1: Create the component**

```tsx
import { For, Show, onMount, onCleanup } from "solid-js";
import type { Component } from "solid-js";
import type { SelectionGroup } from "../types.js";
import { registerOverlayDismiss } from "../../../utils/register-overlay-dismiss.js";

interface GroupPickerFlyoutProps {
  groups: SelectionGroup[];
  /** If set, renders a checkmark on this group (label picker context). */
  activeGroupId?: string;
  /** If set, this group is hidden from the list (move context). */
  excludeGroupId?: string;
  onSelect: (groupId: string) => void;
  onClose: () => void;
}

export const GroupPickerFlyout: Component<GroupPickerFlyoutProps> = (
  props,
) => {
  onMount(() => {
    const unregister = registerOverlayDismiss({
      isOpen: () => true,
      onDismiss: props.onClose,
    });
    onCleanup(unregister);
  });

  const visibleGroups = () =>
    props.groups.filter((g) => g.id !== props.excludeGroupId);

  const header = () =>
    props.excludeGroupId !== undefined ? "Move to group" : "Add to group";

  return (
    <div
      data-react-grab-ignore-events
      class="absolute left-0 top-full mt-1 z-50 bg-white rounded-[10px] overflow-hidden w-[180px] [font-synthesis:none] [corner-shape:superellipse(1.25)] filter-[drop-shadow(0px_1px_2px_#51515140)]"
    >
      <div class="px-2 pt-1.5 pb-1">
        <span class="text-[11px] font-medium text-black/40">{header()}</span>
      </div>
      <div class="border-t border-[#D9D9D9] py-1">
        <For each={visibleGroups()}>
          {(group) => {
            const isActive = () => group.id === props.activeGroupId;
            return (
              <button
                data-react-grab-ignore-events
                class="w-full flex items-center gap-2 px-2 py-1 hover:bg-black/[0.03] cursor-pointer text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSelect(group.id);
                }}
              >
                <Show
                  when={isActive()}
                  fallback={<span class="w-[10px] shrink-0" />}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-black/50 shrink-0"
                  >
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                </Show>
                <span
                  class={
                    isActive()
                      ? "text-[12px] font-medium text-black"
                      : "text-[12px] text-black/70"
                  }
                >
                  {group.name}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-picker-flyout.tsx
git commit -m "feat(selection-groups): add GroupPickerFlyout reusable component"
```

---

## Task 4: Update `types.ts` — SSOT refactor for group props

**Files:**
- Modify: `packages/react-grab/src/types.ts`

**Step 1: Add import for `SelectionGroupsViewProps`**

Line 1 currently imports `SelectionGroup`. Add `SelectionGroupsViewProps` to the same import:

```typescript
import type { SelectionGroup, SelectionGroupsViewProps } from "./features/selection-groups/types.js";
```

**Step 2: Replace manual group fields on `ReactGrabRendererProps` with `extends`**

`ReactGrabRendererProps` is at line 459. Change its declaration to extend `SelectionGroupsViewProps`:

```typescript
export interface ReactGrabRendererProps extends SelectionGroupsViewProps {
```

Then remove the now-redundant manual fields (currently lines 565-571):

```typescript
  groups?: SelectionGroup[];
  activeGroupId?: string;
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onActiveGroupChange?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
```

These are all covered by `SelectionGroupsViewProps`. `onMoveItem` is also now available for free.

**Step 3: Add group picker props to `SelectionLabelProps`**

`SelectionLabelProps` is at line 646. Change its declaration:

```typescript
export interface SelectionLabelProps
  extends Pick<
    SelectionGroupsViewProps,
    "groups" | "activeGroupId" | "onActiveGroupChange"
  > {
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (the removed fields now come from `SelectionGroupsViewProps`)

**Step 5: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "refactor(types): use SelectionGroupsViewProps as SSOT for group props"
```

---

## Task 5: Refactor `CommentsDropdownProps` to use `Pick<>`

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1: Add import for `SelectionGroupsViewProps`**

Line 12 currently imports `SelectionGroup`. Add `SelectionGroupsViewProps`:

```typescript
import type { SelectionGroup, SelectionGroupsViewProps } from "../features/selection-groups/types.js";
```

**Step 2: Replace manual group fields with `Pick<>` and add `onMoveItem`**

`CommentsDropdownProps` currently has (lines 47-51):

```typescript
  groups?: SelectionGroup[];
  onAddGroup?: (name: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onToggleGroupRevealed?: (groupId: string) => void;
```

Replace the interface declaration with:

```typescript
interface CommentsDropdownProps
  extends Pick<
    SelectionGroupsViewProps,
    | "groups"
    | "onAddGroup"
    | "onRenameGroup"
    | "onDeleteGroup"
    | "onToggleGroupRevealed"
    | "onMoveItem"
  > {
```

Then remove those five manual fields — they now come from `Pick<>`.

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "refactor(comments-dropdown): use Pick<SelectionGroupsViewProps> for group props"
```

---

## Task 6: Add group row to `SelectionLabel`

**Files:**
- Modify: `packages/react-grab/src/components/selection-label/index.tsx`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { GroupPickerFlyout } from "../../features/selection-groups/components/group-picker-flyout.jsx";
```

**Step 2: Add local `pickerOpen` signal**

After the existing signals at the top of the component (around line 73), add:

```typescript
  const [pickerOpen, setPickerOpen] = createSignal(false);
```

**Step 3: Insert group row in `isPromptMode` block**

The `isPromptMode` block starts at line 602. Inside, between the TagBadge `<div>` (ends around line 617) and `<BottomSection>` (line 618), insert:

```tsx
              <div class="relative px-2 pb-1">
                <button
                  data-react-grab-ignore-events
                  class="flex items-center gap-1 cursor-pointer hover:bg-black/[0.04] rounded-sm px-0.5 -mx-0.5 transition-colors"
                  onClick={(e) => {
                    e.stopImmediatePropagation();
                    setPickerOpen((v) => !v);
                  }}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-black/25 shrink-0"
                  >
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span class="text-[11px] font-medium text-black/40 leading-none">
                    {props.groups?.find((g) => g.id === props.activeGroupId)
                      ?.name ?? "Default"}
                  </span>
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="text-black/25"
                    style={{
                      transform: pickerOpen() ? "rotate(180deg)" : "",
                      transition: "transform 100ms",
                    }}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <Show when={pickerOpen()}>
                  <GroupPickerFlyout
                    groups={props.groups ?? []}
                    activeGroupId={props.activeGroupId}
                    onSelect={(id) => {
                      props.onActiveGroupChange?.(id);
                      setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                  />
                </Show>
              </div>
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/selection-label/index.tsx
git commit -m "feat(selection-label): add group picker row in prompt mode"
```

---

## Task 7: Add move-to-group flyout in `CommentsDropdown`

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1: Add import**

```typescript
import { GroupPickerFlyout } from "../features/selection-groups/components/group-picker-flyout.jsx";
```

**Step 2: Add local signals**

Near the top of the `CommentsDropdown` component body, after existing signals, add:

```typescript
  const [hoveredItemId, setHoveredItemId] = createSignal<string | null>(null);
  const [openMoveId, setOpenMoveId] = createSignal<string | null>(null);
```

**Step 3: Update `renderItem` callback**

Find the `renderItem` prop passed to `GroupCollapsible` (around line 310). It currently wraps items in a `<div>`. Wrap the content in a relative container and add the move button + flyout:

```tsx
renderItem={(item) => (
  <div
    data-react-grab-ignore-events
    class="relative flex items-start justify-between w-full px-2 py-1 cursor-pointer hover:bg-black/[0.03] gap-2"
    onMouseEnter={() => setHoveredItemId(item.id)}
    onMouseLeave={() => setHoveredItemId(null)}
    onClick={() => props.onSelectItem?.(item)}
  >
    {/* existing item content — keep as-is */}
    <span class="flex flex-col min-w-0 flex-1">
      {/* ... tag/name/comment spans already here ... */}
    </span>

    <div class="flex items-center gap-1 shrink-0">
      <Show when={hoveredItemId() === item.id || openMoveId() === item.id}>
        <button
          data-react-grab-ignore-events
          class="flex items-center justify-center rounded p-0.5 text-black/25 hover:text-black/50 hover:bg-black/[0.06] cursor-pointer transition-colors"
          title="Move to group"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMoveId((id) => (id === item.id ? null : item.id));
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        </button>
      </Show>
      {/* existing time display */}
    </div>

    <Show when={openMoveId() === item.id}>
      <GroupPickerFlyout
        groups={props.groups ?? []}
        excludeGroupId={item.groupId}
        onSelect={(groupId) => {
          props.onMoveItem?.(item.id, groupId);
          setOpenMoveId(null);
        }}
        onClose={() => setOpenMoveId(null)}
      />
    </Show>
  </div>
)}
```

> **Note:** Read the current `renderItem` body carefully before editing — keep the existing tag/name/comment/time content, only wrap it and append the move controls.

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(comments-dropdown): add move-to-group flyout per selection item"
```

---

## Task 8: Thread props in `renderer.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Add group props to the main `SelectionLabel` call**

The main selection label call is at line 126. Add three props:

```tsx
          groups={props.groups}
          activeGroupId={props.activeGroupId}
          onActiveGroupChange={props.onActiveGroupChange}
```

**Step 2: Add `onMoveItem` to `CommentsDropdown` call**

The `CommentsDropdown` call is at line 251. Add:

```tsx
        onMoveItem={props.onMoveItem}
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(renderer): thread groups/activeGroupId/onMoveItem to SelectionLabel and CommentsDropdown"
```

---

## Task 9: Wire `handleMoveItem` in `core/index.tsx`

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Add `onMoveItem` to the renderer call**

The renderer call is around line 4355. After `onActiveGroupChange` (line 4360), add:

```tsx
                onMoveItem={selectionGroups.handleMoveItem}
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS — full chain is wired

**Step 3: Smoke test**

Open the dev app. Verify:
- Grab an element → selection label shows group row with "Default"
- Click the group row → `GroupPickerFlyout` appears with all groups, checkmark on active
- Select a different group → row updates, next grab goes to that group
- Open comments dropdown → hover a selection item → move icon appears
- Click move icon → `GroupPickerFlyout` appears without the item's current group
- Select a group → item moves to that group in the dropdown

**Step 4: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): wire handleMoveItem to renderer for group assignment"
```
