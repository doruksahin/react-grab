---
status: approved
date: 2026-04-06
references: [PRD-004, ADR-0006, SPEC-003, SPEC-004]
---

# SPEC-006 ATT Status Visualization and Filtering

## Overview

Replace the three-state status model (`open | ticketed | resolved`) with the full ATT JIRA board workflow (10 statuses), each with a unique color. Add filtering by JIRA status, assignee, and reporter. When filters are active, non-matching groups and their canvas selections are hidden via the existing `SelectionVisibility` API. A status legend (i) overlay explains all colors and the ATT workflow.

This is ATT-specific — the status-color map is hardcoded per ADR-0006. Assignee/reporter come from expanding the existing `getIssueStatus` poll endpoint.

## Technical Design

### Module Architecture (SRP per PRD-004)

```
features/sidebar/
├── status-colors.ts        NEW — ATT_STATUS_COLORS map + getStatusColor()
├── jira-types.ts            Modified — add jiraAssignee, jiraReporter
├── filter-state.ts          NEW — filter signals + applyFilters() pure function
└── derive-status.ts         Modified — simplified, reads jiraStatus directly

components/sidebar/
├── status-badge.tsx         Modified — accept any status name + dynamic color
├── filter-bar.tsx           NEW — replaces filter-tabs.tsx
├── filter-chips.tsx         NEW — active filter chips with dismiss
├── status-legend.tsx        NEW — (i) overlay with color guide
├── group-card.tsx           Modified — colored left border from getStatusColor()
├── group-list.tsx           Modified — pass filtered + visibility-toggled groups
└── index.tsx                Modified — new filter state, reveal/hide integration
```

### 1. Status Color Map (`features/sidebar/status-colors.ts`)

```typescript
export interface StatusColorConfig {
  hex: string;       // border + badge border
  bg: string;        // badge background (12% alpha)
  text: string;      // badge text color
}

const ATT_STATUS_COLORS: Record<string, StatusColorConfig> = {
  "To Do":          { hex: "#94a3b8", bg: "rgba(148,163,184,0.12)", text: "#94a3b8" },
  "In Progress":    { hex: "#3b82f6", bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  "Code Review":    { hex: "#a78bfa", bg: "rgba(167,139,250,0.12)", text: "#a78bfa" },
  "Test":           { hex: "#f59e0b", bg: "rgba(245,158,11,0.12)",  text: "#f59e0b" },
  "Test Passed":    { hex: "#10b981", bg: "rgba(16,185,129,0.12)",  text: "#10b981" },
  "UAT":            { hex: "#06b6d4", bg: "rgba(6,182,212,0.12)",   text: "#06b6d4" },
  "In Preprod":     { hex: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  text: "#8b5cf6" },
  "In Production":  { hex: "#22c55e", bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
  "Won't Do":       { hex: "#ef4444", bg: "rgba(239,68,68,0.12)",   text: "#ef4444" },
  "Done":           { hex: "#22c55e", bg: "rgba(34,197,94,0.12)",   text: "#22c55e" },
};

const NO_TASK_COLOR: StatusColorConfig = {
  hex: "#b21c8e", bg: "rgba(178,28,142,0.12)", text: "#b21c8e"
};

const UNKNOWN_COLOR: StatusColorConfig = {
  hex: "#6b7280", bg: "rgba(107,114,128,0.12)", text: "#6b7280"
};

export function getStatusColor(jiraStatus: string | undefined): StatusColorConfig {
  if (!jiraStatus) return NO_TASK_COLOR;
  return ATT_STATUS_COLORS[jiraStatus] ?? UNKNOWN_COLOR;
}

export function getStatusLabel(group: SelectionGroupWithJira): string {
  return group.jiraTicketId ? (group.jiraStatus ?? "To Do") : "No Task";
}
```

### 2. Sync-Server: Expand `getIssueStatus` (ADR-0006 Decision 2)

`packages/sync-server/src/services/jira.service.ts`:

