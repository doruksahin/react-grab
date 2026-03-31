# Selection Groups v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement selection groups as a feature module at `src/features/selection-groups/` with factory+DI pattern, then extend `selection-visibility` with group-level reveal toggle — creating a 3-level override cascade (parent → group → item).

**Architecture:** Two composable feature modules. `selection-groups` owns data (CRUD, storage, UI components) via `createSelectionGroups(deps)`. `selection-visibility` owns behavior (reveal/hide, preview rendering) via `createSelectionVisibility(deps)` — extended with `handleToggleGroup`. They compose in `core/index.tsx`: groups module is instantiated first, its accessors passed as deps to visibility module.

**Tech Stack:** SolidJS (signals, createMemo, createEffect, For, Show), Tailwind CSS, sessionStorage

**Design doc:** `docs/plans/2026-03-31-selection-groups-v2-design.md`

---

## Phase 1: Selection Groups Feature Module

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Comment type | `src/types.ts:442-454` | `CommentItem` — add `groupId` here |
| Comment storage | `src/utils/comment-storage.ts` | sessionStorage CRUD pattern to replicate |
| Comment storage load | `src/utils/comment-storage.ts:25-41` | `loadFromSessionStorage` with field defaults |
| Comments signal | `src/core/index.tsx:323-324` | `commentItems` signal + `setCommentItems` |
| Comment creation | `src/core/index.tsx:881-894` | `addCommentItem` call — add `groupId` |
| Comments dropdown | `src/components/comments-dropdown.tsx:32-44` | `CommentsDropdownProps` — add group props |
| Comments dropdown items | `src/components/comments-dropdown.tsx:279-370` | `<For each={props.items}>` — replace with grouped view |
| Renderer CommentsDropdown | `src/components/renderer.tsx:251-263` | Where group props flow to dropdown |
| ReactGrabRendererProps | `src/types.ts:456-559` | Add group-related props |
| Visibility module | `src/features/selection-visibility/index.ts` | Factory pattern to replicate |
| Visibility types | `src/features/selection-visibility/types.ts` | Deps+API interface pattern |
| Icon pattern | `src/components/icons/icon-eye-filled.tsx` | SVG icon component pattern |
| Dropdown positioning | `src/utils/create-anchored-dropdown.ts` | Reuse for group picker |
| Feature folder | `src/features/selection-visibility/` | Directory convention |

All paths relative to `packages/react-grab/`.

---

### Task 1: Define SelectionGroup type

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/types.ts`

**Step 1: Create the types file**

```typescript
import type { Accessor, Setter } from "solid-js";
import type { CommentItem } from "../../types.js";

export const DEFAULT_GROUP_ID = "default" as const;
export const DEFAULT_GROUP_NAME = "Default" as const;

export interface SelectionGroup {
  id: string;
  name: string;
  createdAt: number;
  revealed: boolean;
}

export const createDefaultGroup = (): SelectionGroup => ({
  id: DEFAULT_GROUP_ID,
  name: DEFAULT_GROUP_NAME,
  createdAt: 0,
  revealed: false,
});

/**
 * Dependencies injected from core/index.tsx into the selection groups module.
 */
export interface SelectionGroupsDeps {
  commentItems: Accessor<CommentItem[]>;
  setCommentItems: Setter<CommentItem[]>;
  persistCommentItems: (items: CommentItem[]) => CommentItem[];
}

/**
 * Public API returned by createSelectionGroups.
 */
export interface SelectionGroupsAPI {
  groups: Accessor<SelectionGroup[]>;
  setGroups: Setter<SelectionGroup[]>;
  persistGroups: (groups: SelectionGroup[]) => SelectionGroup[];
  activeGroupId: Accessor<string>;
  setActiveGroupId: Setter<string>;
  handleAddGroup: (name: string) => void;
  handleRenameGroup: (groupId: string, name: string) => void;
  handleDeleteGroup: (groupId: string) => void;
}
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (standalone file)

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/types.ts
git commit -m "feat(selection-groups): define SelectionGroup type and module interfaces"
```

---

### Task 2: Create group storage

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/store/group-storage.ts`
- Create: `packages/react-grab/src/features/selection-groups/store/index.ts`

