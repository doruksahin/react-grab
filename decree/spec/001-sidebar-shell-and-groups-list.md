---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
status: approved
---

# SPEC-001 Sidebar Shell and Groups List

## Overview

Implement Phase 1 of PRD-002: a sidebar shell with groups list, mounted inside react-grab's existing Shadow DOM host. The sidebar is a Solid.js component that overlays the host page (no layout shift), subscribes to the existing `commentItems()` and `groups()` signals, and provides stats, filtering, and group navigation. This SPEC covers the sidebar container, dashboard toolbar button, groups list view, z-index contract, and empty/error states. It does not cover the group detail view (Phase 2) or JIRA integration (Phase 3).

## Technical Design

### Component Tree

The sidebar mounts inside `ReactGrabRenderer` as a sibling to the existing components:

```
ReactGrabRenderer
├── OverlayCanvas                    (z-index: 2147483645)
├── SelectionLabel(s)                (z-index: 2147483647)
├── Toolbar                          (z-index: 2147483647)
│   └── ToolbarContent
│       ├── Select button
│       ├── Comments button
│       ├── Copy All button
│       ├── Visibility button
│       ├── **Dashboard button** ← NEW
│       ├── Toggle button
│       ├── Collapse button
│       └── SyncIndicator
├── ContextMenu
├── ToolbarMenu
├── ClearCommentsPrompt
├── CommentsDropdown
└── **Sidebar** ← NEW                (z-index: 2147483646)
    ├── SidebarHeader
    ├── StatsBar
    ├── FilterTabs
    └── GroupList
        └── GroupCard (repeated)
```

### Z-Index Contract

| Layer | Z-Index | Element |
|-------|---------|---------|
| Host | 2147483647 | Shadow DOM host element |
| Labels | 2147483647 | SelectionLabel, Toolbar |
| **Sidebar** | **2147483646** | Sidebar container |
| Canvas | 2147483645 | OverlayCanvas |

The sidebar sits **below** selection labels and toolbar (so they remain interactive) but **above** the overlay canvas. Add to `constants.ts`:

```typescript
export const Z_INDEX_SIDEBAR = 2147483646;
```

### Signal Threading

The sidebar receives the same signals and handlers already threaded to `CommentsDropdown`. No new signals or storage changes needed.

**In `core/index.tsx`** — add to renderer props:

```typescript
// Already exists, add to Sidebar:
groups={selectionGroups.groups()}
commentItems={commentItems()}
activeGroupId={selectionGroups.activeGroupId()}
onActiveGroupChange={selectionGroups.setActiveGroupId}
```

**In `ReactGrabRenderer`** — add Sidebar component:

```tsx
<Show when={sidebarOpen()}>
  <Sidebar
    groups={props.groups}
    commentItems={props.commentItems}
    activeGroupId={props.activeGroupId}
    onActiveGroupChange={props.onActiveGroupChange}
    syncStatus={props.syncStatus}
    onClose={() => setSidebarOpen(false)}
    onGroupClick={(groupId) => { /* Phase 2: navigate to detail */ }}
  />
</Show>
```

### Sidebar State

The sidebar open/close state is local to the renderer — not persisted to localStorage (unlike toolbar collapsed state). This keeps it simple and avoids the sidebar auto-opening on page load.

```typescript
const [sidebarOpen, setSidebarOpen] = createSignal(false);
```

**Dismiss triggers:**
- Close button click → focus returns to dashboard button
- Dashboard toolbar button toggle
- Escape key (only when sidebar has focus) → focus returns to dashboard button

### Dashboard Button

Add to `toolbar-content.tsx` after the Visibility button, before the Toggle button. The button:
- Uses a 4-square grid icon (matching the proposal)
- Shows active state (pink background) when sidebar is open
- Badge shows group count when sidebar is closed

```tsx
<button
  class={`tb-btn ${sidebarOpen() ? 'active' : ''}`}
  onClick={() => props.onToggleSidebar()}
  title="Dashboard"
>
  <DashboardIcon />
  <Show when={!sidebarOpen() && groupCount() > 0}>
    <span class="badge">{groupCount()}</span>
  </Show>
</button>
```

### Sidebar Container

Fixed-position overlay, left-anchored, full viewport height:

