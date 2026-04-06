---
date: '2026-04-06'
references:
- PRD-004
- ADR-0002
- ADR-0003
status: accepted
---

# ADR-0006 ATT Board Status Mapping and JIRA Metadata Polling

## Context and Problem Statement

PRD-004 requires replacing the three-state status model (`open | ticketed | resolved`) with the full ATT JIRA board workflow (10 statuses) and adding assignee/reporter filtering. This creates two architectural decisions:

1. **Status-to-color mapping:** The ATT board has 10 workflow columns. Each needs a distinct color for the sidebar badge and canvas overlay. The mapping could be hardcoded (ATT-specific PoC), fetched dynamically from the JIRA board configuration API, or stored in the sync-server config. The choice affects whether this feature works only on ATT or generalizes.

2. **Assignee/reporter data source:** The current `getIssueStatus` endpoint (ADR-0003) returns only `status` and `statusCategory`. PRD-004 requires `assignee` and `reporter` for filtering. These fields must be fetched from JIRA and made available to the sidebar. The choice is whether to expand the existing poll endpoint, add a separate metadata endpoint, or fetch once on ticket creation.

## Decision Drivers

- This is a PoC for the ATT board — simplicity over generality
- SSOT: JIRA is the source of truth for all metadata (PRD-004)
- SRP: color mapping, data fetching, and filtering must be isolated modules (PRD-004)
- The existing 30-second polling loop already calls `getIssueStatus` — piggybacking is cheaper than a new poll
- The sync-server proxies all JIRA calls (ADR-0003) — the sidebar never calls JIRA directly
- Assignee/reporter change infrequently compared to status — fetching them every 30 seconds is wasteful but simple
- The `jira.js` `getIssue` API accepts a `fields` parameter — adding fields is a one-line change

## Considered Options

### Decision 1: Status-to-Color Mapping

#### Option A: Hardcoded map in react-grab (ATT-specific)

A static `Record<string, ColorConfig>` in `features/sidebar/status-colors.ts` that maps JIRA status name strings to hex colors. No API call, no configuration — pure code.

```typescript
const ATT_STATUS_COLORS: Record<string, { border: string; fill: string; badge: string }> = {
  "To Do": { border: "#94a3b8", fill: "rgba(148,163,184,0.08)", badge: "rgba(148,163,184,0.12)" },
  "In Progress": { border: "#3b82f6", ... },
  // ... 10 entries
};
```

- Good: zero complexity — no API call, no config, no caching, no error handling
- Good: colors are design decisions, not data — they belong in code, not in a database
- Good: SRP-compliant — one module, one concern, one function
- Bad: only works for ATT. Another board with different status names gets all-gray
- Bad: status name changes on the JIRA board require a code change and rebuild

#### Option B: Fetch board workflow from JIRA API dynamically

Call `GET /rest/api/3/project/{key}/statuses` or `GET /rest/api/3/status` at startup to discover the board's workflow statuses, then assign colors programmatically (e.g., by status category or sequence order).

- Good: works for any JIRA board without code changes
- Good: automatically adapts when the board workflow changes
- Bad: color assignment becomes algorithmic — hard to guarantee visual distinctiveness for arbitrary status counts
- Bad: requires a new sync-server endpoint, caching strategy, and error handling for the discovery call
- Bad: over-engineered for a PoC that targets one board

#### Option C: Store status-color map in sync-server config (D1 or environment)

Define the mapping in the sync-server's configuration (Wrangler secrets, D1 table, or a JSON config endpoint). The sidebar fetches the map on load.

- Good: configurable without code changes — a PM can update colors
- Bad: requires a config UI or manual database editing — no PM would do this
- Bad: adds a fetch call, error handling, and caching for configuration data
- Bad: the mapping changes rarely (board restructures are infrequent) — a config system is not justified

### Decision 2: Assignee/Reporter Data Source

#### Option D: Expand existing `getIssueStatus` endpoint

Add `assignee` and `reporter` to the `fields` parameter in `jira.service.ts:getIssueStatus()`. The sync-server endpoint returns them alongside `status` and `statusCategory`. The sidebar stores them on the in-memory group signal via the existing polling loop.

```typescript
// jira.service.ts — change
fields: ["status"]
// to:
fields: ["status", "assignee", "reporter"]
```

Response shape changes from `{ status, statusCategory }` to `{ status, statusCategory, assignee, reporter }`.

- Good: one-line change in the service; no new endpoint, no new poll
- Good: data arrives every 30 seconds via the existing poll — always fresh
- Good: SSOT — assignee/reporter come from JIRA, not from local state
- Neutral: fetches assignee/reporter every 30 seconds even though they rarely change — acceptable overhead for a PoC
- Bad: OpenAPI spec change + Orval regeneration required (but this is mechanical)

#### Option E: Fetch metadata once on ticket creation

When `createJiraTicket` succeeds, the response includes the full issue — extract assignee and reporter from it. Don't re-fetch on polls.

