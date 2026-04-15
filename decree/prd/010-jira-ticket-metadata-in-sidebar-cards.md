---
status: draft
date: 2026-04-15
references: [PRD-004, SPEC-006]
---

# PRD-010 JIRA Ticket Metadata in Sidebar Cards

## Problem Statement

The sidebar cards currently show JIRA status, assignee, labels, and flag state -- but they are missing fundamental ticket metadata that every PM and developer checks first when triaging work: **priority**, **issue type**, **creation date**, and **due date**.

A PM scanning the sidebar cannot distinguish a Highest-priority bug from a Low-priority task without clicking through to JIRA. They cannot see which tickets are overdue or freshly created without opening each one individually. This forces context-switching between react-grab and JIRA for basic triage -- exactly the workflow the sidebar was built to eliminate.

The sync-server already fetches `priority` and `issuetype` during ticket creation but discards them in the polling response. The data is one API field away; the gap is purely in the return shape and the frontend rendering.

Surfacing these four fields closes the last metadata gap between "what JIRA shows on a card" and "what react-grab shows on a card," making the sidebar a complete replacement for the JIRA board view during visual review sessions.

## Requirements

### Data Layer

- R1: The sync-server `getIssueStatus` poll response must include `priority` (name string, e.g. "High", "Medium"), `issuetype` (name string, e.g. "Bug", "Task"), `duedate` (ISO date string or null), and `created` (ISO datetime string)
- R2: `SelectionGroupWithJira` must be extended with four optional fields: `jiraPriority?: string`, `jiraIssueType?: string`, `jiraDueDate?: string | null`, `jiraCreated?: string`
- R3: All four fields must be optional (`undefined`) for groups without a linked JIRA ticket -- no default values, no placeholder strings
- R4: The OpenAPI spec must be updated and Orval client regenerated to include the new response fields
- R5: The JIRA API fields to request are: `fields.priority.name`, `fields.issuetype.name`, `fields.duedate`, `fields.created`

### Visual -- Priority

- R6: Display a JIRA-style colored arrow icon representing the ticket priority:
  - Highest / High: red upward triangle (`#f87171`)
  - Medium: orange horizontal bar (`#f59e0b`)
  - Low / Lowest: blue downward triangle (`#60a5fa`)
- R7: The priority icon must be rendered as an inline SVG following the project's custom icon pattern (`components/icons/`), not an emoji or external icon library
- R8: The priority icon is positioned in the card bottom metadata row, to the left of the assignee avatar
- R9: The priority icon must only appear on ticketed cards (groups with a `jiraTicketId`)
- R10: Hovering the priority icon must show a tooltip with the priority name (e.g. "High")

### Visual -- Issue Type

- R11: Display an icon representing the issue type: `Bug` shows a bug icon, `Task` shows a task/checkbox icon
- R12: The issue type icon is positioned in the card bottom metadata row, immediately before the ticket key (e.g. before "ATT-123")
- R13: The issue type icon must only appear on ticketed cards
- R14: If the issue type is not one of the known types (Bug, Task), fall back to a generic ticket icon
- R15: Hovering the issue type icon must show a tooltip with the type name

### Visual -- Dates

- R16: Display a date row showing created and due dates in the format: `calendar-icon "Apr 12, 2026 -> Apr 15, 2026"`
- R17: The date row is positioned as its own line below the labels row on the card
- R18: If `dueDate` is null, show only the created date: `calendar-icon "Apr 12, 2026"`
- R19: If neither date exists (unlinked group), the date row must not render at all
- R20: If the due date is in the past, the due date text must render in red (`#f87171`) to indicate overdue status
- R21: The calendar icon must follow the project's custom SVG icon pattern

### Visual -- Consistency

- R22: All new metadata (priority, type, dates) must render identically on both `SelectionCard` and `LooseSelectionCard` components
- R23: The metadata row layout must match the POC (`poc-stats-bar.html`): type icon, ticket key, spacer, priority icon, assignee avatar
- R24: New icons must use the same 12px sizing and color opacity conventions as existing flag and avatar elements

## Success Criteria

- A PM can identify ticket priority at a glance from the sidebar card without opening JIRA
- A PM can distinguish bugs from tasks visually on the card without reading the ticket key
- A PM can see creation and due dates on the card, with overdue tickets highlighted in red
- All four new fields update on the same polling interval as existing JIRA metadata (status, assignee, etc.)
- Cards for unlinked groups show no priority, type, or date metadata -- no empty placeholders
- The sync-server response size increase is minimal (four small string fields per ticket)

## Implementation Notes (for SPEC author)

These findings from architectural review must be addressed in the SPEC:

1. **Fields array merge:** `getIssueStatus` currently fetches `["status", "assignee", "reporter", "labels", "attachment"]`. The SPEC must specify the merged array: `["status", "assignee", "reporter", "labels", "attachment", "priority", "issuetype", "duedate", "created"]`
2. **Zod schema additions:** `JiraTicketStatus` in `packages/sync-server/src/schemas/jira.ts` needs 4 new fields added to the Zod schema — this is the input for Orval regeneration
3. **Layout insertion points:** `group-card.tsx` already renders assignee/reporter with `UserAvatar` (lines 48-70). The SPEC must specify whether priority icon inserts into the existing meta row or creates a new bottom row per the POC
4. **Priority name fallback:** R6 maps 5 JIRA default names. JIRA Cloud allows custom priorities ("Critical", "Blocker", "Trivial"). The SPEC must define fallback behavior — recommend: unmapped names render with Medium-orange icon and tooltip showing the actual name
5. **New SVG icon components needed:** `icon-priority-up.tsx`, `icon-priority-down.tsx`, `icon-priority-bar.tsx`, `icon-bug.tsx`, `icon-task.tsx`, `icon-calendar.tsx` — following the existing `components/icons/` pattern (e.g. `icon-flag.tsx`)
6. **`created` field guarantee:** JIRA `created` is always non-null for existing issues. The SPEC should state: if API returns null, skip the date row entirely (defensive, not expected)

## Out of Scope

- Filtering or sorting by priority, issue type, or due date (future PRD)
- Supporting issue types beyond Bug and Task in the create dialog (the create dialog is unchanged)
- Editable priority or due date from within react-grab (read-only display)
- Sprint, story points, or other JIRA fields not listed in this PRD
- Priority or type icons on canvas overlay labels (sidebar cards only)
- Custom priority schemes or non-standard JIRA priority names
