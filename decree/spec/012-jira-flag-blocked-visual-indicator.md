---
status: implemented
date: 2026-04-14
references: [PRD-007, ADR-0009, SPEC-004, SPEC-006]
---

# SPEC-012 JIRA Flag/Blocked Visual Indicator

## Overview

Add visual indicators for JIRA-flagged (blocked) issues. When a selection group's linked JIRA ticket is flagged, two visual signals appear: (1) a red border on the selection label element, and (2) a red border + red-tinted fill on the canvas overlay. The flag state is fetched via the JIRA Agile API and propagated through the existing data model.

## Technical Design

### 1. Data Model Extensions

#### 1.1 JIRA Types (`features/sidebar/jira-types.ts`)

Add `jiraFlagged` to `SelectionGroupWithJira`:

```typescript
export type SelectionGroupWithJira = SelectionGroup & {
  // ... existing fields
  jiraFlagged?: boolean;  // NEW: JIRA flag/impediment status
};
```

#### 1.2 Selection Label Instance (`types.ts`)

Add `jiraFlagged` to `SelectionLabelInstance`:

```typescript
// In SelectionLabelInstance type
jiraFlagged?: boolean;
```

#### 1.3 Sync Server Schema (`sync-server/src/schemas/jira.ts`)

Add `flagged` to the JIRA issue schema:

```typescript
flagged: z.boolean().optional().default(false),
```

### 2. Data Fetching — JIRA Agile API

#### 2.1 Agile API Integration

The sync-server's JIRA polling must fetch `fields.flagged` from the Agile API:

- **Endpoint**: `GET /rest/agile/1.0/issue/{issueKey}?fields=flagged`
- **Response**: `{ fields: { flagged: true } }`
- **Fallback**: If Agile API unavailable, treat as `flagged: false` (no false positives)

#### 2.2 Polling Propagation

The flag state follows the same polling path as existing JIRA metadata:
1. Sync-server fetches issue data including `flagged`
2. `enrichGroupsWithJiraData()` maps `flagged` -> `jiraFlagged` on `SelectionGroupWithJira`
3. Label instance builder copies `jiraFlagged` to `SelectionLabelInstance`

### 3. Visual — Selection Label Red Border

#### 3.1 Selection Label Component (`components/selection-label/index.tsx`)

On the outer `<div>` at line ~457 (the `data-react-grab-selection-label` element):

```typescript
// Conditional red border when flagged
const flaggedBorderClass = () =>
  props.instance.jiraFlagged ? 'border-2 border-[#dc2626]' : '';
```

Apply to the inner panel container (line ~502) which has `rounded-[10px]`:

```typescript
class={`rounded-[10px] bg-popover ${flaggedBorderClass()} ...`}
```

#### 3.2 CSS Constants

Add to `styles.css` or use inline Tailwind:
- Flag border color: `#dc2626` (red-600) — distinct from "Won't Do" `#ef4444` (red-500)
- Border width: 2px solid

### 4. Visual — Canvas Overlay Red Override

#### 4.1 Overlay Canvas Renderer (`components/overlay-canvas.tsx`)

In the border color determination logic (line ~694-700), insert flagged check before status color:

```typescript
// Current logic:
// if (isActiveGroup) -> ACTIVE_GROUP_BORDER_COLOR
// else -> getStatusColor(instance.groupStatus).hex

// New logic:
// if (isActiveGroup) -> ACTIVE_GROUP_BORDER_COLOR (unchanged)
// else if (instance.jiraFlagged) -> FLAGGED_BORDER_COLOR (#dc2626)
// else -> getStatusColor(instance.groupStatus).hex
```

#### 4.2 Color Constants (`constants.ts`)

```typescript
export const FLAGGED_BORDER_COLOR = '#dc2626';
export const FLAGGED_OVERLAY_COLOR = '#dc2626';
```

#### 4.3 Fill Color

