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

The server contract is unchanged. `SelectionGroup` gains `synthetic?: boolean`. The new module `business/synthetic-group.ts` owns creation (`createSyntheticGroupForItem`, `ensureGroupForItem`) and identification (`isSynthetic`). The new predicate `isPresentedAsLoose` in `membership.ts` is the single rendering rule. Synthetic groups are filtered at two explicit boundaries (renderer, sidebar). GC runs inside `handleMoveItem` — empty synthetic groups are deleted immediately.

### Amendment (2026-04-16) — synthetic group created at selection time

**Commit:** `c95ad64d` — `refactor(selection-groups): create synthetic group at selection time`

The original design created synthetic groups lazily — only when the user clicked "Create ticket" on a loose selection (`handleCreateTicketForLooseItem`). This caused a flow gap: the item lived as `groupId: null` between selection and ticketing, which made it vanish from the comments dropdown when the "Create ticket" click assigned it to a synthetic group that the dropdown filtered out.

**Changed to:** every selection gets a synthetic group at registration time via `ensureGroupForItem()`. Items are never ungrouped. `handleCreateTicketForLooseItem` simplified to a group lookup + dialog open — no more synthetic group creation or item reassignment. The `isUngrouped` predicate was removed (dead code); `isPresentedAsLoose` remains the single rendering rule. The `CommentsDropdown` now receives the full groups list (including synthetic) so `isPresentedAsLoose` can classify items correctly.

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

**Amended 2026-11-15 — ticket lock and membership policy.**

- **Ticket lock decided.** A selection whose group (real or synthetic) has a ticket is locked: it cannot move, be removed, or lose its group, and a ticketed group cannot be deleted. Validation step 4 above (move a ticketed loose item into a real group) is superseded.
- **Invariants are enforced by commands, not by filtering pickers.** `features/selection-groups/business/membership-policy.ts` holds them. Every membership change goes through its commands (`moveSelection`, `moveSelections`, `deleteGroup`, `removeSelection`, `groupForNewSelection`). The pickers use the query `assignableGroupsFor`, which shares the commands' predicates. This replaces "exactly one item — enforced by filtering them from all pickers".
- **Never ungrouped, through synthetic groups.** Moving a selection to "Ungrouped", or deleting its real group, gives it a new synthetic group of its own, so it can still be ticketed.
- **Older data is shown, not rewritten.** `business/membership.ts` shows a synthetic group that has several selections as a visible group, named after its ticket key (`presentedGroups`). It shows a selection whose group is missing as loose. The orchestrator reports each such anomaly once through `logRecoverableError`, so the owner can repair the data deliberately. Nothing is written at load time.

**Amended 2026-11-16 — deleting a selection.**

- **Rule.** A selection without a ticket can be deleted. A selection with a ticket cannot. "Has a ticket" is the ticket lock above: its group, real or synthetic, has a `jiraTicketId`. `ticket-lock.ts` is the only definition. `comment.jiraTicketId` is not used for this; nothing sets it.
- **One command per kind of deletion,** in `membership-policy.ts`:
  - `removeSelection` deletes one selection, or refuses a locked one.
  - `clearSelections` deletes every selection that is not locked and keeps the locked ones. "Clear all" and the automatic clear after "Copy all" use it. The confirmation says how many stay. When nothing can be deleted, the trash is hidden and "Copy all" does not offer to clear.
  - Replacing a selection with a new comment on the same element goes through `removeSelection`. A locked selection is kept, and the new comment is added next to it.
- **No silent deletions.** The 20-item cap from upstream deleted the oldest comment from the server when the 21st was added. It is removed. The existing 5 MB size trim of `localStorage` still applies while there is no server connection; a server refuses any delete it sends for a ticketed comment.
- **Synthetic groups.** The garbage collection of empty synthetic groups keeps a synthetic group that has a ticket: it is a ticketed group, so it cannot be deleted.
- **The UI asks the policy.** A remove (×) button shows only when the orchestrator's `canRemoveItem` allows it. No surface checks the ticket inline.
- **The server enforces the same rule** in `services/ticket-lock.service.ts`. It returns 409 when a request would:
  - delete a comment whose group has a ticket (`DELETE /comments/{commentId}`);
  - delete a ticketed group (`DELETE /groups/{groupId}`);
  - move a comment out of a ticketed group, or into one (`PUT /comments/{commentId}` with another `groupId`). Without this, a move followed by a delete would get round the rule.

  The ticket is set on the server (`updateGroupJira`), so the server has the last word; a direct API call, the dashboard or an older overlay cannot delete a ticketed selection. The client checks first so the user is not offered an action the server refuses.
- **When the server refuses anyway** (a ticket created in another tab that this tab has not seen), the HTTP adapter turns the 409 into a `WriteRefusedError`, and the sync layer reloads groups and comments from the server, once for a burst of refusals. A write that merely fails (network, 5xx) keeps its local change, as before.
