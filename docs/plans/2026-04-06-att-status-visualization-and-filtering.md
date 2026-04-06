# ATT Status Visualization and Filtering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the three-state status model with full ATT JIRA board workflow (10 statuses), add status/assignee/reporter filtering with canvas reveal/hide integration, and add a status legend overlay.

**Architecture:** New `status-colors.ts` module maps JIRA status names → colors. Filter state is a SolidJS signal in the sidebar. Filter visibility uses a new batch `setGroupsRevealed` method on `SelectionVisibilityAPI`, exposed to the sidebar via callback prop. The old `GroupStatus` union type and `deriveStatus()` are replaced by direct `jiraStatus` reads. Sync-server's `getIssueStatus` is expanded with `assignee` + `reporter` fields.

**Tech Stack:** SolidJS (signals, createEffect), jira.js, Hono (sync-server), Zod schemas, Orval (OpenAPI codegen), TailwindCSS

**Spec:** `decree/spec/006-att-status-visualization-and-filtering.md`
**ADR:** `decree/adr/0006-att-board-status-mapping-and-jira-metadata-polling.md`
**PRD:** `decree/prd/004-jira-status-visualization-and-filtering.md`

---

## Task 1: Status Color Map Module

**Files:**
- Create: `packages/react-grab/src/features/sidebar/status-colors.ts`

**Step 1: Create the status color map and helper functions**

```typescript
import type { SelectionGroupWithJira } from "./jira-types.js";

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

export const ALL_ATT_STATUSES = Object.keys(ATT_STATUS_COLORS);

export function getStatusColor(jiraStatus: string | undefined): StatusColorConfig {
  if (!jiraStatus) return NO_TASK_COLOR;
  return ATT_STATUS_COLORS[jiraStatus] ?? UNKNOWN_COLOR;
}

export function getStatusLabel(group: SelectionGroupWithJira): string {
  return group.jiraTicketId ? (group.jiraStatus ?? "To Do") : "No Task";
}
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/sidebar/status-colors.ts
git commit -m "feat: add ATT status color map module"
```

---

## Task 2: Sync-Server — Expand `getIssueStatus` with Assignee/Reporter

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts` — `getIssueStatus` method
- Modify: `packages/sync-server/src/schemas/jira.ts` — `JiraTicketStatus` schema

**Step 1: Update the Zod schema**

In `packages/sync-server/src/schemas/jira.ts`, find the `JiraTicketStatus` constant and add two fields:

```typescript
export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),    // NEW
  reporter: z.string().nullable(),    // NEW
});
```

**Step 2: Update the service method**

In `packages/sync-server/src/services/jira.service.ts`, find `getIssueStatus` (line ~162):

Change `fields: ["status"]` to `fields: ["status", "assignee", "reporter"]`.

Change the return to:

```typescript
return {
  status: issue.fields.status?.name ?? "Unknown",
  statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
  assignee: issue.fields.assignee?.displayName ?? null,
  reporter: issue.fields.reporter?.displayName ?? null,
};
```

**Step 3: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts packages/sync-server/src/schemas/jira.ts
git commit -m "feat: expand getIssueStatus with assignee and reporter fields"
```

---

## Task 3: Regenerate OpenAPI Spec + Orval Types

**Files:**
- Modify: `packages/sync-server/openapi.json` (regenerated)
- Modify: `packages/react-grab/src/generated/sync-api.ts` (regenerated via Orval)

**Step 1: Regenerate the OpenAPI spec**

Check how the spec is generated — look for scripts in `packages/sync-server/package.json`:

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab
cat packages/sync-server/package.json | grep -A5 '"scripts"'
```

Run the OpenAPI generation script (likely `pnpm --filter sync-server openapi` or similar).

**Step 2: Regenerate Orval types in react-grab**

```bash
pnpm --filter react-grab orval
```

Note: There's a known `.js` extension fix needed for Orval output — verify the generated file uses `.js` extensions in imports.

**Step 3: Verify the generated types include `assignee` and `reporter`**

```bash
grep -n "assignee\|reporter" packages/react-grab/src/generated/sync-api.ts
```

**Step 4: Commit**

```bash
git add packages/sync-server/openapi.json packages/react-grab/src/generated/sync-api.ts
git commit -m "chore: regenerate OpenAPI spec and Orval types for assignee/reporter"
```

---

## Task 4: Extend `SelectionGroupWithJira` Type

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts`