```typescript
// Change:
fields: ["status"]
// To:
fields: ["status", "assignee", "reporter"]

// Change return:
return {
  status: issue.fields.status?.name ?? "Unknown",
  statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
  assignee: issue.fields.assignee?.displayName ?? null,
  reporter: issue.fields.reporter?.displayName ?? null,
};
```

`packages/sync-server/src/schemas/jira.ts`:

```typescript
export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),    // NEW
  reporter: z.string().nullable(),    // NEW
});
```

After schema change: regenerate OpenAPI spec + Orval.

### 3. Extended Group Type

`features/sidebar/jira-types.ts` — add:

```typescript
export type SelectionGroupWithJira = SelectionGroup & {
  jiraResolved?: boolean;
  jiraStatus?: string;
  jiraStatusCategory?: string;
  jiraUrl?: string;
  jiraAssignee?: string | null;    // NEW
  jiraReporter?: string | null;    // NEW
};
```

### 3a. Update `handleStatusUpdate` in `components/sidebar/index.tsx`

The existing function stores `status` and `statusCategory`. Extend it to also store `assignee` and `reporter`:

```typescript
function handleStatusUpdate(
  groupId: string,
  status: { status: string; statusCategory: string; assignee: string | null; reporter: string | null },
) {
  const resolved = status.statusCategory.toLowerCase() === "done";
  setGroups((prev) =>
    prev.map((g) =>
      g.id === groupId
        ? {
            ...g,
            jiraStatus: status.status,
            jiraStatusCategory: status.statusCategory,
            jiraAssignee: status.assignee,
            jiraReporter: status.reporter,
            jiraResolved: resolved,
          }
        : g,
    ),
  );
  if (resolved) {
    props.onJiraResolved?.(groupId);
  }
}
```

Also update the merge effect (lines 60-74) to preserve `jiraAssignee` and `jiraReporter` alongside existing fields.

### 3b. Sidebar-Level JIRA Status Polling

**Problem:** The existing JIRA status poll lives inside `GroupDetailView.onMount` — it only runs when a user clicks into a specific group's detail view. With the old 3-state model, `deriveStatus()` could return "ticketed" from `jiraTicketId` alone, so the group list didn't need the actual JIRA status. Now that we show real status names (e.g., "In Progress", "Code Review"), we need to poll ALL ticketed groups when the sidebar opens.

**Solution:** Move the initial status poll to `sidebar/index.tsx`. Poll all ticketed groups on sidebar mount, then every 30 seconds. Keep the detail view poll for the actively viewed group only.

`components/sidebar/index.tsx` — add on mount:

```typescript
onMount(() => {
  if (!props.syncWorkspace) return;

  const pollAllTicketed = async () => {
    const ticketed = groups().filter((g) => g.jiraTicketId);
    await Promise.allSettled(
      ticketed.map(async (g) => {
        try {
          const result = await getJiraTicketStatus(props.syncWorkspace!, g.id);
          if (result.status === 200) {
            handleStatusUpdate(g.id, result.data);
          }
        } catch {
          // Silent — poll failures do not show errors per SPEC-003
        }
      }),
    );
  };

  pollAllTicketed(); // immediate first poll
  const intervalId = setInterval(pollAllTicketed, 30_000);
  onCleanup(() => clearInterval(intervalId));
});
```

`components/sidebar/group-detail-view.tsx` — update `onStatusUpdate` prop type to include assignee/reporter:

```typescript
onStatusUpdate?: (
  groupId: string,
  status: { status: string; statusCategory: string; assignee: string | null; reporter: string | null },
) => void;
```

The detail view poll remains for responsive updates when the user is actively viewing a group — but the sidebar-level poll ensures all group cards show correct status on mount.

### 4. Filter State (`features/sidebar/filter-state.ts`)

