# Selection Groups — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Group selections (comments) into named, collapsible groups with inline CRUD operations, a default group, and a group picker on comment creation.

**Architecture:** New `src/groups/` feature folder with `types.ts`, `store/`, `components/`, `business/`. `CommentItem` gains a `groupId` field referencing `SelectionGroup.id`. Groups persisted to sessionStorage alongside comments. Comments dropdown replaced with grouped collapsibles — group management (rename, delete, create) is inline within the dropdown, no separate panel.

**Tech Stack:** SolidJS (signals, createStore, For, Show), Tailwind CSS, sessionStorage

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Comment type | `src/types.ts:439-450` | `CommentItem` — add `groupId` here |
| Comment storage | `src/utils/comment-storage.ts` | sessionStorage CRUD pattern to replicate |
| Comments signal | `src/core/index.tsx:322-323` | `commentItems` signal + `setCommentItems` |
| Comment creation | `src/core/index.tsx:878-891` | `addCommentItem` call in copy flow |
| Comments dropdown | `src/components/comments-dropdown.tsx` | Flat `<For each={items}>` list to replace |
| Dropdown props | `src/components/comments-dropdown.tsx:39-50` | `CommentsDropdownProps` |
| Renderer props | `src/types.ts` → `ReactGrabRendererProps` | Where to add group-related props |
| Icon pattern | `src/components/icons/icon-select.tsx` | `Component<{ size?, class? }>` |
| Dropdown positioning | `src/utils/create-anchored-dropdown.ts` | Reuse for group picker |

---

### Task 1: Define group types and constants

**Files:**
- Create: `packages/react-grab/src/groups/types.ts`

**Step 1: Create the types file**

```typescript
export const DEFAULT_GROUP_ID = "default" as const;
export const DEFAULT_GROUP_NAME = "Default" as const;

export interface SelectionGroup {
  id: string;
  name: string;
  createdAt: number;
}

export const createDefaultGroup = (): SelectionGroup => ({
  id: DEFAULT_GROUP_ID,
  name: DEFAULT_GROUP_NAME,
  createdAt: 0,
});
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (standalone file)

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/types.ts
git commit -m "feat(groups): define SelectionGroup type and default group constant"
```

---

### Task 2: Add `groupId` to `CommentItem`

**Files:**
- Modify: `packages/react-grab/src/types.ts:439-450`
- Modify: `packages/react-grab/src/utils/comment-storage.ts`

**Step 1: Add `groupId` field to `CommentItem`**

In `types.ts`, add to the `CommentItem` interface:

```typescript
export interface CommentItem {
  id: string;
  groupId: string;          // ← new, references SelectionGroup.id
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  previewBounds?: OverlayBounds[];
  elementSelectors?: string[];
  commentText?: string;
  timestamp: number;
}
```

**Step 2: Update `loadFromSessionStorage` to default `groupId`**

In `comment-storage.ts`, update the `loadFromSessionStorage` map callback to include:

```typescript
import { DEFAULT_GROUP_ID } from "../groups/types.js";

// Inside loadFromSessionStorage, in the .map callback:
groupId: typeof commentItem.groupId === "string" ? commentItem.groupId : DEFAULT_GROUP_ID,
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `addCommentItem` is called without `groupId`. We fix that in Task 5.

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(types): add groupId to CommentItem with default fallback on load"
```

---

### Task 3: Create group storage

**Files:**
- Create: `packages/react-grab/src/groups/store/group-storage.ts`
- Create: `packages/react-grab/src/groups/store/index.ts`

**Step 1: Create `group-storage.ts`**

Follow the same pattern as `comment-storage.ts`: module-level mutable state, sessionStorage persistence, exported CRUD functions.