**Step 1: Add assignee and reporter fields**

```typescript
export type SelectionGroupWithJira = SelectionGroup & {
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL */
  jiraUrl?: string;
  /** JIRA assignee display name, null if unassigned */
  jiraAssignee?: string | null;
  /** JIRA reporter display name */
  jiraReporter?: string | null;
};
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts
git commit -m "feat: add jiraAssignee and jiraReporter to SelectionGroupWithJira"
```

---

## Task 5: Update `handleStatusUpdate` and Merge Effect in Sidebar

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` — `handleStatusUpdate` (~line 143) and merge effect (~lines 60-74)

**Step 1: Update `handleStatusUpdate` signature and body**

Find `handleStatusUpdate` (~line 143). Change:

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

**Step 2: Update merge effect to preserve new fields**

Find the merge effect (~line 60-74). Add `jiraAssignee` and `jiraReporter` to the preserved fields:

```typescript
return {
  ...pg,
  jiraResolved: local.jiraResolved,
  jiraStatus: local.jiraStatus,
  jiraStatusCategory: local.jiraStatusCategory,
  jiraUrl: local.jiraUrl,
  jiraAssignee: local.jiraAssignee,
  jiraReporter: local.jiraReporter,
};
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat: store assignee/reporter in handleStatusUpdate and merge effect"
```

---

## Task 6: Type Migration — Replace `GroupStatus` with JIRA Status Names

**Files:**
- Modify: `packages/react-grab/src/types.ts` — `GroupStatus` type
- Modify: `packages/react-grab/src/core/index.tsx` — instance `groupStatus` assignment (~line 3817)
- Modify: `packages/react-grab/src/utils/overlay-color.ts` — remove `statusOverlayColor`, `STATUS_COLORS`
- Modify: `packages/react-grab/src/constants.ts` — remove `OVERLAY_*_STATUS_*` constants
- Modify: `packages/react-grab/src/features/sidebar/derive-status.ts` — remove `deriveStatus`
- Modify: `packages/react-grab/src/components/overlay-canvas.tsx` — use new color system
- Modify: `packages/react-grab/src/components/selection-label/index.tsx` — update badge rendering

This is the largest task — it touches the most files. Work carefully.

**Step 1: Add `hexToRgba` utility**

In `packages/react-grab/src/utils/overlay-color.ts`, add:

```typescript
/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

**Step 2: Change `GroupStatus` type in `types.ts`**

Find `export type GroupStatus = "open" | "ticketed" | "resolved";` (~line 437).

Replace with:

```typescript
/** JIRA status name (e.g. "In Progress") or undefined for no ticket */
export type GroupStatus = string | undefined;
```

**Step 3: Update `core/index.tsx` instance creation**

Find the line (~3817) that sets `groupStatus: group ? deriveStatus(group) : ("open" as const)`.

Replace with:

```typescript
groupStatus: group?.jiraStatus,
```

Remove the `deriveStatus` import if it's only used here (check with grep first).

**Step 4: Update `overlay-canvas.tsx`**

Add import at top:

```typescript
import { getStatusColor } from "../features/sidebar/status-colors.js";
import { hexToRgba } from "../utils/overlay-color.js";
```

Find the border color logic (~line 698-700). Replace:

```typescript
// Old:
: instance.groupStatus
  ? statusOverlayColor(instance.groupStatus, STATUS_OVERLAY_BORDER_ALPHA)
  : OVERLAY_BORDER_COLOR_DEFAULT;
// New:
: getStatusColor(instance.groupStatus).hex;
```

Find the fill color logic (~line 703-705). Replace:

```typescript
// Old:
: instance.groupStatus
  ? statusOverlayColor(instance.groupStatus, STATUS_OVERLAY_FILL_ALPHA)
  : OVERLAY_FILL_COLOR_DEFAULT;
// New:
: hexToRgba(getStatusColor(instance.groupStatus).hex, STATUS_OVERLAY_FILL_ALPHA);
```

Remove the `statusOverlayColor` import. Keep `activeGroupOverlayColor` if still used.

**Step 5: Update `selection-label/index.tsx` badges**

Find the badge rendering (~line 457-477). The current logic shows ticket/check icons based on `groupStatus === "ticketed"` / `"resolved"`.

Replace with status-aware rendering:

