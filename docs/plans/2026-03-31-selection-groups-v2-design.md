# Selection Groups v2 + Reveal/Hide Integration — Design

## Problem

Selection groups (v1 plan) used `src/groups/` folder convention and had no visibility integration. The reveal/hide feature now uses `src/features/selection-visibility/` with a factory+DI pattern. Groups need to follow the same convention and compose with visibility.

## Architecture

Two composable feature modules:

```
src/features/
├── selection-groups/              ← Pure data management
│   ├── types.ts                   ← SelectionGroup { id, name, createdAt, revealed }
│   ├── index.ts                   ← createSelectionGroups(deps) factory
│   ├── store/
│   │   ├── group-storage.ts       ← sessionStorage CRUD
│   │   └── index.ts
│   ├── components/
│   │   ├── group-collapsible.tsx   ← collapsible section + group eye toggle
│   │   └── group-picker.tsx        ← group selection on comment creation
│   └── business/
│       └── group-operations.ts    ← grouping, cascade delete, fuzzy search
│
└── selection-visibility/          ← Pure reveal/hide behavior (extended)
    ├── types.ts                   ← gains groups deps
    └── index.ts                   ← gains handleToggleGroup()
```

**Composition in core/index.tsx:**

```typescript
const groups = createSelectionGroups({ commentItems, setCommentItems, ... });
const visibility = createSelectionVisibility({
  commentItems, disconnectedItemIds,
  groups: groups.groups,
  setGroups: groups.setGroups,
  persistGroups: groups.persistGroups,
  ...
});
```

Groups module knows nothing about visibility. Visibility module knows about groups (accepts groups accessor for cascade).

## Data Model

```
Parent toggle (localStorage, ToolbarState.selectionsRevealed)
  │ overrides ↓
Group toggle (sessionStorage, SelectionGroup.revealed)
  │ overrides ↓
Item toggle (sessionStorage, CommentItem.revealed)
```

```typescript
// src/features/selection-groups/types.ts
interface SelectionGroup {
  id: string;
  name: string;
  createdAt: number;
  revealed: boolean;
}

// src/types.ts (SSOT, existing)
interface CommentItem {
  ...
  groupId: string;
  revealed: boolean;     // already exists
}

interface ToolbarState {
  ...
  selectionsRevealed: boolean;  // already exists
}
```

## Module APIs

### selection-groups (pure data)

```typescript
createSelectionGroups(deps) → {
  groups: Accessor<SelectionGroup[]>,
  setGroups: Setter<SelectionGroup[]>,
  persistGroups: (groups: SelectionGroup[]) => SelectionGroup[],
  activeGroupId: Accessor<string>,
  setActiveGroupId: Setter<string>,
  handleAddGroup: (name: string) => void,
  handleRenameGroup: (groupId: string, name: string) => void,
  handleDeleteGroup: (groupId: string) => void,
}
```

### selection-visibility (extended)

```typescript
createSelectionVisibility(deps) → {
  selectionsRevealed: Accessor<boolean>,
  isItemRevealed: (commentItemId: string) => boolean,
  handleToggleParent: () => void,       // cascades → groups → items
  handleToggleGroup: (groupId: string) => void,  // NEW, cascades → items
  handleToggleItem: (commentItemId: string) => void,
}
```

## Toggle Cascade (override at every level)

```
handleToggleParent()
  → flip ToolbarState.selectionsRevealed
  → set ALL SelectionGroup.revealed = newValue
  → set ALL CommentItem.revealed = newValue

handleToggleGroup(groupId)
  → flip that SelectionGroup.revealed
  → set all CommentItem where groupId matches = newValue

handleToggleItem(commentItemId)
  → flip that CommentItem.revealed
```

## Storage

| Data | Storage | Reason |
|------|---------|--------|
| `selectionsRevealed` | localStorage (ToolbarState) | User preference, persists across sessions |
| `SelectionGroup[]` | sessionStorage | Session-scoped, tied to DOM selectors |
| `CommentItem[]` | sessionStorage | Session-scoped, tied to DOM selectors |

## UI

- **Toolbar eye button** → `handleToggleParent` (already exists)
- **Group header eye button** → `handleToggleGroup` (new, in GroupCollapsible)
- **Per-item eye button** → `handleToggleItem` (already exists in CommentsDropdown)

## What Doesn't Change

- `showRevealedPreviews` — reads `item.revealed` + `disconnectedItemIds` only
- `domMutationVersion` → `commentsDisconnectedItemIds` pipeline
- `addCommentItemPreview` with tracking array
- Types in `types.ts` (SSOT) — only `groupId` added to `CommentItem`

## Non-Goals

- No drag-and-drop group reordering
- No group colors/icons
- No multi-group membership
- No master-gate toggle behavior (override only, per memory/project_reveal_toggle_hierarchy.md)
