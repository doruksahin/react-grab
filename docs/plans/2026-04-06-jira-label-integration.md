# JIRA Label Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose JIRA ticket labels in the sidebar (filter bar, filter chips, detail header) and in the floating selection label overlay.

**Architecture:** Labels are fetched alongside existing JIRA status fields by extending the backend's `getIssueStatus` call, propagated through the same data pipeline (schema → generated type → poller → group signal → UI), and wired into the existing filter/display pattern already used by assignee and reporter.

**Tech Stack:** TypeScript, Hono (sync-server), SolidJS (react-grab), Zod, jira.js

---

## Data Flow Overview

```
jira.service.ts (getIssueStatus adds labels field)
  → jira.ts schema (JiraTicketStatus adds labels)
  → sync-api.ts generated type (GetJiraTicketStatus200 adds labels)
  → jira-types.ts (SelectionGroupWithJira adds jiraLabels)
  → core/index.tsx (onStatusUpdate maps status.labels → jiraLabels)
  → filter-state.ts (label filter + getDistinctLabels + applyFilters)
  → filter-bar.tsx (label dropdown)
  → filter-chips.tsx (label chip)
  → sidebar/index.tsx (pass labels to FilterBar)
  → detail-header.tsx (display labels)
  → core/index.tsx (thread jiraLabels into SelectionLabelInstance)
```

---

### Task 1: Fetch labels in JIRA service

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts:164-176`

**Step 1: Add `labels` to the JIRA fields fetch and return value**

In `getIssueStatus()`, extend `fields` array and return value:

```typescript
async getIssueStatus(ticketId: string) {
  const issue = await this.client.issues.getIssue({
    issueIdOrKey: ticketId,
    fields: ["status", "assignee", "reporter", "labels"],
  });
  return {
    status: issue.fields.status?.name ?? "Unknown",
    statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
    assignee: issue.fields.assignee?.displayName ?? null,
    reporter: issue.fields.reporter?.displayName ?? null,
    jiraUrl: `${this.config.baseUrl}/browse/${ticketId}`,
    labels: (issue.fields.labels as string[] | undefined) ?? [],
  };
}
```

**Step 2: Verify by inspection** — no automated test here, just ensure the type shape is consistent with the next task.

**Step 3: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts
git commit -m "feat(jira): fetch labels field from JIRA issue status"
```

---

### Task 2: Add labels to the Zod response schema

**Files:**
- Modify: `packages/sync-server/src/schemas/jira.ts:31-37`

**Step 1: Extend `JiraTicketStatus` schema**

```typescript
export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  jiraUrl: z.string(),
  labels: z.array(z.string()),
});
```

**Step 2: Commit**

```bash
git add packages/sync-server/src/schemas/jira.ts
git commit -m "feat(jira): add labels to JiraTicketStatus schema"
```

---

### Task 3: Update generated frontend type

**Files:**
- Modify: `packages/react-grab/src/generated/sync-api.ts:197-205`

**Step 1: Add `labels` to `GetJiraTicketStatus200`**

The generated file is checked in — update it manually to match the schema:

```typescript
export type GetJiraTicketStatus200 = {
  status: string;
  statusCategory: string;
  /** @nullable */
  assignee: string | null;
  /** @nullable */
  reporter: string | null;
  jiraUrl: string;
  labels: string[];
};
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/generated/sync-api.ts
git commit -m "feat(jira): add labels to GetJiraTicketStatus200 generated type"
```

---

### Task 4: Add `jiraLabels` to `SelectionGroupWithJira`

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts`

**Step 1: Add field**

```typescript
export type SelectionGroupWithJira = SelectionGroup & {
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
  /** JIRA assignee display name, null if unassigned */
  jiraAssignee?: string | null;
  /** JIRA reporter display name, null if unknown */
  jiraReporter?: string | null;
  /** JIRA labels array, e.g. ["UI Ticket Manager", "frontend"] */
  jiraLabels?: string[];
};
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts
git commit -m "feat(jira): add jiraLabels to SelectionGroupWithJira"
```

---

### Task 5: Thread labels through `onStatusUpdate` in core

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx` (around line 3856–3868)

**Step 1: Map `status.labels` in the `onStatusUpdate` handler**

Find the `onStatusUpdate` callback (inside `createJiraStatusPoller`) and add `jiraLabels`:

```typescript
onStatusUpdate: (groupId, status) => {
  const resolved = status.statusCategory.toLowerCase() === "done";
  const updated = selectionGroups.groups().map((g) =>
    g.id === groupId
      ? {
          ...g,
          jiraStatus: status.status,
          jiraStatusCategory: status.statusCategory,
          jiraAssignee: status.assignee,
          jiraReporter: status.reporter,
          jiraLabels: status.labels,      // ← add this
          jiraUrl: status.jiraUrl,
          // ...rest of existing fields unchanged
        }
      : g,
  );
  selectionGroups.setGroups(updated as SelectionGroupWithJira[]);
},
```