```typescript
import type { SelectionGroup } from "../types.js";
import { createDefaultGroup, DEFAULT_GROUP_ID } from "../types.js";
import { generateId } from "../../utils/generate-id.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";

const GROUPS_KEY = "react-grab-selection-groups";

const loadFromSessionStorage = (): SelectionGroup[] => {
  try {
    const serialized = sessionStorage.getItem(GROUPS_KEY);
    if (!serialized) return [createDefaultGroup()];
    const parsed = JSON.parse(serialized) as SelectionGroup[];
    const hasDefault = parsed.some((g) => g.id === DEFAULT_GROUP_ID);
    return hasDefault ? parsed : [createDefaultGroup(), ...parsed];
  } catch (error) {
    logRecoverableError("Failed to load groups from sessionStorage", error);
    return [createDefaultGroup()];
  }
};

const persistGroups = (nextGroups: SelectionGroup[]): SelectionGroup[] => {
  groups = nextGroups;
  try {
    sessionStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    logRecoverableError("Failed to save groups to sessionStorage", error);
  }
  return groups;
};

let groups: SelectionGroup[] = loadFromSessionStorage();

export const loadGroups = (): SelectionGroup[] => groups;

export const addGroup = (name: string): SelectionGroup[] =>
  persistGroups([
    ...groups,
    { id: generateId("group"), name, createdAt: Date.now() },
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
} from "./group-storage.js";
```

**Step 3: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/groups/store/
git commit -m "feat(groups): add group storage with sessionStorage persistence"
```

---

### Task 4: Create group business logic

**Files:**
- Create: `packages/react-grab/src/groups/business/group-operations.ts`

**Step 1: Create cascade delete and group-aware comment helpers**

```typescript
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../types.js";
import { DEFAULT_GROUP_ID } from "../types.js";

export const getCommentsByGroup = (
  comments: CommentItem[],
  groupId: string,
): CommentItem[] => comments.filter((c) => c.groupId === groupId);

export const countByGroup = (
  comments: CommentItem[],
  groupId: string,
): number => comments.reduce((n, c) => (c.groupId === groupId ? n + 1 : n), 0);

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
    const found = lowerText.indexOf(lowerQuery[i], textIdx);
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
git add packages/react-grab/src/groups/business/
git commit -m "feat(groups): add business logic for grouping, counting, cascade delete, fuzzy search"
```

---

### Task 5: Wire groups into core orchestrator

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

This is the main wiring task. Multiple changes:

**Step 1: Add imports**

```typescript
import { loadGroups, addGroup as addGroupToStorage, renameGroup as renameGroupInStorage, removeGroup as removeGroupFromStorage } from "../groups/store/index.js";
import { removeCommentsByGroup } from "../groups/business/group-operations.js";
import { DEFAULT_GROUP_ID } from "../groups/types.js";
import type { SelectionGroup } from "../groups/types.js";
```

**Step 2: Add groups signal**

Near the `commentItems` signal (line ~322), add:

```typescript
const [groups, setGroups] = createSignal<SelectionGroup[]>(loadGroups());
const [activeGroupId, setActiveGroupId] = createSignal<string>(DEFAULT_GROUP_ID);
```

**Step 3: Create group action handlers**

```typescript
const handleAddGroup = (name: string) => {
  setGroups(addGroupToStorage(name));
};

const handleRenameGroup = (groupId: string, name: string) => {
  setGroups(renameGroupInStorage(groupId, name));
};

const handleDeleteGroup = (groupId: string) => {
  // Cascade: remove all comments in this group first
  const remainingComments = removeCommentsByGroup(commentItems(), groupId);
  persistCommentItems(remainingComments);
  setCommentItems(remainingComments);
  setGroups(removeGroupFromStorage(groupId));
};
```

Note: This requires `persistCommentItems` to be exported from `comment-storage.ts`. Check if it is — if not, add an export or use the existing `clearComments` / `removeCommentItem` pattern.

**Step 4: Update addCommentItem call**

Find where `addCommentItem` is called (around line 878). The comment creation needs to include `groupId`:

```typescript
const updatedCommentItems = addCommentItem({
  groupId: activeGroupId(),  // ← add this
  content,
  elementName: elementName ?? "element",
  // ... rest unchanged
});
```

**Step 5: Pass groups and handlers to renderer**

In `ReactGrabRendererProps` (in `types.ts`), add:

```typescript
groups: SelectionGroup[];
activeGroupId: string;
onAddGroup: (name: string) => void;
onRenameGroup: (groupId: string, name: string) => void;
onDeleteGroup: (groupId: string) => void;
onActiveGroupChange: (groupId: string) => void;
```

Where `<ReactGrabRenderer>` is rendered, add:

```tsx
groups={groups()}
activeGroupId={activeGroupId()}
onAddGroup={handleAddGroup}
onRenameGroup={handleRenameGroup}
onDeleteGroup={handleDeleteGroup}
onActiveGroupChange={setActiveGroupId}
```

**Step 6: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors in renderer/dropdown components (they don't accept these props yet). Fixed in next tasks.

**Step 7: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/types.ts packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(core): wire group signals, handlers, and activeGroupId into orchestrator"
```