```tsx
const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <div
      class="sidebar"
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '380px',
        height: '100vh',
        'z-index': String(Z_INDEX_SIDEBAR),
      }}
      role="dialog"
      aria-modal="false"
      aria-label="React Grab Dashboard"
    >
      <SidebarHeader syncStatus={props.syncStatus} onClose={props.onClose} />
      <StatsBar groups={props.groups} commentItems={props.commentItems} />
      <FilterTabs activeFilter={activeFilter()} onFilterChange={setActiveFilter} />
      <GroupList
        groups={filteredGroups()}
        commentItems={props.commentItems}
        onGroupClick={props.onGroupClick}
      />
    </div>
  );
};
```

**Note:** `aria-modal="false"` because the sidebar is non-modal — users can still interact with the host page. Focus moves into the sidebar on open but is **not trapped** (trapping is Phase 4 polish per PRD-002). Escape dismisses when sidebar has focus [A-019](../../docs/assumptions.md).

### SidebarHeader

Displays workspace connection status (carried from dashboard layout) and close button:

```tsx
<div class="sb-header">
  <h2>
    <span class={`dot ${props.syncStatus === 'synced' ? 'green' : 'red'}`} />
    react-grab
  </h2>
  <button class="sb-close" onClick={props.onClose}>×</button>
</div>
```

### StatsBar

Derives stats from the signals — no API calls:

Note: `props.groups` and `props.commentItems` are already resolved arrays (not signal accessors) since `core/index.tsx` passes `groups={selectionGroups.groups()}`. The `groupComments` utility is imported from `features/selection-groups/business/group-operations.ts`.

```typescript
const stats = () => {
  const g = props.groups;  // already resolved array
  const c = props.commentItems;
  const grouped = groupComments(g, c);
  return {
    totalGroups: g.length,
    totalSelections: c.length,
    open: grouped.filter(e => deriveStatus(e) === 'open').length,
    ticketed: grouped.filter(e => deriveStatus(e) === 'ticketed').length,
  };
};
```

`deriveStatus` is a **new utility** in `features/sidebar/derive-status.ts`. In Phase 1, it only distinguishes `open` vs `ticketed` based on `jiraTicketId` — which already exists on `SelectionGroup`. The `resolved` state requires JIRA status polling (Phase 3) and will be added then via a separate status map signal.

```typescript
type GroupStatus = 'open' | 'ticketed' | 'resolved';

/**
 * Phase 1: derives status from jiraTicketId only.
 * Phase 3 will add a jiraStatusMap parameter for resolved detection.
 */
function deriveStatus(entry: GroupedComments): GroupStatus {
  if (!entry.group.jiraTicketId) return 'open';
  // Phase 3: check jiraStatusMap.get(group.jiraTicketId) === 'done' → 'resolved'
  return 'ticketed';
}
```

**Why not read `group.jiraStatus`?** The OpenAPI spec's group list response has no `jiraStatus` field — JIRA status is returned by a separate endpoint (`GET /workspaces/{id}/groups/{groupId}/jira-status`). Reading a nonexistent field would cause a TypeScript compilation error. Phase 3 will introduce a `createResource`-based polling signal that maps ticket IDs to statuses, and `deriveStatus` will accept that map as a second parameter.

### FilterTabs

Local signal, not persisted:

```typescript
type FilterStatus = 'all' | 'open' | 'ticketed' | 'resolved';
const [activeFilter, setActiveFilter] = createSignal<FilterStatus>('all');

const filteredGroups = () => {
  const filter = activeFilter();
  if (filter === 'all') return groupedItems();
  return groupedItems().filter(entry => deriveStatus(entry) === filter);
};
```

### GroupCard

Each group card renders:
- Group name
- Selection count
- Status badge (colored: blue=open, yellow=ticketed, green=resolved)
- JIRA ticket ID as clickable link (if ticketed)
- Inline comment previews: up to 3 items showing component name, comment text, and HTML tag — truncated with "+N more"

```tsx
<div class="group-card" onClick={() => props.onGroupClick(group.id)}>
  <div class="gc-top">
    <span class="gc-name">{group.name}</span>
    <StatusBadge status={deriveStatus(entry)} />
  </div>
  <div class="gc-meta">
    <span>{entry.comments.length} selections</span>
    <span>{relativeTime(group.createdAt)}</span>
    <Show when={group.jiraTicketId}>
      <a href={jiraUrl(group.jiraTicketId)} target="_blank">
        {group.jiraTicketId}
      </a>
    </Show>
  </div>
  <div class="gc-preview">
    <For each={entry.comments.slice(0, 3)}>
      {(comment) => (
        <div class="gc-preview-item">
          <span class="gc-tag">{comment.componentName || comment.elementName}</span>
          <span class="gc-tag-html">{comment.tagName}</span>
          <Show when={comment.commentText}>
            <span class="gc-comment-text">{comment.commentText}</span>
          </Show>
        </div>
      )}
    </For>
    <Show when={entry.comments.length > 3}>
      <span class="gc-tag">+{entry.comments.length - 3} more</span>
    </Show>
  </div>
</div>
```

