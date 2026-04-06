---
status: implemented
date: 2026-04-06
references: [PRD-002, SPEC-003]
---

# SPEC-004 Selection Status Colors

## Overview

Change the visual appearance of selection overlays (canvas borders) and selection labels (popup badges) to reflect the JIRA status of the group each selection belongs to. Currently all selections are pink (`rgba(210, 57, 192)`) regardless of JIRA state. After this change:

- **Open** (no JIRA ticket): pink — unchanged, no status icon on label
- **Ticketed** (JIRA ticket assigned): yellow — border + fill tinted yellow, clipboard-check icon on label top-right
- **Resolved** (JIRA ticket done): green — border + fill tinted green, checkmark icon on label top-right

This is a visual-only change. It depends on Phase 3 (SPEC-003) for `jiraTicketId` and `jiraResolved` on the group data. No new data fetching, no new API calls.

**Proposal:** `decree-docs/selection-status-colors-proposal.html`

## Technical Design

### Color System

The overlay canvas uses `overlayColor(alpha)` from `utils/overlay-color.ts`, which produces `rgba(210, 57, 192, alpha)` (pink/purple, wide-gamut aware). This function is parameterized by alpha only — the hue is hardcoded.

Introduce a new `statusOverlayColor(status, alpha)` function that returns the appropriate color based on group status:

```typescript
// utils/overlay-color.ts — extend

const STATUS_COLORS = {
  open: { srgb: "210, 57, 192", p3: "0.84 0.19 0.78" },     // pink (existing)
  ticketed: { srgb: "234, 179, 8", p3: "0.92 0.70 0.03" },   // yellow
  resolved: { srgb: "34, 197, 94", p3: "0.13 0.77 0.37" },   // green
};

export const statusOverlayColor = (
  status: GroupStatus,
  alpha: number,
): string => {
  const c = STATUS_COLORS[status];
  return isWideGamut
    ? `color(display-p3 ${c.p3} / ${alpha})`
    : `rgba(${c.srgb}, ${alpha})`;
};
```

### Overlay Canvas — Status-Aware Borders

The canvas draws selection boxes via `drawRoundedRectangle(ctx, x, y, w, h, radius, fillColor, strokeColor, opacity)`. Currently all persisted selections use `DEFAULT_LAYER_STYLE` which has fixed pink colors.

To make the canvas status-aware, `labelInstances` (the persisted selection overlays rendered on the canvas) need to carry the group's JIRA status. The data flow:

```
commentItems (has groupId)
  → groups (has jiraTicketId, jiraResolved via SelectionGroupWithJira)
    → deriveStatus(group) → "open" | "ticketed" | "resolved"
      → statusOverlayColor(status, alpha) → canvas strokeStyle/fillStyle
```

**Option 1 (minimal):** Add a `groupStatus` field to `SelectionLabelInstance` and compute it when building label instances in `core/index.tsx`. The overlay canvas reads `instance.groupStatus` to pick the layer style.

```typescript
// In core/index.tsx where labelInstances are built:
const groupStatus = deriveStatus(
  groups.find(g => g.id === comment.groupId) ?? { id: '', name: '', createdAt: 0 }
);

// Pass to overlay canvas as part of the instance:
{ ...instance, groupStatus }
```

In `overlay-canvas.tsx`, when rendering label instances (around line 615):

```typescript
for (const instance of instancesToProcess) {
  const status = instance.groupStatus ?? "open";
  const style = {
    borderColor: statusOverlayColor(status, 0.5),
    fillColor: statusOverlayColor(status, 0.08),
    lerpFactor: SELECTION_LERP_FACTOR,
  };
  // use `style` instead of DEFAULT_LAYER_STYLE for this instance
}
```

### Selection Label — Status Icon

The selection label (`components/selection-label/index.tsx`) is the white popup that appears below each selection. Add a status icon to its top-right corner:

- **Open:** no icon (hidden)
- **Ticketed:** yellow badge with clipboard-check icon, tooltip "Ticketed — {ticketId}"
- **Resolved:** green badge with checkmark icon, tooltip "Resolved"

The icon is positioned `absolute`, `top: -6px`, `right: -6px`, `22px` square, `border-radius: 6px`, white 2px border, with the status color as background.

