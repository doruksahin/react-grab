---
status: approved
date: 2026-04-08
references: [PRD-002, PRD-004]
---

# PRD-006 Loose-Selection Ticketing

## Problem Statement

PRD-002's sidebar requires every selection to belong to a named group before a JIRA ticket can be created. The create-ticket flow lives inside `GroupDetailView`, which is only reachable by clicking into a group card. A PM who has selected a single element — a standalone heading, an out-of-place button, a broken image — must first name a group, then navigate into it, before filing a ticket. This is two unnecessary steps for the most common single-item feedback scenario.

The root cause is an architectural coupling: the JIRA ticket pipeline (`JiraCreateDialog` → `JiraCreateForm` → sync-server) expects a `SelectionGroup` as input, because tickets are filed against groups, not individual items. Changing the server contract (adding a `/items/:itemId/jira-ticket` endpoint) would be the cleanest long-term fix but requires a migration and is out of scope for this iteration.

The target user is a PM or tech lead who selects a single element and wants to file a JIRA ticket in one click, without the friction of creating and naming a group first.

## Requirements

### Architecture Principles

- **No server contract change.** The JIRA ticket creation pipeline (sync-server `POST /groups/:groupId/jira-ticket`) is unchanged. Loose-item ticketing must satisfy the existing contract, not replace it.
- **Client-only synthetic groups.** When a loose selection earns a ticket, the client auto-creates a hidden 1-item group (`synthetic: true`) as a backing store for the ticket fields. Synthetic groups are never visible to the user on any user-facing surface.
- **Single rendering predicate.** The rule "this item should render as a loose card" must live in exactly one place — `isPresentedAsLoose` in `features/selection-groups/business/membership.ts`. Every render path consults this predicate; none reimplements it.
- **SRP boundaries.** Four concerns are isolated: synthetic group creation/identification (`synthetic-group.ts`), the rendering predicate (`membership.ts`), the loose card UI (`loose-selection-card.tsx`, `loose-selection-list.tsx`), and the orchestrator that wires all four together (`core/index.tsx:handleCreateTicketForLooseItem`).

### Loose Selection Rendering

- Selections with `groupId === null` render as **loose cards** in a new section above the `GroupList` in the sidebar.
- Loose cards show: component name, tag name, timestamp, a status pill (same color system as `GroupCard`, from PRD-004), and a **"+ Create ticket"** button when no ticket exists.
- When a ticket exists, the "Create ticket" button is replaced by the JIRA ticket ID (linked to the ticket URL).
- Loose cards are non-clickable — they have no detail-view navigation because they have no group to navigate into.
- Loose items do NOT appear in the `GroupList`, stats bar, filter bar, or any user-facing group picker.

### Ticketing Flow

- Clicking "**+ Create ticket**" on a loose card:
  1. Creates a synthetic `SelectionGroup` with `synthetic: true`, name inferred from `componentName || elementName || 'Untitled'`.
  2. Persists the group and moves the item into it via the existing `assignSelection` writer.
  3. Opens the existing `JiraCreateDialog` against the new group. No change to the dialog — it reads `group.name` for the default summary and `group.id` for the API call.
- The existing `onTicketCreated` callback stores `jiraTicketId` and `jiraUrl` on the group. After the poll cycle, the loose card shows the ticket ID and polled status.
- Synthetic groups survive page refresh (persisted to localStorage / D1 via the existing storage adapter).

### Synthetic Group Invariants

- `synthetic: true` is permanent — synthetic groups never become "real" groups by accumulating items.
- Synthetic groups are filtered out of every user-facing surface: `GroupList`, `GroupPickerFlyout` (in `SelectionLabel` and `CommentsDropdown`), stats bar, filter chips, filter distinct lists.
- The filter is applied at two boundaries: `renderer.tsx` (for picker surfaces) and `sidebar/index.tsx` (for display surfaces). The full group list is preserved at both boundaries so `LooseSelectionList` can look up synthetic groups by id.
- When the user moves the sole item out of a synthetic group (via the picker or deletion), the synthetic group is **garbage-collected** — deleted from storage immediately.

## Success Criteria

- A PM selects a single element and sees it as a loose card in the sidebar with a "No Task" pill and a "+ Create ticket" button.
- Clicking "+ Create ticket" opens the JIRA create dialog pre-populated with the element's component name as the summary.
- After submitting, the dialog closes and the loose card shows the ticket ID and polled status pill.
- Synthetic groups never appear in the group list, picker, stats bar, or filter chips.
- Moving the ticketed loose item into a real group via the picker removes it from the loose section and garbage-collects the synthetic group.
- Reloading the page preserves all state: ticketed loose cards still show their ticket, synthetic groups remain hidden.

## Scope

**In scope:** Client-side synthetic group creation, `LooseSelectionCard` + `LooseSelectionList` components, `isPresentedAsLoose` predicate, synthetic group GC in `handleMoveItem`, second `JiraCreateDialog` instance at Sidebar level.

**Out of scope:** Server contract changes (new `/items/:itemId/jira-ticket` endpoint) — that is Strategy 1, a separate plan. Bundling multiple loose items into one group via the picker. Auto-promotion of synthetic groups to real groups. Fixing the pre-existing `GroupedEntry`/`SelectionGroupWithJira` blocker in `group-card.tsx`.
