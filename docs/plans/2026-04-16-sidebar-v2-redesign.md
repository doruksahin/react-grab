# Sidebar V2 Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the sidebar to the design in `poc-stats-bar.html` — dual-metric stats header, Groups/Selections tabs, enriched cards with JIRA metadata, expandable inline groups, inline comments, multi-select + bulk actions, DEV mode toggle.

**Architecture:** Incremental refactor of existing `components/sidebar/`. Each phase ships independently — Phase 1 is visual-only (no data model changes), Phase 2 adds the tabs navigation model, Phase 3 enriches cards with JIRA metadata from the server, Phase 4-5 add new capabilities. The sync store already has most data fields; priority + issue type need a server-side addition.

**Tech Stack:** Solid.js, Tailwind v4, Kobalte (tooltips/collapsible), existing sync store + JIRA polling

**Design reference:** `poc-stats-bar.html` (static HTML mockup at repo root)

---

## Phase 1: Stats Header Upgrade

Upgrade the existing `stats-bar.tsx` from 3 static cells to the POC's dual-metric layout with progress bars. No data model changes — all data is already in the store.

### Task 1: Create progress-bar primitive

**Files:**
- Create: `packages/react-grab/src/components/sidebar/progress-bar.tsx`

**Step 1:** Create a `ProgressBar` component — takes `value` (0-1), `color` (CSS variable or Tailwind class). Renders the POC's 4px-tall track + fill bar. Use `bg-foreground/10` for track, prop-driven fill color. Transition on width.

**Step 2:** Verify it renders in isolation (Storybook or inline in sidebar temporarily).

**Step 3:** Commit: `feat(sidebar): add ProgressBar primitive`