**Step 1: Create `group-storage.ts`**

Follow the exact pattern from `src/utils/comment-storage.ts`: module-level mutable state, sessionStorage persistence, exported CRUD functions.

```typescript
import type { SelectionGroup } from "../types.js";
import { createDefaultGroup, DEFAULT_GROUP_ID } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";
import { logRecoverableError } from "../../../utils/log-recoverable-error.js";

const GROUPS_KEY = "react-grab-selection-groups";

const loadFromSessionStorage = (): SelectionGroup[] => {
  try {
    const serialized = sessionStorage.getItem(GROUPS_KEY);
    if (!serialized) return [createDefaultGroup()];
    const parsed = JSON.parse(serialized) as SelectionGroup[];
    const validated = parsed.map((group) => ({
      ...group,
      revealed:
        typeof group.revealed === "boolean" ? group.revealed : false,
    }));
    const hasDefault = validated.some((g) => g.id === DEFAULT_GROUP_ID);
    return hasDefault ? validated : [createDefaultGroup(), ...validated];
  } catch (error) {
    logRecoverableError("Failed to load groups from sessionStorage", error);
    return [createDefaultGroup()];
  }
};

let groups: SelectionGroup[] = loadFromSessionStorage();

export const persistGroups = (
  nextGroups: SelectionGroup[],
): SelectionGroup[] => {
  groups = nextGroups;
  try {
    sessionStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    logRecoverableError("Failed to save groups to sessionStorage", error);
  }
  return groups;
};

export const loadGroups = (): SelectionGroup[] => groups;

export const addGroup = (name: string): SelectionGroup[] =>
  persistGroups([
    ...groups,
    {
      id: generateId("group"),
      name,
      createdAt: Date.now(),
      revealed: false,
    },
  ]);

export const renameGroup = (
  groupId: string,
  name: string,
): SelectionGroup[] => {
  if (groupId === DEFAULT_GROUP_ID) return groups;
  return persistGroups(
    groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
  );
};

export const removeGroup = (groupId: string): SelectionGroup[] => {
  if (groupId === DEFAULT_GROUP_ID) return groups;
  return persistGroups(groups.filter((g) => g.id !== groupId));
};
```

**Step 2: Create `store/index.ts`**

```typescript
export {
  loadGroups,
  addGroup,
  renameGroup,
  removeGroup,
  persistGroups,
} from "./group-storage.js";
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/store/
git commit -m "feat(selection-groups): add group storage with sessionStorage persistence"
```

---

### Task 3: Create group business logic

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/business/group-operations.ts`

**Step 1: Create group operations**

```typescript
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { DEFAULT_GROUP_ID } from "../types.js";

export const getCommentsByGroup = (
  comments: CommentItem[],
  groupId: string,
): CommentItem[] => comments.filter((c) => c.groupId === groupId);

export const countByGroup = (
  comments: CommentItem[],
  groupId: string,
): number =>
  comments.reduce((n, c) => (c.groupId === groupId ? n + 1 : n), 0);

export const removeCommentsByGroup = (
  comments: CommentItem[],
  groupId: string,
): CommentItem[] => comments.filter((c) => c.groupId !== groupId);

export const groupComments = (
  groups: SelectionGroup[],
  comments: CommentItem[],
): Array<{ group: SelectionGroup; items: CommentItem[] }> =>
  groups.map((group) => ({
    group,
    items: comments.filter((c) => c.groupId === group.id),
  }));

export const isDefaultGroup = (groupId: string): boolean =>
  groupId === DEFAULT_GROUP_ID;

/**
 * Fuzzy match: checks if all characters in `query` appear in `text` in order.
 * Case-insensitive. Empty query matches everything.
 */
export const fuzzyMatchGroup = (text: string, query: string): boolean => {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let textIdx = 0;
  for (let i = 0; i < lowerQuery.length; i++) {
    const found = lowerText.indexOf(lowerQuery[i]!, textIdx);
    if (found === -1) return false;
    textIdx = found + 1;
  }
  return true;
};
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/business/
git commit -m "feat(selection-groups): add business logic for grouping, cascade delete, fuzzy search"
```

---

### Task 4: Create the groups factory function

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/index.ts`

