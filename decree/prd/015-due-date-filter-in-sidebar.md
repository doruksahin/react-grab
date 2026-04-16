---
date: '2026-04-16'
references:
- PRD-004
status: implemented
---

# PRD-015 Due Date Filter in Sidebar

**Design POC:** [`docs/poc/due-date-filter.html`](../../docs/poc/due-date-filter.html) — standalone HTML comparing two UX variants. **Option A (Preset Select)** is approved: a 5th Select added to the existing `FilterBar`, identical primitive and sizing to the other four filters, with six presets mapped to JQL semantics.

## Problem Statement

PRD-004 introduced the sidebar `FilterBar` — four `Select` dropdowns for Status, Assignee, Reporter, and Label that narrow an already-loaded list of `SelectionGroupWithJira[]`. For a PM or tech lead reviewing a page with a dozen or more ticketed selections, these four axes cover "what is this?" and "who owns it?" but not **"when is it due?"**.

Due date is already displayed on every group card — the metadata is present in `group.jiraDueDate` and formatted via `formatDueDate()` in `selection-list-tab.tsx`. What is missing is the ability to *slice the list* by that axis. The user today has to visually scan every card, mentally comparing each formatted date against today's date, to answer questions like:

- "What's overdue on this page?" — the most common triage question when joining a standup or planning a sprint.
- "What's on fire for today?" — identifying the cards that should be resolved by end-of-day.
- "What's coming up this week so I can prepare?" — weekly planning.
- "Which of these even has a due date set?" — spotting tickets that haven't been scoped into a deadline.

Without a filter, a sidebar with 15+ cards forces the user to open JIRA separately or mentally reconstruct the date math each time. This contradicts the sidebar's promise of being the single surface where a PM can triage visual feedback without context-switching.

The resolution is a fifth `Select` in the existing `FilterBar` with six presets that cover the 90% case: **All due dates · Overdue · Due today · This week · Next 7 days · No due date**. The filter runs client-side over already-loaded groups (same architecture as the other four filters), and each preset's semantics are documented as the JQL clause it would translate to (`duedate < now()`, `duedate is EMPTY`, etc.) so that a future server-side refetch pathway can be added without reinventing the preset vocabulary.

## Requirements

### Interaction

- R1: A fifth `Select` titled "All due dates" (when inactive) sits in the sidebar `FilterBar` alongside Status, Assignee, Reporter, and Label
- R2: Opening the Select reveals six options: `All due dates`, `Overdue`, `Due today`, `This week`, `Next 7 days`, `No due date`
- R3: Selecting a preset filters the visible group list in real time — no Apply button, no confirmation step (matches the other four filters)
- R4: The filter composes with the other four filters using AND — a selected Status AND a selected due-date preset both must match
- R5: Choosing `All due dates` (or clearing via the existing "✕ Clear" affordance) removes the due-date constraint and restores the other four filters' state
- R6: The existing "✕ Clear" button in the `FilterBar` clears the due-date filter along with the others

### Preset semantics (client-side matcher ↔ JQL equivalence)

- R7: `Overdue` matches groups where `jiraDueDate` is non-null and strictly before today (local midnight). JQL: `duedate < now()`
- R8: `Due today` matches groups where `jiraDueDate` equals today (local midnight). JQL: `duedate = now()`
- R9: `This week` matches groups where `jiraDueDate` falls within the current Monday–Sunday range (inclusive, local time). JQL: `duedate >= startOfWeek() AND duedate <= endOfWeek()`
- R10: `Next 7 days` matches groups where `jiraDueDate` is between today and today+7 (inclusive, local time). JQL: `duedate >= now() AND duedate <= 7d`
- R11: `No due date` matches groups where `jiraDueDate` is null or missing. JQL: `duedate is EMPTY`
- R12: Groups without a JIRA ticket (`jiraTicketId == null`) are filtered as `No due date` — they have no JIRA field so their due date is effectively empty

### Visual

- R13: The Select uses the exact same primitive, height (26px), font size (11px), background, and border as the other four `FilterBar` selects — identical `triggerClass`
- R14: When a non-default preset is active, the Select's trigger matches the existing visual-state conventions (no new active-state styling invented for this filter alone)
- R15: The filter appears inline with the other four selects in source order: `Status · Assignee · Reporter · Label · Due date`. It wraps naturally on narrow widths via the existing `flex-wrap` container

### Scope

- R16: The filter extends the existing client-side architecture — it adds a `dueDatePreset` field to `FilterState` and a branch in `applyFilters()` alongside the existing status/assignee/reporter/label branches
- R17: The feature does **not** introduce a new HTTP endpoint, new sync-server route, or new polling behaviour — it operates on the groups already loaded by the sync store
- R18: The feature does **not** introduce a custom date-range calendar, a popover, or any new UI primitive beyond what `FilterBar` already uses

## Acceptance Criteria (Testable)

- AC1: When no due-date preset is selected, all groups remain visible regardless of `jiraDueDate`
- AC2: Selecting `Overdue` shows only groups whose `jiraDueDate` is before today
- AC3: Selecting `Due today` shows only groups whose `jiraDueDate` equals today
- AC4: Selecting `This week` shows only groups whose `jiraDueDate` is between Monday and Sunday of the current week
- AC5: Selecting `Next 7 days` shows only groups whose `jiraDueDate` is between today and today+7
- AC6: Selecting `No due date` shows only groups with a null `jiraDueDate` (including groups with no JIRA ticket)
- AC7: Combining a due-date preset with a Status filter applies both (AND) — no group appears unless it matches both
- AC8: The "✕ Clear" button clears the due-date preset along with the other filters
- AC9: The due-date Select is present in the `FilterBar` at all times (does not require a ticketed group to exist to render)
- AC10: Selecting a preset does not trigger any HTTP request (no sync-server call, no JIRA API call)
- AC11: The preset vocabulary and JQL equivalence is documented in the SPEC so a future server-side refetch feature can reuse the same preset keys

## Success Criteria

- A PM scanning a page with 15+ ticketed selections can answer "what's overdue here?" in a single click, without opening JIRA
- The visual footprint of the new filter is indistinguishable in weight from the existing four — no user remarks that the `FilterBar` has grown "heavier" or "busier"
- The feature ships with zero backend changes — the only diff touches `FilterState`, `applyFilters`, and `FilterBar.tsx`
- If and when a server-side due-date refetch is later added (e.g. to find tickets *outside* the loaded set), the preset keys (`overdue`, `today`, `this-week`, `next-7`, `none`) and their JQL equivalents are reused unchanged

## Out of Scope

- A custom date-range picker (arbitrary `duedate >= X AND duedate <= Y`) — the POC shows this as "Option B" and it is deferred until there is explicit user demand
- A popover-based UI (calendar grid, multi-column preset list) — the Select-based UX is sufficient for v1
- Server-side JQL refetch that queries JIRA for tickets not yet in the sync store — a future feature, predicated on a separate sync-server route
- "This sprint" / "Next sprint" presets — sprint boundaries require JIRA sprint metadata we do not currently sync; revisit if sprint data becomes part of the sync payload
- Multi-select presets (e.g. `Overdue` + `Due today` as two checkboxes) — single-select Select is consistent with the other four filters
- Relative date display on cards (e.g. "Due in 3 days" vs the current `Apr 19` format) — orthogonal to filtering, tracked separately if requested
- Persisting the user's last-selected preset across sessions — the other four filters do not persist either; stay consistent
