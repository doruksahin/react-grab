# Storage Strategy

Where react-grab persists data and why.

---

## Two Storage Layers

```
localStorage          ← all react-grab data (preferences + working state)
server (sync)         ← shared workspace data, opt-in via SyncConfig
```

sessionStorage is NOT used for react-grab data. Only `react-grab-mcp-reachable` (MCP health check cache) remains in sessionStorage as it is truly per-tab.

---

## What Goes Where

### localStorage

| Key | Data | Purpose |
|-----|------|---------|
| `react-grab-toolbar-state` | `ToolbarState` (edge, ratio, collapsed, enabled, defaultAction, selectionsRevealed) | Toolbar UI preferences + parent reveal toggle |
| `react-grab-comment-items` | `CommentItem[]` (with revealed) | Comments with element selectors and revealed state |
| `react-grab-selection-groups` | `SelectionGroup[]` (with revealed) | Groups with revealed state |
| `react-grab-revealed-comments` | `Record<commentId, boolean>` | Per-item revealed overrides (used by sync to survive server round-trips) |
| `react-grab-revealed-groups` | `Record<groupId, boolean>` | Per-group revealed overrides (same purpose) |
| `react-grab-clear-confirmed` | `"1"` or absent | UI flag: has the user confirmed the "clear all" prompt? |

**Characteristics:** Persists indefinitely. Shared across all tabs on the same origin. Survives page refresh and browser restart.

### Server (when sync enabled)

| Endpoint | Data | Depends on `syncRevealedState` |
|----------|------|-------------------------------|
| `GET/PUT /workspaces/:id/comments` | `CommentItem[]` | `true`: includes `revealed`. `false`: stripped, merged from localStorage on read. |
| `GET/PUT /workspaces/:id/groups` | `SelectionGroup[]` | Same as comments. |

**SyncConfig** (all fields required):

```typescript
interface SyncConfig {
  serverUrl: string;
  workspace: string;
  syncRevealedState: boolean;  // true = revealed syncs to server, false = per-user in localStorage
  onSyncError: (error: Error) => void;  // must handle errors explicitly
}
```

---

## The `revealed` State

Three levels, all in localStorage:

| Level | Storage key | Scope |
|-------|-------------|-------|
| Parent toggle | `react-grab-toolbar-state` → `selectionsRevealed` | All items |
| Group toggle | `react-grab-selection-groups` → `group.revealed` | Items in group |
| Item toggle | `react-grab-comment-items` → `item.revealed` | Single item |

When sync is enabled with `syncRevealedState: false`, revealed fields are stripped before server write and merged from `react-grab-revealed-comments` / `react-grab-revealed-groups` localStorage keys on server read.

When sync is enabled with `syncRevealedState: true`, revealed goes to the server as-is. All users share the same view.

---

## New Tab Behavior

Since everything is in localStorage (shared across tabs):

- **No sync:** New tab has same data as other tabs. Comments, groups, revealed states all available.
- **With sync:** Server data loads, revealed state comes from localStorage (per-user) or server (`syncRevealedState: true`).