**Step 1: Implement `createSelectionGroups`**

```typescript
import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
} from "./types.js";
import { DEFAULT_GROUP_ID } from "./types.js";
import {
  loadGroups,
  addGroup as addGroupToStorage,
  renameGroup as renameGroupInStorage,
  removeGroup as removeGroupFromStorage,
  persistGroups as persistGroupsToStorage,
} from "./store/index.js";
import { removeCommentsByGroup } from "./business/group-operations.js";

export function createSelectionGroups(
  deps: SelectionGroupsDeps,
): SelectionGroupsAPI {
  const [groups, setGroups] = createSignal(loadGroups());
  const [activeGroupId, setActiveGroupId] = createSignal(DEFAULT_GROUP_ID);

  const persistGroups = (nextGroups: typeof groups extends () => (infer T)[] ? T[] : never) => {
    const persisted = persistGroupsToStorage(nextGroups);
    setGroups(persisted);
    return persisted;
  };

  const handleAddGroup = (name: string) => {
    const updated = addGroupToStorage(name);
    setGroups(updated);
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    const updated = renameGroupInStorage(groupId, name);
    setGroups(updated);
  };

  const handleDeleteGroup = (groupId: string) => {
    // Cascade: remove all comments in this group first
    const remainingComments = removeCommentsByGroup(
      deps.commentItems(),
      groupId,
    );
    deps.persistCommentItems(remainingComments);
    deps.setCommentItems(remainingComments);

    const updated = removeGroupFromStorage(groupId);
    setGroups(updated);
  };

  return {
    groups,
    setGroups,
    persistGroups: persistGroupsToStorage,
    activeGroupId,
    setActiveGroupId,
    handleAddGroup,
    handleRenameGroup,
    handleDeleteGroup,
  };
}

export { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME } from "./types.js";
export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
} from "./types.js";
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/index.ts
git commit -m "feat(selection-groups): implement createSelectionGroups factory"
```

---

### Task 5: Add `groupId` to `CommentItem` and update storage

**Files:**
- Modify: `packages/react-grab/src/types.ts:442-454`
- Modify: `packages/react-grab/src/utils/comment-storage.ts:30-35`

**Step 1: Add `groupId` to `CommentItem`**

In `types.ts`, add to the interface after `id`:

```typescript
export interface CommentItem {
  id: string;
  groupId: string;          // ← NEW
  content: string;
  // ... rest unchanged
}
```

**Step 2: Default `groupId` on load in `comment-storage.ts`**

In `loadFromSessionStorage`, inside the `.map()` callback, add:

```typescript
groupId:
  typeof commentItem.groupId === "string"
    ? commentItem.groupId
    : "default",
```

**Step 3: Add group-related props to `ReactGrabRendererProps`**

In `types.ts`, add to `ReactGrabRendererProps`:

```typescript
groups?: SelectionGroup[];
activeGroupId?: string;
onAddGroup?: (name: string) => void;
onRenameGroup?: (groupId: string, name: string) => void;
onDeleteGroup?: (groupId: string) => void;
onActiveGroupChange?: (groupId: string) => void;
onToggleGroupRevealed?: (groupId: string) => void;
```

Add import at top: `import type { SelectionGroup } from "./features/selection-groups/types.js";`

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `addCommentItem` is called without `groupId` (line ~881). Fixed in Task 7.

