# Sidebar Shell & Groups List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 1 of the embedded dashboard sidebar — a Solid.js sidebar shell with groups list, mounted inside react-grab's Shadow DOM, per SPEC-001.

**Architecture:** The sidebar mounts inside `ReactGrabRenderer` as a sibling to existing components. It subscribes to the existing `commentItems()` and `groups()` Solid signals (same ones the comments dropdown uses). No new data layer — just UI components + a `deriveStatus` utility. Zod schemas harden the adapter boundary first.

**Tech Stack:** Solid.js, Tailwind CSS (Shadow DOM scoped), Zod, Playwright (e2e tests)

**Reference Docs:**
- `decree/spec/001-sidebar-shell-and-groups-list.md` — approved SPEC with acceptance criteria
- `decree/adr/0002-solid-js-sidebar-with-orval-generated-types.md` — technology decisions
- `docs/assumptions.md` — tracked assumptions (A-001 through A-019)

---

## Task 0: Pre-implementation Cleanup — Zod Adapter Validation

**Files:**
- Create: `packages/react-grab/src/features/sync/schemas.ts`
- Modify: `packages/react-grab/src/features/sync/adapter.ts`
- Modify: `packages/react-grab/src/features/selection-groups/types.ts`

**Step 1: Create Zod schemas**

Create `packages/react-grab/src/features/sync/schemas.ts`:

```typescript
import { z } from "zod";

export const CommentItemSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  content: z.string(),
  elementName: z.string(),
  tagName: z.string(),
  componentName: z.string().optional(),
  elementsCount: z.number().optional(),
  elementSelectors: z.array(z.string()).optional(),
  commentText: z.string().optional(),
  timestamp: z.number(),
  status: z.enum(["open", "ticketed", "resolved"]).optional(),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  screenshotFullPage: z.string().optional(),
  screenshotElement: z.string().optional(),
  jiraTicketId: z.string().optional(),
  capturedBy: z.string().optional(),
});

export const SelectionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  jiraTicketId: z.string().optional(),
});

export const UploadResultSchema = z.object({
  key: z.string(),
});
```

**Step 2: Replace `as` casts in adapter.ts**

In `packages/react-grab/src/features/sync/adapter.ts`, add import and replace the 5 casts:

```typescript
import { z } from "zod";
import { CommentItemSchema, SelectionGroupSchema, UploadResultSchema } from "./schemas";
```

Replace each cast:

```typescript
// Line ~29: loadComments (with revealed state)
// Before: return (await response.json()) as CommentItem[];
// After:
const raw = await response.json();
return z.array(CommentItemSchema).parse(raw) as CommentItem[];

// Line ~31: loadComments (without revealed state)
// Before: const serverItems = (await response.json()) as Omit<CommentItem, "revealed">[];
// After:
const raw = await response.json();
const serverItems = z.array(CommentItemSchema).parse(raw);

// Line ~67: loadGroups (with revealed state)
// Before: return (await response.json()) as SelectionGroup[];
// After:
const raw = await response.json();
return z.array(SelectionGroupSchema).parse(raw) as SelectionGroup[];

// Line ~69: loadGroups (without revealed state)
// Before: const serverGroups = (await response.json()) as Omit<SelectionGroup, "revealed">[];
// After:
const raw = await response.json();
const serverGroups = z.array(SelectionGroupSchema).parse(raw);

// Line ~115: uploadScreenshot
// Before: const result = (await response.json()) as { key: string };
// After:
const raw = await response.json();
const result = UploadResultSchema.parse(raw);
```

**Step 3: Document the empty SelectionGroup extension**

In `packages/react-grab/src/features/selection-groups/types.ts`, add a comment:

```typescript
/**
 * Application-level group type. Extends the server type with UI-only fields.
 * Currently empty — placeholder for future fields like local UI state.
 * Do not add server-persisted fields here; update the OpenAPI spec instead.
 */
export interface SelectionGroup extends ServerSelectionGroup {}
```

**Step 4: Verify Zod is available**

Run: `cd packages/react-grab && cat package.json | grep zod`

If zod is not a dependency: `pnpm add zod`

**Step 5: Build and type-check**

Run: `cd packages/react-grab && pnpm build`

Expected: Build succeeds with zero errors.

**Step 6: Commit**

