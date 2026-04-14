---
status: draft
date: 2026-04-14
references: [PRD-004, SPEC-004, SPEC-006]
---

# PRD-007 JIRA Flag/Blocked Visual Indicator

## Problem Statement

In JIRA, issues can be "flagged" to indicate they are blocked or require immediate attention. This is a critical workflow signal — flagged issues represent impediments that slow the entire team.

Currently, react-grab has no awareness of the JIRA flag status. When a selection group's linked JIRA ticket is flagged, there is no visual differentiation on the page. Users must open the sidebar or navigate to JIRA to discover that an issue is blocked. This creates a blind spot: blocked work looks identical to in-progress work on the overlay canvas.

For our enterprise workflow, flagged/blocked status must be immediately visible at a glance — both on the selection label and on the canvas overlay — so that team members can prioritize unblocking work without additional clicks.

## Requirements

### Data Layer
- R1: Fetch the JIRA `flagged` boolean for each linked ticket during the JIRA metadata polling cycle
- R2: Propagate the `flagged` state through the data model: `SelectionGroupWithJira` -> `SelectionLabelInstance` -> canvas renderer
- R3: The flag state must update on the same polling interval as other JIRA metadata (status, assignee, etc.)

### Visual — Selection Label
- R4: When a selection group's JIRA ticket is flagged, the `data-react-grab-selection-label` element must display a **red border** (2px solid, `#dc2626` — red-600)
- R5: The red border must be visible regardless of the current ATT status color
- R6: The red border must coexist with the existing status badge (top-right corner)

### Visual — Sidebar Cards
- R15: `data-react-grab-selection-card` must show a red left-border accent when its parent group's JIRA ticket is flagged
- R16: `data-react-grab-loose-selection-card` must show a red left-border accent when its backing group's JIRA ticket is flagged
- R17: The status pill color in `LooseSelectionCard` must use `resolveDisplayColor` (flag-aware) instead of `getStatusColor`

### Visual — Canvas Overlay
- R7: When a selection group's JIRA ticket is flagged, the canvas overlay border for that selection must render in **red** (`#dc2626`)
- R8: The canvas overlay fill for a flagged selection must use red with the standard `STATUS_OVERLAY_FILL_ALPHA` (0.08)
- R9: The flagged visual must take precedence over the normal status color but yield to the active-group highlight (lightblue glow)

### Visual — Status Legend
- R11: The sidebar Status Legend panel must display a "Flagged / Blocked" entry with red indicator
- R12: The flagged entry must appear above workflow statuses with a visual separator communicating the override relationship

### Architecture — Business Rule Layer
- R13: Color resolution must be encapsulated in a single business rule function (`resolveDisplayColor`) — not scattered across UI components
- R14: The override precedence (flagged > status) must be a named, documented business decision in a dedicated module

### Override Precedence
- R10: Visual priority order (highest to lowest): active-group glow > flagged/blocked red > ATT status color > default pink

## Success Criteria

- SC1: A flagged JIRA ticket's selection label displays a red border within one polling cycle of being flagged
- SC2: A flagged JIRA ticket's canvas overlay renders with red border and red-tinted fill
- SC3: Removing the flag in JIRA clears the red indicators within one polling cycle
- SC4: Flagged visual indicators do not interfere with existing status badge, status colors, or active-group highlighting
- SC5: The flag state is correctly represented in the data model types (`SelectionGroupWithJira`, `SelectionLabelInstance`)
- SC6: The Status Legend panel shows Flagged entry with red indicator above workflow statuses
- SC7: A single `resolveDisplayColor()` function encodes the override rule — no UI component implements the precedence logic directly

## Scope

### In Scope
- Reading JIRA flag status from the API (Agile API `fields.flagged` boolean or standard API custom field)
- Visual indicators on selection labels (red border)
- Visual indicators on canvas overlays (red border + red fill)
- Flagged entry in the sidebar Status Legend panel
- Business rule layer: `resolveDisplayColor()` as single source of truth for color override
- Data model extensions for flag state propagation
- Override precedence logic in the canvas renderer
- HTML POC files colocated in `docs/plans/poc/`

### Out of Scope
- Setting/removing the flag from within react-grab (read-only)
- Flag indicator in the sidebar list view (future enhancement)
- Flag-based filtering or sorting (covered by SPEC-006 ATT status filtering)
- Custom flag colors or user-configurable blocked indicators
- Notification or alert system for newly flagged items
