---
status: draft
date: 2026-04-06
references: [PRD-002]
---

# PRD-004 JIRA Status Visualization and Filtering

## Problem Statement

PRD-002's sidebar uses a simple three-state status model (`open | ticketed | resolved`) derived from `jiraTicketId` presence and a binary `jiraResolved` flag. The actual ATT JIRA board has **10 workflow columns**: To Do, In Progress, Code Review, Test, Test Passed, UAT, In Preprod, In Production, Won't Do, Done. A developer or PM looking at the sidebar cannot tell whether a ticketed issue is in code review, testing, or production — they only see "ticketed" (yellow). This forces them to open JIRA separately to check the real status.

Additionally, selection groups cannot be filtered by JIRA metadata. A PM reviewing the page wants to answer questions like "show me only the groups assigned to me" or "show me only the groups stuck in Code Review" — without manually scanning every group card.

The target user is a PM or tech lead on the ATT project who uses the sidebar to track visual feedback across the engineering pipeline. This feature is **ATT-specific for now** — the board statuses, colors, and workflow are hardcoded for the ATT board as a PoC. Generalization to other boards is out of scope.

## Requirements

### Architecture Principles

- **SSOT (Single Source of Truth):** JIRA is the source of truth for status, assignee, and reporter. The sidebar reads these from the JIRA API via the sync-server proxy — never from hand-written local state. Status names and transitions are defined by the JIRA board, not by react-grab code.
- **SRP (Single Responsibility Principle):** Each concern is isolated:
  - **Status color mapping** — a standalone module that maps JIRA status names to colors. No business logic, no rendering, no data fetching. One function in, one color out.
  - **JIRA metadata fetching** — a data layer that polls/fetches status, assignee, and reporter per ticket. No rendering, no color logic.
  - **Filter state** — a signal-based filter model that tracks active filters. No rendering, no data fetching.
  - **Filter application** — a pure function that takes groups + filters → filtered groups. No side effects, no rendering.
  - **Reveal/hide integration** — uses the existing `SelectionVisibility` API to show/hide selections based on filter results. No new visibility logic.

### Status Visualization

- Replace the three-state `open | ticketed | resolved` model with JIRA board status names
- Groups without a JIRA ticket show status **"No Task"** (pink)
- Ticketed groups show their **actual JIRA status name** as the badge text (e.g., "In Progress", "Code Review", "Test Passed")
- Each JIRA status has a **unique color** — both on the group card badge and the selection overlay border on the canvas
- ATT board status → color mapping (hardcoded for PoC):

| JIRA Status | Color | Hex |
|-------------|-------|-----|
| No Task (no ticket) | Pink | #b21c8e |
| To Do | Slate | #94a3b8 |
| In Progress | Blue | #3b82f6 |
| Code Review | Purple | #a78bfa |
| Test | Amber | #f59e0b |
| Test Passed | Emerald | #10b981 |
| UAT | Cyan | #06b6d4 |
| In Preprod | Violet | #8b5cf6 |
| In Production | Green | #22c55e |
| Won't Do | Red | #ef4444 |
| Done | Green | #22c55e |

- Group cards show a **colored left border** matching the status color
- The **(i) info button** in the sidebar header opens a status legend overlay explaining all colors and the typical workflow flow

### JIRA Metadata Fetching

- When polling JIRA ticket status (existing 30-second poll), also fetch **assignee** and **reporter** fields from the JIRA API response
- Store assignee (display name) and reporter (display name) on the in-memory group signal alongside `jiraStatus` and `jiraStatusCategory`
- The sync-server's `getIssueStatus` endpoint must return `assignee` and `reporter` in addition to `status` and `statusCategory`
- This requires an OpenAPI spec update and Orval regeneration

### Filtering

- Add a **filter bar** below the existing status filter tabs (or replace them) with three filter dimensions:
  - **Status filter:** dropdown or chip selector showing all ATT board statuses + "No Task". Multiple selection allowed.
  - **Assignee filter:** dropdown populated from the distinct assignees across all ticketed groups. Single or multiple selection.
  - **Reporter filter:** dropdown populated from the distinct reporters across all ticketed groups. Single or multiple selection.
- Filters are **AND-combined**: selecting "In Progress" + "Alice" shows only groups that are In Progress AND assigned to Alice
- Active filters are shown as dismissible chips above the group list
- "Clear all" button resets all filters

### Reveal/Hide Integration

- When filters are active, groups that don't match are **hidden from the group list** (existing behavior — already works via `filteredGroups()`)
- Additionally, selections belonging to hidden groups are **visually hidden on the canvas** — their overlay boxes and selection labels disappear
- This uses the existing `SelectionVisibility` API (`handleToggleGroup`, `handleToggleItem`, `selectionsRevealed`) — no new visibility system
- When filters are cleared, all selections reappear

## Success Criteria

- A PM can see at a glance which groups are in Code Review vs Test vs Production — without opening JIRA
- A PM can filter to "show me only In Progress groups assigned to Alice" with two clicks
- Filtering hides non-matching selections from the page — the canvas only shows relevant highlights
- The status legend explains all colors and the ATT workflow to any new user
- The status color on the group card badge matches the selection overlay color on the canvas
- All JIRA metadata (status, assignee, reporter) comes from the JIRA API via sync-server — no manual entry

## Scope

**In scope:** ATT board status visualization (hardcoded status-color map), status/assignee/reporter filtering in sidebar, reveal/hide integration for filtered groups, (i) info legend overlay, sync-server endpoint update for assignee/reporter, OpenAPI spec + Orval regeneration.

**Out of scope:** Dynamic board workflow discovery from JIRA API (fetching statuses programmatically instead of hardcoding) — this is the generalization step for non-ATT boards, deferred until the PoC proves value. Custom color configuration UI. Filtering by other JIRA fields (labels, priority, sprint). Persisting filter state across page refreshes.