```bash
git add packages/react-grab/src/features/sync/schemas.ts packages/react-grab/src/features/sync/adapter.ts packages/react-grab/src/features/selection-groups/types.ts
git commit -m "refactor: add Zod validation at adapter boundary, document SelectionGroup extension"
```

---

## Task 1: Z-Index Constant + deriveStatus Utility

**Files:**
- Modify: `packages/react-grab/src/constants.ts`
- Create: `packages/react-grab/src/features/sidebar/derive-status.ts`
- Create: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Add Z_INDEX_SIDEBAR to constants.ts**

In `packages/react-grab/src/constants.ts`, after the existing z-index constants (around line 42):

```typescript
export const Z_INDEX_SIDEBAR = 2147483646;
```

**Step 2: Create deriveStatus utility**

Create `packages/react-grab/src/features/sidebar/derive-status.ts`:

```typescript
import type { SelectionGroup } from "../selection-groups/types";
import type { CommentItem } from "../../types";

export type GroupStatus = "open" | "ticketed" | "resolved";

export interface GroupedEntry {
  group: SelectionGroup;
  items: CommentItem[];
}

/**
 * Phase 1: derives status from jiraTicketId only.
 * Phase 3 will add a jiraStatusMap parameter for resolved detection.
 */
export function deriveStatus(entry: GroupedEntry): GroupStatus {
  if (!entry.group.jiraTicketId) return "open";
  // Phase 3: check jiraStatusMap.get(group.jiraTicketId) === 'done' → 'resolved'
  return "ticketed";
}
```

**Step 3: Create feature index**

Create `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export { deriveStatus, type GroupStatus, type GroupedEntry } from "./derive-status";
```

**Step 4: Type-check**

Run: `cd packages/react-grab && pnpm build`

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/react-grab/src/constants.ts packages/react-grab/src/features/sidebar/
git commit -m "feat(sidebar): add Z_INDEX_SIDEBAR constant and deriveStatus utility"
```

---

## Task 2: Dashboard Icon + Toolbar Button

**Files:**
- Create: `packages/react-grab/src/components/icons/dashboard-icon.tsx`
- Modify: `packages/react-grab/src/components/toolbar/toolbar-content.tsx`

**Step 1: Create dashboard icon**

Create `packages/react-grab/src/components/icons/dashboard-icon.tsx`:

```tsx
import type { Component } from "solid-js";

interface DashboardIconProps {
  size?: number;
  class?: string;
}

export const DashboardIcon: Component<DashboardIconProps> = (props) => {
  const size = () => props.size ?? 14;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
};
```

**Step 2: Add dashboard button to toolbar**

In `packages/react-grab/src/components/toolbar/toolbar-content.tsx`:

Add to the props interface:

```typescript
// Add to ToolbarContentProps:
sidebarOpen?: boolean;
onToggleSidebar?: () => void;
groupCount?: number;
```

Add the dashboard button. Import the icon at the top:

```typescript
import { DashboardIcon } from "../icons/dashboard-icon";
```

Add a new `<div class="grid">` block after the Visibility button's grid wrapper (after the last `</div>` inside the expandable buttons `<div ref={...}>`) but still inside that expandable buttons container:

```tsx
<div
  class={cn(
    "grid",
    gridTransitionClass(),
    expandGridClass(Boolean(props.enabled)),
  )}
>
  <div class={cn("relative overflow-visible", minDimensionClass())}>
    <button
      data-react-grab-ignore-events
      data-react-grab-toolbar-dashboard
      aria-label={props.sidebarOpen ? "Close dashboard" : "Open dashboard"}
      aria-pressed={props.sidebarOpen}
      class={cn(
        "contain-layout flex items-center justify-center cursor-pointer interactive-scale touch-hitbox",
        buttonSpacingClass(),
        hitboxConstraintClass(),
        props.sidebarOpen && "text-[var(--color-grab-pink)]",
      )}
      onClick={() => props.onToggleSidebar?.()}
    >
      <DashboardIcon
        size={14}
        class={cn(
          "transition-colors",
          props.sidebarOpen ? "text-black" : "text-[#B3B3B3]",
        )}
      />
    </button>
  </div>
</div>
```

**Step 3: Build and verify**

Run: `cd packages/react-grab && pnpm build`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/icons/dashboard-icon.tsx packages/react-grab/src/components/toolbar/toolbar-content.tsx
git commit -m "feat(sidebar): add dashboard icon and toolbar button"
```

