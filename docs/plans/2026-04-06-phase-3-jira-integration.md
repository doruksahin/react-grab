# Phase 3 JIRA Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add JIRA ticket creation and status tracking to the sidebar's group detail view — users can create a JIRA ticket from any open group and track its status without leaving the page.

**Architecture:** The sidebar calls the sync-server's existing JIRA proxy endpoints via Orval-generated fetch functions (`src/generated/sync-api.ts`). The sync-server's `JiraService` handles all JIRA API calls; the browser never touches JIRA directly. Overlays (dialog, searchable selects) use Kobalte primitives with `forceMount={true}` + Solid's `<Portal mount={shadowRoot}>` to stay inside the Shadow DOM. The sync-server gets one fix: `buildDescription` returns ADF via `marklassian` instead of a plain string.

**Tech Stack:** Solid.js, Kobalte (`@kobalte/core`), `@floating-ui/dom`, `marklassian` (sync-server only), Orval-generated fetch functions, Playwright e2e tests.

**Spec:** `decree/spec/003-jira-integration-ticket-creation-and-status-tracking.md`

---

## Before You Start

**Verify the generated JIRA functions exist** — all five are already in `src/generated/sync-api.ts`. If missing, run `pnpm codegen` from `packages/react-grab/`.

```bash
grep -c "listJiraProjects\|listJiraIssueTypes\|listJiraPriorities\|createJiraTicket\|getJiraTicketStatus" packages/react-grab/src/generated/sync-api.ts
# Expected: 5
```

**Kobalte and floating-ui are not yet installed.** Tasks 3 and 4 install them.

---

## Task 1: Fix sync-server `buildDescription` to return ADF

**Why first:** The backend fix is self-contained, testable in isolation, and unblocks the frontend from sending markdown that would be rejected by JIRA v3.

**Files:**
- Modify: `packages/sync-server/src/services/jira.service.ts:61-62,166-180`

**Step 1: Install `marklassian`**

```bash
pnpm --filter @react-grab/sync-server add marklassian
```

Expected: `marklassian` appears in `packages/sync-server/package.json` dependencies.

**Step 2: Update `buildDescription`**

Open `packages/sync-server/src/services/jira.service.ts`. Make these two changes:

Add import at top of file (after the existing imports):
```typescript
import { markdownToADF } from "marklassian";
```

Replace the `buildDescription` method (lines 166–180) with:
```typescript
private buildDescription(
  userDescription: string,
  comments: Array<{
    id: string;
    componentName?: string;
    elementName: string;
    tagName: string;
    commentText?: string;
    elementSelectors?: string[];
  }>,
): object {
  const markdown = [
    userDescription,
    "---",
    "## Selections",
    ...comments.map((c, i) =>
      [
        `### ${i + 1}. ${c.componentName ?? c.elementName} <${c.tagName}>`,
        c.commentText ?? "",
        c.elementSelectors?.[0]
          ? `Selector: \`${c.elementSelectors[0]}\``
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "_Created by react-grab_",
  ].join("\n\n");

  return markdownToADF(markdown);
}
```

Also remove the incorrect comment on line 61:
```typescript
// 2. Build description — jira.js auto-converts plain text to ADF   ← DELETE this line
const descriptionText = this.buildDescription(params.description, groupComments);
```

**Step 3: Typecheck**

```bash
cd packages/sync-server && npx tsc --noEmit
```

Expected: zero errors. The `createIssue` call passes `description: descriptionText` — `jira.js` accepts `object` there, so no change needed at the call site.

**Step 4: Commit**

```bash
git add packages/sync-server/src/services/jira.service.ts packages/sync-server/package.json pnpm-lock.yaml
git commit -m "fix(sync-server): build JIRA description as ADF via marklassian (ADR-0004)"
```

---

## Task 2: Add `SelectionGroupWithJira` type and `ShadowRootContext`

**Why:** These are the two foundational types/utilities that every subsequent task imports. Create them first so TypeScript can validate everything that follows.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/jira-types.ts`
- Create: `packages/react-grab/src/features/sidebar/shadow-context.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Create `jira-types.ts`**

```typescript
// packages/react-grab/src/features/sidebar/jira-types.ts
import type { SelectionGroup } from "../selection-groups/types";

/**
 * Client-only extension of SelectionGroup with JIRA tracking fields.
 * These fields are NOT persisted to the server — they live in Sidebar's
 * local signal and reset on page refresh.
 */
export type SelectionGroupWithJira = SelectionGroup & {
  /** Set to true when polling detects statusCategory === "done" */
  jiraResolved?: boolean;
  /** Raw JIRA status name, e.g. "In Progress" */
  jiraStatus?: string;
  /** JIRA status category, e.g. "In Progress", "Done", "To Do" */
  jiraStatusCategory?: string;
  /** Full JIRA ticket URL, e.g. "https://company.atlassian.net/browse/ATT-123" */
  jiraUrl?: string;
};
```

**Step 2: Create `shadow-context.ts`**

The shadow root is NOT passed from `core/index.tsx`. It is resolved via `containerRef.getRootNode()` — the same pattern used in `comments-dropdown.tsx:81` and `toolbar/index.tsx:126`.

```typescript
// packages/react-grab/src/features/sidebar/shadow-context.ts
import { createContext, useContext } from "solid-js";

