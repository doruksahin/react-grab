# Optional Group Membership for Selections — Design

Date: 2026-04-08
Status: Approved, ready for implementation plan

## Intent

A selection's group membership is optional and expressed by `groupId: string | null` on the selection itself. `null` means *intentionally ungrouped* — not "missing", not "default", not "unknown". There is no sentinel group, no `DEFAULT_GROUP_ID`, no implicit bucket. The `groups` collection represents *user-created groups only*.

`data-react-grab-group-list` must surface both ungrouped selections and user groups, queryable from a single container.

## SSOT

- **Selection owns membership.** `selection.groupId: string | null` is the only place membership is stored.
- **Groups own nothing about selections.** `SelectionGroup` has no item list.
- **One predicate file** (`business/membership.ts`) owns the ungrouped rule. No inlined `=== null` elsewhere.
- **One writer** (`business/selection-assignment.ts`) mutates `selection.groupId`. All move/assign/unassign flows route through it.

## Folder Structure

```
features/selection-groups/
  types.ts                            # SelectionGroup; DEFAULT_GROUP_ID removed
  business/
    membership.ts              [NEW]  # isUngrouped, belongsTo predicates
    group-operations.ts               # group CRUD only
    selection-assignment.ts    [NEW]  # sole writer of selection.groupId
  store/
    group-storage.ts                  # persists groups[] only (no "default")
  components/
    group-picker-flyout.tsx           # adds "Ungrouped" option (null)
    group-collapsible.tsx             # unchanged
    ungrouped-section.tsx      [NEW]  # renders flat list of ungrouped selections
  index.ts

components/sidebar/
  group-list.tsx                      # composes <UngroupedSection/> + groups.map(<GroupCollapsible/>)
```

### SRP boundaries

| File | Single responsibility |
|---|---|
| `membership.ts` | The predicate for ungrouped / belongs-to |
| `group-operations.ts` | CRUD on groups (no selection knowledge) |
| `selection-assignment.ts` | Mutate `selection.groupId` (sole writer) |
| `group-storage.ts` | Persist `groups[]` |
| `group-list.tsx` | Compose ungrouped section + group cards under one container |
| `ungrouped-section.tsx` | Render ungrouped selections as a flat section |
| `group-collapsible.tsx` | Render one user group |

## Data Flow

```
core/index.tsx
  ├── selections (SSOT for groupId: string | null)
  └── groups      (SSOT for user groups, never contains "default")
        │
        ▼
  group-list.tsx  (data-react-grab-group-list)
     ├── ungroupedSelections = selections.filter(isUngrouped)
     │       → <UngroupedSection selections={...}/>
     └── groups.map(g =>
            <GroupCollapsible
              group={g}
              selections={selections.filter(s => belongsTo(s, g.id))}
            />)
```

## Behavior

- **New selection** defaults to `groupId: null` (ungrouped).
- **Move to group:** `handleMoveItem(itemId, groupId)` with `groupId: string | null`. `null` unassigns.
- **Delete group:** demotes its selections to `groupId = null` (no data loss, no blocking dialog).
- **Picker flyout:** top row "Ungrouped" → `onMoveItem(id, null)`.
- **`data-react-grab-group-list`:** single container; ungrouped section rendered inside it, above the user groups.

## Migration

One-shot, idempotent, on hydration:

1. Any selection with `groupId === "default"` → `groupId = null`.
2. Drop the `"default"` entry from persisted `groups[]`.
3. No version bump.

## Tests

- `membership.test.ts` — `isUngrouped`, `belongsTo`.
- `selection-assignment.test.ts` — assign, reassign, unassign, delete-group cascade to `null`.
- `group-list.test.tsx` — `data-react-grab-group-list` contains ungrouped section and group cards; ungrouped items are discoverable from the same container.
- Migration test — legacy `"default"` → `null`; stale `"default"` group entry dropped.

## Out of Scope

- Auto-assigning new selections to the currently-active sidebar group.
- Drag-and-drop between ungrouped section and groups.
- Server-side schema changes (handled when sync adapter is touched).
