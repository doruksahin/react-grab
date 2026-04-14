---
status: draft
date: 2026-04-15
references: [PRD-002, SPEC-001, SPEC-002]
---

# PRD-011 Expandable Inline Groups

## Problem Statement

When a user clicks a group in the sidebar's Groups tab, the entire view navigates to a group-detail component. This full-view navigation breaks the user's mental model of the group list: they lose their scroll position, lose visual context of surrounding groups, and must press "Back" to return. For workflows where the user wants to quickly scan the children of several groups in sequence, this click-navigate-back-click cycle adds significant friction.

The group-detail view also renders the full selection card layout (component names, HTML tags, CSS selectors, raw HTML collapsible) which is more information than most quick-scan tasks require. Users checking "which screenshots are in this group?" or "what was the comment on that selection?" are forced through a heavyweight view for a lightweight question.

An inline expand interaction -- click a group card, see its child selections appear below it in the list -- eliminates the navigation round-trip and lets users keep the group list visible while inspecting children. This directly reduces the interaction cost of the most common sidebar workflow: reviewing and triaging groups.

## Requirements

### Interaction

- R1: Clicking a group card in the Groups tab toggles inline expansion of that group's child selections -- no page navigation occurs
- R2: The expand/collapse affordance is a chevron icon: right-pointing (collapsed) rotating to downward-pointing (expanded), using a CSS transition
- R3: Multiple groups can be expanded simultaneously -- this is not an accordion; expanding one group does not collapse another
- R4: A group's expand/collapse state is preserved during scroll -- collapsing only occurs on explicit user click
- R5: Clicking the group card's JIRA ticket link (if present) must still navigate to JIRA in a new tab without triggering expand/collapse -- event propagation must be handled correctly

### Visual -- Child Selections

- R6: Expanded child selections render immediately below the parent group card, visually connected by a tree-line connector: a left border (2px solid, muted color from the design system) with a small dot at each child's vertical midpoint
- R7: Each child selection displays: comment/description text (or "No comment" placeholder if empty), screenshot thumbnails (element and full-page, same lazy-load pattern as the detail view), and a relative timestamp (e.g. "6h ago")
- R8: Child selections do not display JIRA metadata (status, assignee, reporter, labels, comments, flag state) -- all JIRA data is inherited from the parent group and is already visible on the group card
- R9: An expanded group with zero child selections shows a "No selections" placeholder in the expansion area, using the existing empty-state text style
- R10: The expansion area animates open and closed with a height transition (max 200ms) to avoid layout jumps

### Visual -- Group Card

- R11: The group card retains all its current information: summary text, JIRA labels, dates, bottom metadata row (status badge, assignee avatar, ticket link, flag indicator)
- R12: The expand chevron is the leading element in the card layout, positioned before the summary text -- it replaces any current left-side affordance or is added if none exists
- R13: When expanded, the group card receives a subtle background color change (e.g. slightly lighter or a low-opacity accent tint) to visually indicate the active/open state
- R14: The selection count is displayed on the group card's metadata row (e.g. "2 selections" or "2 sel.") alongside the existing relative timestamp, using the same text style as other metadata

### Data

- R15: Child selections are sourced from the existing `commentItems` array filtered by `groupId` -- no new API calls, no new server endpoints
- R16: The selection count per group is derived from the same filter (`commentItems.filter(c => c.groupId === group.id).length`) and displayed on the group card
- R17: Expand/collapse state is stored as client-side UI state (e.g. a `Set<string>` of expanded group IDs) -- it does not persist across page reloads or sync to the server

### Accessibility

- R18: The expand/collapse chevron (or the group card itself, if the entire card is the toggle target) must be keyboard-operable: focusable and togglable via Enter or Space
- R19: The expanded region must use `aria-expanded` on the toggle element and the child list must be associated via `aria-controls` / `id`
- R20: Screen readers must announce the expand/collapse state change

## Success Criteria

- A user can expand a group inline and see its child selections without losing their scroll position or navigating away from the group list
- Multiple groups can be open at the same time, allowing side-by-side comparison of children across groups
- Child selections show comment text, screenshot thumbnails, and timestamp -- no JIRA metadata clutter
- The chevron rotates smoothly on expand/collapse and the expansion area transitions without layout jumps
- Selection count on each group card matches the actual number of child selections
- No new network requests are made when expanding a group -- all data is already loaded
- The existing group-detail navigation (for users who want the full view) remains accessible via a separate affordance or is preserved as an alternative entry point

## Out of Scope

- Replacing the group-detail view entirely -- the full detail view remains available for users who need the complete selection card layout (CSS selectors, raw HTML, component metadata)
- Inline editing of child selections (comment text, removal) from the expanded view
- Drag-and-drop reordering of selections within the expanded group
- Persisting expand/collapse state across sessions or page reloads
- Filtering or searching within an expanded group's children
- Nested groups (groups within groups)