> Note: Don't change anything else in this block — just add `jiraLabels: status.labels`.

**Step 2: Also thread `jiraLabels` into `SelectionLabelInstance` construction** (~line 3820–3825):

Find where `jiraAssignee: group?.jiraAssignee` is set and add alongside it:

```typescript
jiraAssignee: group?.jiraAssignee,
jiraReporter: group?.jiraReporter,
jiraLabels: group?.jiraLabels,    // ← add this
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(jira): thread jiraLabels from poll response into group signal"
```

---

### Task 6: Add label filter to `FilterState`

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/filter-state.ts`

**Step 1: Update `FilterState`, `EMPTY_FILTER`, `isFilterActive`, `applyFilters`, and add `getDistinctLabels`**

```typescript
import type { SelectionGroupWithJira } from "./jira-types.js";
import { getStatusLabel } from "./status-colors.js";

export interface FilterState {
  statuses: Set<string>;        // empty = all
  assignee: string | null;      // null = all
  reporter: string | null;      // null = all
  label: string | null;         // null = all
}

export const EMPTY_FILTER: FilterState = {
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
};

export function isFilterActive(filter: FilterState): boolean {
  return filter.statuses.size > 0 || filter.assignee !== null || filter.reporter !== null || filter.label !== null;
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
    if (filter.label && !(g.jiraLabels ?? []).includes(filter.label)) return false;
    return true;
  });
}

export function getDistinctAssignees(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraAssignee).filter(Boolean) as string[])].sort();
}

export function getDistinctReporters(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraReporter).filter(Boolean) as string[])].sort();
}

export function getDistinctLabels(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.flatMap(g => g.jiraLabels ?? []).filter(Boolean))].sort();
}
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/sidebar/filter-state.ts
git commit -m "feat(sidebar): add label field to FilterState with getDistinctLabels helper"
```

---

### Task 7: Add label dropdown to `FilterBar`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-bar.tsx`

**Step 1: Add `labels` prop and label handler**

Update props interface and add dropdown. Here is the full updated file:

```tsx
import { type Component, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { ALL_ATT_STATUSES } from "../../features/sidebar/status-colors.js";

interface FilterBarProps {
  filter: FilterState;
  assignees: string[];
  reporters: string[];
  labels: string[];
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

  const handleLabelChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    props.onFilterChange({ ...props.filter, label: value || null });
  };

  const hasActiveFilter = () =>
    props.filter.statuses.size > 0 ||
    props.filter.assignee !== null ||
    props.filter.reporter !== null ||
    props.filter.label !== null;

  const handleClear = () => {
    props.onFilterChange({ statuses: new Set(), assignee: null, reporter: null, label: null });
  };

  const selectClass = "bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white/80 cursor-pointer min-w-0 flex-1";

  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-white/10 items-center flex-wrap">
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
      <Show when={props.labels.length > 0}>
        <select class={selectClass} onChange={handleLabelChange} value={props.filter.label ?? ""}>
          <option value="">All Labels</option>
          {props.labels.map((l) => (
            <option value={l}>{l}</option>
          ))}
        </select>
      </Show>
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

> Note: Added `flex-wrap` to the container so the 4th dropdown wraps gracefully if horizontal space is tight.

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/sidebar/filter-bar.tsx
git commit -m "feat(sidebar): add label dropdown to FilterBar"
```

---

### Task 8: Add label chip to `FilterChips`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-chips.tsx`

**Step 1: Add label chip after reporter chip**

In the `chips()` function, after the `reporter` block add:

```typescript
if (props.filter.label) {
  result.push({
    label: `Label: ${props.filter.label}`,
    onDismiss: () => props.onFilterChange({ ...props.filter, label: null }),
  });
}
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/sidebar/filter-chips.tsx
git commit -m "feat(sidebar): add label chip to FilterChips"
```

---

### Task 9: Wire labels into sidebar `index.tsx`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Import `getDistinctLabels`**

In the import line for filter-state (line 19), add `getDistinctLabels`:

```typescript
import { type FilterState, EMPTY_FILTER, isFilterActive, applyFilters, getDistinctAssignees, getDistinctReporters, getDistinctLabels } from "../../features/sidebar/filter-state.js";
```

**Step 2: Pass `labels` to `FilterBar`**

Find the `<FilterBar>` usage (around line 172) and add the `labels` prop:

```tsx
<FilterBar
  filter={filterState()}
  assignees={getDistinctAssignees(props.groups)}
  reporters={getDistinctReporters(props.groups)}
  labels={getDistinctLabels(props.groups)}
  onFilterChange={setFilterState}
/>
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat(sidebar): pass labels to FilterBar from getDistinctLabels"
```

---

### Task 10: Display labels in `DetailHeader`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/detail-header.tsx`