---

## Task 3: Sidebar Shell Component

**Files:**
- Create: `packages/react-grab/src/components/sidebar/index.tsx`
- Create: `packages/react-grab/src/components/sidebar/sidebar-header.tsx`
- Create: `packages/react-grab/src/components/sidebar/empty-state.tsx`

**Step 1: Create SidebarHeader**

Create `packages/react-grab/src/components/sidebar/sidebar-header.tsx`:

```tsx
import type { Component } from "solid-js";
import type { SyncStatus } from "../../features/sync/types";
import { cn } from "../../utils/cn";

interface SidebarHeaderProps {
  syncStatus: SyncStatus;
  onClose: () => void;
}

export const SidebarHeader: Component<SidebarHeaderProps> = (props) => {
  return (
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <h2 class="flex items-center gap-2 text-sm font-semibold text-white">
        <span
          class={cn(
            "w-2 h-2 rounded-full",
            props.syncStatus === "synced" ? "bg-green-500" : "bg-red-500",
          )}
        />
        react-grab
      </h2>
      <button
        class="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded cursor-pointer"
        onClick={props.onClose}
        aria-label="Close sidebar"
      >
        &times;
      </button>
    </div>
  );
};
```

**Step 2: Create EmptyState**

Create `packages/react-grab/src/components/sidebar/empty-state.tsx`:

```tsx
import type { Component } from "solid-js";

interface EmptyStateProps {
  message: string;
  submessage?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
  return (
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
      <p class="text-sm text-white/60">{props.message}</p>
      {props.submessage && (
        <p class="text-xs text-white/40 mt-1">{props.submessage}</p>
      )}
      {props.action && (
        <button
          class="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-md cursor-pointer"
          onClick={props.action.onClick}
        >
          {props.action.label}
        </button>
      )}
    </div>
  );
};
```

**Step 3: Create Sidebar container**

Create `packages/react-grab/src/components/sidebar/index.tsx`:

```tsx
import { type Component, createSignal, Show } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { CommentItem } from "../../types";
import type { SyncStatus } from "../../features/sync/types";
import { Z_INDEX_SIDEBAR } from "../../constants";
import { SidebarHeader } from "./sidebar-header";
import { EmptyState } from "./empty-state";
import { StatsBar } from "./stats-bar";
import { FilterTabs, type FilterStatus } from "./filter-tabs";
import { GroupList } from "./group-list";
import { groupComments } from "../../features/selection-groups/business/group-operations";
import { deriveStatus } from "../../features/sidebar";

export interface SidebarProps {
  groups: SelectionGroup[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  onClose: () => void;
  onGroupClick: (groupId: string) => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");

  const groupedItems = () => groupComments(props.groups, props.commentItems);

  const filteredGroups = () => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter((entry) => deriveStatus(entry) === filter);
  };

  return (
    <div
      class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-[#1a1a1a] text-[#e5e5e5] animate-slide-in-left"
      style={{ "z-index": String(Z_INDEX_SIDEBAR) }}
      role="dialog"
      aria-modal="false"
      aria-label="React Grab Dashboard"
    >
      <SidebarHeader syncStatus={props.syncStatus} onClose={props.onClose} />

      <Show
        when={props.syncStatus !== "error"}
        fallback={
          <EmptyState
            message="Could not connect to sync server."
            action={{ label: "Retry", onClick: () => { /* Phase 2: retry sync */ } }}
          />
        }
      >
        <StatsBar groupedItems={groupedItems()} />
        <FilterTabs activeFilter={activeFilter()} onFilterChange={setActiveFilter} />

        <Show
          when={props.groups.length > 0}
          fallback={
            <EmptyState
              message="No selections yet."
              submessage="Select elements on the page to get started."
            />
          }
        >
          <Show
            when={filteredGroups().length > 0}
            fallback={
              <EmptyState message={`No ${activeFilter()} groups.`} />
            }
          >
            <GroupList
              groupedItems={filteredGroups()}
              onGroupClick={props.onGroupClick}
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};
```

