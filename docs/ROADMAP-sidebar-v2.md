# Sidebar V2 Roadmap

**Source:** `poc-stats-bar.html` prototypes (Apr 2026)
**Scope:** Redesign selection/group cards, add search & filters, surface JIRA metadata

---

## Current State (what exists)

### Data already on `SelectionGroupWithJira`:
- `jiraStatus`, `jiraStatusCategory` (To Do / In Progress / Done)
- `jiraAssignee`, `jiraAssigneeAvatar`
- `jiraReporter`, `jiraReporterAvatar`
- `jiraLabels[]`
- `jiraComments[]` (threaded, with `parentId`)
- `jiraFlagged`, `jiraFlaggedAt`, `jiraFlaggedBy`, `jiraFlaggedByAvatar`
- `jiraUrl`

### Data NOT yet fetched from JIRA (need sync-server changes):
- `priority` (name + icon URL)
- `issuetype` (name — Task or Bug)
- `duedate`
- `created` (ticket creation date)
- `summary` (ticket title — currently derived from group name)

### UI already implemented:
- Selection cards with comment block, screenshots, checkboxes, bulk bar
- Group cards with ticket key, selection count
- DEV mode toggle with component inspect collapsible
- JIRA create dialog (Work Type, Priority, Labels, Summary, Description, Screenshots)
- JIRA comments read/write with threading and @mentions (separate POC)

---

## Phase 1 — Card Layout Redesign
**Goal:** Replace current card layout with compact, JIRA-aligned design

### 1a. New card row structure
Rewrite `SelectionCard` component with 4-row layout:
1. **Summary** — dominant text, single or two lines
2. **Labels** — chip list from `jiraLabels`
3. **Screenshots** — element + full-page thumbs (own row)
4. **Bottom metadata row** — type icon, ticket key, flag, priority, assignee+name

**Verification:**
- [ ] Cards render with new layout in both Groups and Selections tabs
- [ ] Summary text truncates at 2 lines with ellipsis
- [ ] Labels render as chips, empty state handled (no labels = no row)
- [ ] Screenshot thumbs display, missing screenshots handled gracefully
- [ ] Bottom row shows type icon (🐛/☑), ticket key as link, priority SVG arrow, assignee avatar+name
- [ ] "no ticket" cards show only summary + labels + screenshots (no bottom metadata)
- [ ] Visual regression: no broken styles in existing sidebar features

### 1b. JIRA status pill
Add status category pill at card top-right corner (absolute positioned).

**Verification:**
- [ ] Status pill renders for ticketed cards (To Do gray, In Progress blue, Done green)
- [ ] No status pill on unticketed cards
- [ ] Pill doesn't overlap with summary text

### 1c. Date row
Show created → due date with calendar icon below labels.

**Verification:**
- [ ] Date row shows on ticketed cards that have dates
- [ ] Format: `Apr 12, 2026 → Apr 15, 2026`
- [ ] No date row when dates are missing
- [ ] Arrow separator visually muted

### 1d. Flag indicator
Separate 🚩 icon in bottom metadata row for flagged tickets.

**Verification:**
- [ ] Flag icon shows only on flagged cards
- [ ] Flag is distinct from priority and type icons
- [ ] Card left border turns red when flagged (existing behavior preserved)

**Depends on (backend):** Phase 3 for priority, issuetype, duedate, created fields

---

## Phase 2 — Search & Filters
**Goal:** Add fuzzy search + collapsible filter panel (Option B from POC)

### 2a. Search input
Fuzzy text search across summary, ticket key, labels.

**Verification:**
- [ ] Search input renders between nav tabs and card list
- [ ] Typing filters cards in real-time (debounced ~200ms)
- [ ] Empty search shows all cards
- [ ] Match highlighting on summary text (optional, nice-to-have)
- [ ] Clear button (×) appears when input has text

### 2b. Flag toggle
Standalone 🚩 toggle button next to search.

**Verification:**
- [ ] Toggle filters to flagged-only cards
- [ ] Active state: red border highlight
- [ ] Toggles on/off, does not conflict with other filters

### 2c. Collapsible filter panel
Filter icon with badge count opens panel with: Status, Assignee, Reporter, Labels.

**Verification:**
- [ ] Filter icon shows active filter count as badge
- [ ] Panel expands/collapses on click
- [ ] Status: multi-select pills (To Do, In Progress, Done)
- [ ] Assignee: dropdown populated from unique assignees in current cards
- [ ] Reporter: dropdown populated from unique reporters
- [ ] Labels: dropdown populated from unique labels
- [ ] Filters compose (AND logic): status=InProgress + assignee=Salih shows only matching cards
- [ ] Clearing all filters resets badge to 0 and hides badge
- [ ] Filter state persists across tab switches (Groups ↔ Selections)

