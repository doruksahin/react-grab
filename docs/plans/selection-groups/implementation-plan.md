# Selection Groups — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Group selections (comments) into named, collapsible groups with CRUD operations, a default group, and a group picker on comment creation.

**Architecture:** New `src/groups/` feature folder with `types.ts`, `store/`, `components/`, `business/`. `CommentItem` gains a `groupId` field referencing `SelectionGroup.id`. Groups persisted to sessionStorage alongside comments. Comments dropdown replaced with grouped collapsibles.

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
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/business/
git commit -m "feat(groups): add business logic for grouping, counting, cascade delete"
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

This is a SolidJS component that renders a single group section with a collapsible header and items list. It receives items and renders them in the same style as the current flat list in `comments-dropdown.tsx`.

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
}

export const GroupCollapsible: Component<GroupCollapsibleProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(true);

  return (
    <div>
      <button
        data-react-grab-ignore-events
        class={cn(
          "w-full flex items-center justify-between px-2 py-1.5 hover:bg-black/[0.03] cursor-pointer",
          !props.isFirst && "border-t border-[#D9D9D9]/50",
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div class="flex items-center gap-1.5">
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
              "text-black/30 transition-transform duration-150",
              !isOpen() && "-rotate-90",
            )}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <span class="text-[12px] font-semibold text-black/70">
            {props.group.name}
          </span>
        </div>
        <span class="text-[10px] font-medium text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {props.items.length}
        </span>
      </button>
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
git commit -m "feat(groups): add GroupCollapsible component for grouped comment display"
```

---

### Task 7: Create group picker component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-picker.tsx`

**Step 1: Create the component**

A dropdown that shows available groups with a checkmark on the active one. Includes "New group..." action at the bottom.

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

### Task 8: Create group manager component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-manager.tsx`

**Step 1: Create the component**

CRUD UI for groups: list all groups, rename (inline edit), delete with confirmation, create new. Default group shows "built-in" label and cannot be deleted.

```typescript
import { For, Show, createSignal } from "solid-js";
import type { Component } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../types.js";
import { isDefaultGroup, countByGroup } from "../business/group-operations.js";
import { cn } from "../../utils/cn.js";

interface GroupManagerProps {
  groups: SelectionGroup[];
  comments: CommentItem[];
  onRename: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export const GroupManager: Component<GroupManagerProps> = (props) => {
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = createSignal<string | null>(null);
  let renameInputRef: HTMLInputElement | undefined;
  let createInputRef: HTMLInputElement | undefined;

  const handleRename = (groupId: string) => {
    if (!renameInputRef || !renameInputRef.value.trim()) return;
    props.onRename(groupId, renameInputRef.value.trim());
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!createInputRef || !createInputRef.value.trim()) return;
    props.onCreate(createInputRef.value.trim());
    createInputRef.value = "";
  };

  const confirmDelete = () => {
    const id = pendingDeleteId();
    if (id) {
      props.onDelete(id);
      setPendingDeleteId(null);
    }
  };

  const pendingDeleteGroup = () =>
    props.groups.find((g) => g.id === pendingDeleteId());

  return (
    <div>
      <div class="flex items-center justify-between px-2 pt-1.5 pb-1">
        <span class="text-[11px] font-medium text-black/40">
          Manage Groups
        </span>
        <button
          data-react-grab-ignore-events
          class="text-black/30 hover:text-black/60 cursor-pointer"
          onClick={props.onClose}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Delete confirmation overlay */}
      <Show when={pendingDeleteGroup()}>
        {(group) => {
          const count = () => countByGroup(props.comments, group().id);
          return (
            <div class="border-t border-[#D9D9D9] px-3 pt-2.5 pb-2">
              <span class="text-[12px] font-semibold text-black">
                Delete "{group().name}"?
              </span>
              <Show when={count() > 0}>
                <p class="text-[11px] text-black/50 mt-1 leading-[14px]">
                  This will delete the group and all {count()} selection{count() !== 1 ? "s" : ""} in it.
                </p>
              </Show>
              <div class="flex items-center justify-end gap-1.5 mt-2">
                <button
                  data-react-grab-ignore-events
                  class="text-[11px] font-medium text-black/50 hover:text-black/70 cursor-pointer px-2 py-1 rounded hover:bg-black/[0.03]"
                  onClick={() => setPendingDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  data-react-grab-ignore-events
                  class="text-[11px] font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] cursor-pointer px-2 py-1 rounded"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        }}
      </Show>

      {/* Group list */}
      <Show when={!pendingDeleteId()}>
        <div class="border-t border-[#D9D9D9] py-1">
          <For each={props.groups}>
            {(group) => (
              <div class="group flex items-center justify-between px-2 py-1 hover:bg-black/[0.03]">
                <Show
                  when={editingId() === group.id}
                  fallback={
                    <div class="flex items-center gap-2">
                      <span
                        class={cn(
                          "text-[12px]",
                          isDefaultGroup(group.id)
                            ? "font-medium text-black"
                            : "text-black/70",
                        )}
                      >
                        {group.name}
                      </span>
                      <span class="text-[10px] text-black/30 bg-black/[0.05] rounded-full px-1.5 py-0.5">
                        {countByGroup(props.comments, group.id)}
                      </span>
                    </div>
                  }
                >
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={group.name}
                    class="flex-1 text-[12px] bg-transparent outline-none text-black border-b border-black/20 py-0.5"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(group.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onFocusOut={() => setEditingId(null)}
                  />
                </Show>

                <Show
                  when={isDefaultGroup(group.id)}
                  fallback={
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        data-react-grab-ignore-events
                        class="text-black/30 hover:text-black/60 cursor-pointer p-0.5"
                        onClick={() => {
                          setEditingId(group.id);
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
                        onClick={() => setPendingDeleteId(group.id)}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  }
                >
                  <span class="text-[10px] text-black/20 italic">built-in</span>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* New group input */}
        <div class="border-t border-[#D9D9D9] px-2 py-1.5">
          <div class="flex items-center gap-1.5">
            <input
              ref={createInputRef}
              type="text"
              placeholder="New group name..."
              class="flex-1 text-[12px] bg-transparent outline-none placeholder:text-black/25 text-black"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
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
        </div>
      </Show>
    </div>
  );
};
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/components/group-manager.tsx
git commit -m "feat(groups): add GroupManager CRUD component with delete confirmation"
```

---

### Task 9: Replace flat comments dropdown with grouped view

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

This is the biggest UI change. The flat `<For each={props.items}>` becomes grouped collapsibles.

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

**Step 2: Add group manager toggle state**

Inside the component, add:

```typescript
const [showManager, setShowManager] = createSignal(false);
```

**Step 3: Add manage groups button to the header**

In the header area (after the Copy button, line ~258), add:

```tsx
<button
  data-react-grab-ignore-events
  class="shrink-0 flex items-center justify-center px-[3px] py-px rounded-sm bg-white [border-width:0.5px] border-solid border-[#B3B3B3] cursor-pointer transition-all hover:bg-[#F5F5F5] press-scale h-[17px]"
  onClick={(event) => {
    event.stopPropagation();
    setShowManager((prev) => !prev);
  }}
>
  {/* Gear/settings icon SVG */}
</button>
```

**Step 4: Replace flat list body**

Replace the flat `<For each={props.items}>` block (lines ~279-334) with:

```tsx
<Show
  when={!showManager()}
  fallback={
    <GroupManager
      groups={props.groups}
      comments={props.items}
      onRename={props.onRenameGroup}
      onDelete={props.onDeleteGroup}
      onCreate={props.onAddGroup}
      onClose={() => setShowManager(false)}
    />
  }
>
  <For each={groupedItems()}>
    {(entry, index) => (
      <GroupCollapsible
        group={entry.group}
        items={entry.items}
        isFirst={index() === 0}
        renderItem={(item) => (
          {/* existing item render JSX from the current flat list */}
        )}
      />
    )}
  </For>
</Show>
```

Where `groupedItems` is a memo:

```typescript
import { groupComments } from "../groups/business/group-operations.js";

const groupedItems = createMemo(() =>
  groupComments(props.groups, props.items),
);
```

**Step 5: Move the existing per-item render JSX**

Extract the existing item render (lines 281-333) into the `renderItem` callback. Keep all existing event handlers, hover tracking, and highlight behavior intact.

**Step 6: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: May have errors where `CommentsDropdown` is used (needs new props). Fixed in Task 10.

**Step 7: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(groups): replace flat comments list with grouped collapsibles and manager"
```

---

### Task 10: Wire everything through renderer

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

### Task 11: Build, link, and verify in AdCreative

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
- Default group exists and is used for new selections
- Group picker appears (or active group is used) when creating comments
- Groups can be created, renamed, deleted via the manager
- Deleting a group with selections shows confirmation and removes all its selections
- Counts update reactively when adding/removing selections
- Groups persist across page reloads (sessionStorage)

**Step 3: Fix any issues found**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/groups/types.ts` | Create | `SelectionGroup`, `DEFAULT_GROUP_ID`, `createDefaultGroup` |
| `src/groups/store/group-storage.ts` | Create | sessionStorage CRUD for groups |
| `src/groups/store/index.ts` | Create | Re-export |
| `src/groups/business/group-operations.ts` | Create | `groupComments`, `countByGroup`, `removeCommentsByGroup` |
| `src/groups/components/group-collapsible.tsx` | Create | Collapsible group section |
| `src/groups/components/group-picker.tsx` | Create | Group selection dropdown |
| `src/groups/components/group-manager.tsx` | Create | CRUD UI with delete confirmation |
| `src/types.ts` | Modify | Add `groupId` to `CommentItem`, group props to `ReactGrabRendererProps` |
| `src/utils/comment-storage.ts` | Modify | Default `groupId` on load |
| `src/components/comments-dropdown.tsx` | Modify | Replace flat list with grouped collapsibles + manager toggle |
| `src/components/renderer.tsx` | Modify | Pass group props to CommentsDropdown |
| `src/core/index.tsx` | Modify | Groups signal, handlers, wire to renderer |