**Step 4: Build (will fail — StatsBar, FilterTabs, GroupList don't exist yet)**

This is expected. Proceed to Task 4.

**Step 5: Commit (partial — shell components only)**

```bash
git add packages/react-grab/src/components/sidebar/
git commit -m "feat(sidebar): add sidebar shell, header, and empty state components"
```

---

## Task 4: StatsBar, FilterTabs, GroupList, GroupCard

**Files:**
- Create: `packages/react-grab/src/components/sidebar/stats-bar.tsx`
- Create: `packages/react-grab/src/components/sidebar/filter-tabs.tsx`
- Create: `packages/react-grab/src/components/sidebar/group-list.tsx`
- Create: `packages/react-grab/src/components/sidebar/group-card.tsx`
- Create: `packages/react-grab/src/components/sidebar/status-badge.tsx`

**Step 1: Create StatusBadge**

Create `packages/react-grab/src/components/sidebar/status-badge.tsx`:

```tsx
import type { Component } from "solid-js";
import type { GroupStatus } from "../../features/sidebar";
import { cn } from "../../utils/cn";

const statusConfig: Record<GroupStatus, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-500/15", text: "text-blue-400", label: "open" },
  ticketed: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "ticketed" },
  resolved: { bg: "bg-green-500/15", text: "text-green-400", label: "resolved" },
};

export const StatusBadge: Component<{ status: GroupStatus }> = (props) => {
  const config = () => statusConfig[props.status];
  return (
    <span
      class={cn(
        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
        config().bg,
        config().text,
      )}
    >
      {config().label}
    </span>
  );
};
```

**Step 2: Create StatsBar**

Create `packages/react-grab/src/components/sidebar/stats-bar.tsx`:

```tsx
import type { Component } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";

interface StatsBarProps {
  groupedItems: GroupedEntry[];
}

export const StatsBar: Component<StatsBarProps> = (props) => {
  const stats = () => {
    const items = props.groupedItems;
    const totalSelections = items.reduce((sum, e) => sum + e.items.length, 0);
    return {
      groups: items.length,
      selections: totalSelections,
      open: items.filter((e) => deriveStatus(e) === "open").length,
      ticketed: items.filter((e) => deriveStatus(e) === "ticketed").length,
    };
  };

  return (
    <div class="flex border-b border-white/10">
      <StatCell value={stats().groups} label="Groups" />
      <StatCell value={stats().selections} label="Items" />
      <StatCell value={stats().open} label="Open" />
      <StatCell value={stats().ticketed} label="Ticketed" />
    </div>
  );
};

const StatCell: Component<{ value: number; label: string }> = (props) => (
  <div class="flex-1 text-center py-2.5 px-1">
    <div class="text-lg font-bold text-white">{props.value}</div>
    <div class="text-[10px] text-white/40 uppercase tracking-wider">{props.label}</div>
  </div>
);
```

**Step 3: Create FilterTabs**

Create `packages/react-grab/src/components/sidebar/filter-tabs.tsx`:

```tsx
import { type Component, For } from "solid-js";
import { cn } from "../../utils/cn";

export type FilterStatus = "all" | "open" | "ticketed" | "resolved";

const FILTERS: FilterStatus[] = ["all", "open", "ticketed", "resolved"];

interface FilterTabsProps {
  activeFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
}

export const FilterTabs: Component<FilterTabsProps> = (props) => {
  return (
    <div class="flex gap-1.5 px-4 py-2 border-b border-white/10">
      <For each={FILTERS}>
        {(filter) => (
          <button
            class={cn(
              "px-2.5 py-1 rounded-md text-[11px] cursor-pointer transition-colors",
              props.activeFilter === filter
                ? "bg-[var(--color-grab-pink)] text-white"
                : "text-white/40 hover:text-white/70 hover:bg-white/5",
            )}
            onClick={() => props.onFilterChange(filter)}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        )}
      </For>
    </div>
  );
};
```

**Step 4: Create GroupCard**

Create `packages/react-grab/src/components/sidebar/group-card.tsx`:

```tsx
import { type Component, For, Show } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";
import { StatusBadge } from "./status-badge";

interface GroupCardProps {
  entry: GroupedEntry;
  onClick: () => void;
}

const relativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const GroupCard: Component<GroupCardProps> = (props) => {
  const status = () => deriveStatus(props.entry);
  const comments = () => props.entry.items;

  return (
    <div
      class="bg-[#232323] rounded-lg p-3 mb-1.5 cursor-pointer border border-transparent hover:border-white/10 hover:bg-[#2a2a2a] transition-colors"
      onClick={props.onClick}
    >
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-semibold text-[13px] text-white">{props.entry.group.name}</span>
        <StatusBadge status={status()} />
      </div>

      <div class="flex gap-3 text-[11px] text-white/40 mb-2">
        <span>{comments().length} selections</span>
        <span>{relativeTime(props.entry.group.createdAt)}</span>
        <Show when={props.entry.group.jiraTicketId}>
          <a
            href={`#`}
            class="text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {props.entry.group.jiraTicketId}
          </a>
        </Show>
      </div>

      <div class="flex flex-col gap-1">
        <For each={comments().slice(0, 3)}>
          {(comment) => (
            <div class="flex items-center gap-1.5 text-[10px]">
              <span class="px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                {comment.componentName || comment.elementName}
              </span>
              <span class="px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                {comment.tagName}
              </span>
              <Show when={comment.commentText}>
                <span class="text-white/30 italic truncate max-w-[150px]">
                  {comment.commentText}
                </span>
              </Show>
            </div>
          )}
        </For>
        <Show when={comments().length > 3}>
          <span class="text-[10px] text-white/30 px-1.5">
            +{comments().length - 3} more
          </span>
        </Show>
      </div>
    </div>
  );
};
```

**Step 5: Create GroupList**

Create `packages/react-grab/src/components/sidebar/group-list.tsx`:

```tsx
import { type Component, For } from "solid-js";
import type { GroupedEntry } from "../../features/sidebar";
import { GroupCard } from "./group-card";

