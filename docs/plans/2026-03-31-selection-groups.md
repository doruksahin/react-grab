# Selection Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Group selections (comments) into named, collapsible groups with inline CRUD, fuzzy search, a default group, and a group picker on comment creation.

**Architecture:** New `src/groups/` feature folder with `types.ts`, `store/`, `components/`, `business/`. `CommentItem` gains a `groupId` field referencing `SelectionGroup.id`. Groups persisted to sessionStorage. Comments dropdown replaced with grouped collapsibles — group management (rename, delete, create) and fuzzy search are inline within the dropdown.

**Tech Stack:** SolidJS (signals, createMemo, createStore, For, Show), Tailwind CSS, sessionStorage, Playwright (e2e)

---

## Codebase Orientation

Read these files before starting any task:

| Concept | File | What to look for |
|---------|------|-----------------|
| Comment type | `packages/react-grab/src/types.ts:439-450` | `CommentItem` interface |
| Comment storage | `packages/react-grab/src/utils/comment-storage.ts` | sessionStorage CRUD pattern |
| Comments signal | `packages/react-grab/src/core/index.tsx:322-323` | `commentItems` signal |
| Comment creation | `packages/react-grab/src/core/index.tsx:878-891` | `addCommentItem` call in copy flow |
| Comments dropdown | `packages/react-grab/src/components/comments-dropdown.tsx` | Flat `<For each={items}>` list |
| Dropdown props | `packages/react-grab/src/components/comments-dropdown.tsx:39-50` | `CommentsDropdownProps` |
| Icon pattern | `packages/react-grab/src/components/icons/icon-select.tsx` | `Component<{ size?, class? }>` |
| E2e test pattern | `packages/react-grab/e2e/history-items.spec.ts` | Playwright fixture pattern |
| UI reference | `docs/plans/selection-groups/poc.html` | Approved UI mockup |
| Architecture | `docs/plans/selection-groups/architecture.md` | Design decisions and data flow |

---

### Task 1: Define group types and constants

**Files:**
- Create: `packages/react-grab/src/groups/types.ts`

**Step 1: Write the types file**

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

**Step 2: Run typecheck to verify**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/types.ts
git commit -m "feat(groups): define SelectionGroup type and default group constant"
```

---

### Task 2: Add `groupId` to `CommentItem`

**Files:**
- Modify: `packages/react-grab/src/types.ts:439-450`
- Modify: `packages/react-grab/src/utils/comment-storage.ts:25-39`

**Step 1: Add `groupId` field to `CommentItem` interface**

In `packages/react-grab/src/types.ts`, modify:

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
}
```

**Step 2: Run typecheck to see where `groupId` is missing**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: FAIL — multiple errors where `CommentItem` is constructed without `groupId`

**Step 3: Default `groupId` in `loadFromSessionStorage`**

In `packages/react-grab/src/utils/comment-storage.ts`, add import and update the `.map` callback:

```typescript
import { DEFAULT_GROUP_ID } from "../groups/types.js";
```

In the `loadFromSessionStorage` return, add to the `.map` callback:

```typescript
groupId: typeof commentItem.groupId === "string" ? commentItem.groupId : DEFAULT_GROUP_ID,
```

**Step 4: Run typecheck again**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: FAIL — still errors where `addCommentItem` is called without `groupId`. These are fixed in Task 5.

**Step 5: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(types): add groupId to CommentItem with default fallback on load"
```

---

### Task 3: Create group storage

**Files:**
- Create: `packages/react-grab/src/groups/store/group-storage.ts`
- Create: `packages/react-grab/src/groups/store/index.ts`

**Step 1: Write `group-storage.ts`**

Follow the exact pattern from `packages/react-grab/src/utils/comment-storage.ts`: module-level mutable array, sessionStorage persistence, exported CRUD functions.

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

**Step 2: Write `store/index.ts`**

```typescript
export {
  loadGroups,
  addGroup,
  renameGroup,
  removeGroup,
} from "./group-storage.js";
```

**Step 3: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/groups/store/
git commit -m "feat(groups): add group storage with sessionStorage persistence"
```

