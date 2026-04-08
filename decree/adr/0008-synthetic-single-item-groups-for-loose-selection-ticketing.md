---
date: '2026-04-08'
references:
- PRD-006
- ADR-0002
- ADR-0003
- SPEC-003
status: accepted
---

# ADR-0008 Synthetic single-item groups for loose-selection ticketing

## Context and Problem Statement

PRD-006 requires that a PM can file a JIRA ticket against a single ungrouped selection (a "loose" selection) without first creating and naming a group. The existing JIRA ticket creation pipeline (`JiraCreateDialog` → `JiraCreateForm` → sync-server `POST /groups/:groupId/jira-ticket`) expects a `SelectionGroup` as input — the ticket is filed against a group, not an individual item. Two strategies were considered:

**Strategy 1 — New server endpoint:** Add a `/items/:itemId/jira-ticket` endpoint to the sync-server. The sidebar calls this endpoint directly for loose items; the server creates a ticket and stores its id on the `CommentItem` (a new `jiraTicketId` field on the item, not the group).

**Strategy 2 — Client-only synthetic groups:** When a loose selection earns a ticket, the client auto-creates a hidden 1-item `SelectionGroup` with a `synthetic: true` flag. The existing pipeline runs unchanged against this group. The synthetic group is invisible on all user-facing surfaces; its item renders as a loose card via a single client-side predicate.

This ADR documents the decision between these two strategies and the design choices within Strategy 2.

## Decision Drivers

- The sync-server contract is stable — changing it requires a D1 migration and OpenAPI spec update + Orval regeneration across two packages.
- The sidebar JIRA pipeline (SPEC-003, ADR-0003) is tested and working. Duplicating it for a new endpoint is high risk for marginal gain.
- The `optional-group-membership` refactor (the parent branch) already introduced `assignSelection` as a clean writer and established a vitest baseline. Strategy 2 composites naturally on top.
- The ATT board is the only JIRA integration target right now — optimizing the server contract for a general item-level ticket API is premature.
- Synthetic groups must be invisible on all user-facing surfaces. This invisibility rule must live in exactly one place to be maintainable.

## Considered Options

### Strategy 1: New server endpoint `/items/:itemId/jira-ticket`

A dedicated endpoint that accepts an item id and creates a JIRA ticket, storing `jiraTicketId` directly on the `CommentItem` row in D1.

- Good: cleanest long-term model — tickets belong to items, not groups, for single-item feedback
- Good: no synthetic group complexity on the client
- Bad: requires D1 schema migration (`CommentItem` gets a new `jiraTicketId` column)
- Bad: OpenAPI spec change + Orval regeneration in both `sync-server` and `react-grab`
- Bad: the JIRA status polling loop (SPEC-003) polls by `groupId` — it would need a parallel item-level poll path
- Bad: `SelectionGroupWithJira` in the sidebar is already the unified type for Jira-enriched groups — introducing a parallel item-level Jira type creates a second enrichment path with its own bugs
- Bad: the existing `JiraCreateDialog` and `JiraCreateForm` would need a new prop branch to handle item-vs-group ticketing

### Strategy 2: Client-only synthetic groups (chosen)

Add `synthetic?: boolean` to `SelectionGroup`. When a loose item earns a ticket, create a 1-item `SelectionGroup` with `synthetic: true` client-side. Run the existing ticket pipeline against it. Filter synthetic groups out of every user-facing surface.

- Good: zero server changes — the existing pipeline runs unchanged
- Good: Jira polling, status display, and `onTicketCreated` callback all work for synthetic groups without modification — they are just `SelectionGroup`s
- Good: the implementation is a delta on top of the existing `optional-group-membership` refactor — no new architectural layers
- Good: synthetic group GC (deletion when emptied) is a small addition to `handleMoveItem`
- Neutral: adds `synthetic?: boolean` to `SelectionGroup` — this is the same pattern as the existing `jiraResolved?: boolean` extension
- Bad: "synthetic group" is a fiction the client must maintain. If the user somehow adds a second item to a synthetic group (prevented by filtering synthetic groups out of all pickers), the rendering invariant breaks.
- Bad: `isPresentedAsLoose` must be the single source of truth for the rendering rule — if any render path skips it, synthetic groups leak into the UI

### Within Strategy 2: Single predicate vs. distributed checks

