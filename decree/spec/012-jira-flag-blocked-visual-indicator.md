---
status: draft
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

### Manual Verification
- Flag an issue in JIRA → verify red border appears on label within one polling cycle
- Unflag the issue → verify red border disappears within one polling cycle
- Flag an issue that is also in the active group → verify lightblue glow takes precedence
- Flag an issue with "Won't Do" status → verify flag red border is visually distinguishable

## Acceptance Criteria

### Data Model
- [ ] `SelectionGroupWithJira` type includes `jiraFlagged?: boolean`
- [ ] `SelectionLabelInstance` type includes `jiraFlagged?: boolean`
- [ ] Sync-server JIRA schema includes `flagged: z.boolean().optional()`

### Data Fetching
- [ ] Sync-server fetches `fields.flagged` from JIRA Agile API
- [ ] `enrichGroupsWithJiraData()` maps `flagged` to `jiraFlagged`
- [ ] Label instance builder propagates `jiraFlagged` from group to instance
- [ ] Missing/unavailable flag data defaults to `false` (no false positives)

### Selection Label Visual
- [ ] `data-react-grab-selection-label` element has red border (`#dc2626`, 2px) when `jiraFlagged` is true
- [ ] Red border is visible regardless of ATT status color
- [ ] Red border coexists with existing status badge (no layout shift)
- [ ] Red border removed when `jiraFlagged` becomes false

### Canvas Overlay Visual
- [ ] Canvas overlay border renders in red (`#dc2626`) for flagged selections
- [ ] Canvas overlay fill uses red with `STATUS_OVERLAY_FILL_ALPHA` (0.08)
- [ ] Flagged red overrides ATT status color in the canvas
- [ ] Active-group highlight (lightblue) overrides flagged red

### Override Precedence
- [ ] Active-group glow > flagged red > ATT status > default pink
- [ ] Selecting a flagged group shows lightblue glow, not red
- [ ] Deselecting a flagged group shows red, not status color

### Business Rule Layer
- [ ] `resolve-display-color.ts` module exists in `features/sidebar/`
- [ ] `resolveDisplayColor()` returns `FLAGGED_COLOR` when `jiraFlagged` is true
- [ ] `resolveDisplayColor()` falls through to `getStatusColor()` when not flagged
- [ ] `FLAGGED_COLOR` exported as `StatusColorConfig` with hex `#dc2626`
- [ ] Canvas overlay uses `resolveDisplayColor()` instead of `getStatusColor()` directly
- [ ] Selection label border uses `resolveDisplayColor()` for color determination

### Status Legend
- [ ] Status Legend panel shows "Flagged / Blocked" entry with red indicator
- [ ] Flagged entry appears above workflow statuses with visual separator
- [ ] Flagged row has distinct visual treatment (background tint, left border accent)

### Constants and Config
- [ ] `FLAGGED_COLOR` constant defined in `resolve-display-color.ts` as `StatusColorConfig`
- [ ] Flag color is `#dc2626` (red-600), distinct from "Won't Do" `#ef4444`

### HTML POC
- [ ] `docs/plans/poc/flag-selection-label.html` — selection label red border comparison
- [ ] `docs/plans/poc/flag-canvas-overlay.html` — canvas overlay red override + precedence
- [ ] `docs/plans/poc/flag-status-legend.html` — status legend with flagged entry