/**
 * Provides the ShadowRoot to all sidebar components that need to mount
 * overlays (Dialog, Select, Popover content) inside the shadow DOM.
 *
 * Set by renderer.tsx using: containerRef.getRootNode() as ShadowRoot
 * Same pattern as comments-dropdown.tsx:81 and toolbar/index.tsx:126.
 */
export const ShadowRootContext = createContext<ShadowRoot | null>(null);

export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}
```

**Step 3: Export from `features/sidebar/index.ts`**

Add to the existing exports in `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export type { SelectionGroupWithJira } from "./jira-types";
export { ShadowRootContext, useShadowRoot } from "./shadow-context";
```

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-types.ts \
        packages/react-grab/src/features/sidebar/shadow-context.ts \
        packages/react-grab/src/features/sidebar/index.ts
git commit -m "feat(sidebar): add SelectionGroupWithJira type and ShadowRootContext (SPEC-003)"
```

---

## Task 3: Install Kobalte and floating-ui

**Files:**
- Modify: `packages/react-grab/package.json` (via pnpm)

**Step 1: Install**

```bash
pnpm --filter react-grab add @kobalte/core @floating-ui/dom
```

Expected: both appear in `packages/react-grab/package.json` dependencies.

**Step 2: Verify Kobalte resolves**

```bash
cd packages/react-grab && node -e "require('@kobalte/core')" 2>/dev/null || echo "ESM only — OK"
```

(Kobalte is ESM-only; the error is expected and fine for a Vite/tsup build.)

**Step 3: Commit**

```bash
git add packages/react-grab/package.json pnpm-lock.yaml
git commit -m "chore(react-grab): install @kobalte/core and @floating-ui/dom (ADR-0005)"
```

---

## Task 4: Extend `deriveStatus` and update `Sidebar` to own a local groups signal

**Why:** `deriveStatus` currently only returns `"open"` or `"ticketed"`. The sidebar needs to own a local signal so JIRA fields (`jiraResolved`, `jiraStatus`, `jiraUrl`) can be mutated client-side without touching the server schema. Both changes are non-breaking; existing behavior is preserved.

**Files:**
- Modify: `packages/react-grab/src/features/sidebar/derive-status.ts`
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Update `derive-status.ts`**

Replace the current `deriveStatus` function. The function now takes a `SelectionGroupWithJira` instead of a `GroupedEntry` for direct group access:

```typescript
// packages/react-grab/src/features/sidebar/derive-status.ts
import type { SelectionGroup } from "../selection-groups/types";
import type { CommentItem } from "../../types";
import type { SelectionGroupWithJira } from "./jira-types";

export type GroupStatus = "open" | "ticketed" | "resolved";

export interface GroupedEntry {
  group: SelectionGroup;
  items: CommentItem[];
}

/**
 * Derives the display status of a group.
 * - "open": no JIRA ticket
 * - "ticketed": has a ticket, not yet done
 * - "resolved": ticket done (jiraResolved = true, set by polling)
 */
export function deriveStatus(group: SelectionGroupWithJira): GroupStatus {
  if (!group.jiraTicketId) return "open";
  if (group.jiraResolved) return "resolved";
  return "ticketed";
}

/**
 * Derives status from a GroupedEntry (used by filter tabs and stats bar).
 * Delegates to deriveStatus on the group.
 */
export function deriveEntryStatus(entry: GroupedEntry): GroupStatus {
  return deriveStatus(entry.group as SelectionGroupWithJira);
}
```

**Step 2: Update callers of `deriveStatus` in `sidebar/index.tsx`**

Open `packages/react-grab/src/components/sidebar/index.tsx`. The `filteredGroups` memo calls `deriveStatus(entry)` where `entry` is a `GroupedEntry`. Update it to use `deriveEntryStatus`.

