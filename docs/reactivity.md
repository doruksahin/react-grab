# Reactivity: Props as Reactive Source

Focused reference for the sidebar/core data flow pattern. See also: `solidjs-reactivity-patterns.md`.

---

## The Pattern

**Core owns all state. Components read props directly. Mutations go up.**

```
core/index.tsx
  └─ selectionGroups.groups()          ← single source of truth
       │
       └─ ReactGrabRenderer (props)
            └─ Sidebar (props.groups)  ← reads directly, no local copy
```

---

## Why `props.groups` is Already Reactive

In SolidJS, props are not plain values — they are **lazy getters** backed by the parent's signals. Reading `props.groups` inside any reactive context (JSX, `createMemo`, `createEffect`) automatically tracks the parent signal and re-runs when it changes.

```tsx
// ✅ Idiomatic — tracks selectionGroups.groups() automatically
const groupedItems = createMemo(() => groupComments(props.groups, props.commentItems));

// ❌ Workaround — manual sync, one tick late, double render
const [groups, setGroups] = createSignal(props.groups);
createEffect(() => { setGroups(props.groups); }); // fights the reactive graph
const groupedItems = createMemo(() => groupComments(groups(), props.commentItems));
```

The workaround is the React `useState` mental model applied to SolidJS. It causes:
- **Double render**: parent updates → sidebar re-renders with new props → effect fires → `setGroups` → sidebar re-renders again
- **One-tick stale**: the effect runs *after* render, so there's a frame where the local signal has old data
- **Unnecessary complexity**: you're rewiring reactivity that SolidJS gives for free

---

## Why the Loop Requires `untrack`

The filter effect calls `onFilterVisibilityChange` → `setGroupsRevealed` → `persistGroups` → core groups signal updates → `props.groups` changes.

If the filter effect tracked `props.groups`, it would re-run on every `persistGroups` call — including the ones it just triggered:

```
filter effect → setGroupsRevealed → persistGroups → props.groups changes → filter effect → ∞
```

`untrack` breaks the cycle by reading `props.groups` without registering it as a dependency. The filter effect only re-runs when the user changes `filterState`:

```tsx
createEffect(() => {
  const filter = filterState();                      // tracked — re-runs on filter change
  const allGroups = untrack(() => props.groups);     // NOT tracked — read without subscribing
  props.onFilterVisibilityChange?.(visibleIds, allIds);
});
```

**Rule:** Use `untrack` when you need a value *at the time the effect runs* but don't want that value to *trigger* the effect.

Ref: [SolidJS `untrack`](https://docs.solidjs.com/reference/reactive-utilities/untrack)

---

## Why Mutations Go Up to Core

The sidebar had one legitimate reason for a local signal: `handleTicketCreated` needed to optimistically write `jiraTicketId`/`jiraUrl` before the next poll. That write was local — it never reached core's groups.

The fix is to lift the mutation:

```tsx
// core/index.tsx — owns the write
onTicketCreated={(groupId, ticketId, ticketUrl) => {
  const updated = selectionGroups.groups().map((g) =>
    g.id === groupId ? { ...g, jiraTicketId: ticketId, jiraUrl: ticketUrl } : g,
  );
  selectionGroups.persistGroups(updated);
}}
```

```tsx
// sidebar/index.tsx — delegates immediately
<GroupDetailView onTicketCreated={props.onTicketCreated} />
```

**Why this is correct:** `persistGroups` saves to storage and updates the signal. The next `props.groups` read in the sidebar reflects the new value synchronously within the same reactive batch. No gap, no stale frame.

---

## Summary

| | Workaround (before) | Idiomatic (after) |
|---|---|---|
| Data source | Local signal mirroring props | `props.groups` directly |
| Sync mechanism | `createEffect(() => setGroups(props.groups))` | None needed |
| Renders per update | 2 (parent + effect) | 1 |
| Mutation path | Local signal → never reaches core | Callback → core → `persistGroups` → props |
| `untrack` needed | Yes (loop from merge effect) | Yes (loop from filter effect — different trigger) |

---

## References

- [SolidJS Props](https://docs.solidjs.com/concepts/components/props) — props are reactive getters
- [SolidJS `createMemo`](https://docs.solidjs.com/reference/basic-reactivity/create-memo) — derived reactive state
- [SolidJS `untrack`](https://docs.solidjs.com/reference/reactive-utilities/untrack) — read without subscribing
- [SolidJS `createEffect`](https://docs.solidjs.com/reference/basic-reactivity/create-effect) — side effects with tracking