**Step 5: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(types): add groupId to CommentItem and group props to ReactGrabRendererProps"
```

---

### Task 6: Create group collapsible component

**Files:**
- Create: `packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx`

**Step 1: Create the component**

This renders one group section: collapsible header with group name, item count badge, eye toggle, and inline rename/delete actions (hover, non-default only). Items are rendered via a `renderItem` callback.

```tsx
import { createSignal, For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { isDefaultGroup } from "../business/group-operations.js";
import { cn } from "../../../utils/cn.js";

interface GroupCollapsibleProps {
  group: SelectionGroup;
  items: CommentItem[];
  renderItem: (item: CommentItem) => JSX.Element;
  isFirst: boolean;
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  onToggleRevealed: (groupId: string) => void;
}

export const GroupCollapsible: Component<GroupCollapsibleProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(true);
  const [isRenaming, setIsRenaming] = createSignal(false);
  let renameInputRef: HTMLInputElement | undefined;

  const handleRenameSubmit = () => {
    if (!renameInputRef || !renameInputRef.value.trim()) {
      setIsRenaming(false);
      return;
    }
    props.onRename(props.group.id, renameInputRef.value.trim());
    setIsRenaming(false);
  };

  return (
    <div>
      {/* Group header */}
      <div
        class={cn(
          "group/header w-full flex items-center justify-between px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-[#D9D9D9]/50",
        )}
        onClick={() => !isRenaming() && setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Chevron */}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
            class={cn("text-black/30 transition-transform duration-150 shrink-0", !isOpen() && "-rotate-90")}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          {/* Group name (or rename input) */}
          <Show
            when={!isRenaming()}
            fallback={
              <input
                ref={renameInputRef}
                type="text"
                value={props.group.name}
                class="text-[12px] font-semibold text-black/70 bg-transparent outline-none border-b border-black/30 min-w-0 flex-1"
                on:click={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                onFocusOut={handleRenameSubmit}
              />
            }
          >
            <span class="text-[12px] font-semibold text-black/70 truncate">
              {props.group.name}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {/* Hover actions for non-default groups */}
          <Show when={!isDefaultGroup(props.group.id)}>
            <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <button
                data-react-grab-ignore-events
                class="text-black/30 hover:text-black/60 cursor-pointer p-0.5"
                on:click={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  requestAnimationFrame(() => {
                    renameInputRef?.focus();
                    renameInputRef?.select();
                  });
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
              </button>
              <button
                data-react-grab-ignore-events
                class="text-[#B91C1C]/50 hover:text-[#B91C1C] cursor-pointer p-0.5"
                on:click={(e) => {
                  e.stopPropagation();
                  props.onDelete(props.group.id);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </Show>
          {/* Group eye toggle */}
          <button
            data-react-grab-ignore-events
            class="flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
            on:click={(e) => {
              e.stopPropagation();
              props.onToggleRevealed(props.group.id);
            }}
            on:pointerdown={(e) => e.stopPropagation()}
            aria-label={props.group.revealed ? "Hide group selections" : "Reveal group selections"}
          >
            {props.group.revealed ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20">
                <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
                <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
                <path d="m2 2 20 20"/>
              </svg>
            )}
          </button>
          {/* Count badge */}
          <span class="text-[10px] font-medium text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {props.items.length}
          </span>
        </div>
      </div>
      {/* Collapsible items */}
      <div
        class="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ "grid-template-rows": isOpen() ? "1fr" : "0fr" }}
      >
        <div class="min-h-0 overflow-hidden">
          <Show
            when={props.items.length > 0}
            fallback={
              <div class="px-2 py-2 text-[11px] text-black/30 text-center italic">
                No selections yet
              </div>
            }
          >
            <For each={props.items}>
              {(item) => props.renderItem(item)}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};
```

**Note:** All nested buttons use `on:click` (native) per the SolidJS event delegation pattern documented in `docs/solidjs-reactivity-patterns.md`.

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-groups/components/group-collapsible.tsx
git commit -m "feat(selection-groups): add GroupCollapsible with eye toggle and inline rename/delete"
```

---

### Task 7: Wire groups into core/index.tsx

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Add imports**

```typescript
import { createSelectionGroups } from "../features/selection-groups/index.js";
import { DEFAULT_GROUP_ID } from "../features/selection-groups/types.js";
```

**Step 2: Instantiate groups module**

Place BEFORE the `visibility` instantiation (around line 3729). The groups module only needs comment deps:

```typescript
const selectionGroups = createSelectionGroups({
  commentItems,
  setCommentItems,
  persistCommentItems,
});
```

**Step 3: Update `addCommentItem` call**

Find (line ~881) and add `groupId`:

```typescript
const updatedCommentItems = addCommentItem({
  groupId: selectionGroups.activeGroupId(),  // ← NEW
  content,
  // ... rest unchanged
});
```

**Step 4: Pass group props to `<ReactGrabRenderer>`**

Find where renderer is called and add:

```tsx
groups={selectionGroups.groups()}
activeGroupId={selectionGroups.activeGroupId()}
onAddGroup={selectionGroups.handleAddGroup}
onRenameGroup={selectionGroups.handleRenameGroup}
onDeleteGroup={selectionGroups.handleDeleteGroup}
onActiveGroupChange={selectionGroups.setActiveGroupId}
```

**Step 5: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors in renderer/dropdown (they don't accept group props yet). Fixed in Tasks 8-9.

**Step 6: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): wire createSelectionGroups into orchestrator"
```

---

### Task 8: Replace flat comments dropdown with grouped view

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1: Add group props to `CommentsDropdownProps`**

```typescript
import type { SelectionGroup } from "../features/selection-groups/types.js";
import { GroupCollapsible } from "../features/selection-groups/components/group-collapsible.jsx";
import { groupComments, fuzzyMatchGroup } from "../features/selection-groups/business/group-operations.js";

// Add to CommentsDropdownProps:
groups?: SelectionGroup[];
onAddGroup?: (name: string) => void;
onRenameGroup?: (groupId: string, name: string) => void;
onDeleteGroup?: (groupId: string) => void;
onToggleGroupRevealed?: (groupId: string) => void;
```

**Step 2: Add grouped memos and search state**

Inside the component, add:

```typescript
const [searchQuery, setSearchQuery] = createSignal("");

const groupedItems = () =>
  groupComments(props.groups ?? [], props.items);

const filteredGroupedItems = () => {
  const query = searchQuery();
  if (!query) return groupedItems();
  return groupedItems().filter((entry) =>
    fuzzyMatchGroup(entry.group.name, query),
  );
};
```

**Step 3: Add search bar**

After the header section and before the items list, add:

```tsx
<Show when={(props.groups?.length ?? 0) > 1}>
  <div class="border-t border-[#D9D9D9] px-2 py-1">
    <div class="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/25 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        data-react-grab-ignore-events
        type="text"
        placeholder="Search groups..."
        class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black py-0.5"
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
      />
    </div>
  </div>
</Show>
```

**Step 4: Replace the flat `<For each={props.items}>` with grouped view**

Replace the items `<For>` block with:

```tsx
<For each={filteredGroupedItems()}>
  {(entry, index) => (
    <GroupCollapsible
      group={entry.group}
      items={entry.items}
      isFirst={index() === 0}
      onRename={(groupId, name) => props.onRenameGroup?.(groupId, name)}
      onDelete={(groupId) => props.onDeleteGroup?.(groupId)}
      onToggleRevealed={(groupId) => props.onToggleGroupRevealed?.(groupId)}
      renderItem={(item) => (
        /* Move existing per-item render JSX here — the <div> with
           data-react-grab-comment-item, all event handlers (onMouseEnter,
           onMouseLeave, onClick, etc.), the name/comment/timestamp spans,
           and the per-item eye toggle button. Keep ALL existing handlers intact. */
      )}
    />
  )}
</For>
```

**IMPORTANT:** The existing per-item render JSX (lines ~282-370 in the current file) must be moved into the `renderItem` callback. Keep ALL event handlers (`onMouseEnter`, `onMouseLeave`, `onClick`, highlight tracking) intact. Only the outer `<For>` loop changes — each item is now rendered inside a `GroupCollapsible`.

**Step 5: Add "New group..." input at the bottom**

After the scrollable area, before the panel closing `</div>`:

```tsx
<div class="border-t border-[#D9D9D9] px-2 py-1.5">
  <div class="flex items-center gap-1.5">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/25 shrink-0"><path d="M12 5v14m-7-7h14"/></svg>
    <input
      data-react-grab-ignore-events
      type="text"
      placeholder="New group..."
      class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.currentTarget.value.trim()) {
          props.onAddGroup?.(e.currentTarget.value.trim());
          e.currentTarget.value = "";
        }
      }}
    />
  </div>
</div>
```

**Step 6: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `CommentsDropdown` is used without new props. Fixed in Task 9.

**Step 7: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(comments-dropdown): replace flat list with grouped collapsibles"
```

---

### Task 9: Wire group props through renderer

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Pass group props to `<CommentsDropdown>`**

```tsx
<CommentsDropdown
  position={props.commentsDropdownPosition ?? null}
  items={props.commentItems ?? []}
  disconnectedItemIds={props.commentsDisconnectedItemIds}
  groups={props.groups}
  onSelectItem={props.onCommentItemSelect}
  onItemHover={props.onCommentItemHover}
  onCopyAll={props.onCommentsCopyAll}
  onCopyAllHover={props.onCommentsCopyAllHover}
  onClearAll={props.onCommentsClear}
  onDismiss={props.onCommentsDismiss}
  onDropdownHover={props.onCommentsDropdownHover}
  onToggleItemRevealed={props.onToggleCommentItemRevealed}
  onAddGroup={props.onAddGroup}
  onRenameGroup={props.onRenameGroup}
  onDeleteGroup={props.onDeleteGroup}
  onToggleGroupRevealed={props.onToggleGroupRevealed}
/>
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(renderer): wire group props to CommentsDropdown"
```

---

## Phase 2: Extend Visibility Module with Group-Level Toggle

---

### Task 10: Extend visibility module types with group deps

**Files:**
- Modify: `packages/react-grab/src/features/selection-visibility/types.ts`

**Step 1: Add group dependencies**

Add imports and new deps:

```typescript
import type { SelectionGroup } from "../selection-groups/types.js";

// Add to SelectionVisibilityDeps:
/** Reactive signal of all selection groups */
groups: Accessor<SelectionGroup[]>;
/** Setter for the groups signal */
setGroups: Setter<SelectionGroup[]>;
/** Persist groups to sessionStorage */
persistGroups: (groups: SelectionGroup[]) => SelectionGroup[];
```

**Step 2: Add `handleToggleGroup` to API**

```typescript
// Add to SelectionVisibilityAPI:
/** Toggle a group's revealed state (overrides all items in group) */
handleToggleGroup: (groupId: string) => void;
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/types.ts
git commit -m "feat(selection-visibility): add group deps and handleToggleGroup to API types"
```

---

### Task 11: Implement group-level toggle in visibility module

**Files:**
- Modify: `packages/react-grab/src/features/selection-visibility/index.ts`

**Step 1: Add `handleToggleGroup` implementation**

After `handleToggleItem`, add:

```typescript
const handleToggleGroup = (groupId: string) => {
  const group = deps.groups().find((g) => g.id === groupId);
  if (!group) return;
  const newRevealed = !group.revealed;

  // Update the group's revealed state
  const updatedGroups = deps.groups().map((g) =>
    g.id === groupId ? { ...g, revealed: newRevealed } : g,
  );
  deps.setGroups(updatedGroups);
  deps.persistGroups(updatedGroups);

  // Override all items in this group
  const items = deps.commentItems();
  const updatedItems = items.map((item) =>
    item.groupId === groupId
      ? { ...item, revealed: newRevealed }
      : item,
  );
  deps.setCommentItems(updatedItems);
  deps.persistCommentItems(updatedItems);
};
```

**Step 2: Update `handleToggleParent` to cascade through groups**

Replace the existing `handleToggleParent`:

```typescript
const handleToggleParent = () => {
  const newRevealed = !selectionsRevealed();

  // Override all groups
  const updatedGroups = deps.groups().map((group) => ({
    ...group,
    revealed: newRevealed,
  }));
  deps.setGroups(updatedGroups);
  deps.persistGroups(updatedGroups);

  // Override all items
  const items = deps.commentItems();
  const updatedItems = items.map((item) => ({
    ...item,
    revealed: newRevealed,
  }));
  deps.setCommentItems(updatedItems);
  deps.persistCommentItems(updatedItems);

  // Update toolbar state
  deps.updateToolbarState({ selectionsRevealed: newRevealed });
};
```

**Step 3: Add to return object**

```typescript
return {
  selectionsRevealed,
  isItemRevealed,
  handleToggleParent,
  handleToggleGroup,  // ← NEW
  handleToggleItem,
};
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `createSelectionVisibility` is called without new group deps. Fixed in Task 12.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/index.ts
git commit -m "feat(selection-visibility): implement group-level toggle with cascade"
```

---

### Task 12: Wire group deps into visibility module in core

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Pass group deps to `createSelectionVisibility`**

Find the `createSelectionVisibility` call and add the three new deps:

```typescript
const visibility = createSelectionVisibility({
  commentItems,
  setCommentItems,
  persistCommentItems,
  getConnectedCommentElements,
  disconnectedItemIds: commentsDisconnectedItemIds,
  createElementBounds,
  addCommentItemPreview,
  actions: {
    removeGrabbedBox: actions.removeGrabbedBox,
    removeLabelInstance: actions.removeLabelInstance,
  },
  currentToolbarState,
  updateToolbarState,
  // NEW: group deps
  groups: selectionGroups.groups,
  setGroups: selectionGroups.setGroups,
  persistGroups: selectionGroups.persistGroups,
});
```

**Step 2: Pass `handleToggleGroup` to renderer**

```tsx
onToggleGroupRevealed={visibility.handleToggleGroup}
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (zero errors)

**Step 4: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): wire group deps to visibility module and pass handleToggleGroup to renderer"
```

---

### Task 13: Build and verify

**Step 1: Build**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

**Step 2: Test all scenarios**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Page load | Default group exists, comments assigned to it |
| 2 | Create new comment | Goes into active group |
| 3 | Create new group ("New group..." input) | Appears in dropdown |
| 4 | Rename group (hover → pencil) | Inline edit works |
| 5 | Delete group (hover → trash) | Confirmation shown, cascade deletes items |
| 6 | Search groups | Fuzzy match filters groups |
| 7 | Collapse/expand group | Items hide/show with animation |
| 8 | **Group eye toggle ON** | All items in group get `revealed: true`, overlays appear |
| 9 | **Group eye toggle OFF** | All items in group get `revealed: false`, overlays disappear |
| 10 | **Item eye toggle** within revealed group | That one item toggles independently |
| 11 | **Parent eye toggle ON** | All groups + all items set to `revealed: true` |
| 12 | **Parent eye toggle OFF** | All groups + all items set to `revealed: false` |
| 13 | Page reload | Groups, items, and revealed states persist |
| 14 | Old sessionStorage (no groupId) | Items default to `"default"` group |

**Step 3: Commit if fixes needed**

---

## File Change Summary

### New files

| File | Purpose |
|------|---------|
| `src/features/selection-groups/types.ts` | `SelectionGroup`, `SelectionGroupsDeps`, `SelectionGroupsAPI` |
| `src/features/selection-groups/index.ts` | `createSelectionGroups()` factory |
| `src/features/selection-groups/store/group-storage.ts` | sessionStorage CRUD |
| `src/features/selection-groups/store/index.ts` | Re-export |
| `src/features/selection-groups/business/group-operations.ts` | Grouping, cascade, fuzzy search |
| `src/features/selection-groups/components/group-collapsible.tsx` | Group section with eye toggle |

### Modified files

| File | Change |
|------|--------|
| `src/types.ts` | Add `groupId` to `CommentItem`, group props to `ReactGrabRendererProps` |
| `src/utils/comment-storage.ts` | Default `groupId` on load |
| `src/components/comments-dropdown.tsx` | Grouped collapsibles + search + "New group..." |
| `src/components/renderer.tsx` | Pass group props to dropdown |
| `src/core/index.tsx` | Instantiate groups module, wire to visibility and renderer |
| `src/features/selection-visibility/types.ts` | Add group deps + `handleToggleGroup` |
| `src/features/selection-visibility/index.ts` | Implement `handleToggleGroup`, update `handleToggleParent` cascade |