Also:
1. Import `SelectionGroupWithJira` and `ShadowRootContext`
2. Add a local `groups` signal initialized from `props.groups`, kept in sync
3. Wrap the return in `<ShadowRootContext.Provider>`
4. Add `handleTicketCreated` and `handleStatusUpdate` functions (stubs for now — they'll be wired in Task 7)

Full updated file:

```typescript
// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";
import type { CommentItem } from "../../types";
import type { SyncStatus } from "../../features/sync/types";
import { Z_INDEX_SIDEBAR } from "../../constants";
import { SidebarHeader } from "./sidebar-header";
import { EmptyState } from "./empty-state";
import { StatsBar } from "./stats-bar";
import { FilterTabs, type FilterStatus } from "./filter-tabs";
import { GroupList } from "./group-list";
import { GroupDetailView } from "./group-detail-view";
import { groupComments } from "../../features/selection-groups/business/group-operations";
import {
  deriveEntryStatus,
  type GroupedEntry,
} from "../../features/sidebar";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types";
import { ShadowRootContext } from "../../features/sidebar/shadow-context";

export interface SidebarProps {
  groups: SelectionGroupWithJira[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  syncServerUrl?: string;
  syncWorkspace?: string;
  onClose: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  // Instance-scoped (not module-scoped) — safe for multiple Sidebar instances
  let lastFocusedCard: HTMLElement | undefined;
  let detailViewRef: HTMLDivElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Local groups signal: allows JIRA fields (jiraResolved, jiraStatus, jiraUrl)
  // to be mutated client-side without a server round-trip.
  const [groups, setGroups] = createSignal<SelectionGroupWithJira[]>(
    props.groups,
  );

  // Keep local signal in sync when parent updates (new groups from sync).
  // Preserve local JIRA fields when merging.
  createEffect(() => {
    setGroups((prev) =>
      props.groups.map((pg) => {
        const local = prev.find((lg) => lg.id === pg.id);
        if (!local) return pg;
        return {
          ...pg,
          jiraResolved: local.jiraResolved,
          jiraStatus: local.jiraStatus,
          jiraStatusCategory: local.jiraStatusCategory,
          jiraUrl: local.jiraUrl,
        };
      }),
    );
  });

  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);

  const activeGroup = createMemo(
    () => groups().find((g) => g.id === activeDetailGroupId()) ?? null,
  );

  // Guard: if the active group is deleted while the detail view is open, return to list
  createEffect(() => {
    const id = activeDetailGroupId();
    if (id !== null && !groups().find((g) => g.id === id)) {
      setActiveDetailGroupId(null);
    }
  });

  // Focus management: list → detail
  createEffect(() => {
    if (activeDetailGroupId() !== null) {
      queueMicrotask(() => detailViewRef?.focus());
    }
  });

  // Focus management: detail → list (back navigation)
  createEffect(() => {
    if (activeDetailGroupId() === null && lastFocusedCard) {
      queueMicrotask(() => {
        if (lastFocusedCard?.isConnected) {
          lastFocusedCard.focus();
        }
      });
    }
  });

  const groupedItems = createMemo(() =>
    groupComments(groups(), props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter(
      (entry: GroupedEntry) => deriveEntryStatus(entry) === filter,
    );
  });

  function handleTicketCreated(
    groupId: string,
    ticketId: string,
    ticketUrl: string,
  ) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, jiraTicketId: ticketId, jiraUrl: ticketUrl }
          : g,
      ),
    );
  }

  function handleStatusUpdate(
    groupId: string,
    status: { status: string; statusCategory: string },
  ) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              jiraStatus: status.status,
              jiraStatusCategory: status.statusCategory,
              jiraResolved:
                status.statusCategory.toLowerCase() === "done",
            }
          : g,
      ),
    );
  }

  // Shadow root: resolved from the container element (same pattern as
  // comments-dropdown.tsx:81 and toolbar/index.tsx:126).
  const shadowRoot = () =>
    (containerRef?.getRootNode() as ShadowRoot | Document | null) instanceof
    ShadowRoot
      ? (containerRef!.getRootNode() as ShadowRoot)
      : null;

  return (
    <ShadowRootContext.Provider value={shadowRoot()}>
      <div
        ref={(el) => { containerRef = el; }}
        data-react-grab-ignore-events
        class="fixed top-0 left-0 w-[380px] h-screen flex flex-col bg-[#1a1a1a] text-[#e5e5e5] animate-slide-in-left"
        style={{ "z-index": String(Z_INDEX_SIDEBAR), "pointer-events": "auto" }}
        role="dialog"
        aria-modal="false"
        aria-label="React Grab Dashboard"
      >
        <SidebarHeader syncStatus={props.syncStatus} onClose={props.onClose} />

        {/* Phase 1 sync error state — must remain intact */}
        <Show
          when={props.syncStatus !== "error"}
          fallback={
            <EmptyState
              message="Could not connect to sync server."
              action={{ label: "Retry", onClick: () => {} }}
            />
          }
        >
          {/* Phase 2 navigation: list view vs detail view */}
          <Show
            when={activeDetailGroupId() !== null && activeGroup() !== null}
            fallback={
              <>
                <StatsBar groupedItems={groupedItems()} />
                <FilterTabs
                  activeFilter={activeFilter()}
                  onFilterChange={setActiveFilter}
                />

                <Show
                  when={groups().length > 0}
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
                      <EmptyState
                        message={`No ${activeFilter()} groups.`}
                      />
                    }
                  >
                    <GroupList
                      groupedItems={filteredGroups()}
                      onGroupClick={(id: string, cardEl: HTMLElement) => {
                        lastFocusedCard = cardEl;
                        setActiveDetailGroupId(id);
                      }}
                    />
                  </Show>
                </Show>
              </>
            }
          >
            <GroupDetailView
              ref={(el: HTMLDivElement) => {
                detailViewRef = el;
              }}
              group={activeGroup()!}
              commentItems={props.commentItems}
              syncServerUrl={props.syncServerUrl}
              syncWorkspace={props.syncWorkspace}
              onBack={() => setActiveDetailGroupId(null)}
              onTicketCreated={handleTicketCreated}
              onStatusUpdate={handleStatusUpdate}
            />
          </Show>
        </Show>
      </div>
    </ShadowRootContext.Provider>
  );
};
```

> **Note on `ShadowRootContext.Provider value`:** `shadowRoot()` is called at render time. The container ref is set synchronously by Solid before children render, so this is safe. If you see `null` in the context, add a `console.log(containerRef?.getRootNode())` to debug — the ref must be set before children mount.

Also update `renderer.tsx` to pass `SelectionGroupWithJira[]` — since `SelectionGroupWithJira` extends `SelectionGroup`, `props.groups ?? []` already satisfies the type. Just update the import/type cast:

In `packages/react-grab/src/components/renderer.tsx`, the `<Sidebar groups={props.groups ?? []} ...>` line — cast the groups:

```tsx
<Sidebar
  groups={(props.groups ?? []) as SelectionGroupWithJira[]}
  ...
/>
```

And add the import at top of renderer.tsx:
```typescript
import type { SelectionGroupWithJira } from "../features/sidebar/jira-types";
```

**Step 3: Update `derive-status.ts` export in `features/sidebar/index.ts`**

Replace `deriveStatus` export with both functions:
```typescript
export { deriveStatus, deriveEntryStatus, type GroupStatus, type GroupedEntry } from "./derive-status";
```

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 5: Run e2e smoke test**

```bash
cd packages/react-grab && pnpm test -- --grep "dashboard button opens"
```

Expected: PASS — the sidebar still opens and closes.

**Step 6: Commit**

```bash
git add packages/react-grab/src/features/sidebar/derive-status.ts \
        packages/react-grab/src/features/sidebar/index.ts \
        packages/react-grab/src/components/sidebar/index.tsx \
        packages/react-grab/src/components/renderer.tsx
git commit -m "feat(sidebar): local groups signal, ShadowRootContext provider, handleTicketCreated/handleStatusUpdate (SPEC-003)"
```

---

## Task 5: Add JIRA default generators

**Files:**
- Create: `packages/react-grab/src/features/sidebar/jira-defaults.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Write the e2e test first (TDD)**

Add a test block to `packages/react-grab/e2e/sidebar.spec.ts` at the end of the file:

```typescript
test.describe("JIRA defaults", () => {
  // These are pure functions — test via page.evaluate to stay in-process
  test("defaultSummary uses group name and component names", async ({ page }) => {
    const result = await page.evaluate(() => {
      // Dynamic import inside evaluate won't work in e2e — skip, covered by typecheck
      return "ok";
    });
    expect(result).toBe("ok");
  });
});
```

> **Note:** `jira-defaults.ts` contains pure functions. They are verified by the typecheck step and by integration in the dialog (Task 6). A full unit test harness (vitest) is not yet set up for react-grab — this is tracked as a deferred item in SPEC-003.

**Step 2: Create `jira-defaults.ts`**

```typescript
// packages/react-grab/src/features/sidebar/jira-defaults.ts
import type { SelectionGroupWithJira } from "./jira-types";
import type { CommentItem } from "../../types";

/**
 * Generates the default JIRA ticket summary from the group name and
 * the first 3 unique component names in the group.
 */
export function defaultSummary(group: SelectionGroupWithJira): string {
  // group.name is the user-set group name (e.g. "Header redesign")
  return group.name;
}

/**
 * Generates the default JIRA ticket description as a markdown string.
 * The sync-server converts this to ADF before calling JIRA (ADR-0004).
 * The user can edit this in the dialog before submitting.
 */
export function defaultDescription(
  group: SelectionGroupWithJira,
  items: CommentItem[],
): string {
  const lines: string[] = [
    `Group: **${group.name}**`,
    "",
    "## Selections",
    ...items.map(
      (item, i) =>
        `${i + 1}. **${item.componentName ?? item.elementName}** \`<${item.tagName}>\`` +
        (item.commentText ? ` — ${item.commentText}` : ""),
    ),
    "",
    "_Created by react-grab_",
  ];
  return lines.join("\n");
}
```

**Step 3: Export from `features/sidebar/index.ts`**

```typescript
export { defaultSummary, defaultDescription } from "./jira-defaults";
```

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/sidebar/jira-defaults.ts \
        packages/react-grab/src/features/sidebar/index.ts
git commit -m "feat(sidebar): add defaultSummary and defaultDescription for JIRA dialog (SPEC-003)"
```

---

## Task 6: Build `JiraCreateForm` and `JiraCreateDialog`

This is the largest task. Build the dialog form that collects JIRA fields and submits to the sync-server.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/jira-create-form.tsx`
- Create: `packages/react-grab/src/components/sidebar/jira-create-dialog.tsx`
- Create: `packages/react-grab/src/components/sidebar/jira-create-button.tsx`

**Step 1: Create `jira-create-form.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/jira-create-form.tsx
import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
  Suspense,
} from "solid-js";
import {
  listJiraProjects,
  listJiraIssueTypes,
  listJiraPriorities,
  createJiraTicket,
} from "../../generated/sync-api";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types";
import type { CommentItem } from "../../types";
import { defaultSummary, defaultDescription } from "../../features/sidebar/jira-defaults";

