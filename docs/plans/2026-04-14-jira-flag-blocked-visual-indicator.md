# JIRA Flag/Blocked Visual Indicator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show red visual indicators (border on selection labels, red overlay on canvas) when a JIRA ticket is flagged/blocked.

**Architecture:** Extend the existing JIRA status polling chain to include the `flagged` boolean. The sync-server adds an `AgileClient` call to fetch `fields.flagged`. The flag state propagates through `JiraTicketStatus` → `SelectionGroupWithJira` → `SelectionLabelInstance` → canvas renderer and selection label component. Visual override precedence: active-group glow > flagged red > ATT status color > default pink.

**Tech Stack:** TypeScript, Solid.js, jira.js (`AgileClient`), Canvas 2D, Tailwind v4, Zod, Hono (sync-server)

**Decree:**
- [PRD-007](../../decree/prd/007-jira-flag-blocked-visual-indicator.md) — Requirements (R1-R17)
- [ADR-0009](../../decree/adr/0009-flag-data-source-and-blocked-visual-strategy.md) — Agile API + red border strategy
- [SPEC-012](../../decree/spec/012-jira-flag-blocked-visual-indicator.md) — Technical design (37 acceptance criteria)
- [PRD-008](../../decree/prd/008-jira-flag-toggle-write-back.md) — Future: flag toggle write-back

**HTML POCs** (open in browser to preview):
- [Selection Label — red border](poc/flag-selection-label.html)
- [Canvas Overlay — red override + precedence](poc/flag-canvas-overlay.html)
- [Status Legend — flagged entry](poc/flag-status-legend.html)

**Business Rule:** [`resolveDisplayColor()`](../../packages/react-grab/src/features/sidebar/resolve-display-color.ts) — single source of truth for color override

---

## Task 1: Add `flagged` to sync-server JIRA schema

**Files:**
- Modify: `packages/sync-server/src/schemas/jira.ts:48-58`

**Step 1: Add `flagged` field to `JiraTicketStatus` schema**

In `packages/sync-server/src/schemas/jira.ts`, add `flagged` to the `JiraTicketStatus` Zod schema:

```typescript
// After line 58 (inside JiraTicketStatus schema), add:
flagged: z.boolean().optional().default(false),
```

The full `JiraTicketStatus` schema should become:

```typescript
export const JiraTicketStatus = z.object({
  status: z.string(),
  statusCategory: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  assigneeAvatar: z.string().nullable(),
  reporterAvatar: z.string().nullable(),
  jiraUrl: z.string(),
  labels: z.array(z.string()),
  comments: z.array(JiraComment),
  flagged: z.boolean().optional().default(false),  // NEW
});
```

**Step 2: Verify typecheck**