```typescript
import { getStatusColor } from "../../features/sidebar/status-colors.js";

// Replace the <Show when={(props.groupStatus ?? "open") !== "open"}> block:
<Show when={props.groupStatus || props.jiraTicketId}>
  <div
    data-react-grab-status-badge={props.groupStatus ?? "no-task"}
    class="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-[6px] flex items-center justify-center border-2 border-white"
    style={{
      background: getStatusColor(props.groupStatus).hex,
      "pointer-events": "auto",
    }}
    title={props.groupStatus ?? "No Task"}
  >
    <Show when={props.groupStatus === "Done" || props.groupStatus === "Won't Do"}>
      <IconCheck size={12} class="text-white" />
    </Show>
    <Show when={props.groupStatus && props.groupStatus !== "Done" && props.groupStatus !== "Won't Do"}>
      <IconTicket size={12} class="text-white" />
    </Show>
    <Show when={!props.groupStatus && props.jiraTicketId}>
      <IconTicket size={12} class="text-white" />
    </Show>
  </div>
</Show>
```

**Step 6: Clean up dead code**

- `utils/overlay-color.ts`: Remove `statusOverlayColor`, `STATUS_COLORS` (keep `overlayColor`, `activeGroupOverlayColor`, `isWideGamut`, `hexToRgba`)
- `constants.ts`: Remove `OVERLAY_BORDER_COLOR_STATUS_OPEN`, `OVERLAY_FILL_COLOR_STATUS_OPEN`, `OVERLAY_BORDER_COLOR_STATUS_TICKETED`, `OVERLAY_FILL_COLOR_STATUS_TICKETED`, `OVERLAY_BORDER_COLOR_STATUS_RESOLVED`, `OVERLAY_FILL_COLOR_STATUS_RESOLVED`. Remove the `statusOverlayColor` import.
- `features/sidebar/derive-status.ts`: Remove `deriveStatus` function. Keep `deriveEntryStatus` if still used by filter-tabs (will be removed in Task 8). If `deriveEntryStatus` is the only remaining export, keep the file for now.

**Step 7: Verify build**

```bash
pnpm --filter react-grab build
```

Fix any type errors.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor: replace GroupStatus three-state model with JIRA status names"
```

---

## Task 7: Batch Visibility API — `setGroupsRevealed`

**Files:**
- Modify: `packages/react-grab/src/features/selection-visibility/types.ts` — add method to interface
- Modify: `packages/react-grab/src/features/selection-visibility/index.ts` — implement method

**Step 1: Add to the API interface**

In `types.ts`, find `SelectionVisibilityAPI` interface (~line 63). Add:

```typescript
/** Batch set revealed state for groups by filter results. visibleIds = groups to show, allGroupIds = all groups affected by filtering */
setGroupsRevealed: (visibleIds: Set<string>, allGroupIds: string[]) => void;
```

**Step 2: Implement in `index.ts`**

Find the `createSelectionVisibility` function. Before the return statement (~line 130), add:

```typescript
const setGroupsRevealed = (visibleIds: Set<string>, allGroupIds: string[]) => {
  const allIdSet = new Set(allGroupIds);
  const updatedGroups = deps.groups().map((g) =>
    allIdSet.has(g.id) ? { ...g, revealed: visibleIds.has(g.id) } : g,
  );
  deps.persistGroups(updatedGroups);

  const items = deps.commentItems();
  const updatedItems = items.map((item) =>
    item.groupId && allIdSet.has(item.groupId)
      ? { ...item, revealed: visibleIds.has(item.groupId) }
      : item,
  );
  deps.setCommentItems(updatedItems);
  deps.persistCommentItems(updatedItems);
};
```

Add `setGroupsRevealed` to the return object.

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/types.ts packages/react-grab/src/features/selection-visibility/index.ts
git commit -m "feat: add setGroupsRevealed batch method to SelectionVisibilityAPI"
```

---

## Task 8: Filter State Module

**Files:**
- Create: `packages/react-grab/src/features/sidebar/filter-state.ts`

**Step 1: Create the filter state module**

```typescript
import type { SelectionGroupWithJira } from "./jira-types.js";
import { getStatusLabel } from "./status-colors.js";

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
  if (!isFilterActive(filter)) return groups;
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

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/sidebar/filter-state.ts
git commit -m "feat: add filter state module with applyFilters pure function"
```

---