- Good: no poll overhead for rarely-changing fields
- Bad: if assignee changes in JIRA after ticket creation, the sidebar is stale permanently
- Bad: breaks SSOT — the sidebar shows creation-time data, not current data
- Bad: "show me groups assigned to Alice" would miss groups re-assigned to Alice after creation

#### Option F: Separate metadata endpoint with longer poll interval

Create a new `/jira/metadata` endpoint that fetches assignee, reporter, and other fields on a 5-minute interval (separate from the 30-second status poll).

- Good: reduces JIRA API call overhead for rarely-changing fields
- Bad: two separate polling loops to manage — complexity for marginal gain
- Bad: stale for up to 5 minutes — acceptable but unnecessary when Option D works

## Decision Outcome

**Decision 1: Option A — Hardcoded status-color map (ATT-specific).**

Colors are design decisions. A `Record<string, ColorConfig>` in `features/sidebar/status-colors.ts` is the simplest correct solution for a PoC targeting one board. It's a single module with a single concern (SRP). If the PoC proves value and we need multi-board support, we replace this module with Option B — the interface remains the same (`statusName → color`), only the implementation changes.

Unknown status names (e.g., if ATT adds a new column) fall back to a default gray — the UI doesn't break, it just shows a neutral color. This is acceptable for a PoC.

**Decision 2: Option D — Expand `getIssueStatus` to include assignee and reporter.**

One-line change in `jira.service.ts`. The data arrives via the existing 30-second poll. The sidebar stores it on the in-memory group signal (same pattern as `jiraStatus` and `jiraStatusCategory`). SSOT is maintained — the sidebar always shows current JIRA data.

The 30-second re-fetch of rarely-changing fields is acceptable overhead for a PoC. If JIRA API rate limits become a concern, we can move to Option F (separate longer-interval poll) — but this is premature optimization.

## Consequences

### Status Colors
- `features/sidebar/status-colors.ts` — new module: `ATT_STATUS_COLORS` map + `getStatusColor(statusName)` function
- `deriveStatus()` is replaced by a direct `group.jiraStatus` read — no more mapping to three abstract states
- The sidebar badge shows the raw JIRA status name (e.g., "Code Review") instead of "ticketed"
- Canvas overlay border color comes from `getStatusColor(group.jiraStatus)` instead of `statusOverlayColor()`
- Groups without a ticket show "No Task" (pink) — this is the fallback, not a JIRA status
- Unknown JIRA statuses fall back to gray (`#6b7280`)

### Assignee/Reporter
- `jira.service.ts:getIssueStatus()` adds `assignee` and `reporter` to the `fields` parameter
- Response type changes: `{ status, statusCategory, assignee?: string, reporter?: string }`
- OpenAPI spec updated, Orval regenerated
- `SelectionGroupWithJira` type extended with `jiraAssignee?: string` and `jiraReporter?: string`
- The polling `handleStatusUpdate` stores these alongside status

### Filtering
- The existing `FilterTabs` ("All", "Open", "Ticketed", "Resolved") is replaced by the new multi-dimensional filter bar
- Filter state is a set of active status names + optional assignee + optional reporter
- `filteredGroups()` applies filters as AND-combined predicates
- Groups hidden by filters also hide their canvas selections via the existing `SelectionVisibility` API

## Affected Files

- `packages/sync-server/src/services/jira.service.ts` — add `assignee`, `reporter` to `getIssueStatus()` fields
- `packages/sync-server/src/schemas/jira.ts` — update `JiraTicketStatus` schema with assignee/reporter
- `packages/sync-server/openapi.json` — regenerated
- `packages/react-grab/src/generated/sync-api.ts` — regenerated via Orval
- `packages/react-grab/src/features/sidebar/status-colors.ts` — NEW: ATT status-color map
- `packages/react-grab/src/features/sidebar/jira-types.ts` — add `jiraAssignee`, `jiraReporter` to `SelectionGroupWithJira`
- `packages/react-grab/src/features/sidebar/derive-status.ts` — simplified or replaced by direct status name read
- `packages/react-grab/src/components/sidebar/filter-tabs.tsx` — replaced by new multi-dimensional filter bar
- `packages/react-grab/src/components/sidebar/index.tsx` — new filter state, reveal/hide integration
- `packages/react-grab/src/components/sidebar/group-card.tsx` — use `getStatusColor()` for badge + left border
- `packages/react-grab/src/components/sidebar/status-badge.tsx` — accept any status name + dynamic color
- `packages/react-grab/src/utils/overlay-color.ts` — `statusOverlayColor()` replaced or extended to accept any hex color

## Validation Needed

1. Verify `getIssue({ fields: ["status", "assignee", "reporter"] })` returns assignee/reporter display names via `jira.js` — test against ATT board
2. Confirm all 10 ATT board status names match the hardcoded map — fetch actual statuses from a real ATT ticket in each column
3. Verify the existing `SelectionVisibility` API can hide/show selections by group — test `handleToggleGroup(groupId)` hides both canvas overlays and selection labels