Flagged selections use red fill with standard alpha:
```typescript
hexToRgba(FLAGGED_OVERLAY_COLOR, STATUS_OVERLAY_FILL_ALPHA) // rgba(220, 38, 38, 0.08)
```

### 5. Business Rule Layer — Screaming Architecture

#### 5.1 `resolveDisplayColor()` (`features/sidebar/resolve-display-color.ts`)

A dedicated module that encodes the color override business rule. This is the SINGLE source of truth — UI components call this instead of `getStatusColor()` directly.

```typescript
import { type StatusColorConfig, getStatusColor } from "./status-colors.js";

export const FLAGGED_COLOR: StatusColorConfig = {
  hex: "#dc2626",
  bg: "rgba(220,38,38,0.12)",
  text: "#dc2626",
};

export function resolveDisplayColor(
  jiraStatus: string | undefined,
  jiraFlagged: boolean | undefined,
): StatusColorConfig {
  if (jiraFlagged) return FLAGGED_COLOR;
  return getStatusColor(jiraStatus);
}
```

**Why a separate module:** The business decision "flagged overrides status" must not be buried in `if` checks inside overlay-canvas.tsx, selection-label/index.tsx, and status-legend.tsx. It lives in one place, is documented, and is unit-testable.

### 6. Visual — Status Legend Flagged Entry

#### 6.1 Status Legend (`components/sidebar/status-legend.tsx`)

Add a "Flagged / Blocked" row at the top of the legend, before workflow statuses, with a visual separator:

- Red dot (`#dc2626`) with description: "Ticket has an impediment — overrides status color"
- Subtle red background tint + left border accent on the flagged row
- "OVERRIDES" separator label between flagged entry and workflow statuses

### 7. Override Precedence Chain

Priority (highest first):
1. **Active group** → lightblue glow (`ACTIVE_GROUP_BORDER_COLOR`)
2. **Flagged/blocked** → red (`FLAGGED_COLOR.hex` via `resolveDisplayColor`)
3. **ATT status** → `getStatusColor(status).hex`
4. **Default** → pink (`overlayColor()`)

This matches the existing pattern where active-group already overrides status color.

## Testing Strategy

### Unit Tests
- Test `resolveDisplayColor()` returns `FLAGGED_COLOR` when `jiraFlagged` is true
- Test `resolveDisplayColor()` returns status color when `jiraFlagged` is false/undefined
- Test `resolveDisplayColor()` returns `FLAGGED_COLOR` even when status is "Won't Do" (flag overrides all)
- Test status poller maps `flagged` to `jiraFlagged` on groups
- Test label instance builder propagates `jiraFlagged` from group to instance

### Integration Tests
- Test that a flagged issue's selection label renders with red border class
- Test that canvas overlay uses `FLAGGED_BORDER_COLOR` when `jiraFlagged` is true
- Test that active-group highlight still overrides flagged red

### Manual Verification Checklist

> **Prerequisites:** sync-server running, extension loaded, at least one selection group with a linked JIRA ticket, access to JIRA board to flag/unflag.

#### MV-1: Data Flow — flag arrives from JIRA
- [ ] Flag a ticket in JIRA (board view → right-click → "Add flag")
- [ ] Wait one polling cycle (~30s)
- [ ] DevTools → Network → filter `jira-status` → response includes `"flagged": true`

#### MV-2: Selection Label — red border + flag icon ([POC reference](../../docs/plans/poc/flag-selection-label.html))
- [ ] Flagged ticket's selection label has 2px red border (`#dc2626`)
- [ ] Red flag icon (JIRA pennant) appears next to the tag badge
- [ ] Status badge (top-right) retains its original status color — badge is NOT red
- [ ] Unflag in JIRA → wait one poll → red border and flag icon disappear