---

### Task 4: Create group business logic with fuzzy search

**Files:**
- Create: `packages/react-grab/src/groups/business/group-operations.ts`
- Create: `packages/react-grab/src/groups/business/group-operations.test.ts`

**Step 1: Write the failing test for `fuzzyMatchGroup`**

```typescript
// packages/react-grab/src/groups/business/group-operations.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fuzzyMatchGroup, groupComments, countByGroup, removeCommentsByGroup, isDefaultGroup } from "./group-operations.js";

describe("fuzzyMatchGroup", () => {
  it("matches empty query to everything", () => {
    assert.equal(fuzzyMatchGroup("Header Redesign", ""), true);
  });

  it("matches exact substring", () => {
    assert.equal(fuzzyMatchGroup("Header Redesign", "header"), true);
  });

  it("matches fuzzy characters in order", () => {
    assert.equal(fuzzyMatchGroup("Header Redesign", "hdrdn"), true);
  });

  it("rejects characters out of order", () => {
    assert.equal(fuzzyMatchGroup("Header Redesign", "ngised"), false);
  });

  it("is case-insensitive", () => {
    assert.equal(fuzzyMatchGroup("Footer Audit", "FOOTER"), true);
  });
});

describe("isDefaultGroup", () => {
  it("returns true for default id", () => {
    assert.equal(isDefaultGroup("default"), true);
  });

  it("returns false for other ids", () => {
    assert.equal(isDefaultGroup("group-123"), false);
  });
});

describe("countByGroup", () => {
  const comments = [
    { id: "1", groupId: "a" },
    { id: "2", groupId: "a" },
    { id: "3", groupId: "b" },
  ] as any[];

  it("counts items in a group", () => {
    assert.equal(countByGroup(comments, "a"), 2);
  });

  it("returns 0 for empty group", () => {
    assert.equal(countByGroup(comments, "c"), 0);
  });
});

describe("removeCommentsByGroup", () => {
  const comments = [
    { id: "1", groupId: "a" },
    { id: "2", groupId: "b" },
    { id: "3", groupId: "a" },
  ] as any[];

  it("removes all comments in the specified group", () => {
    const result = removeCommentsByGroup(comments, "a");
    assert.equal(result.length, 1);
    assert.equal(result[0].groupId, "b");
  });
});

describe("groupComments", () => {
  const groups = [
    { id: "a", name: "Group A", createdAt: 0 },
    { id: "b", name: "Group B", createdAt: 1 },
  ];
  const comments = [
    { id: "1", groupId: "a" },
    { id: "2", groupId: "b" },
    { id: "3", groupId: "a" },
  ] as any[];

  it("groups comments by their groupId", () => {
    const result = groupComments(groups, comments);
    assert.equal(result.length, 2);
    assert.equal(result[0].group.id, "a");
    assert.equal(result[0].items.length, 2);
    assert.equal(result[1].group.id, "b");
    assert.equal(result[1].items.length, 1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/react-grab && npx tsx --test src/groups/business/group-operations.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// packages/react-grab/src/groups/business/group-operations.ts
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

**Step 4: Run tests to verify they pass**

Run: `cd packages/react-grab && npx tsx --test src/groups/business/group-operations.test.ts`
Expected: PASS — all tests green

**Step 5: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/react-grab/src/groups/business/
git commit -m "feat(groups): add business logic with fuzzy search, grouping, cascade delete"
```

---

### Task 5: Wire groups into core orchestrator

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`
- Modify: `packages/react-grab/src/types.ts`
- Modify: `packages/react-grab/src/utils/comment-storage.ts`

**Step 1: Add group props to `ReactGrabRendererProps`**

In `packages/react-grab/src/types.ts`, find `ReactGrabRendererProps` and add:

```typescript
import type { SelectionGroup } from "../groups/types.js";