```tsx
// Inside selection-label/index.tsx, inside the .body container:
<Show when={groupStatus() !== "open"}>
  <div
    class="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-[6px] flex items-center justify-center border-2 border-white"
    style={{
      background: groupStatus() === "ticketed" ? "#eab308" : "#22c55e",
      "pointer-events": "auto",
    }}
    title={groupStatus() === "ticketed" ? `Ticketed — ${ticketId()}` : "Resolved"}
  >
    <Show when={groupStatus() === "ticketed"}>
      <TicketIcon size={12} />
    </Show>
    <Show when={groupStatus() === "resolved"}>
      <CheckIcon size={12} />
    </Show>
  </div>
</Show>
```

The `groupStatus` and `ticketId` are derived from the comment's `groupId` → group lookup → `deriveStatus()`. These need to be threaded as props to the selection label or computed internally.

### Data Threading

The selection label already receives `groups` and `activeGroupId` as props (from `renderer.tsx`, line 157). It also receives the comment's `groupId` implicitly via the selection instance. The status can be derived inside the label:

```typescript
const group = () => props.groups?.find(g => g.id === commentGroupId());
const groupStatus = () => group() ? deriveStatus(group()!) : "open";
const ticketId = () => group()?.jiraTicketId;
```

For the overlay canvas, `labelInstances` need the `groupStatus` added. This is computed in `core/index.tsx` when building the instances array.

### File Changes

```
packages/react-grab/src/
├── utils/
│   └── overlay-color.ts              Modified: add statusOverlayColor()
├── components/
│   ├── overlay-canvas.tsx            Modified: use statusOverlayColor for label instances
│   └── selection-label/
│       └── index.tsx                 Modified: add status icon badge
├── components/icons/
│   ├── icon-ticket.tsx               NEW: clipboard-check icon (12px)
│   └── icon-check.tsx                NEW: checkmark icon (12px)
├── core/
│   └── index.tsx                     Modified: add groupStatus to labelInstances
└── types.ts                          Modified: add groupStatus to SelectionLabelInstance
```

### Active Group Highlight — Sidebar Selection Glow

When a user clicks a group in the sidebar (entering the detail view), all selections belonging to that group are highlighted on the overlay canvas with a **lightblue glow effect** to visually connect the sidebar detail view with the on-page elements.

**Color:** Lightblue — `rgba(56, 189, 248, alpha)` (sky-400) / `color(display-p3 0.22 0.74 0.97 / alpha)` for wide-gamut.

Add to `overlay-color.ts`:

```typescript
const ACTIVE_GROUP_COLORS = { srgb: "56, 189, 248", p3: "0.22 0.74 0.97" };

export const activeGroupOverlayColor = (alpha: number): string =>
  isWideGamut
    ? `color(display-p3 ${ACTIVE_GROUP_COLORS.p3} / ${alpha})`
    : `rgba(${ACTIVE_GROUP_COLORS.srgb}, ${alpha})`;
```

**Glow effect:** The canvas draws the active group's selections with:
- Border: `activeGroupOverlayColor(0.7)` — brighter than normal
- Fill: `activeGroupOverlayColor(0.12)` — subtle tinted fill
- Shadow: `ctx.shadowColor = activeGroupOverlayColor(0.5)`, `ctx.shadowBlur = 12` — the glow

**Data threading:** `activeDetailGroupId` lives as local state inside `Sidebar`. It must be lifted to `renderer.tsx` so it can reach `OverlayCanvas`.

Signal chain:
```
Sidebar.activeDetailGroupId (internal signal)
  → props.onActiveDetailGroupChange(id | null)  [new SidebarProps callback]
    → renderer.tsx: activeDetailGroupId signal
      → OverlayCanvas.activeGroupId prop
```

- Add `onActiveDetailGroupChange?: (groupId: string | null) => void` to `SidebarProps`
- Sidebar calls it via `createEffect` whenever `activeDetailGroupId` changes
- `renderer.tsx` holds `const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<string | null>(null)`
- On sidebar close, reset: `setActiveDetailGroupId(null)`
- Pass `activeDetailGroupId()` to `OverlayCanvas` as `activeGroupId`

**Do NOT use `selectionGroups.activeGroupId`** for the glow — that tracks the assignment group for new selections, not the sidebar detail view.

```typescript
// OverlayCanvasProps — add:
activeGroupId?: string | null;
```

In the canvas render loop for `labelInstances`, when `instance.groupId === props.activeGroupId`, use the active group layer style instead of the status-based style.

**Behavior:**
- Glow appears when a group detail view is open in the sidebar
- Glow disappears when navigating back to the groups list (`activeDetailGroupId === null`)
- Selections not belonging to the active group render with their normal status color (pink/yellow/green)
- The glow is purely visual — no interaction change

### File Changes