#### MV-3: Canvas Overlay — red fill + border ([POC reference](../../docs/plans/poc/flag-canvas-overlay.html))
- [ ] Flagged ticket's overlay border is red, not the normal status color
- [ ] Overlay has a subtle red tint (8% opacity fill)
- [ ] Click a different group → flagged group shows red overlay (not status color)
- [ ] Click the flagged group to make it active → lightblue glow overrides red

#### MV-4: Override Precedence ([POC reference](../../docs/plans/poc/flag-canvas-overlay.html))
- [ ] Flagged + "In Progress": overlay is red, NOT blue
- [ ] Flagged + "Code Review": overlay is red, NOT violet
- [ ] Flagged + active group: overlay is lightblue glow, NOT red
- [ ] Deselect the flagged group: overlay goes back to red
- [ ] Unflag the ticket: overlay returns to its status color

#### MV-5: Selection Card (sidebar — group detail) ([POC reference](../../docs/plans/poc/flag-card-icon.html))
- [ ] Open a group with a flagged ticket → selection card has red left-border accent (3px)
- [ ] Red flag icon appears next to the component name
- [ ] Unflag → wait → left-border and flag icon disappear

#### MV-6: Loose Selection Card (sidebar — loose list) ([POC reference](../../docs/plans/poc/flag-card-icon.html))
- [ ] Loose selection with a flagged backing ticket → red left-border accent (3px)
- [ ] Red flag icon appears next to the ticket ID
- [ ] Status pill color is red (`#dc2626`), not the workflow status color

#### MV-7: Status Legend ([POC reference](../../docs/plans/poc/flag-status-legend.html))
- [ ] Click info button in sidebar header → "Flagged / Blocked" row at the TOP, above "No Task"
- [ ] Red dot (`#dc2626`) next to it
- [ ] "OVERRIDES" separator between flagged row and workflow statuses
- [ ] "Won't Do" further down has a different red (`#ef4444`) — visually distinguishable

#### MV-8: Edge Cases
- [ ] Unflagged ticket: no red anywhere — normal status colors
- [ ] Ticket with no JIRA link: no red, shows default pink
- [ ] "Won't Do" + flagged: red border on label, red overlay — distinct from unflagged "Won't Do"
- [ ] Multiple flagged tickets on page: each independently shows red

## Acceptance Criteria

### Data Model
- [x] `SelectionGroupWithJira` type includes `jiraFlagged?: boolean`
- [x] `SelectionLabelInstance` type includes `jiraFlagged?: boolean`
- [x] Sync-server JIRA schema includes `flagged: z.boolean().optional()`

### Data Fetching
- [x] Sync-server fetches `fields.flagged` from JIRA Agile API
- [x] `enrichGroupsWithJiraData()` maps `flagged` to `jiraFlagged`
- [x] Label instance builder propagates `jiraFlagged` from group to instance
- [x] Missing/unavailable flag data defaults to `false` (no false positives)

### Selection Label Visual
- [x] `data-react-grab-selection-label` element has red border (`#dc2626`, 2px) when `jiraFlagged` is true
- [x] `data-react-grab-selection-label` shows red `IconFlag` next to the tag badge when flagged
- [x] Red border is visible regardless of ATT status color
- [x] Red border coexists with existing status badge (no layout shift)
- [x] Red border removed when `jiraFlagged` becomes false

### Canvas Overlay Visual
- [x] Canvas overlay border renders in red (`#dc2626`) for flagged selections
- [x] Canvas overlay fill uses red with `STATUS_OVERLAY_FILL_ALPHA` (0.08)
- [x] Flagged red overrides ATT status color in the canvas
- [x] Active-group highlight (lightblue) overrides flagged red

### Override Precedence
- [x] Active-group glow > flagged red > ATT status > default pink
- [x] Selecting a flagged group shows lightblue glow, not red
- [x] Deselecting a flagged group shows red, not status color