### Empty and Error States

**No groups:** Shown when `groups().length === 0`:
```tsx
<div class="empty-state">
  <p>No selections yet.</p>
  <p>Select elements on the page to get started.</p>
</div>
```

**No filter matches:** Shown when `filteredGroups().length === 0` but groups exist:
```tsx
<div class="empty-state">
  <p>No {activeFilter()} groups.</p>
</div>
```

**Sync error:** Shown when `syncStatus === 'error'`:
```tsx
<div class="error-state">
  <p>Could not connect to sync server.</p>
  <button onClick={retry}>Retry</button>
</div>
```

### Styling Approach

All styles scoped inside the existing Shadow DOM via Tailwind utility classes (already used throughout react-grab). The sidebar uses the existing color variables:

- `--color-grab-pink: #b21c8e` for active states and badges
- Dark theme matching the toolbar: `#1a1a1a` background, `#e5e5e5` text
- Animations: reuse existing `animate-slide-in-left` or add a simple CSS transition on `transform: translateX`

### File Structure

```
packages/react-grab/src/
├── features/
│   ├── sidebar/
│   │   ├── derive-status.ts       # NEW: deriveStatus() utility
│   │   └── index.ts               # Public exports
│   └── sync/
│       ├── schemas.ts             # NEW: Zod schemas for adapter validation
│       └── adapter.ts             # Modified: replace `as` casts with Zod parse
├── components/
│   ├── sidebar/
│   │   ├── index.tsx              # Sidebar container
│   │   ├── sidebar-header.tsx     # Header with sync status + close
│   │   ├── stats-bar.tsx          # Stats summary
│   │   ├── filter-tabs.tsx        # Status filter tabs
│   │   ├── group-list.tsx         # Scrollable group list
│   │   ├── group-card.tsx         # Individual group card
│   │   ├── status-badge.tsx       # Colored status badge
│   │   └── empty-state.tsx        # Empty/error state views
│   ├── icons/
│   │   └── dashboard-icon.tsx     # NEW: 4-square grid icon
│   ├── toolbar/
│   │   └── toolbar-content.tsx    # Modified: add dashboard button
│   └── renderer.tsx               # Modified: mount Sidebar
├── constants.ts                   # Modified: add Z_INDEX_SIDEBAR
└── core/
    └── index.tsx                  # Modified: thread sidebar props
```

### Pre-implementation Cleanup

These changes improve type safety before the sidebar work begins. They are not sidebar-specific but reduce risk for the sidebar (and all future consumers of synced data).

#### Zod validation at the adapter boundary

The `StorageAdapter` in `features/sync/adapter.ts` has 5 `as` casts on `response.json()` returns — the exact boundary where external data enters the app. Replace these with Zod parse calls to catch API schema drift at runtime instead of silently passing wrong shapes into Solid signals.

Add `features/sync/schemas.ts`:

```typescript
import { z } from 'zod';

export const CommentItemSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  content: z.string(),
  elementName: z.string(),
  tagName: z.string(),
  componentName: z.string().optional(),
  elementsCount: z.number().optional(),
  elementSelectors: z.array(z.string()).optional(),
  commentText: z.string().optional(),
  timestamp: z.number(),
  status: z.enum(['open', 'ticketed', 'resolved']).optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional(),
  screenshotElement: z.string().optional(),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const SelectionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  jiraTicketId: z.string().optional(),
});
```

In `adapter.ts`, replace `as` casts:

```typescript
// Before:
const data = await response.json() as CommentItem[];

// After:
const raw = await response.json();
const data = z.array(CommentItemSchema).parse(raw);
```

This catches schema drift at the sync boundary with a clear Zod error instead of silently passing malformed data to the sidebar.

#### Document the empty SelectionGroup extension

In `features/selection-groups/types.ts`, the `SelectionGroup extends ServerSelectionGroup` extension currently adds no fields. Add a comment:

```typescript
/**
 * Application-level group type. Extends the server type with UI-only fields.
 * Currently empty — placeholder for future fields like local UI state.
 * Do not add server-persisted fields here; update the OpenAPI spec instead.
 */
export interface SelectionGroup extends ServerSelectionGroup {
  // Phase 2+ may add: expanded?: boolean, lastViewedAt?: number
}
```

## Testing Strategy

### Unit Tests

**Group filtering logic:**
- `deriveStatus()` returns correct status for groups with/without `jiraTicketId` and various ticket statuses
- `filteredGroups()` returns all groups when filter is "all", only matching groups for specific filters
- Empty group list returns empty array for all filters
- Stats computation is correct for mixed group statuses

**Component rendering (vitest + solid-testing-library):**
- `StatsBar` renders correct counts from signal data
- `FilterTabs` updates `activeFilter` signal on click
- `GroupCard` renders group name, selection count, status badge, and truncated comment previews
- `GroupCard` renders JIRA ticket link only when `jiraTicketId` exists
- `GroupCard` shows "+N more" when comments exceed 3
- Empty state renders when no groups exist
- Error state renders when sync status is "error"

### Integration Tests

**Sidebar open/close:**
- Dashboard button click opens sidebar
- Dashboard button click again closes sidebar
- Close button dismisses sidebar
- Escape key dismisses when sidebar has focus
- Sidebar does not shift host page layout (verify no `margin`, `padding`, or `transform` changes on host)

**Signal reactivity:**
- Adding a comment via react-grab updates the sidebar's group list in real time (same signal)
- Creating a new group via the comments dropdown appears in the sidebar immediately
- Deleting a group removes it from the sidebar

**Z-index stacking:**
- Selection labels remain clickable when sidebar is open
- Toolbar remains interactive when sidebar is open
- Overlay canvas highlights are visible behind the sidebar

### Manual Verification

- Open sidebar on a real host page, verify no layout shift
- Verify sidebar scrolls independently from host page
- Verify dark theme matches toolbar appearance
- Verify sidebar renders correctly at 1280px, 1440px, and 1920px viewport widths [A-015](../../docs/assumptions.md)

## Acceptance Criteria

- [ ] Dashboard button added to toolbar between Visibility and Toggle buttons
- [ ] Dashboard button shows active state when sidebar is open
- [ ] Dashboard button shows group count badge when sidebar is closed
- [ ] Sidebar opens as a 380px fixed overlay on the left
- [ ] Sidebar renders inside Shadow DOM host
- [ ] Sidebar z-index is 2147483646 (below labels, above canvas)
- [ ] Host page does not shift, resize, or reflow when sidebar opens/closes
- [ ] Sidebar header shows sync connection status (green dot = synced, red = error)
- [ ] Stats bar shows total groups, total selections, open count, ticketed count
- [ ] Filter tabs work: All, Open, Ticketed, Resolved (Resolved filter shows empty until Phase 3 adds JIRA polling)
- [ ] Group cards show: name, selection count, status badge, JIRA ticket link (if any), comment previews (max 3 + overflow)
- [ ] Clicking a group card is wired to `onGroupClick` (Phase 2 will implement navigation)
- [ ] Empty state shown when no groups exist
- [ ] Empty state shown when no groups match active filter
- [ ] Error state shown when sync server is unreachable, with retry button
- [ ] Escape key dismisses sidebar when it has focus and returns focus to dashboard button
- [ ] Close button dismisses sidebar and returns focus to dashboard button
- [ ] `Z_INDEX_SIDEBAR` constant added to `constants.ts`
- [ ] All unit tests pass (filtering logic, component rendering)
- [ ] Integration tests pass (open/close, signal reactivity, z-index stacking)
- [ ] No layout shift verified on a real host page at 1280px+ viewport
- [ ] Zod schemas added for CommentItem and SelectionGroup in `features/sync/schemas.ts`
- [ ] All 5 `as` casts in `adapter.ts` replaced with Zod `.parse()` calls
- [ ] Empty `SelectionGroup` extension documented with comment explaining intent
- [ ] `deriveStatus()` compiles without accessing nonexistent `jiraStatus` field

### Deferred (Phase 2+)

- [ ] Group detail view on card click
- [ ] Focus trapping inside sidebar (Phase 4)
- [ ] `aria-modal="true"` upgrade (Phase 4)
- [ ] Performance measurement via `performance.mark` (Phase 4)
- [ ] Keyboard navigation within group list