```typescript
export interface FilterState {
  statuses: Set<string>;        // empty = all
  assignee: string | null;      // null = all
  reporter: string | null;      // null = all
}

export const EMPTY_FILTER: FilterState = {
  statuses: new Set(),
  assignee: null,
  reporter: null,
};

export function isFilterActive(filter: FilterState): boolean {
  return filter.statuses.size > 0 || filter.assignee !== null || filter.reporter !== null;
}

export function applyFilters(
  groups: SelectionGroupWithJira[],
  filter: FilterState,
): SelectionGroupWithJira[] {
  return groups.filter((g) => {
    const status = getStatusLabel(g);
    if (filter.statuses.size > 0 && !filter.statuses.has(status)) return false;
    if (filter.assignee && g.jiraAssignee !== filter.assignee) return false;
    if (filter.reporter && g.jiraReporter !== filter.reporter) return false;
    return true;
  });
}

export function getDistinctAssignees(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraAssignee).filter(Boolean) as string[])].sort();
}

export function getDistinctReporters(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraReporter).filter(Boolean) as string[])].sort();
}
```

### 5. Filter Bar (`components/sidebar/filter-bar.tsx`)

Replaces the existing `FilterTabs`. Three dropdowns in a horizontal row:

```
[Status ▾]  [Assignee ▾]  [Reporter ▾]  [✕ Clear]
```

Each dropdown is a native `<select>` (consistent with the JIRA create form approach).

- **Status dropdown:** `<option>All Statuses</option>` + one option per ATT status + "No Task". Multi-select not needed for PoC — single status filter is sufficient.
- **Assignee dropdown:** `<option>All Assignees</option>` + distinct assignees from ticketed groups.
- **Reporter dropdown:** `<option>All Reporters</option>` + distinct reporters from ticketed groups.
- **Clear button:** resets all three to default. Hidden when no filter is active.

### 6. Active Filter Chips (`components/sidebar/filter-chips.tsx`)

When any filter is active, show dismissible chips between the filter bar and the group list:

```
[Status: In Progress ✕]  [Assignee: Alice ✕]
```

Each chip has a dismiss (✕) button that clears that filter dimension only.

### 7. Reveal/Hide Integration

**Problem:** The Sidebar component doesn't have access to the `SelectionVisibility` API — it only reaches the sidebar through `core/index.tsx → renderer.tsx → comments-dropdown.tsx`. Additionally, `handleToggleGroup` is a toggle (flips `!revealed`), not a setter — using it in a loop is O(n²) and fragile.

**Solution:** Add a batch setter `setGroupsRevealed` to `SelectionVisibilityAPI` and expose it to the Sidebar via a new callback prop.

#### 7a. New batch method on `SelectionVisibilityAPI`

`features/selection-visibility/types.ts` — add to interface:

```typescript
export interface SelectionVisibilityAPI {
  // ... existing methods ...
  /** Batch set revealed state for groups by filter results */
  setGroupsRevealed: (visibleIds: Set<string>, allGroupIds: string[]) => void;
}
```

`features/selection-visibility/index.ts` — implement:

```typescript
const setGroupsRevealed = (visibleIds: Set<string>, allGroupIds: string[]) => {
  const updatedGroups = deps.groups().map((g) =>
    allGroupIds.includes(g.id)
      ? { ...g, revealed: visibleIds.has(g.id) }
      : g,
  );
  deps.persistGroups(updatedGroups);

  const items = deps.commentItems();
  const updatedItems = items.map((item) =>
    item.groupId && allGroupIds.includes(item.groupId)
      ? { ...item, revealed: visibleIds.has(item.groupId) }
      : item,
  );
  deps.setCommentItems(updatedItems);
  deps.persistCommentItems(updatedItems);
};
```

One pass, no toggle, no reactivity loop.

#### 7b. New callback prop on `SidebarProps`

```typescript
export interface SidebarProps {
  // ... existing props ...
  onFilterVisibilityChange?: (visibleIds: Set<string>, allGroupIds: string[]) => void;
}
```

Wired in `core/index.tsx`:

```typescript
<Sidebar
  onFilterVisibilityChange={visibility.setGroupsRevealed}
  // ... existing props ...
/>
```

#### 7c. Filter effect in `Sidebar.index.tsx`

```typescript
createEffect(() => {
  const filter = filterState();
  if (!isFilterActive(filter)) {
    // No filter active — restore all groups to revealed
    const allIds = groups().map(g => g.id);
    props.onFilterVisibilityChange?.(new Set(allIds), allIds);
    return;
  }
  const filtered = applyFilters(groups(), filter);
  const visibleIds = new Set(filtered.map(g => g.id));
  const allIds = groups().map(g => g.id);
  props.onFilterVisibilityChange?.(visibleIds, allIds);
});
```