**Depends on:** Phase 1a (cards must render the data that filters operate on)

---

## Phase 3 — Sync-Server: New JIRA Fields
**Goal:** Fetch priority, issuetype, duedate, created from JIRA and surface on `SelectionGroupWithJira`

### 3a. Extend JIRA field fetch
Add to `jira.service.ts` issue fetch: `priority`, `issuetype`, `duedate`, `created`.

**Verification:**
- [ ] `getTicketStatus` returns new fields: `priority`, `priorityIconUrl`, `issueType`, `dueDate`, `created`
- [ ] Fields are optional — missing values don't break existing flow
- [ ] Existing fields (status, assignee, labels, comments, flagged) unchanged

### 3b. Extend `SelectionGroupWithJira` type
Add: `jiraPriority`, `jiraPriorityIcon`, `jiraIssueType`, `jiraDueDate`, `jiraCreated`.

**Verification:**
- [ ] Type compiles without errors
- [ ] New fields populated in sidebar store when ticket is linked
- [ ] New fields are `undefined` for unlinked groups (no runtime errors)

### 3c. Wire to card components
Pass new fields through to the card layout from Phase 1.

**Verification:**
- [ ] Priority icon + color renders correctly for each level (Highest/High/Medium/Low/Lowest)
- [ ] Issue type icon renders (🐛 Bug, ☑ Task)
- [ ] Date row populated from real JIRA data
- [ ] Cards without tickets show no JIRA metadata

---

## Phase 4 — Expandable Groups
**Goal:** Click a group card to expand and see its child selections inline

### 4a. Group expand/collapse
Add expand chevron + toggle interaction to group cards.

**Verification:**
- [ ] Clicking group card toggles child list visibility
- [ ] Chevron rotates on expand (▶ → ▼)
- [ ] Expand state preserved during scroll
- [ ] Only one group expanded at a time (accordion) — or allow multiple (decide)

### 4b. Child selection rendering
Render child selections with tree-line connector. No JIRA attributes — only comment, screenshots, timestamp.

**Verification:**
- [ ] Child cards show: comment text, screenshot thumbs, relative time
- [ ] Tree-line (left border + dot) connects children to parent
- [ ] No duplicate JIRA data (inherited from group)
- [ ] Empty group shows "No selections" placeholder

---

## Phase 5 — Inline Comments
**Goal:** Show JIRA comments in a collapsible section on ticketed cards

### 5a. Comment toggle
"💬 Comments (N)" collapsible on ticketed cards.

**Verification:**
- [ ] Comment count accurate (matches `jiraComments.length`)
- [ ] Toggle expands/collapses comment list
- [ ] No comment section on unticketed cards
- [ ] "Comments (0)" still shows toggle (allows posting first comment)

### 5b. Comment rendering
Mini comment layout: avatar, author, time, body with @mention highlighting.

**Verification:**
- [ ] Comments render in chronological order
- [ ] Threaded replies indented with left border
- [ ] @mentions highlighted with blue background
- [ ] Avatar shows initials fallback when `authorAvatar` is null
- [ ] Long comments truncate with "show more" (optional, nice-to-have)

### 5c. Reply composer
Inline reply input at bottom of comment section.

**Verification:**
- [ ] Composer renders with current user avatar
- [ ] Submitting calls `addJiraComment` API
- [ ] New comment appears immediately (optimistic update)
- [ ] Error state shown if API fails
- [ ] @mention picker triggered by typing `@` (reuse from `poc-jira-comments.html`)

**Depends on:** Existing `addJiraComment` endpoint (already implemented)

---

## Phase 6 — DEV Mode Separation
**Goal:** DEV insights hidden by default, only visible when DEV toggle is on

**Already partially implemented** — the DEV toggle and `.dev-only` class exist.

**Verification:**
- [ ] DEV toggle in header works globally for the panel
- [ ] "DEV INSIGHTS" collapsible shows under each card only in DEV mode
- [ ] Code snippet (tag, node, class, props, active) renders correctly
- [ ] DEV mode does not affect card layout or JIRA data visibility
- [ ] Toggle state persists across tab switches

---

## Dependency Graph

```
Phase 3 (backend) ──┐
                     ├──→ Phase 1 (card layout) ──→ Phase 2 (search/filters)
                     │                            ──→ Phase 4 (expandable groups)
                     │                            ──→ Phase 5 (inline comments)
                     └──→ Phase 6 (DEV mode) [independent]
```

**Critical path:** Phase 3 → Phase 1 → Phase 2
**Can parallelize:** Phase 4, 5, 6 after Phase 1

---

## Out of Scope (for now)
- Drag-and-drop reordering of cards
- Inline editing of JIRA fields (priority, assignee) from sidebar
- Real-time JIRA webhook push (currently polling)
- Comment emoji reactions
- Card keyboard navigation
