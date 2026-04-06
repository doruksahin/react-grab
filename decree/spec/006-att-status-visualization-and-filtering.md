---
status: draft
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

When filters change in `Sidebar.index.tsx`:

```typescript
createEffect(() => {
  const filtered = applyFilters(groups(), filterState());
  const filteredIds = new Set(filtered.map(g => g.id));

  // Hide groups not matching filters
  for (const group of groups()) {
    const shouldReveal = filteredIds.has(group.id);
    if (group.revealed !== shouldReveal) {
      visibility.handleToggleGroup(group.id);
    }
  }
});
```

This leverages the existing `SelectionVisibility` API — `handleToggleGroup(groupId)` toggles the `revealed` flag on all comments in the group, which the overlay canvas already respects. No new visibility system needed.

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

`overlay-canvas.tsx` uses `getStatusColor(instance.groupStatus).hex` to set `strokeStyle` and a lower-alpha version for `fillStyle`. This replaces the current `statusOverlayColor()` approach from SPEC-004.

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
- [ ] When filters active, non-matching groups' selections hidden on canvas (overlay boxes + labels disappear)
- [ ] Uses existing `SelectionVisibility` API (`handleToggleGroup`) — no new visibility system
- [ ] When filters cleared, all selections reappear on canvas
- [ ] **UI verify:** Apply status filter → look at the page → only matching group's selections visible → clear filter → all selections return

### Canvas Colors
- [ ] Canvas overlay border color comes from `getStatusColor().hex`
- [ ] Canvas fill uses same hex at lower alpha
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
- [ ] `handleStatusUpdate` stores assignee/reporter from poll response
- [ ] **UI verify:** Open a group detail → assignee name visible (if assigned in JIRA)

### Deferred

- [ ] Dynamic board workflow discovery from JIRA API (generalize beyond ATT)
- [ ] Multi-select status filter (currently single-select)
- [ ] Persist filter state across page refreshes
- [ ] Filter by JIRA labels, priority, or sprint