interface GroupListProps {
  groupedItems: GroupedEntry[];
  onGroupClick: (groupId: string) => void;
}

export const GroupList: Component<GroupListProps> = (props) => {
  return (
    <div class="flex-1 overflow-y-auto p-2">
      <For each={props.groupedItems}>
        {(entry) => (
          <GroupCard
            entry={entry}
            onClick={() => props.onGroupClick(entry.group.id)}
          />
        )}
      </For>
    </div>
  );
};
```

**Step 6: Build**

Run: `cd packages/react-grab && pnpm build`

Expected: Build succeeds.

**Step 7: Commit**

```bash
git add packages/react-grab/src/components/sidebar/
git commit -m "feat(sidebar): add StatsBar, FilterTabs, GroupList, GroupCard, StatusBadge"
```

---

## Task 5: Wire Sidebar into Renderer + Core

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`
- Modify: `packages/react-grab/src/core/index.tsx`

**Step 1: Add sidebar to renderer**

In `packages/react-grab/src/components/renderer.tsx`:

Add imports:

```typescript
import { Sidebar } from "./sidebar";
```

Add `sidebarOpen` signal inside the component:

```typescript
const [sidebarOpen, setSidebarOpen] = createSignal(false);
```

Add a ref for the dashboard button (for focus restoration):

```typescript
let dashboardBtnRef: HTMLButtonElement | undefined;
```

Add the Sidebar component render after the `CommentsDropdown` block:

```tsx
<Show when={sidebarOpen()}>
  <Sidebar
    groups={props.groups ?? []}
    commentItems={props.commentItems ?? []}
    syncStatus={props.syncStatus ?? "local"}
    onClose={() => {
      setSidebarOpen(false);
      dashboardBtnRef?.focus();
    }}
    onGroupClick={(groupId) => {
      /* Phase 2: navigate to detail */
    }}
  />
</Show>
```

Thread the `sidebarOpen`, `setSidebarOpen`, `dashboardBtnRef`, and group count to toolbar via existing props pattern. Add to the `ToolbarContent` usage:

```tsx
sidebarOpen={sidebarOpen()}
onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
groupCount={props.groups?.length ?? 0}
```

**Step 2: Add Escape key handler**

In the renderer, add an effect for Escape dismissal:

```typescript
import { createEffect, onCleanup } from "solid-js";

// Inside the component:
createEffect(() => {
  if (!sidebarOpen()) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSidebarOpen(false);
      dashboardBtnRef?.focus();
    }
  };
  document.addEventListener("keydown", handler);
  onCleanup(() => document.removeEventListener("keydown", handler));
});
```

**Step 3: Thread props from core/index.tsx**

