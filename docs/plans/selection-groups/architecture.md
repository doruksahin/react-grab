# Selection Groups — Architecture

## Problem

Selections (comments/grabbed elements) are currently a flat list. Users need to organize them into named groups for better context management — e.g., grouping related UI elements before sending to an agent.

## Current State

```
CommentItem[] ← flat array in sessionStorage
  │
  ├── comment-storage.ts    CRUD (addCommentItem, removeCommentItem, loadComments, clearComments)
  ├── core/index.tsx         signal: commentItems, uses addCommentItem on copy
  └── comments-dropdown.tsx  flat <For each={items}> list
```

**Key types:**
- `CommentItem` — id, content, elementName, tagName, componentName, timestamp, commentText, etc.
- Comments stored in `sessionStorage` via `comment-storage.ts`
- `commentItems` signal in `core/index.tsx` drives the UI

## Proposed State

```
SelectionGroup { id, name, createdAt }
CommentItem    { ..., groupId }         ← references SelectionGroup.id

groups/
├── types.ts              ← SelectionGroup, GroupedCommentItems
├── store/
│   ├── group-storage.ts  ← CRUD for groups (sessionStorage, same pattern as comment-storage)
│   └── index.ts          ← re-export
├── components/
│   ├── group-collapsible.tsx    ← single group section with header + items
│   ├── group-picker.tsx         ← dropdown to select group when creating/editing comment
│   └── group-manager.tsx        ← CRUD UI for groups (create, rename, delete)
└── business/
    └── group-operations.ts      ← cascade delete, move between groups, default group logic
```

## Data Flow

```
                    SelectionGroup[]
                         │
   ┌─────────────────────┼─────────────────────┐
   │                     │                      │
group-storage.ts    core/index.tsx         comments-dropdown.tsx
(persist)           (signal: groups)       (grouped view)
                         │
                    CommentItem.groupId ← references group
```

## Key Design Decisions

1. **`groupId` on `CommentItem`** — SSOT. Each comment belongs to exactly one group. No separate mapping table.

2. **Default group** — Created on init with `id: "default"`, `name: "Default"`. Cannot be deleted. New comments go here unless user picks another group.

3. **Feature folder** — `src/groups/` with `types.ts`, `store/`, `components/`, `business/`. Extends existing patterns, doesn't modify `store.ts`.

4. **Group storage** — Same pattern as `comment-storage.ts`: sessionStorage, same size limits, same error handling. Separate key.

5. **Cascade delete** — Deleting a group deletes all its comments. No orphans. No "move to default" fallback. Explicit destructive action with confirmation.

6. **Comments dropdown becomes grouped** — `<For each={groups}>` wrapping `<For each={groupItems}>` with collapsible sections. Header shows group name + count.

7. **Group picker** — Shown when creating a new comment (during copy flow). Simple dropdown, not a modal. Uses existing dropdown positioning utils.

## Affected Files

### New files (in `src/groups/`)

| File | Purpose |
|------|---------|
| `types.ts` | `SelectionGroup` interface, `DEFAULT_GROUP_ID` constant |
| `store/group-storage.ts` | sessionStorage CRUD for groups |
| `store/index.ts` | Re-export |
| `components/group-collapsible.tsx` | Collapsible group section |
| `components/group-picker.tsx` | Group selection dropdown |
| `components/group-manager.tsx` | Create/rename/delete groups UI |
| `business/group-operations.ts` | Cascade delete, default group init |

### Modified files

| File | Change |
|------|--------|
| `types.ts` | Add `groupId: string` to `CommentItem` |
| `utils/comment-storage.ts` | Default `groupId` to `DEFAULT_GROUP_ID` on load, pass through on add |
| `components/comments-dropdown.tsx` | Replace flat list with grouped collapsibles |
| `core/index.tsx` | Add `groups` signal, wire group picker into copy flow, pass groups to renderer |

## Non-Goals

- No drag-and-drop reordering of groups
- No group colors/icons
- No multi-group selection (a comment belongs to exactly one group)
- No group export/import
