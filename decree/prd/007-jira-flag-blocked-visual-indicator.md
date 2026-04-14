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

### Visual — Flag Icon
- R18: A filled red flag icon (matching JIRA's flag visual) must appear on flagged selection labels — next to the tag badge
- R19: A filled red flag icon must appear on flagged selection cards — next to the component name
- R20: A filled red flag icon must appear on flagged loose-selection cards — next to the ticket ID
- R21: The flag icon must follow the project's custom SVG icon pattern (`components/icons/icon-flag.tsx`) — no external icon library
- R22: The flagged border style and icon size must be defined as shared constants in the business rule layer (`FLAGGED_BORDER_CLASS`, `FLAGGED_ICON_SIZE`) — DRY across all consumers

### Data — Flag Date and Author
- R23: The sync-server must fetch the JIRA issue changelog and extract the timestamp of the most recent flag event (`field === "Flagged"`, `toString === "Impediment"`)
- R24: The `flaggedAt` ISO timestamp must be included in the `JiraTicketStatus` response alongside `flagged`
- R25: The flag date must be shown as relative time (e.g. "3h ago") next to the flag icon on all flagged surfaces (label, card, loose-card)
- R26: The sync-server must extract the flagger's display name and avatar URL from the changelog entry `author` field
- R27: `flaggedBy` (display name) and `flaggedByAvatar` (48x48 URL) must be included in the `JiraTicketStatus` response

### Interaction — Flag Tooltip
- R28: Hovering the flag icon + relative time must show a tooltip with: flag header, flagger avatar (24px), flagger name, and exact date to the minute (e.g. "Apr 14, 2026 at 17:32")
- R29: The tooltip must use the existing Kobalte `Tooltip` component with shadow DOM portal mounting

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
- Setting/removing the flag from within react-grab (read-only) — see [PRD-008](008-jira-flag-toggle-write-back.md)
- Flag-based filtering or sorting (covered by SPEC-006 ATT status filtering)
- Custom flag colors or user-configurable blocked indicators
- Notification or alert system for newly flagged items

## Related Documents

| Document | Relationship |
|----------|-------------|
| [ADR-0009](../adr/0009-flag-data-source-and-blocked-visual-strategy.md) | Architecture decision — Agile API + red border strategy |
| [SPEC-012](../spec/012-jira-flag-blocked-visual-indicator.md) | Technical specification — 37 acceptance criteria |
| [PRD-008](008-jira-flag-toggle-write-back.md) | Future follow-up — flag toggle write-back (depends on this PRD) |
| [Implementation Plan](../../docs/plans/2026-04-14-jira-flag-blocked-visual-indicator.md) | 12-task implementation plan |
| [Business Rule](../../packages/react-grab/src/features/sidebar/resolve-display-color.ts) | `resolveDisplayColor()` — single source of truth |

### HTML POCs
| POC | What it shows |
|-----|---------------|
| [Selection Label](../../docs/plans/poc/flag-selection-label.html) | Red border on label — normal vs flagged comparison |
| [Canvas Overlay](../../docs/plans/poc/flag-canvas-overlay.html) | Red overlay + override precedence chain |
| [Status Legend](../../docs/plans/poc/flag-status-legend.html) | Flagged entry with "OVERRIDES" separator |
| [Card Flag Icon](../../docs/plans/poc/flag-card-icon.html) | Flag icon on selection cards + loose cards (R18-R20) |
| [Flag Tooltip](../../docs/plans/poc/flag-tooltip.html) | Hover tooltip: who flagged + exact date (R26-R29) |