This reads `filterState()` (owned by sidebar) and `groups()` (local signal), then calls out to core via the callback — no writes back into the sidebar's own signal graph.

### 8. Status Legend (`components/sidebar/status-legend.tsx`)

Triggered by (i) button in `SidebarHeader`. Renders as a full-sidebar overlay (same as the HTML proposal). Contains:

- All ATT statuses with color swatches and descriptions
- Lifecycle flow diagram (No Task → To Do → ... → Done)
- "How it works" notes explaining transitions

### 9. Updated Group Card

`group-card.tsx` changes:
- Left border color: `getStatusColor(group.jiraStatus).hex`
- Badge: shows `getStatusLabel(group)` with dynamic color from `getStatusColor()`
- Assignee shown in meta row when present (person icon, normal opacity)
- Reporter shown in meta row when present (pen icon, dimmer opacity to differentiate from assignee)

### 10. Canvas Overlay Colors

**Type change required:** The current `GroupStatus = "open" | "ticketed" | "resolved"` type permeates `types.ts`, `overlay-canvas.tsx`, `selection-label/index.tsx`, `overlay-color.ts`, and `constants.ts`. It must be widened to carry the JIRA status name.

#### 10a. Replace `GroupStatus` type

`types.ts`:

```typescript
// Replace: export type GroupStatus = "open" | "ticketed" | "resolved";
// With:
export type GroupStatus = string | undefined;
// undefined = no JIRA ticket ("No Task"), string = JIRA status name
```

#### 10b. Update `core/index.tsx` instance creation

```typescript
// Replace: groupStatus: group ? deriveStatus(group) : ("open" as const),
// With:
groupStatus: group?.jiraStatus,
```

This passes the JIRA status name (e.g., `"In Progress"`) to the overlay instance. `undefined` means no ticket.

#### 10c. Update `overlay-canvas.tsx`

Replace `statusOverlayColor(instance.groupStatus, alpha)` calls with `getStatusColor(instance.groupStatus)`:

```typescript
import { getStatusColor } from "../features/sidebar/status-colors.js";

// Border:
const instanceBorderColor = isActiveGroup
  ? ACTIVE_GROUP_BORDER_COLOR
  : getStatusColor(instance.groupStatus).hex;

// Fill (use hex with alpha):
const instanceFillColor = isActiveGroup
  ? ACTIVE_GROUP_FILL_COLOR
  : hexToRgba(getStatusColor(instance.groupStatus).hex, STATUS_OVERLAY_FILL_ALPHA);
```

Add a `hexToRgba` utility to convert hex to rgba string for the fill alpha.

#### 10d. Update `selection-label/index.tsx`

The current badge shows ticket/check icons based on `groupStatus === "ticketed"` / `"resolved"`. Replace with:

```typescript
import { getStatusColor, getStatusLabel } from "../../features/sidebar/status-colors.js";

// Show badge whenever there's a JIRA status or "No Task" status that isn't the default
<Show when={props.groupStatus !== undefined || props.jiraTicketId}>
  <div
    style={{ background: getStatusColor(props.groupStatus).hex }}
    // ... badge rendering with status-appropriate icon
  >
    {/* Icon logic: check icon for Done/Won't Do, ticket icon for others */}
  </div>
</Show>
```

#### 10e. Remove dead code

After migration, remove:
- `statusOverlayColor()` from `utils/overlay-color.ts`
- `STATUS_COLORS` object from `utils/overlay-color.ts`
- `OVERLAY_BORDER_COLOR_STATUS_*` / `OVERLAY_FILL_COLOR_STATUS_*` constants from `constants.ts`
- `deriveStatus()` from `features/sidebar/derive-status.ts` (replaced by direct `jiraStatus` read)
- The old `GroupStatus` union type

**Note:** `overlayColor()` and `activeGroupOverlayColor()` remain — they handle the non-status default overlay colors.