## Task 9: Filter Bar Component (replaces FilterTabs)

**Files:**
- Create: `packages/react-grab/src/components/sidebar/filter-bar.tsx`
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` — swap FilterTabs for FilterBar

**Step 1: Create `filter-bar.tsx`**

```typescript
import { type Component, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";

interface FilterBarProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  onFilterChange: (filter: FilterState) => void;
}

export const FilterBar: Component<FilterBarProps> = (props) => {
  const handleStatusChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    const statuses = value === "" ? new Set<string>() : new Set([value]);
    props.onFilterChange({ ...props.filter, statuses });
  };

  const handleAssigneeChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    props.onFilterChange({ ...props.filter, assignee: value || null });
  };

  const handleReporterChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    props.onFilterChange({ ...props.filter, reporter: value || null });
  };

  const hasActiveFilter = () =>
    props.filter.statuses.size > 0 ||
    props.filter.assignee !== null ||
    props.filter.reporter !== null;

  const handleClear = () => {
    props.onFilterChange({ statuses: new Set(), assignee: null, reporter: null });
  };

  const selectClass = "bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/80 cursor-pointer min-w-0 flex-1";

  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-white/10 items-center">
      <select class={selectClass} onChange={handleStatusChange} value={[...props.filter.statuses][0] ?? ""}>
        <option value="">All Statuses</option>
        <option value="No Task">No Task</option>
        {ALL_ATT_STATUSES.map((s) => (
          <option value={s}>{s}</option>
        ))}
      </select>
      <select class={selectClass} onChange={handleAssigneeChange} value={props.filter.assignee ?? ""}>
        <option value="">All Assignees</option>
        {props.assignees.map((a) => (
          <option value={a}>{a}</option>
        ))}
      </select>
      <select class={selectClass} onChange={handleReporterChange} value={props.filter.reporter ?? ""}>
        <option value="">All Reporters</option>
        {props.reporters.map((r) => (
          <option value={r}>{r}</option>
        ))}
      </select>
      <Show when={hasActiveFilter()}>
        <button
          class="text-[10px] text-white/50 hover:text-white/80 cursor-pointer whitespace-nowrap"
          onClick={handleClear}
        >
          ✕ Clear
        </button>
      </Show>
    </div>
  );
};
```

**Step 2: Commit (filter-bar only, wiring in Task 11)**

```bash
git add packages/react-grab/src/components/sidebar/filter-bar.tsx
git commit -m "feat: add FilterBar component with status/assignee/reporter dropdowns"
```

---

## Task 10: Filter Chips Component

**Files:**
- Create: `packages/react-grab/src/components/sidebar/filter-chips.tsx`

**Step 1: Create `filter-chips.tsx`**

```typescript
import { type Component, Show, For } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";

interface FilterChipsProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export const FilterChips: Component<FilterChipsProps> = (props) => {
  const chips = () => {
    const result: { label: string; onDismiss: () => void }[] = [];
    for (const status of props.filter.statuses) {
      result.push({
        label: `Status: ${status}`,
        onDismiss: () => {
          const next = new Set(props.filter.statuses);
          next.delete(status);
          props.onFilterChange({ ...props.filter, statuses: next });
        },
      });
    }
    if (props.filter.assignee) {
      result.push({
        label: `Assignee: ${props.filter.assignee}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, assignee: null }),
      });
    }
    if (props.filter.reporter) {
      result.push({
        label: `Reporter: ${props.filter.reporter}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, reporter: null }),
      });
    }
    return result;
  };

  return (
    <Show when={chips().length > 0}>
      <div class="flex flex-wrap gap-1.5 px-4 py-1.5">
        <For each={chips()}>
          {(chip) => (
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/70">
              {chip.label}
              <button
                class="text-white/40 hover:text-white/80 cursor-pointer"
                onClick={chip.onDismiss}
              >
                ✕
              </button>
            </span>
          )}
        </For>
      </div>
    </Show>
  );
};
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/sidebar/filter-chips.tsx
git commit -m "feat: add FilterChips component with dismissible active filter chips"
```

---

## Task 11: Wire Filter State + Visibility into Sidebar

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` — replace FilterTabs, add filter state, add visibility effect
- Modify: `packages/react-grab/src/core/index.tsx` — pass `onFilterVisibilityChange` prop

**Step 1: Update `SidebarProps`**