---

### Task 6: Create group collapsible component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-collapsible.tsx`

**Step 1: Create the component**

This is a SolidJS component that renders a single group section: collapsible header with inline rename/delete hover actions (for non-default groups), and items list. The header shows group name + item count badge. Hover reveals pencil (rename) and trash (delete) icons between the name and the count badge.

```typescript
import { createSignal, For, Show } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../types.js";
import { isDefaultGroup } from "../business/group-operations.js";
import { cn } from "../../utils/cn.js";

interface GroupCollapsibleProps {
  group: SelectionGroup;
  items: CommentItem[];
  renderItem: (item: CommentItem) => JSX.Element;
  isFirst: boolean;
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
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

  const startRename = (event: MouseEvent) => {
    event.stopPropagation();
    setIsRenaming(true);
    requestAnimationFrame(() => {
      renameInputRef?.focus();
      renameInputRef?.select();
    });
  };

  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation();
    props.onDelete(props.group.id);
  };

  return (
    <div>
      <div
        class={cn(
          "group/header w-full flex items-center justify-between px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-[#D9D9D9]/50",
        )}
        onClick={() => !isRenaming() && setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class={cn(
              "text-black/30 transition-transform duration-150 shrink-0",
              !isOpen() && "-rotate-90",
            )}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <Show
            when={!isRenaming()}
            fallback={
              <input
                ref={renameInputRef}
                type="text"
                value={props.group.name}
                class="text-[12px] font-semibold text-black/70 bg-transparent outline-none border-b border-black/30 min-w-0 flex-1"
                onClick={(e) => e.stopPropagation()}
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
                onClick={startRename}
              >
                {/* Pencil icon */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
              </button>
              <button
                data-react-grab-ignore-events
                class="text-[#B91C1C]/50 hover:text-[#B91C1C] cursor-pointer p-0.5"
                onClick={handleDeleteClick}
              >
                {/* Trash icon */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </Show>
          <span class="text-[10px] font-medium text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {props.items.length}
          </span>
        </div>
      </div>
      <div
        class="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{
          "grid-template-rows": isOpen() ? "1fr" : "0fr",
        }}
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

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/components/group-collapsible.tsx
git commit -m "feat(groups): add GroupCollapsible with inline rename/delete hover actions"
```

---

### Task 7: Create group picker component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-picker.tsx`

**Step 1: Create the component**

A dropdown that shows available groups with a checkmark on the active one. Includes "New group..." action at the bottom with inline input.

```typescript
import { For, Show, createSignal } from "solid-js";
import type { Component } from "solid-js";
import type { SelectionGroup } from "../types.js";
import { cn } from "../../utils/cn.js";

interface GroupPickerProps {
  groups: SelectionGroup[];
  activeGroupId: string;
  onSelect: (groupId: string) => void;
  onCreateGroup: (name: string) => void;
}

export const GroupPicker: Component<GroupPickerProps> = (props) => {
  const [isCreating, setIsCreating] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const handleCreate = () => {
    if (!inputRef || !inputRef.value.trim()) return;
    props.onCreateGroup(inputRef.value.trim());
    inputRef.value = "";
    setIsCreating(false);
  };

  return (
    <div class="py-1">
      <div class="px-2 pt-0.5 pb-1">
        <span class="text-[11px] font-medium text-black/40">Add to group</span>
      </div>
      <div class="border-t border-[#D9D9D9] py-1">
        <For each={props.groups}>
          {(group) => (
            <button
              data-react-grab-ignore-events
              class="w-full flex items-center gap-2 px-2 py-1 hover:bg-black/[0.03] cursor-pointer"
              onClick={() => props.onSelect(group.id)}
            >
              <Show
                when={group.id === props.activeGroupId}
                fallback={<span class="w-[10px]" />}
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
                  class="text-black/50"
                >
                  <path d="m5 12 5 5L20 7" />
                </svg>
              </Show>
              <span
                class={cn(
                  "text-[12px]",
                  group.id === props.activeGroupId
                    ? "font-medium text-black"
                    : "text-black/70",
                )}
              >
                {group.name}
              </span>
            </button>
          )}
        </For>
      </div>
      <div class="border-t border-[#D9D9D9] py-1">
        <Show
          when={isCreating()}
          fallback={
            <button
              data-react-grab-ignore-events
              class="w-full flex items-center gap-2 px-2 py-1 hover:bg-black/[0.03] cursor-pointer"
              onClick={() => {
                setIsCreating(true);
                requestAnimationFrame(() => inputRef?.focus());
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
                class="text-black/40"
              >
                <path d="M12 5v14m-7-7h14" />
              </svg>
              <span class="text-[12px] text-black/50">New group...</span>
            </button>
          }
        >
          <div class="flex items-center gap-1.5 px-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Group name..."
              class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black py-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <button
              data-react-grab-ignore-events
              class="text-[10px] font-medium text-black/40 hover:text-black/70 cursor-pointer px-1"
              onClick={handleCreate}
            >
              Add
            </button>
          </div>
        </Show>
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
git add packages/react-grab/src/groups/components/group-picker.tsx
git commit -m "feat(groups): add GroupPicker dropdown component"
```