## Testing Strategy

### Unit Tests

- `getStatusColor("In Progress")` returns blue config
- `getStatusColor("Won't Do")` returns red config
- `getStatusColor(undefined)` returns pink (No Task)
- `getStatusColor("Unknown Column")` returns gray fallback
- `getStatusLabel(group)` returns "No Task" when no `jiraTicketId`
- `getStatusLabel(group)` returns `jiraStatus` when ticketed
- `applyFilters` with empty filter returns all groups
- `applyFilters` with status filter returns only matching groups
- `applyFilters` with assignee filter returns only matching groups
- `applyFilters` with combined filters returns AND-intersected result
- `getDistinctAssignees` returns sorted unique names, excludes nulls
- `isFilterActive` returns false for EMPTY_FILTER, true when any dimension set

### Integration Tests (Playwright)

- Group card shows "No Task" pink badge when no JIRA ticket
- Group card shows "In Progress" blue badge when JIRA status is "In Progress"
- Group card left border matches badge color
- Selecting status filter hides non-matching groups from list
- Selecting assignee filter hides non-matching groups from list
- Combined filter (status + assignee) shows only AND-matched groups
- Clear button resets all filters, all groups reappear
- Filter chips appear when filter is active, dismiss button works
- (i) button opens status legend overlay
- Status legend shows all 10 ATT statuses with correct colors
- Canvas selection borders match the group's JIRA status color

### UI Verification Steps

These are manual checks to confirm the feature works end-to-end:

1. **Status colors:** Open sidebar → see groups with different JIRA statuses → each group card has a distinct colored left border and badge matching the ATT board column
2. **No Task:** A group without a JIRA ticket shows "No Task" with pink badge
3. **Unknown status:** If a JIRA status doesn't match the hardcoded map, it shows gray (won't happen on ATT, but verify with a mocked value)
4. **Status filter:** Select "Code Review" from the status dropdown → only Code Review groups remain → other groups disappear from the list AND their canvas selections disappear from the page
5. **Assignee filter:** Select an assignee → only their groups remain → canvas matches
6. **Combined filter:** Select "In Progress" + an assignee → only groups matching BOTH appear
7. **Filter chips:** Active filters show as chips → click ✕ on a chip → that filter clears, groups reappear
8. **Clear all:** Click clear button → all groups and selections reappear
9. **Legend:** Click (i) → status guide overlay shows all 10 colors with descriptions → click "Got it" → overlay closes
10. **Canvas match:** Compare the selection border color on the page with the badge color in the sidebar → they must match for every group
11. **Poll update:** Move a ticket from "To Do" to "In Progress" in JIRA → wait ≤30 seconds → sidebar badge changes from slate to blue, canvas border changes too

## Acceptance Criteria

### Sync-Server
- [ ] `getIssueStatus` fetches `fields: ["status", "assignee", "reporter"]`
- [ ] Response includes `assignee: string | null` and `reporter: string | null`
- [ ] `JiraTicketStatus` schema updated with assignee/reporter
- [ ] OpenAPI spec regenerated
- [ ] Orval regenerated in react-grab with `.js` extension fix
- [ ] **UI verify:** Call `/jira/status` for an ATT ticket → response includes assignee display name

### Status Color Map
- [ ] `status-colors.ts` created with `ATT_STATUS_COLORS` map (10 entries)
- [ ] `getStatusColor()` returns correct config for each ATT status
- [ ] `getStatusColor(undefined)` returns pink (No Task)
- [ ] `getStatusColor("unknown")` returns gray fallback
- [ ] `getStatusLabel()` returns "No Task" or JIRA status name
- [ ] **UI verify:** Each group card badge shows the correct color and status name

### Group Card Updates
- [ ] Group card left border uses `getStatusColor().hex`
- [ ] Status badge shows `getStatusLabel()` with dynamic color
- [ ] Assignee displayed in meta row with person icon when present
- [ ] Reporter displayed in meta row with pen icon (dimmer) when present
- [ ] **UI verify:** Cards visually match the HTML proposal — colored left border, status badge, assignee line