### Task 2: Refactor stats-bar to dual-metric layout

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/stats-bar.tsx`

**Step 1:** Read current `stats-bar.tsx` to understand existing props and derivations.

**Step 2:** Refactor to match POC layout:
- Row 1: "GROUPS" label | Total **N** | Linked **N** | Flagged **N** | `<ProgressBar value={linked/total}>`
- Row 2: "SELECTIONS" label | Total **N** | Ticketed **N** | Flagged **N** | `<ProgressBar value={ticketed/total}>`

Derive all counts from existing `props.groups` and `props.commentItems`:
- `groupsTotal` = `groups.length`
- `groupsLinked` = groups with `jiraTicketId`
- `groupsFlagged` = groups with `jiraFlagged === true`
- `selectionsTotal` = `commentItems.length`
- `selectionsTicketed` = count items whose group has `jiraTicketId`
- `selectionsFlagged` = count items whose group has `jiraFlagged === true`

Use design tokens: `text-foreground/30` for labels, `text-foreground` for bold values, `text-green-500` for linked, `text-red-400` for flagged.

**Step 3:** Verify in the live sidebar with real data.

**Step 4:** Commit: `refactor(sidebar): dual-metric stats bar with progress bars`

---

## Phase 2: Tabs Navigation (Groups / Selections)

Replace the current list-only view with a Groups/Selections tab switcher. The Groups tab shows the existing group list. The Selections tab shows a flat list of all selections with per-selection JIRA metadata.

### Task 3: Add tab state signal + tab bar component

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1:** Add signal: `const [activeTab, setActiveTab] = createSignal<"groups" | "selections">("groups");`

**Step 2:** Create the tab bar UI below the stats header (matching POC's segmented control style). Each tab shows its count badge. Active tab gets `bg-accent` + `text-foreground`.

**Step 3:** Wire the tab state to conditionally render:
- `"groups"` → existing `LooseSelectionList` + `GroupList` flow
- `"selections"` → new flat selection list (placeholder for now — empty div with "Coming in Task 4")

**Step 4:** Commit: `feat(sidebar): add Groups/Selections tab navigation`

### Task 4: Build the Selections tab — flat selection list

**Files:**
- Create: `packages/react-grab/src/components/sidebar/selection-list-tab.tsx`
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1:** Create `SelectionListTab` component. It receives `commentItems` and `groups` (to resolve group metadata per item). Renders a flat `<For each={items}>` with one card per `CommentItem`.

**Step 2:** Each card shows (matching POC):
- JIRA status pill (top-right) — reuse `jira-status-banner.tsx` pattern
- Summary text (from `commentText` or fallback to `componentName`)
- Labels (from the item's group's `jiraLabels`)
- Date row (item `timestamp` formatted via `relative-time.ts`)
- Screenshot row (from `screenshotElement` / `screenshotFullPage`)
- Bottom row: type icon + JIRA key + assignee avatar (from group's JIRA fields)

**Step 3:** Wire into `index.tsx` replacing the Task 3 placeholder.

**Step 4:** Commit: `feat(sidebar): selections tab with flat item list`

---

## Phase 3: Enriched Card Metadata (Priority, Issue Type, Dates)

The POC shows priority icons, issue type icons, and date ranges on cards. Priority and issue type are not currently fetched from JIRA. This requires a server-side addition.

### Task 5: Extend JIRA polling response with priority + issue type

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts` (add fields to `getIssueStatus`)
- Modify: `packages/sync-server/src/schemas/jira.ts` (extend Zod schema)
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts` (extend `SelectionGroupWithJira`)
- Modify: `packages/react-grab/src/features/sync/store/sync-store.ts` (store new fields in `updateJiraStatus`)

**Step 1:** In `jira.service.ts`, add `priority` (name + id) and `issueType` (name + iconUrl) to the `getIssueStatus` response. These come from `issue.fields.priority` and `issue.fields.issuetype` in the JIRA REST API.

**Step 2:** Extend the Zod schema for the response. Run `pnpm --filter @react-grab/sync-server export-spec` + `pnpm --filter react-grab codegen`.

**Step 3:** Add `jiraPriority?: string` and `jiraIssueType?: string` to `SelectionGroupWithJira`.

**Step 4:** Store them in `updateJiraStatus` alongside existing fields.

**Step 5:** Verify with `pnpm build` + manual test (JIRA polling returns new fields).

**Step 6:** Commit: `feat(sync): add JIRA priority and issue type to polling response`

### Task 6: Create priority icon + issue type icon components

**Files:**
- Create: `packages/react-grab/src/components/sidebar/priority-icon.tsx`
- Create: `packages/react-grab/src/components/sidebar/issue-type-icon.tsx`

**Step 1:** `PriorityIcon` — takes `priority: string` ("Highest" | "High" | "Medium" | "Low" | "Lowest"). Renders the colored triangle SVG from the POC. Up-pointing for high, down-pointing for low.

**Step 2:** `IssueTypeIcon` — takes `issueType: string` ("Bug" | "Task" | "Story" | "Epic"). Renders the corresponding icon (bug icon for Bug, checkbox for Task, etc.). Use simple SVG icons, not emoji.

**Step 3:** Commit: `feat(sidebar): add PriorityIcon and IssueTypeIcon components`

### Task 7: Wire metadata into selection cards

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/selection-list-tab.tsx` (or the card component)

**Step 1:** Add the bottom row to each card: `<IssueTypeIcon>` + JIRA key (linked) + `<PriorityIcon>` + assignee avatar.

**Step 2:** Add date range row when dates are available.

**Step 3:** Commit: `feat(sidebar): wire priority, issue type, dates into selection cards`

---

## Phase 4: Expandable Inline Groups

The POC shows groups that expand in-place to reveal child selections — no navigation to a detail view. This addresses PRD-011 (Expandable Inline Groups).