---

### Task 8: Replace flat comments dropdown with grouped view

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

This is the biggest UI change. The flat `<For each={props.items}>` becomes grouped collapsibles with inline group CRUD.

**Step 1: Add group-related props to `CommentsDropdownProps`**

```typescript
import type { SelectionGroup } from "../groups/types.js";

// Add to CommentsDropdownProps:
groups: SelectionGroup[];
activeGroupId: string;
onAddGroup: (name: string) => void;
onRenameGroup: (groupId: string, name: string) => void;
onDeleteGroup: (groupId: string) => void;
onActiveGroupChange: (groupId: string) => void;
```

**Step 2: Add imports and state for delete confirmation + search**

```typescript
import { GroupCollapsible } from "../groups/components/group-collapsible.js";
import { groupComments, countByGroup, fuzzyMatchGroup } from "../groups/business/group-operations.js";

// Inside the component:
const [pendingDeleteGroupId, setPendingDeleteGroupId] = createSignal<string | null>(null);
const [searchQuery, setSearchQuery] = createSignal("");

const groupedItems = createMemo(() =>
  groupComments(props.groups, props.items),
);

const filteredGroupedItems = createMemo(() => {
  const query = searchQuery();
  if (!query) return groupedItems();
  return groupedItems().filter((entry) => fuzzyMatchGroup(entry.group.name, query));
});

const pendingDeleteGroup = () =>
  props.groups.find((g) => g.id === pendingDeleteGroupId());
```

**Step 3: Add search bar between header and grouped list**

After the header `<div>` and before the grouped list `<div>`, add:

```tsx
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
```

**Step 4: Replace the flat list body with grouped view**

Replace the `<For each={props.items}>` block (lines ~279-334) with:

```tsx
<Show
  when={!pendingDeleteGroupId()}
  fallback={
    /* Inline delete confirmation */
    <Show when={pendingDeleteGroup()}>
      {(group) => {
        const count = () => countByGroup(props.items, group().id);
        return (
          <div class="px-3 pt-2.5 pb-2">
            <span class="text-[12px] font-semibold text-black">
              Delete "{group().name}"?
            </span>
            <Show when={count() > 0}>
              <p class="text-[11px] text-black/50 mt-1 leading-[14px]">
                This will delete the group and all {count()} selection{count() !== 1 ? "s" : ""} in it.
              </p>
            </Show>
            <Show when={count() === 0}>
              <p class="text-[11px] text-black/50 mt-1 leading-[14px]">
                This will delete the empty group.
              </p>
            </Show>
            <div class="flex items-center justify-end gap-1.5 mt-2">
              <button
                data-react-grab-ignore-events
                class="text-[11px] font-medium text-black/50 hover:text-black/70 cursor-pointer px-2 py-1 rounded hover:bg-black/[0.03]"
                onClick={() => setPendingDeleteGroupId(null)}
              >
                Cancel
              </button>
              <button
                data-react-grab-ignore-events
                class="text-[11px] font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] cursor-pointer px-2 py-1 rounded"
                onClick={() => {
                  props.onDeleteGroup(group().id);
                  setPendingDeleteGroupId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      }}
    </Show>
  }
>
  <Show
    when={filteredGroupedItems().length > 0}
    fallback={
      <div class="px-2 py-3 text-[11px] text-black/30 text-center italic">
        No matching groups
      </div>
    }
  >
    <For each={filteredGroupedItems()}>
      {(entry, index) => (
        <GroupCollapsible
          group={entry.group}
          items={entry.items}
          isFirst={index() === 0}
          onRename={props.onRenameGroup}
          onDelete={(groupId) => setPendingDeleteGroupId(groupId)}
          renderItem={(item) => (
          {/* Move existing per-item render JSX here — keep all event handlers intact */}
        )}
      />
    )}
  </For>
  </Show>
</Show>
```