Add to the interface:

```typescript
onFilterVisibilityChange?: (visibleIds: Set<string>, allGroupIds: string[]) => void;
```

**Step 2: Replace filter state and imports**

Remove:
```typescript
import { FilterTabs, type FilterStatus } from "./filter-tabs.js";
```

Add:
```typescript
import { FilterBar } from "./filter-bar.js";
import { FilterChips } from "./filter-chips.js";
import { type FilterState, EMPTY_FILTER, isFilterActive, applyFilters, getDistinctAssignees, getDistinctReporters } from "../../features/sidebar/filter-state.js";
```

Replace `const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");` with:

```typescript
const [filterState, setFilterState] = createSignal<FilterState>(EMPTY_FILTER);
```

**Step 3: Update `filteredGroups` memo**

Replace the existing `filteredGroups` memo (~line 120-127):

```typescript
const filteredGroups = createMemo(() => {
  const filtered = applyFilters(groups(), filterState());
  return groupedItems().filter((entry: GroupedEntry) =>
    filtered.some((g) => g.id === entry.group.id),
  );
});
```

**Step 4: Add filter visibility effect**

After `filteredGroups`, add:

```typescript
createEffect(() => {
  const filter = filterState();
  const allIds = groups().map((g) => g.id);
  if (!isFilterActive(filter)) {
    props.onFilterVisibilityChange?.(new Set(allIds), allIds);
    return;
  }
  const filtered = applyFilters(groups(), filter);
  const visibleIds = new Set(filtered.map((g) => g.id));
  props.onFilterVisibilityChange?.(visibleIds, allIds);
});
```

**Step 5: Replace `<FilterTabs>` in JSX**

Replace `<FilterTabs activeFilter={activeFilter()} onFilterChange={setActiveFilter} />` with:

```tsx
<FilterBar
  filter={filterState()}
  assignees={getDistinctAssignees(groups())}
  reporters={getDistinctReporters(groups())}
  onFilterChange={setFilterState}
/>
<FilterChips
  filter={filterState()}
  onFilterChange={setFilterState}
/>
```

Update the empty state message from `` `No ${activeFilter()} groups.` `` to `"No groups match the active filters."`.

**Step 6: Wire in `core/index.tsx`**

Find where `<Sidebar>` is rendered (~line 4430+). Add the prop:

```typescript
onFilterVisibilityChange={visibility.setGroupsRevealed}
```

**Step 7: Verify build**

```bash
pnpm --filter react-grab build
```

**Step 8: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx packages/react-grab/src/core/index.tsx
git commit -m "feat: wire filter state and batch visibility into sidebar"
```

---

## Task 12: Update Group Card with Status Colors

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/group-card.tsx`

**Step 1: Read current `group-card.tsx`**

Use Serena `find_symbol` on `GroupCard` with `include_body=True` to see current implementation.

**Step 2: Add status color imports and update rendering**

Add imports:

```typescript
import { getStatusColor, getStatusLabel } from "../../features/sidebar/status-colors.js";
```

Replace the status derivation. Find `const status = () => deriveStatus(props.entry);` and replace with:

```typescript
const statusLabel = () => getStatusLabel(props.entry.group);
const statusColor = () => getStatusColor(props.entry.group.jiraStatus);
```

Update the group card to show:
- **Left border:** `border-l-2` with `style={{ "border-left-color": statusColor().hex }}`
- **Status badge:** Text showing `statusLabel()` with background `statusColor().bg` and text color `statusColor().text`
- **Assignee line:** When `props.entry.group.jiraAssignee` is present, show person icon + name
- **Reporter line:** When `props.entry.group.jiraReporter` is present, show pen icon + name (dimmer opacity)

Remove the `deriveStatus` import.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-card.tsx
git commit -m "feat: update group card with JIRA status colors and assignee/reporter display"
```

---

## Task 13: Status Legend Overlay

**Files:**
- Create: `packages/react-grab/src/components/sidebar/status-legend.tsx`
- Modify: `packages/react-grab/src/components/sidebar/sidebar-header.tsx` — add (i) button

**Step 1: Create `status-legend.tsx`**

```typescript
import { type Component, For } from "solid-js";
import { getStatusColor, ALL_ATT_STATUSES, type StatusColorConfig } from "../../features/sidebar/status-colors.js";