Run: `pnpm --filter sync-server typecheck`
Expected: PASS (new optional field doesn't break existing code)

**Step 3: Commit**

```bash
git add packages/sync-server/src/schemas/jira.ts
git commit -m "feat(sync-server): add flagged field to JiraTicketStatus schema"
```

---

## Task 2: Fetch `flagged` from JIRA Agile API in sync-server

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts:1,46-52,331-362`

**Step 1: Import and instantiate `AgileClient`**

At the top of `jira.service.ts` (line 1), change the import:

```typescript
import { Version3Client, AgileClient } from "jira.js";
```

In the class, add a private `agileClient` field alongside `client` (around line 46):

```typescript
private client: Version3Client;
private agileClient: AgileClient;
```

In the constructor (around line 52), instantiate it with the same config:

```typescript
this.agileClient = new AgileClient({
  host: config.baseUrl,
  authentication: {
    basic: { email: config.email, apiToken: config.apiToken },
  },
});
```

**Step 2: Fetch `flagged` in `getIssueStatus` method**

In `getIssueStatus` (line 331), after the existing `this.client.issues.getIssue()` call and before the return statement, add a flagged fetch:

```typescript
// After line 335 (the getIssue call), add:
let flagged = false;
try {
  const agileIssue = await this.agileClient.board.getIssue({
    issueIdOrKey: ticketId,
    fields: ["flagged"],
  });
  flagged = (agileIssue as any).fields?.flagged === true;
} catch {
  // Agile API may not be available — default to not flagged
}
```

**Note:** The `jira.js` AgileClient may not have a typed `getIssue` method on board. Check the available methods. If not available, use a raw fetch:

```typescript
let flagged = false;
try {
  const response = await fetch(
    `${this.config.baseUrl}/rest/agile/1.0/issue/${ticketId}?fields=flagged`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString("base64")}`,
        Accept: "application/json",
      },
    },
  );
  if (response.ok) {
    const data = await response.json();
    flagged = data.fields?.flagged === true;
  }
} catch {
  // Silent — default to not flagged
}
```

**Step 3: Include `flagged` in the return object**

In the return statement (line 353), add `flagged`:

```typescript
return {
  status: issue.fields.status?.name ?? "Unknown",
  statusCategory: issue.fields.status?.statusCategory?.name ?? "Unknown",
  // ... existing fields ...
  comments,
  flagged,  // NEW
};
```

**Step 4: Verify typecheck**

Run: `pnpm --filter sync-server typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts
git commit -m "feat(sync-server): fetch JIRA flagged status via Agile API"
```

---

## Task 3: Regenerate Orval types for react-grab

**Files:**
- Modify: `packages/react-grab/src/generated/` (auto-generated)

**Step 1: Regenerate types**

The sync-server uses OpenAPI + Orval to generate typed client functions. After changing the schema, regenerate:

Run: `pnpm codegen`
Expected: `packages/react-grab/src/generated/sync-api.ts` should now include `flagged?: boolean` in `GetJiraTicketStatus200`

**Step 2: Verify the generated type includes `flagged`**

Run: `grep -n "flagged" packages/react-grab/src/generated/sync-api.ts`
Expected: A line showing `flagged?: boolean` in the response type

**Step 3: Commit**

```bash
git add packages/react-grab/src/generated/
git commit -m "chore: regenerate orval types with flagged field"
```

---

## Task 4: Add `jiraFlagged` to frontend data model types

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/jira-types.ts:10-36`
- Modify: `packages/react-grab/src/types.ts:453-494`

**Step 1: Add `jiraFlagged` to `SelectionGroupWithJira`**

In `packages/react-grab/src/features/sidebar/jira-types.ts`, add after `jiraComments` (line 35):

```typescript
jiraFlagged?: boolean;
```

**Step 2: Add `jiraFlagged` to `SelectionLabelInstance`**

In `packages/react-grab/src/types.ts`, add after `jiraComments` (line 493):

```typescript
jiraFlagged?: boolean;
```

**Step 3: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS (new optional fields)

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts packages/react-grab/src/types.ts
git commit -m "feat: add jiraFlagged to SelectionGroupWithJira and SelectionLabelInstance types"
```

---

## Task 5: Propagate `flagged` through the JIRA status poller

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx:3950-3974`

**Step 1: Add `jiraFlagged` to the status update mapper**

In `packages/react-grab/src/core/index.tsx`, inside the `onStatusUpdate` callback (around line 3960), add `jiraFlagged` to the spread object:

```typescript
onStatusUpdate: (groupId, status) => {
  const resolved = status.statusCategory.toLowerCase() === "done";
  const updated = selectionGroups.groups().map((g) =>
    g.id === groupId
      ? {
          ...g,
          jiraStatus: status.status,
          jiraStatusCategory: status.statusCategory,
          jiraAssignee: status.assignee,
          jiraReporter: status.reporter,
          jiraAssigneeAvatar: status.assigneeAvatar,
          jiraReporterAvatar: status.reporterAvatar,
          jiraLabels: status.labels,
          jiraComments: status.comments,
          jiraResolved: resolved,
          jiraUrl: status.jiraUrl,
          jiraFlagged: status.flagged ?? false,  // NEW
        }
      : g,
  );
  selectionGroups.persistGroups(updated);
},
```

**Step 2: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat: propagate jiraFlagged from poller to selection groups"
```

---

## Task 6: Propagate `jiraFlagged` to `SelectionLabelInstance`

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx:3906-3923`

**Step 1: Add `jiraFlagged` to the label instance enrichment memo**

In `packages/react-grab/src/core/index.tsx`, inside the `createMemo` that enriches label instances (around line 3913-3922), add:

```typescript
return {
  ...withLiveGroup,
  groupStatus: group?.jiraStatus,
  jiraTicketId: group?.jiraTicketId,
  jiraUrl: group?.jiraUrl,
  jiraStatusCategory: group?.jiraStatusCategory,
  jiraAssignee: group?.jiraAssignee,
  jiraReporter: group?.jiraReporter,
  jiraAssigneeAvatar: group?.jiraAssigneeAvatar,
  jiraReporterAvatar: group?.jiraReporterAvatar,
  jiraLabels: group?.jiraLabels,
  jiraComments: group?.jiraComments,
  jiraFlagged: group?.jiraFlagged,  // NEW
};
```

**Step 2: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat: propagate jiraFlagged to SelectionLabelInstance"
```

---

## Task 7: Business rule layer — `resolveDisplayColor` (Screaming Architecture)

**Files:**
- Verify: `packages/react-grab/src/features/sidebar/resolve-display-color.ts` (already created)

**Step 1: Verify the module exists and exports correctly**

The file was created during planning. Verify it:

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 2: Write unit test for the business rule**

Create test file `packages/react-grab/src/features/sidebar/resolve-display-color.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { FLAGGED_COLOR, resolveDisplayColor } from "./resolve-display-color.js";

describe("resolveDisplayColor — business rule: flagged overrides status", () => {
  it("returns FLAGGED_COLOR when jiraFlagged is true, regardless of status", () => {
    expect(resolveDisplayColor("In Progress", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Code Review", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Won't Do", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor("Done", true)).toBe(FLAGGED_COLOR);
    expect(resolveDisplayColor(undefined, true)).toBe(FLAGGED_COLOR);
  });

  it("falls through to getStatusColor when not flagged", () => {
    const result = resolveDisplayColor("In Progress", false);
    expect(result.hex).toBe("#3b82f6"); // blue
  });

  it("falls through to getStatusColor when flagged is undefined", () => {
    const result = resolveDisplayColor("In Progress", undefined);
    expect(result.hex).toBe("#3b82f6"); // blue
  });

  it("returns NO_TASK_COLOR when status is undefined and not flagged", () => {
    const result = resolveDisplayColor(undefined, false);
    expect(result.hex).toBe("#b21c8e"); // grab-pink
  });
});
```

**Step 3: Run the test**

Run: `pnpm --filter react-grab test -- resolve-display-color`
Expected: PASS — all 4 tests green

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/resolve-display-color.ts packages/react-grab/src/features/sidebar/resolve-display-color.test.ts
git commit -m "feat: add resolveDisplayColor business rule — flagged overrides status (ADR-0009)"
```

---

## Task 8: Canvas overlay — use `resolveDisplayColor`

**Files:**
- Modify: `packages/react-grab/src/components/overlay-canvas.tsx:695-703`

**Step 1: Import `resolveDisplayColor`**

At the top of `overlay-canvas.tsx`, add:

```typescript
import { resolveDisplayColor } from "../features/sidebar/resolve-display-color.js";
```

**Step 2: Replace `getStatusColor` calls with `resolveDisplayColor` in the color logic**

Replace lines 695-703 (the border/fill/shadow determination):

**Before:**
```typescript
const instanceBorderColor = isActiveGroup
  ? ACTIVE_GROUP_BORDER_COLOR
  : getStatusColor(instance.groupStatus).hex;
const instanceFillColor = isActiveGroup
  ? ACTIVE_GROUP_FILL_COLOR
  : hexToRgba(getStatusColor(instance.groupStatus).hex, STATUS_OVERLAY_FILL_ALPHA);
const instanceShadowPasses = isActiveGroup
  ? ACTIVE_GROUP_SHADOW_PASSES
  : undefined;
```

**After:**
```typescript
const resolvedColor = resolveDisplayColor(instance.groupStatus, instance.jiraFlagged);
const instanceBorderColor = isActiveGroup
  ? ACTIVE_GROUP_BORDER_COLOR
  : resolvedColor.hex;
const instanceFillColor = isActiveGroup
  ? ACTIVE_GROUP_FILL_COLOR
  : hexToRgba(resolvedColor.hex, STATUS_OVERLAY_FILL_ALPHA);
const instanceShadowPasses = isActiveGroup
  ? ACTIVE_GROUP_SHADOW_PASSES
  : undefined;
```

Note: The business rule (flagged > status) is in `resolveDisplayColor` — the canvas code just calls it. Active-group remains the highest-priority override handled at the call site.

**Step 3: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/overlay-canvas.tsx
git commit -m "feat: canvas overlay uses resolveDisplayColor for flag-aware coloring"
```

---

## Task 9: Selection label — red border when flagged

**Files:**
- Modify: `packages/react-grab/src/components/selection-label/index.tsx:502-513`

**Step 1: Import `resolveDisplayColor`**

```typescript
import { resolveDisplayColor } from "../../features/sidebar/resolve-display-color.js";
```

**Step 2: Add red border to the inner panel when flagged**

Modify the inner panel `<div>` (line 502-513).

**Before:**
```tsx
<div
  ref={panelRef}
  class={cn(
    'relative contain-layout flex items-center gap-[5px] rounded-[10px] antialiased w-fit h-fit p-0 [font-synthesis:none] [corner-shape:superellipse(1.25)]',
    'bg-popover',
    isShaking() && 'animate-shake'
  )}
```

**After:**
```tsx
<div
  ref={panelRef}
  class={cn(
    'relative contain-layout flex items-center gap-[5px] rounded-[10px] antialiased w-fit h-fit p-0 [font-synthesis:none] [corner-shape:superellipse(1.25)]',
    'bg-popover',
    props.instance.jiraFlagged && 'border-2 border-[#dc2626]',
    isShaking() && 'animate-shake'
  )}
```

Note: The border color `#dc2626` matches `FLAGGED_COLOR.hex` from the business rule layer. The `cn()` utility handles class merging correctly.

**Step 3: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/selection-label/index.tsx
git commit -m "feat: selection label shows red border for flagged JIRA issues"
```

---

## Task 10: Sidebar cards — flag indicator on selection-card and loose-selection-card

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/selection-card.tsx:12-20,54-58`
- Modify: `packages/react-grab/src/components/sidebar/loose-selection-card.tsx:10-28,52`
- Modify: `packages/react-grab/src/components/sidebar/loose-selection-list.tsx:53-65`
- Modify: `packages/react-grab/src/components/sidebar/selection-list.tsx:36-42`

**Step 1: Add `jiraFlagged` prop to `SelectionCard`**

In `selection-card.tsx`, add to `SelectionCardProps`:

```typescript
export interface SelectionCardProps {
  item: CommentItem;
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
  onRemoveItem?: () => void;
  jiraFlagged?: boolean;  // NEW
}
```

**Step 2: Add red left-border to `SelectionCard` when flagged**

Change line 56:

**Before:**
```tsx
class="bg-muted rounded-lg p-3 mb-1.5 border border-border"
```

**After:**
```tsx
class={cn(
  "bg-muted rounded-lg p-3 mb-1.5 border border-border",
  props.jiraFlagged && "border-l-[3px] border-l-[#dc2626]"
)}
```

Import `cn` from the utils if not already imported.

**Step 3: Add `jiraFlagged` prop to `LooseSelectionCard`**

In `loose-selection-card.tsx`, add to `LooseSelectionCardProps`:

```typescript
jiraFlagged?: boolean;  // NEW
```

**Step 4: Add red left-border to `LooseSelectionCard` inner container when flagged**

Change line 52:

**Before:**
```tsx
<div class="relative bg-muted rounded-lg border border-border p-3 cursor-default">
```

**After:**
```tsx
<div class={cn(
  "relative bg-muted rounded-lg border border-border p-3 cursor-default",
  props.jiraFlagged && "border-l-[3px] border-l-[#dc2626]"
)}>
```

Also pass `jiraFlagged` down to the inner `<SelectionCard>` (line 106):

```tsx
<SelectionCard
  item={props.item}
  syncServerUrl={props.syncServerUrl}
  syncWorkspace={props.syncWorkspace}
  scrollRoot={props.scrollRoot}
  jiraFlagged={props.jiraFlagged}  // NEW
/>
```

**Step 5: Wire `jiraFlagged` from parent components**

In `loose-selection-list.tsx`, pass `jiraFlagged` to `LooseSelectionCard` (line 53-65):

```tsx
<LooseSelectionCard
  item={item}
  statusLabel={group() ? getStatusLabel(group()!) : "No Task"}
  statusColor={resolveDisplayColor(group()?.jiraStatus, group()?.jiraFlagged)}
  jiraTicketId={group()?.jiraTicketId}
  jiraUrl={group()?.jiraUrl}
  jiraFlagged={group()?.jiraFlagged}  // NEW
  onCreateTicket={props.onCreateTicket}
  ...
```

Note: also change `getStatusColor(group()?.jiraStatus)` to `resolveDisplayColor(group()?.jiraStatus, group()?.jiraFlagged)` — this makes the status pill flag-aware.

In `selection-list.tsx`, the parent needs to pass `jiraFlagged` — check if the group context is available. If the parent (`GroupDetailView`) has the group, pass `jiraFlagged` through.

**Step 6: Verify typecheck**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/react-grab/src/components/sidebar/selection-card.tsx packages/react-grab/src/components/sidebar/loose-selection-card.tsx packages/react-grab/src/components/sidebar/loose-selection-list.tsx packages/react-grab/src/components/sidebar/selection-list.tsx
git commit -m "feat: flag indicator on selection-card and loose-selection-card"
```

---

## Task 11: Status Legend — add Flagged entry

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/status-legend.tsx`

**Step 1: Import `FLAGGED_COLOR`**

```typescript
import { FLAGGED_COLOR } from "../../features/sidebar/resolve-display-color.js";
```

**Step 2: Add Flagged row at top of legend, before workflow statuses**

After the header `<div>` and before the `<For each={FLOW}>`, add:

```tsx
{/* Flagged — cross-cutting override, shown above workflow statuses */}
<div class="flex items-start gap-2.5 bg-[rgba(220,38,38,0.06)] rounded-md p-1.5 -mx-1.5 border-l-[3px] border-l-[#dc2626]">
  <div
    class="w-3 h-3 rounded-sm mt-0.5 shrink-0"
    style={{ background: FLAGGED_COLOR.hex }}
  />
  <div>
    <div class="text-[11px] font-medium text-foreground">Flagged / Blocked</div>
    <div class="text-[10px] text-muted-foreground">
      Ticket has an impediment — overrides status color on canvas and label border
    </div>
  </div>
</div>
<div class="relative border-t border-border my-2">
  <span class="absolute -top-[8px] left-1/2 -translate-x-1/2 bg-card/95 px-2 text-[9px] font-bold text-[#dc2626] tracking-wider">
    OVERRIDES
  </span>
</div>
```

**Step 3: Verify typecheck + visual**

Run: `pnpm --filter react-grab typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/status-legend.tsx
git commit -m "feat: status legend shows Flagged entry above workflow statuses"
```

---

## Task 12: Build verification and final typecheck

**Files:** None (verification only)

**Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS across all packages

**Step 2: Lint**

Run: `pnpm lint`
Expected: PASS

**Step 3: Build**

Run: `pnpm build`
Expected: PASS

**Step 4: Run existing tests + new test**

Run: `pnpm test`
Expected: All existing tests + `resolve-display-color.test.ts` pass

**Step 5: Update SPEC-012 acceptance criteria**

Check off all completed items in `decree/spec/012-jira-flag-blocked-visual-indicator.md`:
- [x] All Data Model items
- [x] All Data Fetching items
- [x] All Selection Label Visual items
- [x] All Canvas Overlay Visual items
- [x] All Override Precedence items
- [x] All Business Rule Layer items
- [x] All Status Legend items
- [x] All Sidebar Cards items
- [x] All Constants and Config items
- [x] All HTML POC items

**Step 6: Decree progress check**

Run: `decree progress`
Expected: SPEC-012 shows 100% (37/37)

**Step 7: Final commit**

```bash
git add decree/spec/012-jira-flag-blocked-visual-indicator.md
git commit -m "docs: mark SPEC-012 acceptance criteria complete"
```