### Business Rule Layer
- [x] `resolve-display-color.ts` module exists in `features/sidebar/`
- [x] `resolveDisplayColor()` returns `FLAGGED_COLOR` when `jiraFlagged` is true
- [x] `resolveDisplayColor()` falls through to `getStatusColor()` when not flagged
- [x] `FLAGGED_COLOR` exported as `StatusColorConfig` with hex `#dc2626`
- [x] Canvas overlay uses `resolveDisplayColor()` instead of `getStatusColor()` directly
- [x] Selection label border uses `resolveDisplayColor()` for color determination

### Sidebar Cards
- [x] `SelectionCard` accepts optional `jiraFlagged` prop
- [x] `data-react-grab-selection-card` shows unified red border (`FLAGGED_BORDER_CLASS`) when flagged — same as selection label
- [x] `data-react-grab-selection-card` shows red flag icon (`IconFlag`) next to component name when flagged
- [x] `data-react-grab-loose-selection-card` inner container shows unified red border when flagged
- [x] `data-react-grab-loose-selection-card` shows red flag icon next to ticket ID when flagged
- [x] `LooseSelectionCard` status pill uses `resolveDisplayColor` instead of `getStatusColor`
- [x] `loose-selection-list.tsx` passes `jiraFlagged` from backing group to `LooseSelectionCard`
- [x] `IconFlag` component exists at `components/icons/icon-flag.tsx` (Atlassian @atlaskit flag SVG)

### Flag Icon Visual ([POC reference](../../docs/plans/poc/flag-card-icon.html))
- [x] `IconFlag` renders a filled flag SVG (Lucide `flag` shape, solid fill, not stroked)
- [x] `SelectionCard` shows red `IconFlag` (14px) next to component name when flagged
- [x] `LooseSelectionCard` shows red `IconFlag` (12px) next to ticket ID when flagged
- [x] Flag icon color is `#dc2626` matching `FLAGGED_COLOR`

### Status Legend
- [x] Status Legend panel shows "Flagged / Blocked" entry with red indicator
- [x] Flagged entry appears above workflow statuses with visual separator
- [x] Flagged row has distinct visual treatment (background tint, left border accent)

### Constants and Config
- [x] `FLAGGED_COLOR` constant defined in `resolve-display-color.ts` as `StatusColorConfig`
- [x] `FLAGGED_BORDER_CLASS` shared Tailwind class string in `resolve-display-color.ts` — used by label, card, loose-card
- [x] `FLAGGED_ICON_SIZE` shared icon size constant (16px) in `resolve-display-color.ts`
- [x] Flag color is `#dc2626` (red-600), distinct from "Won't Do" `#ef4444`

### HTML POC
- [x] [`docs/plans/poc/flag-selection-label.html`](../../docs/plans/poc/flag-selection-label.html) — selection label red border comparison
- [x] [`docs/plans/poc/flag-canvas-overlay.html`](../../docs/plans/poc/flag-canvas-overlay.html) — canvas overlay red override + precedence
- [x] [`docs/plans/poc/flag-status-legend.html`](../../docs/plans/poc/flag-status-legend.html) — status legend with flagged entry
- [x] [`docs/plans/poc/flag-card-icon.html`](../../docs/plans/poc/flag-card-icon.html) — flag icon on selection cards and loose cards

## Related Documents

| Document | Relationship |
|----------|-------------|
| [PRD-007](../prd/007-jira-flag-blocked-visual-indicator.md) | Parent requirement (R1-R17) |
| [ADR-0009](../adr/0009-flag-data-source-and-blocked-visual-strategy.md) | Architecture decision — Agile API + red border |
| [PRD-008](../prd/008-jira-flag-toggle-write-back.md) | Future follow-up — flag toggle write-back |
| [Implementation Plan](../../docs/plans/2026-04-14-jira-flag-blocked-visual-indicator.md) | 12-task bite-sized plan |
| [Business Rule](../../packages/react-grab/src/features/sidebar/resolve-display-color.ts) | `resolveDisplayColor()` — screaming architecture layer |