In `packages/react-grab/src/core/index.tsx`, the renderer already receives `groups`, `commentItems`, and `syncStatus` as props (verified in exploration). No changes needed in core/index.tsx — the renderer already has everything it needs.

**Step 4: Build and test manually**

Run: `cd packages/react-grab && pnpm build`

Expected: Build succeeds.

Start the dev server and verify:
Run: `cd packages/react-grab && pnpm dev` (or the monorepo dev command)

Manual checks:
- Dashboard button appears on toolbar
- Clicking it opens the sidebar
- Clicking again closes it
- Escape key closes it
- Host page does not shift

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx packages/react-grab/src/core/index.tsx
git commit -m "feat(sidebar): wire sidebar into renderer with open/close and Escape dismiss"
```

---

## Task 6: E2E Tests

**Files:**
- Create: `packages/react-grab/e2e/sidebar.spec.ts`

**Step 1: Write sidebar e2e tests**

Create `packages/react-grab/e2e/sidebar.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/"); // assumes dev server or e2e-app
  });

  test("dashboard button opens and closes sidebar", async ({ page }) => {
    const dashboardBtn = page.locator("[data-react-grab-toolbar-dashboard]");
    await expect(dashboardBtn).toBeVisible();

    // Open sidebar
    await dashboardBtn.click();
    const sidebar = page.locator("[role='dialog'][aria-label='React Grab Dashboard']");
    await expect(sidebar).toBeVisible();

    // Close sidebar
    await dashboardBtn.click();
    await expect(sidebar).not.toBeVisible();
  });

  test("escape key closes sidebar", async ({ page }) => {
    const dashboardBtn = page.locator("[data-react-grab-toolbar-dashboard]");
    await dashboardBtn.click();

    const sidebar = page.locator("[role='dialog'][aria-label='React Grab Dashboard']");
    await expect(sidebar).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sidebar).not.toBeVisible();
  });

  test("sidebar does not shift host page layout", async ({ page }) => {
    const body = page.locator("body");
    const beforeMargin = await body.evaluate((el) => getComputedStyle(el).marginLeft);

    const dashboardBtn = page.locator("[data-react-grab-toolbar-dashboard]");
    await dashboardBtn.click();

    const afterMargin = await body.evaluate((el) => getComputedStyle(el).marginLeft);
    expect(beforeMargin).toBe(afterMargin);
  });

  test("sidebar shows empty state when no groups", async ({ page }) => {
    const dashboardBtn = page.locator("[data-react-grab-toolbar-dashboard]");
    await dashboardBtn.click();

    const emptyState = page.locator("text=No selections yet");
    await expect(emptyState).toBeVisible();
  });

  test("filter tabs are interactive", async ({ page }) => {
    // This test requires groups to exist — may need setup via react-grab API
    const dashboardBtn = page.locator("[data-react-grab-toolbar-dashboard]");
    await dashboardBtn.click();

    const allTab = page.locator("button:text('All')");
    const openTab = page.locator("button:text('Open')");
    await expect(allTab).toBeVisible();
    await expect(openTab).toBeVisible();

    await openTab.click();
    // Verify the tab is active (has the pink background class)
  });
});
```

**Step 2: Run e2e tests**

Run: `cd packages/react-grab && pnpm test -- --grep sidebar`

Expected: Tests pass (may need to adjust selectors based on Shadow DOM — if tests can't find elements, use `page.locator` with pierce selectors or access the shadow root).

**Step 3: Commit**

```bash
git add packages/react-grab/e2e/sidebar.spec.ts
git commit -m "test(sidebar): add e2e tests for sidebar open/close, escape, layout shift"
```

---

## Task 7: Final Verification Against Acceptance Criteria

**Step 1: Run full build**

Run: `cd packages/react-grab && pnpm build`

**Step 2: Run all e2e tests**

Run: `cd packages/react-grab && pnpm test`

**Step 3: Walk through SPEC-001 acceptance criteria**

Open `decree/spec/001-sidebar-shell-and-groups-list.md` and verify each checkbox. Mark completed items:

```bash
decree progress
```

**Step 4: Final commit if any fixes were needed**

```bash
git commit -m "feat(sidebar): Phase 1 complete — sidebar shell and groups list"
```

**Step 5: Update SPEC status**

```bash
decree status SPEC-001 implement
```
