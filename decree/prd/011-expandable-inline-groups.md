---
status: draft
date: 2026-04-15
references: [PRD-002, SPEC-001, SPEC-002]
---

# PRD-011 Expandable Inline Groups

## Problem Statement

When a user clicks a group in the sidebar's group list, the entire view navigates to a group-detail component. This full-view navigation breaks the user's mental model of the group list: they lose their scroll position, lose visual context of surrounding groups, and must press "Back" to return. For workflows where the user wants to quickly scan the children of several groups in sequence, this click-navigate-back-click cycle adds significant friction.

The group-detail view also renders the full selection card layout (component names, HTML tags, CSS selectors, raw HTML collapsible) which is more information than most quick-scan tasks require. Users checking "which screenshots are in this group?" or "what was the comment on that selection?" are forced through a heavyweight view for a lightweight question.

An inline expand interaction -- click a group card, see its child selections appear below it in the list -- eliminates the navigation round-trip and lets users keep the group list visible while inspecting children. This directly reduces the interaction cost of the most common sidebar workflow: reviewing and triaging groups.

## Requirements

### Interaction

- R1: Clicking the expand chevron on a group card toggles inline expansion of that group's child selections — the chevron is the sole expand/collapse target, not the entire card
- R2: The expand/collapse affordance is a chevron icon: right-pointing (collapsed) rotating to downward-pointing (expanded), using a CSS transition
- R3: Multiple groups can be expanded simultaneously — this is not an accordion; expanding one group does not collapse another
- R4: A group's expand/collapse state is preserved during scroll — collapsing only occurs on explicit user click
- R5: Clicking the group card body (outside the chevron) navigates to the existing group-detail view, preserving the current SPEC-002 navigation model
- R5a: Clicking the JIRA ticket link navigates to JIRA in a new tab — event propagation must not trigger expand or detail navigation

### Visual -- Child Selections

- R6: Expanded child selections render immediately below the parent group card, visually connected by a tree-line connector: a left border (2px solid, muted color from the design system) with a small dot at each child's vertical midpoint
- R7: Each child selection displays: comment/description text (or "No comment" placeholder if empty), screenshot thumbnails (element and full-page, same lazy-load pattern as the detail view), and a relative timestamp (e.g. "6h ago")
- R8: Child selections do not display JIRA metadata (status, assignee, reporter, labels, comments, flag state) -- all JIRA data is inherited from the parent group and is already visible on the group card
- R9: An expanded group with zero child selections shows a "No selections" placeholder in the expansion area, using the existing empty-state text style
- R10: The expansion area opens and closes without layout jumps — CSS transition on opacity/transform is preferred over height animation (child content has dynamic height due to lazy-loaded screenshots)
- R10a: If a group has more than 10 child selections, only the first 10 render initially with a "Show N more" link to load the rest — prevents DOM bloat and scroll jank
- R10b: Screenshot thumbnails in expanded children must use the existing `useLazyVisible` pattern (lazy-load on scroll into viewport)

### Visual -- Group Card

- R11: The group card retains all its current information: summary text, JIRA labels, dates, bottom metadata row (status badge, assignee avatar, ticket link, flag indicator)
- R12: The expand chevron is the leading element in the card layout, positioned before the summary text -- it replaces any current left-side affordance or is added if none exists
- R13: When expanded, the group card receives a subtle background color change (e.g. slightly lighter or a low-opacity accent tint) to visually indicate the active/open state
- R14: The selection count is displayed on the group card's metadata row (e.g. "2 selections" or "2 sel.") alongside the existing relative timestamp, using the same text style as other metadata

### Data

- R15: Child selections are sourced from the existing `commentItems` array filtered by `groupId` -- no new API calls, no new server endpoints
- R16: The selection count per group is derived from the same filter (`commentItems.filter(c => c.groupId === group.id).length`) and displayed on the group card
- R17: Expand/collapse state is stored as client-side UI state (e.g. a `Set<string>` of expanded group IDs) — it does not persist across page reloads or sync to the server
- R17a: When a filter (SPEC-006) hides a group that is currently expanded, the expansion state is cleared for that group — when the filter is removed and the group reappears, it starts collapsed

### Accessibility

- R18: The expand/collapse chevron (or the group card itself, if the entire card is the toggle target) must be keyboard-operable: focusable and togglable via Enter or Space
- R19: The expanded region must use `aria-expanded` on the toggle element and the child list must be associated via `aria-controls` / `id`
- R20: Screen readers must announce the expand/collapse state change

### Acceptance Criteria (Testable)

- AC1: Clicking the chevron on a collapsed group expands it, showing child selections below
- AC2: Clicking the chevron on an expanded group collapses it, hiding child selections
- AC3: Clicking the card body (not chevron) navigates to group-detail view (SPEC-002 behavior preserved)
- AC4: JIRA ticket link in bottom row opens JIRA in new tab without triggering expand or detail navigation
- AC5: Two groups expanded simultaneously — both remain open
- AC6: Scroll down, expand a group, scroll away and back — expansion state preserved
- AC7: Group with 0 selections shows "No selections" placeholder when expanded
- AC8: Group with 15 selections shows first 10 + "Show 5 more" link
- AC9: Screenshots in expanded children lazy-load only when scrolled into viewport
- AC10: Filter hides an expanded group → clear filter → group reappears collapsed
- AC11: Tab/Enter on chevron toggles expansion (keyboard accessible)
- AC12: Screen reader announces "expanded"/"collapsed" state on toggle
- AC13: `aria-expanded` attribute updates on the toggle element

## Success Criteria

- A user can expand a group inline and see its child selections without losing their scroll position or navigating away from the group list
- Multiple groups can be open at the same time, allowing side-by-side comparison of children across groups
- Child selections show comment text, screenshot thumbnails, and timestamp -- no JIRA metadata clutter
- The chevron rotates smoothly on expand/collapse and the expansion area transitions without layout jumps
- Selection count on each group card matches the actual number of child selections
- No new network requests are made when expanding a group -- all data is already loaded
- The existing group-detail navigation (SPEC-002) is preserved via card body click — chevron for expand, card body for detail view

## Out of Scope

- Replacing the group-detail view entirely -- the full detail view remains available for users who need the complete selection card layout (CSS selectors, raw HTML, component metadata)
- Inline editing of child selections (comment text, removal) from the expanded view
- Drag-and-drop reordering of selections within the expanded group
- Persisting expand/collapse state across sessions or page reloads
- Filtering or searching within an expanded group's children
- Nested groups (groups within groups)
