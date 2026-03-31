# Tech Debt: Make Default Group Virtual (Optional `groupId`)

**Status:** Proposed
**Priority:** Low — current signal-level guarantee works, this is an architectural improvement
**Area:** `packages/react-grab/src/features/selection-groups/`

## Current State

Every `CommentItem` has a required `groupId: string`. A default group with `id: "default"` must always exist so items are never orphaned. The invariant is enforced at the signal level in `createSelectionGroups()` — the `groups()` accessor prepends the default group if it's missing from the raw data.

This works, but the default group is conceptually different from user-created groups: it can't be renamed, can't be deleted, and is auto-created if missing. It's a **system invariant disguised as data**.

## Proposed Change

Make `groupId` optional on `CommentItem`. `null` (or `undefined`) means "ungrouped." The default group becomes a **virtual rendering concept** — never stored, never synced, never loaded.

### Schema Change

```typescript
interface CommentItem {
  groupId: string | null; // null = ungrouped (renders under "Default")
  // ...rest unchanged
}
```

### Core Logic Change

```typescript
const VIRTUAL_DEFAULT: SelectionGroup = {
  id: "__ungrouped__",
  name: "Default",
  createdAt: 0,
  revealed: false,
};

const groupComments = (groups: SelectionGroup[], comments: CommentItem[]) => [
  { group: VIRTUAL_DEFAULT, items: comments.filter((c) => c.groupId === null) },
  ...groups.map((g) => ({
    group: g,
    items: comments.filter((c) => c.groupId === g.id),
  })),
];
```

### What Gets Removed

- `DEFAULT_GROUP_ID` constant
- `createDefaultGroup()` factory
- `ensureDefaultGroup` logic in the signal accessor
- `isDefaultGroup()` check (becomes `groupId === null`)
- "Can't rename/delete default" guards in `renameGroup` / `removeGroup`

### Migration

Existing items with `groupId: "default"` need migration to `groupId: null`:
- localStorage: migrate on load (one-time)
- Server: migrate stored workspace data or handle `"default"` as alias for `null`

### Why This Is Better

1. **No invariant to enforce** — there's nothing to "go missing"
2. **No special-case guards** — every stored group plays by the same rules
3. **Cleaner sync** — server can return `[]` groups without issues
4. **Conceptual clarity** — ungrouped items are ungrouped, not "in a group called Default"

### Why It's Not Urgent

The signal-level guarantee is a single line of code, easy to maintain, and has no edge cases. This refactor is about architectural purity, not fixing bugs.