**Step 1: Show labels as small tags below assignee/reporter row**

Add a `<Show>` block after the existing assignee/reporter row inside the `<Show when={groupWithJira().jiraTicketId}>` block:

```tsx
<Show when={(groupWithJira().jiraLabels ?? []).length > 0}>
  <div class="flex flex-wrap gap-1 mt-1 pl-7">
    {(groupWithJira().jiraLabels ?? []).map((lbl) => (
      <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
        {lbl}
      </span>
    ))}
  </div>
</Show>
```

The full `<Show when={groupWithJira().jiraTicketId}>` block will look like:

```tsx
<Show when={groupWithJira().jiraTicketId}>
  <div class="flex gap-3 mt-1.5 pl-7 text-[11px]">
    <a
      href={groupWithJira().jiraUrl ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      class="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
      style={{ "pointer-events": "auto" }}
    >
      {groupWithJira().jiraTicketId}
    </a>
    <Show when={groupWithJira().jiraAssignee}>
      <span class="text-[10px] text-white/50">
        👤 {groupWithJira().jiraAssignee}
      </span>
    </Show>
    <Show when={groupWithJira().jiraReporter}>
      <span class="text-[10px] text-white/30">
        ✏️ {groupWithJira().jiraReporter}
      </span>
    </Show>
  </div>
  <Show when={(groupWithJira().jiraLabels ?? []).length > 0}>
    <div class="flex flex-wrap gap-1 mt-1 pl-7">
      {(groupWithJira().jiraLabels ?? []).map((lbl) => (
        <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
          {lbl}
        </span>
      ))}
    </div>
  </Show>
</Show>
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/sidebar/detail-header.tsx
git commit -m "feat(sidebar): show JIRA labels in DetailHeader"
```

---

### Task 11: Display labels in the floating selection label overlay

The floating overlay on-page uses `SelectionLabelInstance` (in `types.ts`) and renders JIRA info through `jira-meta.tsx`.

**Files:**
- Modify: `packages/react-grab/src/types.ts` (find `SelectionLabelInstance`, add `jiraLabels`)
- Modify: `packages/react-grab/src/components/selection-label/jira-meta.tsx` (render labels)

**Step 1: Add `jiraLabels` to `SelectionLabelInstance` in `types.ts`**

Find the `jiraReporter` field and add after it:

```typescript
jiraReporter?: string | null;
jiraLabels?: string[];
```

**Step 2: Render labels in `jira-meta.tsx`**

After the existing reporter `<Show>` block, add:

```tsx
<Show when={(props.labels ?? []).length > 0}>
  <div class="flex flex-wrap gap-1 mt-0.5">
    {(props.labels ?? []).map((lbl) => (
      <span class="text-[8px] px-1 py-0.5 rounded-full bg-black/10 text-black/40">
        {lbl}
      </span>
    ))}
  </div>
</Show>
```

> Note: Check the existing `jira-meta.tsx` prop interface — add `labels?: string[]` to it and pass `instance.jiraLabels` from wherever `JiraMeta` is rendered.

**Step 3: Commit**

```bash
git add packages/react-grab/src/types.ts packages/react-grab/src/components/selection-label/jira-meta.tsx
git commit -m "feat(selection-label): display JIRA labels in floating overlay jira-meta"
```

---

## Summary of changed files

| File | Change |
|------|--------|
| `packages/sync-server/src/services/jira.service.ts` | Add `labels` to `getIssueStatus` fetch + return |
| `packages/sync-server/src/schemas/jira.ts` | Add `labels: z.array(z.string())` to `JiraTicketStatus` |
| `packages/react-grab/src/generated/sync-api.ts` | Add `labels: string[]` to `GetJiraTicketStatus200` |
| `packages/react-grab/src/features/sidebar/jira-types.ts` | Add `jiraLabels?: string[]` to `SelectionGroupWithJira` |
| `packages/react-grab/src/core/index.tsx` | Map `status.labels → jiraLabels` in poller callback + thread into `SelectionLabelInstance` |
| `packages/react-grab/src/features/sidebar/filter-state.ts` | Add `label` field, `getDistinctLabels`, update `applyFilters`/`isFilterActive`/`EMPTY_FILTER` |
| `packages/react-grab/src/components/sidebar/filter-bar.tsx` | Add `labels` prop + label dropdown |
| `packages/react-grab/src/components/sidebar/filter-chips.tsx` | Add label chip |
| `packages/react-grab/src/components/sidebar/index.tsx` | Import `getDistinctLabels`, pass to `FilterBar` |
| `packages/react-grab/src/components/sidebar/detail-header.tsx` | Show label pills in JIRA info row |
| `packages/react-grab/src/types.ts` | Add `jiraLabels?: string[]` to `SelectionLabelInstance` |
| `packages/react-grab/src/components/selection-label/jira-meta.tsx` | Render labels in floating overlay |
