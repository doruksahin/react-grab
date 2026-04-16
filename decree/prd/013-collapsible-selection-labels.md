---
status: draft
date: 2026-04-16
references: [SPEC-010, SPEC-013]
---

# PRD-013 Collapsible Selection Labels

**Design POC:** [`docs/plans/poc/collapsible-label-poc.html`](../../docs/plans/poc/collapsible-label-poc.html) — standalone HTML exploring three collapsed-state variants (Pill, Dot, Mini bar) with click-to-expand and chevron-to-collapse interactions. The **Dot** variant was chosen for implementation.

## Problem Statement

Persistent selection labels pin to every selected element on a page and render the full JIRA card — ticket ID, status, assignee avatar, labels, comments count, and a rich-text comment editor with toolbar. A single label consumes ~320×400 pixels of screen real estate.

On pages with multiple tracked selections (a common workflow during triage or multi-element review), these labels occlude the underlying UI, compete for visual attention, and make it difficult to see the design context they were meant to annotate. The user ends up dragging labels out of the way or mentally filtering them out, neither of which is a good experience.

At the same time, the JIRA information is valuable — the user does want to see ticket status and comments for a given element; they just don't want that information forced on them for every element simultaneously.

The resolution is a collapsible label: a minimal visual presence (a small dot) per selection by default, expanding to the full card only for the element the user is actively focused on. This preserves the "I can see where my tracked selections are" affordance while eliminating the occlusion cost.

## Requirements

### Interaction

- R1: When the collapsible labels feature is enabled, each persistent label instance starts collapsed as a small dot
- R2: Clicking the dot expands that specific label to the full card — other labels remain in whatever state they were in (independent per-instance state)
- R3: The expanded label renders a chevron button in its header row that collapses the label back to a dot when clicked
- R4: Collapsed and expanded state is per-instance — clicking one dot to expand does not collapse others or affect other labels' state
- R5: The collapsed dot is positioned at the bottom-center of the selected element's bounds, with a small gap below — it anchors to the element the same way the full label does

### Visual

- R6: The collapsed dot is a small (~10px) circle in the overlay's primary accent color, subtle but visible against typical page backgrounds
- R7: The dot has a hover affordance (scale transform) to indicate it is interactive
- R8: The expanded label is visually identical to the existing persistent label — no layout changes for users who don't enable collapsing
- R9: The chevron collapse button sits in the label's header row, immediately after the tag name badge, using a chevron-up icon to signal "minimize"

### Feature Flag

- R10: The collapsible behavior is gated behind an `Options.collapsibleLabels` boolean flag passed to `init()`
- R11: When the flag is off (default), persistent labels render expanded with no collapse button — zero behavior change for existing consumers
- R12: When the flag is on, all persistent labels start collapsed by default and gain the expand/collapse controls
- R13: The flag is a one-way switch — consumers opt in; there is no per-instance opt-out within a page session

### Scope

- R14: Only persistent label instances (the sidebar-managed, pinned-to-element labels — renderer type #3) are affected
- R15: Primary active selection labels (the label that appears when the user clicks/selects during an active session) are not affected — they remain as-is
- R16: Agent session labels (transient "Thinking…" / "Grabbing…" progress indicators) are not affected

### Persistence

- R17: Collapsed/expanded state is client-side UI state only — it does not sync to the server or persist across page reloads
- R18: When the page reloads, all persistent labels reset to the default state determined by the feature flag

### Acceptance Criteria (Testable)

- AC1: With the feature flag off, clicking a tracked element shows the full label with no dot and no collapse button — identical to pre-feature behavior
- AC2: With the feature flag on, persistent labels initially render as dots (not full cards)
- AC3: With the feature flag on, clicking a dot expands that instance to the full label
- AC4: When one of several labels is expanded, the others remain collapsed as dots
- AC5: The expanded label renders a chevron collapse button next to the tag name
- AC6: Clicking the chevron collapses the label back to a dot
- AC7: Collapsed dots are positioned relative to their selected element (not fixed screen positions)
- AC8: The dot has a visible hover affordance (scale or visual change) indicating interactivity

## Success Criteria

- A user with multiple tracked selections on a page sees small dots at each selection point rather than overlapping full cards
- Clicking a dot immediately reveals the full JIRA context for that selection
- The user can toggle any label between compact and full views without affecting others
- When collapsing is off (default), existing consumers see no change — no dots, no new buttons, no layout shifts
- The feature is discoverable (visible chevron) and reversible (clicking the chevron collapses it again)

## Out of Scope

- Remembering collapsed/expanded state across page reloads or sessions
- Collapsing primary active selection labels or agent session labels
- A "collapse all" / "expand all" bulk control
- Configurable dot styles (color, size, position) — the dot uses fixed design tokens
- Animated expand/collapse transitions between dot and full label
- Keyboard shortcuts for collapse/expand (click-only for now)
- Server-side sync of collapsed state
