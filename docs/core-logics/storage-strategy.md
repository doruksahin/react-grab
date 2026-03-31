# Storage Strategy

Where react-grab persists data and why.

---

## Three Storage Layers

```
localStorage          ← user preferences, persist forever
sessionStorage        ← session-scoped data, dies on tab close
server (sync)         ← shared workspace data, opt-in
```

---

## What Goes Where

### localStorage

| Key | Data | Why localStorage |
|-----|------|-----------------|
| `react-grab-toolbar-state` | `ToolbarState` (edge, ratio, collapsed, enabled, defaultAction, selectionsRevealed) | User preferences. Should survive tab close, page refresh, browser restart. Same across all tabs. |

**Characteristics:** Persists indefinitely. Shared across tabs on the same origin. Synchronous API.

### sessionStorage

| Key | Data | Why sessionStorage |
|-----|------|-------------------|
| `react-grab-comment-items` | `CommentItem[]` | Comments reference DOM elements via CSS selectors. Those selectors are path-based (`html > body > div:nth-of-type(1) > ...`) and can break across sessions if the DOM structure changes. Session-scoped = selectors are valid for the duration of the tab. |
| `react-grab-selection-groups` | `SelectionGroup[]` | Groups are containers for comments. Same lifecycle as comments. |
| `react-grab-revealed-comments` | `Record<commentId, boolean>` | Per-item revealed overrides. Per-user view state — NOT synced to server. Saved so that `revealed` states survive server round-trips during sync. |
| `react-grab-revealed-groups` | `Record<groupId, boolean>` | Per-group revealed overrides. Same purpose as above. |
| `react-grab-clear-confirmed` | `"1"` or absent | UI flag: has the user confirmed the "clear all" prompt? Resets on tab close so the safety prompt returns in new sessions. |
| `react-grab-mcp-reachable` | `"true"` or `"false"` | MCP server health check cache. Avoids repeated failed fetch requests per session. |

**Characteristics:** Scoped to a single tab. Dies on tab close. Not shared across tabs. Synchronous API.

### Server (when sync enabled)

| Endpoint | Data | Why server |
|----------|------|-----------|
| `GET/PUT /workspaces/:id/comments` | `CommentItem[]` (without `revealed`) | Shared between users in a workspace. Source of truth when sync is configured. |
| `GET/PUT /workspaces/:id/groups` | `SelectionGroup[]` (without `revealed`) | Same as comments — shared workspace data. |

**Characteristics:** Shared across users and machines. Async API. `revealed` field is stripped before write, merged from sessionStorage on read.

---

## The `revealed` State Split

The `revealed` field exists at three levels. Each level uses a different storage:

```
selectionsRevealed (parent toggle)
  Storage: localStorage (inside ToolbarState)
  Scope: persists forever, same across tabs
  Synced: NO (user preference)

SelectionGroup.revealed (group toggle)
  Storage: sessionStorage (react-grab-revealed-groups)
  Scope: per tab, dies on close
  Synced: NO (per-user view state)

CommentItem.revealed (item toggle)
  Storage: sessionStorage (react-grab-revealed-comments)
  Scope: per tab, dies on close
  Synced: NO (per-user view state)
```

### Why this matters for sync

When loading from the server, items arrive without `revealed`. The merge function must reconstruct it:

1. Check `react-grab-revealed-comments` in sessionStorage for per-item overrides
2. If sessionStorage has no data (new tab, first sync load) → fall back to `selectionsRevealed` from localStorage (parent toggle state)

This means: if the parent toggle is ON and you open a new tab, all items default to revealed. If the parent toggle is OFF, all items default to hidden. Per-item overrides only exist after you've toggled individual items in that tab.

---

## When Sync Replaces sessionStorage

```
No sync configured:
  comments → sessionStorage (read/write directly)
  groups   → sessionStorage (read/write directly)

Sync configured:
  comments → server via HTTP (read/write)
             + sessionStorage for revealed states only
  groups   → server via HTTP (read/write)
             + sessionStorage for revealed states only
```

When sync is active, the main data (comments, groups) goes to the server. sessionStorage is only used for per-user view state (`revealed` overrides) and UI flags (`clear-confirmed`, `mcp-reachable`).

---

## Known Inconsistency

`selectionsRevealed` (parent toggle) lives in localStorage while the per-item states it cascades to live in sessionStorage. This means:

- **Same tab, refresh:** Parent ON + per-item states preserved → works correctly
- **New tab, no sync:** Parent ON but per-item states are empty → items default to not revealed (no server to load from, sessionStorage is blank)
- **New tab, with sync:** Parent ON + per-item states empty → merge falls back to parent toggle → items default to revealed

This inconsistency is documented as a conscious trade-off. The parent toggle is a user preference (should persist). The per-item states are session-scoped (tied to DOM selector validity).