interface StatusLegendProps {
  onClose: () => void;
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  "No Task": "Selection group not yet linked to a JIRA ticket",
  "To Do": "Ticket created, not yet started",
  "In Progress": "Developer actively working on it",
  "Code Review": "Pull request submitted for review",
  "Test": "QA testing in progress",
  "Test Passed": "QA approved, ready for UAT",
  "UAT": "User acceptance testing",
  "In Preprod": "Deployed to pre-production environment",
  "In Production": "Live in production",
  "Won't Do": "Ticket closed without implementation",
  "Done": "Completed and verified",
};

const FLOW = ["No Task", "To Do", "In Progress", "Code Review", "Test", "Test Passed", "UAT", "In Preprod", "In Production", "Done"];

export const StatusLegend: Component<StatusLegendProps> = (props) => {
  return (
    <div class="absolute inset-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-sm flex flex-col overflow-y-auto">
      <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span class="text-[13px] font-semibold text-white">Status Legend</span>
        <button
          class="text-[11px] text-white/60 hover:text-white cursor-pointer"
          onClick={props.onClose}
        >
          Got it
        </button>
      </div>
      <div class="px-4 py-3 space-y-2">
        <For each={FLOW}>
          {(status) => {
            const color = status === "No Task"
              ? getStatusColor(undefined)
              : getStatusColor(status);
            return (
              <div class="flex items-start gap-2.5">
                <div
                  class="w-3 h-3 rounded-sm mt-0.5 shrink-0"
                  style={{ background: color.hex }}
                />
                <div>
                  <div class="text-[11px] font-medium text-white/90">{status}</div>
                  <div class="text-[10px] text-white/50">{STATUS_DESCRIPTIONS[status]}</div>
                </div>
              </div>
            );
          }}
        </For>
        <div class="mt-3 pt-3 border-t border-white/10">
          <div class="text-[10px] text-white/40 leading-relaxed">
            Lifecycle: No Task → To Do → In Progress → Code Review → Test → Test Passed → UAT → In Preprod → In Production → Done
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Add (i) button to `sidebar-header.tsx`**

Read the current `SidebarHeader` component. Add a new prop `onInfoClick` and render an (i) button:

```tsx
<button
  class="w-6 h-6 rounded-full border border-white/20 text-[11px] text-white/60 hover:text-white/80 hover:border-white/40 cursor-pointer flex items-center justify-center"
  onClick={props.onInfoClick}
  title="Status legend"
>
  i
</button>
```

**Step 3: Wire legend state in `sidebar/index.tsx`**

Add state: `const [showLegend, setShowLegend] = createSignal(false);`

Pass `onInfoClick={() => setShowLegend(true)}` to `SidebarHeader`.

Render legend overlay:

```tsx
<Show when={showLegend()}>
  <StatusLegend onClose={() => setShowLegend(false)} />
</Show>
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/status-legend.tsx packages/react-grab/src/components/sidebar/sidebar-header.tsx packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat: add status legend overlay with (i) button in sidebar header"
```

---

## Task 14: Clean Up Old Filter Tabs

**Files:**
- Delete: `packages/react-grab/src/components/sidebar/filter-tabs.tsx`
- Modify: `packages/react-grab/src/features/sidebar/derive-status.ts` — remove if fully unused

**Step 1: Check for remaining usages**

```bash
grep -rn "filter-tabs\|FilterTabs\|deriveStatus\|deriveEntryStatus" packages/react-grab/src/ --include="*.ts" --include="*.tsx"
```

**Step 2: Remove unused files/exports**

Delete `filter-tabs.tsx` if no remaining imports. Remove `deriveStatus` from `derive-status.ts` if unused. If `deriveEntryStatus` is also unused (replaced by the new `filteredGroups` logic), delete the entire file and update the barrel export in `features/sidebar/index.ts`.

**Step 3: Verify build**

```bash
pnpm --filter react-grab build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old FilterTabs and deriveStatus dead code"
```

---

## Task 15: Final Build + Smoke Test

**Step 1: Full build**

```bash
pnpm --filter react-grab build
pnpm --filter sync-server build
```

**Step 2: Run existing tests**

```bash
pnpm --filter react-grab test 2>&1 | tail -20
```

**Step 3: Manual smoke test checklist (from SPEC-006 UI Verification)**

Verify each item from the SPEC acceptance criteria marked with "UI verify". These are manual checks — document results.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test findings"
```