**Step 5: Add "New group..." input at the bottom of the dropdown**

After the scrollable grouped list area, before the closing `</div>` of the panel, add:

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
          props.onAddGroup(e.currentTarget.value.trim());
          e.currentTarget.value = "";
        }
      }}
    />
  </div>
</div>
```

**Step 6: Move the existing per-item render JSX**

Extract the existing item render (lines 281-333 of the original file) into the `renderItem` callback. Keep all existing event handlers, hover tracking, and highlight behavior intact.

**Step 7: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: May have errors where `CommentsDropdown` is used (needs new props). Fixed in Task 9.

**Step 8: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(groups): replace flat comments list with grouped collapsibles, fuzzy search, and inline CRUD"
```

---

### Task 9: Wire everything through renderer

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`
- Modify: `packages/react-grab/src/core/index.tsx` (if not done in Task 5)

**Step 1: Pass group props through renderer to CommentsDropdown**

In `renderer.tsx`, find where `<CommentsDropdown>` is rendered and add:

```tsx
groups={props.groups}
activeGroupId={props.activeGroupId}
onAddGroup={props.onAddGroup}
onRenameGroup={props.onRenameGroup}
onDeleteGroup={props.onDeleteGroup}
onActiveGroupChange={props.onActiveGroupChange}
```

**Step 2: Verify the full prop chain**

Trace: `core/index.tsx` → `ReactGrabRendererProps` → `renderer.tsx` → `CommentsDropdown`. Ensure all group props flow through without gaps.

**Step 3: Verify typecheck passes end-to-end**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (all types aligned)

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx packages/react-grab/src/core/index.tsx
git commit -m "feat(groups): wire group props through renderer to comments dropdown"
```

---

### Task 10: Build, link, and verify in AdCreative

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab && pnpm build
```

**Step 2: Verify in dev server**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2 && pnpm dev
```

Verify:
- Comments dropdown shows grouped view with collapsible sections
- Search bar filters groups by fuzzy match, shows "No matching groups" when empty
- Default group exists and is used for new selections
- Hover non-default group headers to see rename + delete actions
- Rename works inline (click pencil, type, Enter)
- Delete shows inline confirmation with selection count, then removes group + selections
- "New group..." input at bottom creates a new group
- Counts update reactively when adding/removing selections
- Groups persist across page reloads (sessionStorage)
- Group picker works during copy flow

**Step 3: Fix any issues found**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/groups/types.ts` | Create | `SelectionGroup`, `DEFAULT_GROUP_ID`, `createDefaultGroup` |
| `src/groups/store/group-storage.ts` | Create | sessionStorage CRUD for groups |
| `src/groups/store/index.ts` | Create | Re-export |
| `src/groups/business/group-operations.ts` | Create | `groupComments`, `countByGroup`, `removeCommentsByGroup`, `fuzzyMatchGroup` |
| `src/groups/components/group-collapsible.tsx` | Create | Collapsible group section with inline rename/delete |
| `src/groups/components/group-picker.tsx` | Create | Group selection dropdown |
| `src/types.ts` | Modify | Add `groupId` to `CommentItem`, group props to `ReactGrabRendererProps` |
| `src/utils/comment-storage.ts` | Modify | Default `groupId` on load |
| `src/components/comments-dropdown.tsx` | Modify | Grouped collapsibles + fuzzy search + inline delete confirm + "New group..." input |
| `src/components/renderer.tsx` | Modify | Pass group props to CommentsDropdown |
| `src/core/index.tsx` | Modify | Groups signal, handlers, wire to renderer |