```
packages/react-grab/src/
├── utils/
│   └── overlay-color.ts              Modified: add statusOverlayColor(), activeGroupOverlayColor()
├── components/
│   ├── overlay-canvas.tsx            Modified: use statusOverlayColor for label instances, activeGroupOverlayColor + shadow glow for active group
│   └── selection-label/
│       └── index.tsx                 Modified: add status icon badge
├── components/icons/
│   ├── icon-ticket.tsx               NEW: clipboard-check icon (12px)
│   └── icon-check.tsx                NEW: checkmark icon (12px)
├── core/
│   └── index.tsx                     Modified: add groupStatus to labelInstances
├── components/
│   ├── renderer.tsx                  Modified: hold activeDetailGroupId signal, pass to OverlayCanvas, reset on close
│   └── sidebar/
│       └── index.tsx                 Modified: add onActiveDetailGroupChange callback to SidebarProps
└── types.ts                          Modified: add groupStatus, groupId to SelectionLabelInstance
```

### Dependencies

- Depends on SPEC-003 (Phase 3) for `jiraTicketId` and `jiraResolved` on groups
- Depends on `deriveStatus()` from `features/sidebar/derive-status.ts` (already exists)
- Depends on `activeDetailGroupId` signal from sidebar (SPEC-002, already exists)
- No new npm dependencies

## Testing Strategy

### Unit Tests

- `statusOverlayColor("open", 0.5)` returns pink rgba
- `statusOverlayColor("ticketed", 0.5)` returns yellow rgba
- `statusOverlayColor("resolved", 0.5)` returns green rgba
- Wide-gamut variant returns `color(display-p3 ...)` format

### Integration Tests (Playwright)

- Selection box for a group with no JIRA ticket renders pink border
- Selection box for a ticketed group renders yellow border
- Selection box for a resolved group renders green border
- Selection label for an open group has no status icon
- Selection label for a ticketed group shows yellow badge with clipboard icon
- Selection label for a resolved group shows green badge with checkmark icon
- Status icon tooltip shows ticket ID for ticketed selections
- Clicking a group in the sidebar highlights that group's selections with lightblue glow on the canvas
- Navigating back to the groups list removes the lightblue glow
- Selections not in the active group retain their status color while the glow is active

### Manual Verification

- Create selections across multiple groups with different JIRA statuses
- Verify colors are visually distinct at a glance (pink/yellow/green)
- Verify wide-gamut colors render correctly on P3 displays
- Verify status icons don't overlap with the label arrow or tag text
- Open a group detail in sidebar — verify lightblue glow appears on the matching selections
- Verify glow is visible against both light and dark host page backgrounds
- Verify glow disappears when navigating back to group list

## Acceptance Criteria

- [ ] `statusOverlayColor(status, alpha)` function added to `utils/overlay-color.ts`
- [ ] Overlay canvas renders pink borders for open selections (unchanged behavior)
- [ ] Overlay canvas renders yellow borders for ticketed selections
- [ ] Overlay canvas renders green borders for resolved selections
- [ ] Fill color tints match border status (pink/yellow/green at lower alpha)
- [ ] `groupStatus` field added to `SelectionLabelInstance` type
- [ ] `groupStatus` computed from `deriveStatus()` when building label instances in `core/index.tsx`
- [ ] Selection label shows no status icon when group is open
- [ ] Selection label shows yellow clipboard-check badge for ticketed groups
- [ ] Selection label shows green checkmark badge for resolved groups
- [ ] Status icon positioned top-right (-6px, -6px) with white border
- [ ] Status icon tooltip shows "Ticketed — {ticketId}" or "Resolved"
- [ ] Status icon has `pointer-events: auto`
- [ ] `icon-ticket.tsx` and `icon-check.tsx` created in `components/icons/`
- [ ] Unit tests pass for `statusOverlayColor`
- [ ] Integration tests pass for canvas colors and label icons
- [ ] `activeGroupOverlayColor(alpha)` function added to `utils/overlay-color.ts` (lightblue)
- [ ] `activeGroupId?: string | null` prop added to `OverlayCanvasProps`
- [ ] `activeDetailGroupId` threaded from renderer to overlay canvas
- [ ] Canvas draws lightblue border + fill for selections in the active sidebar group
- [ ] Canvas draws glow effect (`shadowColor` + `shadowBlur: 12`) for active group selections
- [ ] Glow appears when group detail view is open, disappears on back navigation
- [ ] Selections outside the active group retain their status color while glow is active
- [ ] `decree lint` passes

### Deferred

- [ ] Animate color transitions when JIRA status changes (smooth lerp between colors)
- [ ] Click status icon to open JIRA ticket in new tab