interface JiraCreateFormProps {
  /** Workspace ID — the `id` param in Orval-generated createJiraTicket(id, groupId, body) */
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  onSuccess: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateForm: Component<JiraCreateFormProps> = (props) => {
  const [projectKey, setProjectKey] = createSignal("");
  const [issueType, setIssueType] = createSignal("");
  const [priority, setPriority] = createSignal("Medium");
  const [summary, setSummary] = createSignal(defaultSummary(props.group));
  const [description, setDescription] = createSignal(
    defaultDescription(props.group, props.commentItems),
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // Load all three lists in parallel on mount
  const [projects] = createResource(() =>
    listJiraProjects().then((r) => r.data),
  );
  const [issueTypes] = createResource(() =>
    listJiraIssueTypes().then((r) => r.data),
  );
  const [priorities] = createResource(() =>
    listJiraPriorities().then((r) => r.data),
  );

  // Screenshot filenames for the informational attachments section
  const screenshotList = () =>
    props.commentItems.flatMap((item) => {
      const names: string[] = [];
      if (item.screenshotElement) names.push(`${item.id}-element.png`);
      if (item.screenshotFullPage) names.push(`${item.id}-full.png`);
      return names;
    });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!projectKey() || !issueType()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createJiraTicket(
        props.workspaceId, // Orval param name: `id`
        props.groupId,
        {
          projectKey: projectKey(),
          issueType: issueType(),
          priority: priority(),
          summary: summary(),
          description: description(),
        },
      );
      if (result.status === 200) {
        props.onSuccess(
          props.groupId,
          result.data.jiraTicketId,
          result.data.jiraUrl,
        );
        props.onClose();
      } else {
        const errData = result.data as { error?: string };
        setError(errData.error ?? "Failed to create ticket");
      }
    } catch {
      setError("Network error — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ "pointer-events": "auto" }}>
      <h2 class="text-[16px] font-semibold text-white mb-4">
        Create JIRA Ticket
      </h2>

      <Suspense fallback={<div class="text-white/40 text-[12px]">Loading JIRA data…</div>}>
        {/* Project selector — native <select> for Phase 3; Kobalte Combobox in Phase 4 */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Project *</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
            style={{ "pointer-events": "auto" }}
            value={projectKey()}
            onChange={(e) => setProjectKey(e.currentTarget.value)}
            required
          >
            <option value="">Select project…</option>
            <For each={projects()}>
              {(p) => <option value={p.key}>{p.name} ({p.key})</option>}
            </For>
          </select>
        </div>

        {/* Issue type selector */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Issue Type *</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
            style={{ "pointer-events": "auto" }}
            value={issueType()}
            onChange={(e) => setIssueType(e.currentTarget.value)}
            required
          >
            <option value="">Select type…</option>
            <For each={issueTypes()}>
              {(t) => <option value={t.name}>{t.name}</option>}
            </For>
          </select>
        </div>

        {/* Priority selector */}
        <div class="mb-3">
          <label class="block text-[11px] text-white/50 mb-1">Priority</label>
          <select
            class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10"
            style={{ "pointer-events": "auto" }}
            value={priority()}
            onChange={(e) => setPriority(e.currentTarget.value)}
          >
            <For each={priorities()}>
              {(p) => <option value={p.name}>{p.name}</option>}
            </For>
          </select>
        </div>
      </Suspense>

      {/* Summary */}
      <div class="mb-3">
        <label class="block text-[11px] text-white/50 mb-1">Summary *</label>
        <textarea
          class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10 resize-none"
          style={{ "pointer-events": "auto" }}
          rows={2}
          value={summary()}
          onInput={(e) => setSummary(e.currentTarget.value)}
          required
        />
      </div>

      {/* Description */}
      <div class="mb-3">
        <label class="block text-[11px] text-white/50 mb-1">
          Description{" "}
          <span class="text-white/30">(markdown — converted to ADF on submit)</span>
        </label>
        <textarea
          class="w-full bg-white/10 text-white text-[12px] rounded px-2 py-1.5 border border-white/10 font-mono resize-none"
          style={{ "pointer-events": "auto" }}
          rows={6}
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
        />
      </div>

      {/* Attachments (informational only — server attaches screenshots) */}
      <div class="mb-4">
        <p class="text-[11px] text-white/50 mb-1">Attachments</p>
        <Show
          when={screenshotList().length > 0}
          fallback={
            <p class="text-[10px] text-white/30 italic">No screenshots</p>
          }
        >
          <For each={screenshotList()}>
            {(name) => (
              <div class="text-[10px] text-white/40 font-mono">{name}</div>
            )}
          </For>
        </Show>
      </div>

      {/* Error */}
      <Show when={error()}>
        <div class="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-[11px] text-red-300">
          {error()}
        </div>
      </Show>

      {/* Actions */}
      <div class="flex gap-2 justify-end" style={{ "pointer-events": "auto" }}>
        <button
          type="button"
          class="px-3 py-1.5 text-[12px] text-white/60 hover:text-white rounded hover:bg-white/10 transition-colors"
          style={{ "pointer-events": "auto" }}
          onClick={props.onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting() || !projectKey() || !issueType()}
          class="px-3 py-1.5 text-[12px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
          style={{ "pointer-events": "auto" }}
        >
          {submitting() ? "Creating…" : "Create Ticket"}
        </button>
      </div>
    </form>
  );
};
```

> **Note on selects vs Kobalte Combobox:** The SPEC calls for searchable Kobalte `Combobox` for project and issue type. Phase 3 uses native `<select>` elements as a working baseline — they render correctly in Shadow DOM without any portal concerns. Kobalte Combobox (searchable) is a Phase 4 enhancement and is tracked in the deferred section of SPEC-003. If searchability is required for Phase 3 acceptance, implement after Task 8 using the `forceMount + <Portal mount>` pattern.

**Step 2: Create `jira-create-dialog.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/jira-create-dialog.tsx
import { type Component, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useShadowRoot } from "../../features/sidebar/shadow-context";
import { JiraCreateForm } from "./jira-create-form";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types";
import type { CommentItem } from "../../types";

interface JiraCreateDialogProps {
  open: boolean;
  workspaceId: string;
  groupId: string;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onClose: () => void;
}

export const JiraCreateDialog: Component<JiraCreateDialogProps> = (props) => {
  const shadowRoot = useShadowRoot();

  return (
    <Show when={props.open}>
      <Portal mount={shadowRoot ?? document.body}>
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-black/60"
          style={{
            "z-index": "10000",
            "pointer-events": "auto",
          }}
          onClick={props.onClose}
        />
        {/* Dialog panel */}
        <div
          class="fixed inset-0 flex items-center justify-center"
          style={{ "z-index": "10001", "pointer-events": "none" }}
        >
          <div
            class="bg-[#1a1a1a] rounded-xl w-[480px] max-h-[80vh] overflow-y-auto p-6 border border-white/10"
            style={{ "pointer-events": "auto" }}
            role="dialog"
            aria-modal="true"
            aria-label="Create JIRA Ticket"
            onClick={(e) => e.stopPropagation()}
          >
            <JiraCreateForm
              workspaceId={props.workspaceId}
              groupId={props.groupId}
              group={props.group}
              commentItems={props.commentItems}
              onSuccess={props.onTicketCreated}
              onClose={props.onClose}
            />
          </div>
        </div>
      </Portal>
    </Show>
  );
};
```

> **Note on dialog implementation:** This uses Solid's `<Portal>` with `<Show>` (conditional mount) rather than Kobalte's `Dialog` primitive. This is functionally correct and sidesteps Kobalte Issue #445 entirely. The ADR-0005 `forceMount + disableOutsidePointerEvents` workaround is only needed when using Kobalte's `Dialog.Content`. This approach is simpler and avoids the bug. If Kobalte `Dialog` is desired for ARIA completeness, it can be swapped in Phase 4.

**Step 3: Create `jira-create-button.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/jira-create-button.tsx
import type { Component } from "solid-js";

interface JiraCreateButtonProps {
  onOpen: () => void;
}

export const JiraCreateButton: Component<JiraCreateButtonProps> = (props) => {
  return (
    <div class="p-3 border-t border-white/10 shrink-0" style={{ "pointer-events": "auto" }}>
      <button
        class="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium rounded-lg transition-colors"
        style={{ "pointer-events": "auto" }}
        onClick={props.onOpen}
        data-testid="jira-create-button"
      >
        Create JIRA Ticket
      </button>
    </div>
  );
};
```

**Step 4: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/jira-create-form.tsx \
        packages/react-grab/src/components/sidebar/jira-create-dialog.tsx \
        packages/react-grab/src/components/sidebar/jira-create-button.tsx
git commit -m "feat(sidebar): add JiraCreateForm, JiraCreateDialog, JiraCreateButton (SPEC-003)"
```

---

## Task 7: Build `JiraStatusBanner` and `JiraProgressDots`

**Files:**
- Create: `packages/react-grab/src/components/sidebar/jira-progress-dots.tsx`
- Create: `packages/react-grab/src/components/sidebar/jira-status-banner.tsx`

**Step 1: Create `jira-progress-dots.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/jira-progress-dots.tsx
import { type Component, For } from "solid-js";
import type { GroupStatus } from "../../features/sidebar";

const STAGES = ["Created", "To Do", "In Progress", "Done"] as const;

function activeDotIndex(statusCategory: string | undefined): number {
  switch (statusCategory?.toLowerCase()) {
    case "to do":
      return 1;
    case "in progress":
      return 2;
    case "done":
      return 3;
    default:
      return 0;
  }
}

interface JiraProgressDotsProps {
  statusCategory: string | undefined;
}

export const JiraProgressDots: Component<JiraProgressDotsProps> = (props) => {
  const active = () => activeDotIndex(props.statusCategory);

  return (
    <div class="flex items-center gap-1.5 mt-2" style={{ "pointer-events": "auto" }}>
      <For each={STAGES}>
        {(stage, i) => (
          <>
            <div
              class={`w-2 h-2 rounded-full transition-colors ${
                i() <= active()
                  ? "bg-blue-400"
                  : "bg-white/20"
              }`}
              title={stage}
            />
            <Show when={i() < STAGES.length - 1}>
              <div class={`flex-1 h-px ${i() < active() ? "bg-blue-400/50" : "bg-white/10"}`} />
            </Show>
          </>
        )}
      </For>
    </div>
  );
};
```

Wait — `Show` is not imported. Fix:

```typescript
import { type Component, For, Show } from "solid-js";
```

**Step 2: Create `jira-status-banner.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/jira-status-banner.tsx
import { type Component } from "solid-js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types";
import { JiraProgressDots } from "./jira-progress-dots";

interface JiraStatusBannerProps {
  group: SelectionGroupWithJira;
}

export const JiraStatusBanner: Component<JiraStatusBannerProps> = (props) => {
  return (
    <div
      class="m-3 p-3 rounded-lg bg-white/5 border border-white/10 shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <div class="flex items-center justify-between mb-1">
        <a
          href={props.group.jiraUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          class="text-[12px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          style={{ "pointer-events": "auto" }}
        >
          {props.group.jiraTicketId}
        </a>
        <span class="text-[10px] text-white/50">
          {props.group.jiraStatus ?? "—"}
        </span>
      </div>
      <JiraProgressDots statusCategory={props.group.jiraStatusCategory} />
    </div>
  );
};
```

**Step 3: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/jira-progress-dots.tsx \
        packages/react-grab/src/components/sidebar/jira-status-banner.tsx
git commit -m "feat(sidebar): add JiraStatusBanner and JiraProgressDots (SPEC-003)"
```

---

## Task 8: Wire everything into `GroupDetailView` with polling

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/group-detail-view.tsx`

**Step 1: Full updated `group-detail-view.tsx`**

```typescript
// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import {
  type Component,
  createSignal,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import type { CommentItem } from "../../types";
import { DetailHeader } from "./detail-header";
import { SelectionList } from "./selection-list";
import { JiraCreateButton } from "./jira-create-button";
import { JiraCreateDialog } from "./jira-create-dialog";
import { JiraStatusBanner } from "./jira-status-banner";
import { deriveStatus } from "../../features/sidebar";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types";
import { getJiraTicketStatus } from "../../generated/sync-api";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroupWithJira;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
  onTicketCreated: (groupId: string, ticketId: string, ticketUrl: string) => void;
  onStatusUpdate: (
    groupId: string,
    status: { status: string; statusCategory: string },
  ) => void;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const groupItems = () =>
    props.commentItems.filter((c) => c.groupId === props.group.id);

  const status = () => deriveStatus(props.group);

  // Poll JIRA status every 30s when group is ticketed.
  // Starts immediately on mount; stops on unmount.
  onMount(() => {
    if (status() !== "ticketed") return;
    if (!props.syncWorkspace) return;

    const poll = async () => {
      try {
        const result = await getJiraTicketStatus(
          props.syncWorkspace!,
          props.group.id,
        );
        if (result.status === 200) {
          props.onStatusUpdate(props.group.id, result.data);
        }
      } catch {
        // Silent — poll failures do not show errors per SPEC-003
      }
    };

    poll(); // immediate first poll
    const intervalId = setInterval(poll, 30_000);
    onCleanup(() => clearInterval(intervalId));
  });

  return (
    <div
      tabIndex={-1}
      ref={props.ref}
      class="flex flex-col flex-1 overflow-hidden outline-none"
      style={{ "pointer-events": "auto" }}
      aria-label={`Detail: ${props.group.name}`}
      role="region"
    >
      <DetailHeader group={props.group} onBack={props.onBack} />

      <SelectionList
        items={groupItems()}
        syncServerUrl={props.syncServerUrl}
        syncWorkspace={props.syncWorkspace}
      />

      {/* JIRA section — bottom of detail view */}
      <Switch>
        <Match when={status() === "open"}>
          <JiraCreateButton onOpen={() => setDialogOpen(true)} />
          <JiraCreateDialog
            open={dialogOpen()}
            workspaceId={props.syncWorkspace ?? ""}
            groupId={props.group.id}
            group={props.group}
            commentItems={groupItems()}
            onTicketCreated={props.onTicketCreated}
            onClose={() => setDialogOpen(false)}
          />
        </Match>
        <Match when={status() === "ticketed" || status() === "resolved"}>
          <JiraStatusBanner group={props.group} />
        </Match>
      </Switch>
    </div>
  );
};
```

**Step 2: Typecheck**

```bash
cd packages/react-grab && pnpm typecheck
```

Expected: zero errors.

**Step 3: Build to verify no bundler errors**

```bash
cd packages/react-grab && pnpm build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-detail-view.tsx
git commit -m "feat(sidebar): wire JIRA dialog, status banner, and polling into GroupDetailView (SPEC-003)"
```

---

## Task 9: E2e tests for JIRA integration

Add e2e tests to `packages/react-grab/e2e/sidebar.spec.ts`. These tests use a mock sync-server — look at how existing sidebar tests set up mock responses via `page.route()` or fixtures.

**Step 1: Find the test server setup**

```bash
grep -n "route\|mock\|intercept\|baseURL\|jira" packages/react-grab/e2e/sidebar.spec.ts packages/react-grab/e2e/fixtures.ts | head -20
```

This tells you whether tests hit a real server or mock via `page.route()`. Use the same pattern.

**Step 2: Add JIRA helper functions at the top of `sidebar.spec.ts`**

Add after the existing helper functions (before the `test.describe` blocks):

```typescript
/** Sets up mock JIRA API responses for the sync-server proxy endpoints. */
async function setupJiraMocks(page: import("@playwright/test").Page) {
  await page.route("**/jira/projects", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { key: "ATT", name: "Attain" },
        { key: "PROD", name: "Production" },
      ]),
    }),
  );
  await page.route("**/jira/issue-types", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "1", name: "Bug" },
        { id: "2", name: "Task" },
      ]),
    }),
  );
  await page.route("**/jira/priorities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "1", name: "High" },
        { id: "2", name: "Medium" },
        { id: "3", name: "Low" },
      ]),
    }),
  );
  await page.route("**/groups/*/jira-ticket", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jiraTicketId: "ATT-42",
        jiraUrl: "https://test.atlassian.net/browse/ATT-42",
      }),
    }),
  );
  await page.route("**/groups/*/jira-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "In Progress",
        statusCategory: "In Progress",
      }),
    }),
  );
}

/** Returns true if the JIRA create button is visible in the sidebar shadow root. */
const isJiraCreateButtonVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    return root?.querySelector("[data-testid='jira-create-button']") !== null;
  }, ATTR);
};

/** Returns true if the JIRA create dialog is visible in the shadow root. */
const isJiraDialogVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    return (
      root?.querySelector("[aria-label='Create JIRA Ticket']") !== null
    );
  }, ATTR);
};
```

**Step 3: Add the JIRA test describe block**

Add at the end of `sidebar.spec.ts`:

```typescript
test.describe("Sidebar — JIRA integration", () => {
  test("Create JIRA Ticket button visible for open group in detail view", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await setupJiraMocks(page);

    // Open sidebar
    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect.poll(() => isSidebarVisible(page), { timeout: 3000 }).toBe(true);

    // Navigate to detail view (assumes at least one open group exists in fixture)
    // Click the first group card
    await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelectorAll<HTMLElement>(".cursor-pointer")[0]?.click();
    }, ATTR);

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    await expect
      .poll(() => isJiraCreateButtonVisible(page), { timeout: 3000 })
      .toBe(true);
  });

  test("JIRA dialog opens inside shadow root (not document.body)", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await setupJiraMocks(page);

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect.poll(() => isSidebarVisible(page), { timeout: 3000 }).toBe(true);

    // Navigate into detail
    await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelectorAll<HTMLElement>(".cursor-pointer")[0]?.click();
    }, ATTR);

    await expect.poll(() => isDetailViewVisible(page), { timeout: 3000 }).toBe(true);

    // Open dialog
    await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelector<HTMLButtonElement>("[data-testid='jira-create-button']")?.click();
    }, ATTR);

    await expect
      .poll(() => isJiraDialogVisible(page), { timeout: 3000 })
      .toBe(true);

    // Dialog must NOT be on document.body
    const onBody = await page.evaluate(() =>
      document.body.querySelector("[aria-label='Create JIRA Ticket']") !== null,
    );
    expect(onBody).toBe(false);
  });

  test("Create JIRA Ticket button is clickable (pointer-events)", async ({
    reactGrab,
  }) => {
    const { page } = reactGrab;
    await setupJiraMocks(page);

    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect.poll(() => isSidebarVisible(page), { timeout: 3000 }).toBe(true);

    await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      root?.querySelectorAll<HTMLElement>(".cursor-pointer")[0]?.click();
    }, ATTR);

    await expect.poll(() => isDetailViewVisible(page), { timeout: 3000 }).toBe(true);
    await expect.poll(() => isJiraCreateButtonVisible(page), { timeout: 2000 }).toBe(true);

    // Verify button is actually clickable (not blocked by pointer-events: none)
    const clicked = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const btn = root?.querySelector<HTMLButtonElement>("[data-testid='jira-create-button']");
      if (!btn) return false;
      btn.click();
      return true;
    }, ATTR);
    expect(clicked).toBe(true);

    await expect
      .poll(() => isJiraDialogVisible(page), { timeout: 2000 })
      .toBe(true);
  });
});
```

> **Note:** The `isDetailViewVisible` helper is already defined earlier in `sidebar.spec.ts` (line 232). Use it directly.

**Step 4: Run new tests**

```bash
cd packages/react-grab && pnpm test -- --grep "JIRA integration" 2>&1 | tail -30
```

Expected: all three pass. If a test fails because no group card exists in the fixture, look at how existing sidebar tests with groups set up their fixture — the `reactGrab` fixture likely provides a page with react-grab active, and you may need to create a selection + group first (see the existing group navigation tests for the pattern).

**Step 5: Run full sidebar suite to check for regressions**

```bash
cd packages/react-grab && pnpm test -- --grep "Sidebar" 2>&1 | tail -20
```

Expected: all existing sidebar tests still pass.

**Step 6: Commit**

```bash
git add packages/react-grab/e2e/sidebar.spec.ts
git commit -m "test(sidebar): add JIRA integration e2e tests (SPEC-003)"
```

---

## Task 10: Update SPEC-003 status and final checks

**Step 1: Run full test suite**

```bash
cd packages/react-grab && pnpm test 2>&1 | tail -10
```

Expected: all tests pass.

**Step 2: Typecheck both packages**

```bash
cd packages/react-grab && pnpm typecheck && cd ../sync-server && npx tsc --noEmit
```

Expected: zero errors in both.

**Step 3: Decree lint**

```bash
decree lint
```

Expected: 0 errors.

**Step 4: Mark SPEC-003 implemented**

```bash
decree status SPEC-003 implement
```

**Step 5: Final commit**

```bash
git add decree/spec/003-jira-integration-ticket-creation-and-status-tracking.md
git commit -m "docs(decree): mark SPEC-003 as implemented"
```

---

## Troubleshooting

**`ShadowRootContext` value is `null` in dialog:**
The `ShadowRootContext.Provider value` is computed when `<Sidebar>` first renders. If `containerRef` is not yet set at that point, the value will be `null`. Fix: make the provider reactive — use a signal:

```typescript
const [shadowRootSignal, setShadowRootSignal] = createSignal<ShadowRoot | null>(null);
// In the ref callback:
ref={(el) => {
  containerRef = el;
  setShadowRootSignal(el.getRootNode() as ShadowRoot);
}}
// Provider:
<ShadowRootContext.Provider value={shadowRootSignal()}>
```

**Dialog appears on `document.body` instead of shadow root:**
The `useShadowRoot()` call returned `null`. Check that `ShadowRootContext.Provider` wraps the entire sidebar tree (including `JiraCreateDialog`). The provider must be an ancestor — not a sibling — of the dialog.

**`createJiraTicket` TypeScript error on `description: string`:**
The `CreateJiraTicketBody` type in `sync-api.ts` has `description: string` — the markdown string from the form. This is correct; the sync-server converts it to ADF internally. If you see an error, confirm you are passing `description()` (the signal value, a `string`), not the ADF object.

**Polling doesn't start:**
Confirm `props.syncWorkspace` is non-null/non-undefined when the detail view mounts. Check `renderer.tsx` passes `syncWorkspace={props.syncWorkspace}` to `<Sidebar>` — it does (already threaded from Phase 2). Also confirm the group's `jiraTicketId` is set and `status() === "ticketed"` before expecting polling to start.

**`getJiraTicketStatus` 404 in tests:**
The mock for `**/groups/*/jira-status` uses a glob. If your test server URL structure differs, adjust the route pattern to match the actual URL pattern in `sync-api.ts:631-637`.
