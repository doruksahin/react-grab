---
date: '2026-04-16'
references:
- PRD-015
status: accepted
---

# ADR-0015 Due date filter — preset Select over client-side loaded groups

## Context and Problem Statement

PRD-015 adds a due-date filter to the sidebar `FilterBar`. Before implementation, two orthogonal questions must be resolved:

1. **Control shape** — how the user picks a due-date constraint. The filter bar already uses four `Select` dropdowns (Status, Assignee, Reporter, Label). We can follow that pattern, or introduce a richer control (popover + range calendar) to enable arbitrary date ranges.
2. **Data source** — where the filter runs. The existing four filters narrow the `SelectionGroupWithJira[]` already in the sync store (client-side). A due-date filter could instead re-issue a JQL query to sync-server to find tickets outside the loaded set.

The POC ([`docs/poc/due-date-filter.html`](../../docs/poc/due-date-filter.html)) prototypes both control shapes with live mock data. The JQL-refetch pathway is architectural; it was discussed but not built.

## Decision Drivers

- **Consistency with existing filter bar** — users already have a mental model for four identical Selects; deviating for one axis increases cognitive load
- **Implementation cost** — a new Kobalte-backed Calendar + Popover primitive is ~300+ lines and introduces shadow-DOM portal wiring (ADR-0005); a fifth Select is a trivial extension of existing code
- **Coverage of the 90% case** — triage questions ("what's overdue?", "what's due today?", "what has no deadline?") do not require arbitrary ranges
- **Scope of data in the sync store** — the store already contains every group the user cares about (the ones surfaced by the sync-server for this workspace); filtering on already-loaded data does not leave any valid results hidden
- **Forward compatibility** — a preset vocabulary that maps 1:1 to JQL clauses (`duedate < now()`, `duedate is EMPTY`) can be reused unchanged if a server-side refetch becomes necessary later
- **Visual budget** — the `FilterBar` lives inside a narrow sidebar column; a popover control that expands to 420px wide breaks the compact layout on narrow widths

## Considered Options

### Option A — Preset Select, client-side filter (CHOSEN)

Add a fifth `Select` to `FilterBar` with six presets (`All due dates`, `Overdue`, `Due today`, `This week`, `Next 7 days`, `No due date`). Extend `FilterState` with a `dueDatePreset` field and add a matcher branch to `applyFilters()`. The filter runs over the already-loaded `SelectionGroupWithJira[]`; no network call.

Each preset corresponds to a documented JQL clause so the vocabulary survives if a future server-side refetch is added.

**Pros**
- Identical primitive, height, font, and behaviour as the other four filters — zero new UI vocabulary
- ~40 lines of implementation: one new `Select`, one new field, one new matcher branch, one new test file
- No new UI primitives, no Kobalte Calendar, no Popover, no shadow-DOM portal wiring
- Client-side means instant filter response — no loading state, no stale data window
- Composes cleanly with the other four filters via the existing `applyFilters` AND-chain

**Cons**
- Cannot express arbitrary date ranges (e.g. "due between April 20 and April 25")
- Cannot find tickets outside the loaded set (anything filtered out by workspace / project scope upstream is invisible)

### Option B — Popover with preset list + range calendar

A single trigger button opens a popover containing a preset list (left column) and a Kobalte-backed range calendar (right column). Covers A's presets plus arbitrary `duedate >= X AND duedate <= Y` ranges. New UI primitives (`Popover`, `Calendar`) added to `components/ui/`, rendered via `<Portal mount={useShadowMount()}>` per ADR-0005.

**Pros**
- Covers 100% of the JQL date-range grammar
- Matches the shadcn-solid / Kobalte `DatePicker` / `RangePicker` pattern users encounter in other apps

**Cons**
- ~300+ lines of new primitive code; new dependency surface (Kobalte Calendar)
- Popover is 420px wide; breaks the compact `FilterBar` layout in narrow sidebar widths
- Introduces a control-shape mismatch: one filter out of five uses a popover, the rest use Selects
- No user signal today that arbitrary ranges are needed — speculative complexity

### Option C — Server-side JQL refetch

A fifth Select as in Option A, but selecting a preset dispatches a new sync-server request that runs JQL against JIRA (e.g. `duedate < now() AND project = ATT`) and replaces the loaded groups. New sync-server route, new loading state, cache-invalidation concerns.

**Pros**
- Finds tickets outside the currently loaded set — useful if the sync store ever stops being a full mirror
- Aligned with the "JQL in background" framing the feature was originally described with

**Cons**
- Requires a new sync-server route, a new Drizzle query path, new tests on the backend — ~10x the implementation scope of Option A
- The sync store *is* already the full set for a workspace; no user-visible benefit today
- Introduces loading / error states on a filter that users expect to feel instant
- Conflicts with the "zero backend changes" success criterion in PRD-015

## Decision Outcome

**Chosen: Option A — Preset Select, client-side filter.**

Rationale:

1. **Consistency first.** The sidebar `FilterBar` is a pattern the user has built a mental model around over four existing filters. Adding a fifth that looks and feels identical is the lowest-friction way to extend that pattern. Option B breaks the pattern visually (popover vs. Select) and in footprint (420px vs. ~100px).

2. **Scope matches value.** Option A covers the 90% case — overdue, today, this week, no date — in ~40 lines of code with zero new primitives. Option B's unique value (arbitrary ranges) has no concrete user demand today. Option C's unique value (tickets outside the loaded set) has no user-visible benefit because the sync store is already a full mirror.

3. **Forward-compatible.** Option A documents each preset's JQL equivalent directly in SPEC-018. If a future feature needs to refetch via JQL (Option C) or add a custom-range entry (Option B as a "Custom range…" item in the preset list), the preset vocabulary (`overdue`, `today`, `this-week`, `next-7`, `none`) and clauses (`duedate < now()`, etc.) are reused unchanged. Option A is a strict subset of A+B and A+C; it does not paint the codebase into a corner.

4. **Validation already complete.** The POC shows the interaction working end-to-end, the JQL mapping is deterministic, and the control fits naturally in the existing `FilterBar` flex-wrap layout without any responsive work.

### Consequences

- `FilterState` gains a `dueDatePreset: DueDatePreset | null` field (`DueDatePreset` is the union of six literal strings)
- `applyFilters` gets a new branch that runs a matcher function per preset
- `filter-state.ts` exports a `DUE_DATE_PRESETS` constant (array of `{ key, label, jql }`) so the label, the matcher, and the JQL doc live in one place (SSOT)
- No changes to sync-server, no changes to the sync store, no changes to the generated API client
- Tests added to `features/sidebar/filter-state.test.ts` covering each matcher; an E2E test in `e2e/mocked/` covers the `Select` wiring with tagged `@SPEC-018`

### If this decision is revisited

- If users start requesting specific date ranges repeatedly → extend with a "Custom range…" preset that opens a minimal date-range dialog (partial Option B), rather than replace the Select
- If the sync store ever becomes a partial mirror (e.g. pagination by project, or lazy-load by tab) → add a server-side refetch pathway (Option C) that reuses the same preset keys and dispatches the documented JQL clauses