**Option A:** Each consumer that needs to know "is this loose?" reimplements the check inline (`item.groupId === null || (group.synthetic && items.filter(i => i.groupId === group.id).length === 1)`).

**Option B:** One exported predicate `isPresentedAsLoose(item, groups, allItems)` in `membership.ts` that encodes the rule. Every consumer calls this function.

- Option A: spreads the synthetic-group fiction across the codebase — changing the rule requires finding every site
- Option B: changing the rendering rule is a one-file edit; every consumer automatically inherits the fix

**Option B chosen.** The predicate is the single source of truth.

### Within Strategy 2: Filter boundary placement

Synthetic groups must be invisible in `GroupList`, `GroupPickerFlyout` (SelectionLabel, CommentsDropdown), stats bar, filter chips. Two options for where to filter:

**Option C:** Filter at the source — `core/index.tsx` passes `userFacingGroups()` (filtered) to the renderer, so all downstream consumers see only real groups.

**Option D:** Filter at two explicit boundaries — `renderer.tsx` (for picker surfaces: `SelectionLabel`, `CommentsDropdown`) and `sidebar/index.tsx` (for display surfaces: `groupedItems`, filter distincts, empty-state guard). `Sidebar` receives the full `props.groups` so `LooseSelectionList` can look up synthetic groups by id.

- Option C: simpler at the source, but Sidebar receives filtered groups — `LooseSelectionList` cannot look up synthetic groups by id without a separate `allGroups` prop
- Option D: requires two filter points, but Sidebar retains the full list for `LooseSelectionList` without adding a new prop

**Option D chosen.** Sidebar's `props.groups` stays full. The two filter boundaries are explicit and co-located with the consumers they protect.

## Decision Outcome

**Strategy 2 — client-only synthetic groups.**

The server contract is unchanged. `SelectionGroup` gains `synthetic?: boolean`. The new module `business/synthetic-group.ts` owns creation (`createSyntheticGroupForItem`) and identification (`isSynthetic`). The new predicate `isPresentedAsLoose` in `membership.ts` is the single rendering rule. Synthetic groups are filtered at two explicit boundaries (renderer, sidebar). The orchestrator in `core/index.tsx:handleCreateTicketForLooseItem` wires all four primitives. GC runs inside `handleMoveItem` — empty synthetic groups are deleted immediately.

## Consequences

### New modules
- `features/selection-groups/types.ts` — `SelectionGroup.synthetic?: boolean`
- `features/selection-groups/business/synthetic-group.ts` — `createSyntheticGroupForItem`, `isSynthetic`, `inferSyntheticGroupName`
- `features/selection-groups/business/membership.ts` — adds `isPresentedAsLoose`
- `components/sidebar/loose-selection-card.tsx` — NEW: non-clickable card with status pill + Create-ticket button
- `components/sidebar/loose-selection-list.tsx` — NEW: derives and renders loose cards above `GroupList`

### Modified modules
- `features/selection-groups/index.ts` — GC in `handleMoveItem`
- `components/sidebar/index.tsx` — `userFacingGroups` memo, mounts `LooseSelectionList`, second `JiraCreateDialog`, `looseTicketDialog` controlled prop
- `components/renderer.tsx` — `userFacingGroups` memo for picker surfaces
- `types.ts` (`ReactGrabRendererProps`) — three new Sidebar-wiring props
- `core/index.tsx` — `handleCreateTicketForLooseItem` orchestrator, `looseTicketDialog` signal

### Invariants enforced by this decision
- Synthetic groups are filtered from ALL user-facing group lists — enforced at two explicit boundaries.
- The synthetic-group rendering rule is encoded in exactly one predicate (`isPresentedAsLoose`).
- Synthetic groups always have exactly one item — enforced by filtering them from all pickers.
- Synthetic groups are GC'd when their item is moved out — enforced in `handleMoveItem`.

## Validation Needed

1. Smoke test: loose card appears for ungrouped selections; disappears when item is moved into a real group.
2. Smoke test: synthetic groups do not appear in `GroupList`, picker, stats bar, or filter chips.
3. Smoke test: ticket creation dialog opens with inferred name as default summary; ticket id appears on the card after polling.
4. Smoke test: after moving a ticketed loose item into a real group, the synthetic group is absent from `localStorage`.
5. Reload: ticketed loose cards persist; synthetic groups remain hidden after page refresh.