// Add to ReactGrabRendererProps:
groups: SelectionGroup[];
activeGroupId: string;
onAddGroup: (name: string) => void;
onRenameGroup: (groupId: string, name: string) => void;
onDeleteGroup: (groupId: string) => void;
onActiveGroupChange: (groupId: string) => void;
```

**Step 2: Add imports to `core/index.tsx`**

```typescript
import { loadGroups, addGroup as addGroupToStorage, renameGroup as renameGroupInStorage, removeGroup as removeGroupFromStorage } from "../groups/store/index.js";
import { removeCommentsByGroup } from "../groups/business/group-operations.js";
import { DEFAULT_GROUP_ID } from "../groups/types.js";
import type { SelectionGroup } from "../groups/types.js";
```

**Step 3: Add groups signal near `commentItems` signal (line ~322)**

```typescript
const [groups, setGroups] = createSignal<SelectionGroup[]>(loadGroups());
const [activeGroupId, setActiveGroupId] = createSignal<string>(DEFAULT_GROUP_ID);
```

**Step 4: Add group action handlers**

```typescript
const handleAddGroup = (name: string) => {
  setGroups(addGroupToStorage(name));
};

const handleRenameGroup = (groupId: string, name: string) => {
  setGroups(renameGroupInStorage(groupId, name));
};

const handleDeleteGroup = (groupId: string) => {
  const remainingComments = removeCommentsByGroup(commentItems(), groupId);
  persistCommentItems(remainingComments);
  setCommentItems(remainingComments);
  setGroups(removeGroupFromStorage(groupId));
};
```

Note: Check if `persistCommentItems` is exported from `comment-storage.ts`. If not, export it.

**Step 5: Update `addCommentItem` call (line ~878)**

Add `groupId: activeGroupId()` to the comment creation:

```typescript
const updatedCommentItems = addCommentItem({
  groupId: activeGroupId(),
  content,
  elementName: elementName ?? "element",
  // ... rest unchanged
});
```

**Step 6: Pass group props to `<ReactGrabRenderer>` (line ~4082)**

```tsx
groups={groups()}
activeGroupId={activeGroupId()}
onAddGroup={handleAddGroup}
onRenameGroup={handleRenameGroup}
onDeleteGroup={handleDeleteGroup}
onActiveGroupChange={setActiveGroupId}
```

**Step 7: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: FAIL — renderer and dropdown components don't accept the new props yet. Fixed in Tasks 8-9.

**Step 8: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/types.ts packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(core): wire group signals, handlers, and activeGroupId into orchestrator"
```

---

### Task 6: Create GroupCollapsible component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-collapsible.tsx`

**Step 1: Write the component**

A SolidJS component rendering one group section: collapsible header with chevron + group name + inline rename/delete hover actions (non-default groups only) + count badge. Body contains items via `renderItem` callback.

Reference the approved PoC: `docs/plans/selection-groups/poc.html` — hover the "Header Redesign" or "Footer Audit" group headers to see the rename (pencil) and delete (trash) icons.

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
          <Show when={!isDefaultGroup(props.group.id)}>
            <div class="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
              <button
                data-react-grab-ignore-events
                class="text-black/30 hover:text-black/60 cursor-pointer p-0.5"
                onClick={startRename}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
              </button>
              <button
                data-react-grab-ignore-events
                class="text-[#B91C1C]/50 hover:text-[#B91C1C] cursor-pointer p-0.5"
                onClick={handleDeleteClick}
              >
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