### Task 8: Add inline expand to group cards

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/group-card.tsx`
- Create: `packages/react-grab/src/components/sidebar/group-children.tsx`

**Step 1:** Add a `[isExpanded, setIsExpanded]` signal to `GroupCard`. Toggle on card click (matching POC's chevron rotation).

**Step 2:** Create `GroupChildren` component — renders child `CommentItem`s with the POC's connector-line visual (vertical line with dots). Each child shows: comment text, screenshot thumbnails, relative time.

**Step 3:** Render `<Show when={isExpanded()}><GroupChildren items={props.items} /></Show>` below the card header.

**Step 4:** Keep the existing detail-view navigation as a separate action (e.g., double-click or a "View details" button) so both interaction models coexist.

**Step 5:** Commit: `feat(sidebar): expandable inline groups with child selections (PRD-011)`

---

## Phase 5: Inline Comments on Cards

The POC shows collapsible comment threads on selection cards with a mini reply composer. The `jiraComments` data already exists on each group from JIRA polling.

### Task 9: Create inline comment thread component

**Files:**
- Create: `packages/react-grab/src/components/sidebar/card-comments.tsx`

**Step 1:** Create `CardComments` component. Takes `comments: JiraComment[]` (from the group's `jiraComments`). Renders:
- Toggle header: "Comments (N)" with chevron
- Collapsible body with `<For each={rootComments}>`:
  - Avatar + author + relative time
  - Body text (with `@mention` styled spans)
  - Nested replies (indented, with left border)
- Mini composer at bottom (simple input, not full Tiptap)

**Step 2:** Use existing `relative-time.ts` for timestamps. Reuse avatar pattern from `UserAvatar.tsx`.

**Step 3:** Mount inside the selection card, below screenshots.

**Step 4:** Commit: `feat(sidebar): collapsible inline comment threads on selection cards`

---

## Phase 6: Multi-Select + Bulk Actions

The POC shows checkboxes on cards and a purple bulk action bar at the bottom.

### Task 10: Add multi-select state + checkboxes

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` (state)
- Modify: selection card component (checkbox UI)

**Step 1:** Add `[selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set())` to `index.tsx`. Pass down `selectedIds` + `onToggleSelect` to cards.

**Step 2:** Add checkbox to each card (matching POC's 14px bordered checkbox). Selected state: purple fill + checkmark.

**Step 3:** Commit: `feat(sidebar): multi-select checkboxes on selection cards`

### Task 11: Create bulk action bar

**Files:**
- Create: `packages/react-grab/src/components/sidebar/bulk-action-bar.tsx`

**Step 1:** Create `BulkActionBar` — shows when `selectedIds.size > 0`. Fixed to bottom of sidebar with slide-up animation. Purple background (#a78bfa). Shows: "N selected" + action buttons (Move to group, Create ticket, Delete).

**Step 2:** Wire action callbacks to `index.tsx` handlers.

**Step 3:** Commit: `feat(sidebar): bulk action bar with move, ticket, delete actions`

---

## Phase 7: Search + Filter Refinements

### Task 12: Add search input to filter area

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/filter-bar.tsx`
- Modify: `packages/react-grab/src/features/sidebar/filter-state.ts`

**Step 1:** Add `searchQuery` signal to filter state. Add text input above existing filter dropdowns (matching POC layout).

**Step 2:** Filter both groups and selections by search query (fuzzy match on group name, comment text, component name).

**Step 3:** Add flag-only toggle button next to search (matching POC's 🚩 button).

**Step 4:** Commit: `feat(sidebar): search input and flag-only filter in filter bar`

---

## Phase 8: DEV Mode Toggle

### Task 13: Add DEV mode toggle + dev insights

**Files:**
- Create: `packages/react-grab/src/components/sidebar/dev-insights.tsx`
- Modify: `packages/react-grab/src/components/sidebar/sidebar-header.tsx`
- Modify: selection card component

**Step 1:** Add `[isDevMode, setIsDevMode] = createSignal(false)` to sidebar state. Add toggle switch to header (matching POC's track/thumb toggle).

**Step 2:** Create `DevInsights` component — shows code snippet with tag, node, class, props, file path. Takes data from `CommentItem` fields (`tagName`, `componentName`, `content`).

**Step 3:** Render `<Show when={isDevMode()}><DevInsights item={item} /></Show>` inside each card.

**Step 4:** Commit: `feat(sidebar): DEV mode toggle with per-card technical insights`

---

## Phasing Summary

| Phase | Tasks | Dependencies | Ships independently? |
|-------|-------|-------------|---------------------|
| 1. Stats header | 1-2 | None | Yes |
| 2. Tabs | 3-4 | None | Yes |
| 3. Enriched cards | 5-7 | Server change (Task 5) | Yes |
| 4. Expandable groups | 8 | Phase 2 (tabs) | Yes |
| 5. Inline comments | 9 | Phase 2 (tabs) | Yes |
| 6. Multi-select | 10-11 | Phase 2 (tabs) | Yes |
| 7. Search | 12 | None | Yes |
| 8. DEV mode | 13 | None | Yes |

Phases 1, 2, 7, 8 have zero server dependencies and can start immediately.
Phase 3 requires a sync-server schema change (Task 5).
Phases 4-6 depend on Phase 2 for the tabs shell.
