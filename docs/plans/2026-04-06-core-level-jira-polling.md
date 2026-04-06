# Core-Level JIRA Status Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move JIRA status polling from sidebar to core/index.tsx so canvas selection boxes show correct status colors without opening the sidebar.

**Architecture:** The `createJiraStatusPoller` primitive moves from sidebar to core. It stores `jiraStatus`/`jiraAssignee`/`jiraReporter` directly on the core groups signal via `selectionGroups.persistGroups()`. The overlay canvas already reads `group?.jiraStatus` via `computedLabelInstancesWithStatus` — once core groups have the data, canvas colors work automatically.

**Tech Stack:** SolidJS (signals, onMount), `createJiraStatusPoller` primitive, `selectionGroups` API

**Spec:** `decree/spec/006-att-status-visualization-and-filtering.md` §3b

---

## Task 1: Move Poller from Sidebar to Core

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx` — add poller after `createSelectionVisibility`
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` — remove poller call + unused imports

### Step 1: Add poller to core/index.tsx

After the `createSelectionVisibility(...)` block (around line 3840), add the poller. The `syncState` module-level variable provides the workspace.

Import at top of file:

```typescript
import { createJiraStatusPoller } from "../features/sidebar/jira-status-poller.js";
import type { SelectionGroupWithJira } from "../features/sidebar/jira-types.js";
```

Note: `SelectionGroupWithJira` may already be imported — check before adding.

After `createSelectionVisibility`:

```typescript
// Poll JIRA status for all ticketed groups on init.
// Stores jiraStatus on core groups signal so canvas overlays
// and selection labels show correct status colors without opening the sidebar.
createJiraStatusPoller({
  groups: selectionGroups.groups as () => SelectionGroupWithJira[],
  syncWorkspace: () => syncState?.workspace,
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
            jiraResolved: resolved,
          }
        : g,
    );
    selectionGroups.persistGroups(updated);
  },
});
```

### Step 2: Remove poller from sidebar/index.tsx

Remove the `createJiraStatusPoller` call (around line 193-197):

```typescript
// DELETE THIS BLOCK:
createJiraStatusPoller({
  groups,
  syncWorkspace: () => props.syncWorkspace,
  onStatusUpdate: handleStatusUpdate,
});
```

Remove unused imports:
- `createJiraStatusPoller` from `../../features/sidebar/jira-status-poller.js`
- `GetJiraTicketStatus200` from `../../generated/sync-api.js` — check if still used by `handleStatusUpdate` first

### Step 3: Simplify sidebar's handleStatusUpdate

The sidebar's `handleStatusUpdate` is still needed for the `handleTicketCreated` flow (when a user creates a new ticket, the status is set immediately). But now the poll results come via `props.groups` from core — the merge effect (line 66) already syncs them to the local signal.

Check: is `handleStatusUpdate` still called from anywhere in the sidebar? If only from the poller (which we removed), it can be simplified. If `handleTicketCreated` also uses it, keep it but note it's now only for ticket creation, not polling.

### Step 4: Verify build

```bash
pnpm --filter react-grab build
```

### Step 5: Commit

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat: move JIRA status polling from sidebar to core for canvas colors"
```

---

## Task 2: Verify Canvas Colors Work

### Step 1: Trace the data flow

Confirm the chain works by reading the code:

1. `createJiraStatusPoller` calls `onStatusUpdate` → `selectionGroups.persistGroups(updated)` → core groups signal updated with `jiraStatus`
2. `computedLabelInstancesWithStatus` (core/index.tsx ~3806) reads `group?.jiraStatus` → sets `instance.groupStatus`
3. `overlay-canvas.tsx` reads `instance.groupStatus` → `getStatusColor(instance.groupStatus).hex` → correct color
4. `selection-label/index.tsx` reads `props.groupStatus` → `getStatusColor(props.groupStatus).hex` → correct badge color

### Step 2: Fix the merge effect — don't clobber core's jiraStatus

The sidebar's merge effect (line 66) does `...pg` (parent group) then overrides with local jira fields. Since core now HAS `jiraStatus` on the parent group, `...pg` will include it. The local override `jiraStatus: local.jiraStatus` would overwrite with the local value. On first render, `local.jiraStatus` is `undefined` (sidebar just initialized).

**This is a bug.** The merge effect preserves LOCAL jira fields over parent. But now the parent (core) is the source of truth for jira status. The merge effect should NOT override parent jira fields with stale local values.

**Fix:** Simplify the merge effect to just mirror core groups:

```typescript
createEffect(() => {
  setGroups(props.groups as SelectionGroupWithJira[]);
});
```

**Reviewed edge case (accepted):** `handleTicketCreated` sets `jiraTicketId` and `jiraUrl` on the local signal as an optimistic update before core polls. With the simplified merge, the next `props.groups` sync (triggered by any core signal change) would overwrite the optimistic values with core's version — which won't have `jiraTicketId` until the next 30s poll. This creates a ≤30 second window where the sidebar briefly loses the optimistic ticket state.

**Decision: acceptable.** The user just created the ticket and saw it immediately. Core confirms on the next poll cycle. The 30-second gap is invisible in practice — the user has already moved on. The alternative (selective field merging) adds complexity for a negligible UX gain.

### Step 3: Commit if fix needed

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "fix: don't clobber core jiraStatus in sidebar merge effect"
```

---

## Task 3: Clean Up Sidebar handleStatusUpdate

### Step 1: Check remaining callers

```bash
grep -n "handleStatusUpdate" packages/react-grab/src/components/sidebar/index.tsx
```

If only called from the now-removed poller, remove the function entirely. If called from `handleTicketCreated` or elsewhere, keep it but simplify — it now only needs to handle the ticket-creation case where core hasn't polled yet.

### Step 2: Remove GetJiraTicketStatus200 import if unused

Check if the type is still used after removing the poller. If not, remove the import.

### Step 3: Commit

```bash
git add packages/react-grab/src/components/sidebar/index.tsx
git commit -m "chore: clean up sidebar after polling moved to core"
```

---

## Task 4: Final Build + Verify

### Step 1: Full build

```bash
pnpm --filter react-grab build
```

### Step 2: Manual verification checklist

1. **Canvas colors without sidebar:** Load page with ticketed groups → selection boxes on page should show JIRA status colors (blue for In Progress, purple for Code Review, etc.) — NOT pink "No Task" color
2. **Sidebar shows correct status:** Open sidebar → ticketed groups show actual JIRA status immediately
3. **No API loop:** Check sync-server logs — should see one burst of GET /jira/status calls on page load, then every 30 seconds
4. **Ticket creation still works:** Create a new JIRA ticket via sidebar → status updates correctly