**Step 2: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/groups/components/group-collapsible.tsx
git commit -m "feat(groups): add GroupCollapsible with inline rename/delete hover actions"
```

---

### Task 7: Create GroupPicker component

**Files:**
- Create: `packages/react-grab/src/groups/components/group-picker.tsx`

**Step 1: Write the component**

Dropdown showing available groups with checkmark on active group, plus "New group..." inline creation at the bottom. Reference the approved PoC: `docs/plans/selection-groups/poc.html` — the "Group Picker" panel.

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
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/40"><path d="M12 5v14m-7-7h14" /></svg>
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

**Step 2: Run typecheck**

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

This is the biggest UI change. Reference `docs/plans/selection-groups/poc.html` for the approved layout.

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

**Step 2: Add imports and state**

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

After the header `<div>` (with "Comments" label + clear/copy buttons), before the grouped list `<div>`:

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

**Step 4: Replace flat list with grouped collapsibles + delete confirmation + no-results state**

Replace the `<For each={props.items}>` block with:

```tsx
<Show
  when={!pendingDeleteGroupId()}
  fallback={
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

**Step 5: Add "New group..." input at bottom of dropdown**

After the scrollable grouped list area, before the panel's closing `</div>`:

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

**Step 6: Move existing per-item render JSX into renderItem callback**

Extract the existing item render (lines 281-333 of the original) into the `renderItem` callback. Keep all event handlers, hover tracking, and highlight behavior intact.

**Step 7: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: FAIL — renderer doesn't pass the new props yet. Fixed in Task 9.

**Step 8: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(groups): replace flat comments with grouped collapsibles, fuzzy search, inline CRUD"
```

---

### Task 9: Wire group props through renderer

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Pass group props to `<CommentsDropdown>`**

Find where `<CommentsDropdown>` is rendered in `renderer.tsx` and add:

```tsx
groups={props.groups}
activeGroupId={props.activeGroupId}
onAddGroup={props.onAddGroup}
onRenameGroup={props.onRenameGroup}
onDeleteGroup={props.onDeleteGroup}
onActiveGroupChange={props.onActiveGroupChange}
```

**Step 2: Run typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS — full prop chain complete

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(groups): wire group props through renderer to comments dropdown"
```

---

### Task 10: Build, link, and verify in AdCreative

**Step 1: Build react-grab**

Run: `cd /Users/doruk/Desktop/ADCREATIVE/react-grab && pnpm build`
Expected: Build succeeds

**Step 2: Run unit tests**

Run: `cd packages/react-grab && npx tsx --test src/groups/business/group-operations.test.ts`
Expected: All tests pass

**Step 3: Start dev server and verify**

Run: `cd /Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2 && pnpm dev`

Verify each of these:
- [ ] Comments dropdown shows grouped view with collapsible sections
- [ ] Search bar filters groups by fuzzy match
- [ ] "No matching groups" shows when search has no results
- [ ] Default group exists and receives new selections
- [ ] Hover non-default group headers → rename (pencil) + delete (trash) appear
- [ ] Rename: click pencil → inline input → Enter commits, Escape cancels
- [ ] Delete: click trash → inline confirmation with selection count → "Delete" removes group + all its selections
- [ ] "New group..." input at bottom creates a new group
- [ ] Counts in badges update reactively
- [ ] Groups persist across page reloads (sessionStorage)

**Step 4: Fix any issues found, commit**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/groups/types.ts` | Create | `SelectionGroup`, `DEFAULT_GROUP_ID`, `createDefaultGroup` |
| `src/groups/store/group-storage.ts` | Create | sessionStorage CRUD for groups |
| `src/groups/store/index.ts` | Create | Re-export |
| `src/groups/business/group-operations.ts` | Create | `groupComments`, `countByGroup`, `removeCommentsByGroup`, `fuzzyMatchGroup` |
| `src/groups/business/group-operations.test.ts` | Create | Unit tests for all business logic |
| `src/groups/components/group-collapsible.tsx` | Create | Collapsible group section with inline rename/delete |
| `src/groups/components/group-picker.tsx` | Create | Group selection dropdown |
| `src/types.ts` | Modify | Add `groupId` to `CommentItem`, group props to `ReactGrabRendererProps` |
| `src/utils/comment-storage.ts` | Modify | Default `groupId` on load, export `persistCommentItems` |
| `src/components/comments-dropdown.tsx` | Modify | Grouped collapsibles + fuzzy search + inline delete confirm + "New group..." input |
| `src/components/renderer.tsx` | Modify | Pass group props to CommentsDropdown |
| `src/core/index.tsx` | Modify | Groups signal, handlers, wire to renderer |