### Filter Bar
- [ ] `filter-tabs.tsx` replaced by `filter-bar.tsx`
- [ ] Status dropdown shows "All Statuses" + 10 ATT statuses + "No Task"
- [ ] Assignee dropdown shows "All Assignees" + distinct assignees from groups
- [ ] Reporter dropdown shows "All Reporters" + distinct reporters from groups
- [ ] **UI verify:** Selecting a status hides non-matching groups from the sidebar list

### Filter Logic
- [ ] `filter-state.ts` created with `FilterState`, `applyFilters()`, `isFilterActive()`
- [ ] Filters are AND-combined
- [ ] `getDistinctAssignees()` and `getDistinctReporters()` return sorted unique names
- [ ] **UI verify:** Select "In Progress" + an assignee → only matching groups shown

### Filter Chips
- [ ] Active filters shown as dismissible chips between filter bar and group list
- [ ] Each chip has ✕ button that clears that filter dimension
- [ ] Clear all button resets all filters
- [ ] Chips hidden when no filter is active
- [ ] **UI verify:** Apply a filter → chip appears → click ✕ → filter clears, groups reappear

### Reveal/Hide Integration
- [ ] `setGroupsRevealed` batch method added to `SelectionVisibilityAPI`
- [ ] `SidebarProps` extended with `onFilterVisibilityChange` callback
- [ ] `core/index.tsx` wires `visibility.setGroupsRevealed` to sidebar callback
- [ ] When filters active, non-matching groups' selections hidden on canvas (overlay boxes + labels disappear)
- [ ] When filters cleared, all selections reappear on canvas
- [ ] No reactivity loops — filter effect reads `filterState()` + `groups()`, writes only via callback to core
- [ ] **UI verify:** Apply status filter → look at the page → only matching group's selections visible → clear filter → all selections return

### Canvas Colors & Type Migration
- [ ] `GroupStatus` type changed from `"open" | "ticketed" | "resolved"` to `string | undefined`
- [ ] `core/index.tsx` passes `group?.jiraStatus` instead of `deriveStatus(group)` as `groupStatus`
- [ ] `overlay-canvas.tsx` uses `getStatusColor(instance.groupStatus).hex` for border
- [ ] `overlay-canvas.tsx` uses `hexToRgba()` helper for fill alpha
- [ ] `selection-label/index.tsx` badges updated for new status model
- [ ] Dead code removed: `statusOverlayColor()`, old `STATUS_COLORS`, old `OVERLAY_*_STATUS_*` constants, `deriveStatus()`
- [ ] **UI verify:** Selection border color on the page matches the badge color in the sidebar

### Status Legend
- [ ] (i) button in sidebar header opens legend overlay
- [ ] Legend shows all 10 ATT statuses with correct color swatches
- [ ] Legend shows "No Task" with pink swatch
- [ ] Legend shows lifecycle flow diagram
- [ ] "Got it" button closes the overlay
- [ ] **UI verify:** Click (i) → legend matches the HTML proposal design

### Extended Group Type
- [ ] `jiraAssignee` and `jiraReporter` added to `SelectionGroupWithJira`
- [ ] `handleStatusUpdate` stores `assignee` and `reporter` from poll response (updated signature)
- [ ] Merge effect (lines 60-74) preserves `jiraAssignee` and `jiraReporter` alongside existing fields
- [ ] **UI verify:** Open a group detail → assignee name visible (if assigned in JIRA)

### Sidebar-Level JIRA Status Polling
- [ ] `sidebar/index.tsx` polls all ticketed groups on mount via `getJiraTicketStatus`
- [ ] Poll repeats every 30 seconds
- [ ] `GroupDetailView` `onStatusUpdate` prop type updated with `assignee`/`reporter`
- [ ] **UI verify:** Open sidebar without clicking a group → all ticketed groups show actual JIRA status (not "To Do")

### Deferred

- [ ] Dynamic board workflow discovery from JIRA API (generalize beyond ATT)
- [ ] Multi-select status filter (currently single-select)
- [ ] Persist filter state across page refreshes
- [ ] Filter by JIRA labels, priority, or sprint
