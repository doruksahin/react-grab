# Selection Label — Stats-Bar Card Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the sidebar's stats-bar card body (`packages/react-grab/src/components/sidebar/selection-list-tab.tsx:116-281`) into a shared `<SelectionCardBody>` component and render it inside the expanded/ticketed selection label so both surfaces show the same 7-row layout.

**Architecture:** One new presentation component `components/sidebar/selection-card-body.tsx` owns the 7 rows (status pill, summary, labels, date range, screenshots, meta, comments). `SelectionListTab` consumes it verbatim (behavior-preserving refactor). `SelectionLabel` consumes it in place of the current `JiraMeta` + bare `CommentsSection` when the label is expanded on a ticketed selection. New JIRA fields (`jiraDueDate`, `jiraIssueType`, `jiraPriority`) are added to `JiraDisplayFields` so they cascade into both `SelectionLabelInstance` and `SelectionLabelProps` automatically. Item-level fields the label doesn't have today (`commentText`, `timestamp`, screenshot flags) get added to `SelectionLabelInstance` and plumbed through the renderer.

**Tech Stack:** Solid.js, Tailwind v4, tsup. Tests: Playwright visual snapshots (Chromium). Lint: oxlint. Format: oxfmt. Package manager: pnpm (10.24.0).

**Branch:** `feat/selection-label-stats-bar-parity` (already created, design doc already committed).

**Design reference:** `docs/plans/2026-04-16-selection-label-stats-bar-parity-design.md`, `poc-stats-bar.html`, `poc-selection-label.html`.

---

## Task 0: Baseline — confirm targeted tests pass before any change

**Files:** none — verification only.

**Step 1: Run the SPEC-004 / SPEC-010 suites to capture the green baseline**

```bash
pnpm --filter react-grab exec playwright test --project=chromium --grep @SPEC-010
```

Expected: all tests pass. If any fail, **stop** and report to the user — do not continue. The refactor only works if we have a clean starting point.

**Step 2: Capture current visual snapshots for the label**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium
```

Expected: pass. Snapshots exist at `packages/react-grab/e2e/mocked/jira-selection-label-visual.spec.ts-snapshots/`.

**Step 3: No commit** — this task is a gate, not a change.

---

## Task 1: Extract `<SelectionCardBody>` — copy, don't refactor yet

**Files:**
- Create: `packages/react-grab/src/components/sidebar/selection-card-body.tsx`

**Step 1: Read the current inlined card body**

Read `packages/react-grab/src/components/sidebar/selection-list-tab.tsx:144-281` — the `{/* Card content */}` block. This is the 7-row layout we're extracting. Note the props it depends on:

- `item: CommentItem`
- `group: SelectionGroupWithJira | undefined` (via `groupMap`)
- `syncServerUrl`, `syncWorkspace`
- `onSubmitJiraComment`, `onSearchJiraUsers`, `onRefreshJiraStatus`
- `isDevMode` (for DevInsights)

**Step 2: Create the new component with a flat prop contract**

Path: `packages/react-grab/src/components/sidebar/selection-card-body.tsx`

```tsx
import { type Component, For, Show } from "solid-js";
import type { JiraComment } from "../../types.js";
import type {
  SearchJiraUsersFn,
  SubmitCommentFn,
} from "../../features/jira-comments/types.js";
import { IssueTypeIcon } from "./issue-type-icon.jsx";
import { PriorityIcon } from "./priority-icon.jsx";
import { UserAvatar } from "./UserAvatar.jsx";
import { CommentsSection } from "../jira-comments/comments-section.jsx";
import { relativeTime } from "../../features/sidebar/relative-time.js";
import { screenshotUrl } from "../../features/sidebar/screenshot-url.js";

const getStatusPillClass = (category?: string): string => {
  switch (category) {
    case "indeterminate":
      return "text-blue-400 bg-blue-400/[0.12]";
    case "done":
      return "text-green-400 bg-green-400/[0.12]";
    case "new":
    default:
      return "text-muted-foreground bg-foreground/[0.06]";
  }
};

const getStatusDisplayText = (
  ticketId?: string,
  status?: string,
): string => {
  if (!ticketId) return "no ticket";
  return status ?? "To Do";
};

const formatDueDate = (dueDate: string): string =>
  new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export interface SelectionCardBodyProps {
  // Status pill (top-right, absolute)
  jiraTicketId?: string;
  jiraStatus?: string;
  jiraStatusCategory?: string;

  // Summary row
  summary: string;

  // Labels row
  jiraLabels?: readonly string[];

  // Date row
  timestamp: number;
  jiraDueDate?: string | null;

  // Screenshot row (item-scoped)
  itemId: string;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;

  // Bottom meta row
  jiraIssueType?: string | null;
  jiraPriority?: string | null;
  jiraAssignee?: string | null;
  jiraAssigneeAvatar?: string | null;

  // Comments
  jiraComments?: ReadonlyArray<JiraComment>;
  onSubmitComment?: SubmitCommentFn;
  onSearchUsers?: SearchJiraUsersFn;
  onRefreshStatus?: () => void;
}

export const SelectionCardBody: Component<SelectionCardBodyProps> = (
  props,
) => {
  const hasTicket = () => Boolean(props.jiraTicketId);
  const hasScreenshot = () =>
    (props.hasElementScreenshot || props.hasFullPageScreenshot) &&
    Boolean(props.syncServerUrl && props.syncWorkspace);

  return (
    <div data-react-grab-selection-card-body class="relative">
      {/* JIRA status pill — absolute top-right */}
      <div class="absolute top-0 right-0">
        <Show
          when={hasTicket()}
          fallback={
            <span class="text-[9px] uppercase font-medium text-muted-foreground italic">
              no ticket
            </span>
          }
        >
          <span
            class={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded ${getStatusPillClass(props.jiraStatusCategory)}`}
          >
            {getStatusDisplayText(props.jiraTicketId, props.jiraStatus)}
          </span>
        </Show>
      </div>

      {/* Summary text */}
      <div class="text-[12px] font-medium text-foreground pr-16 truncate">
        {props.summary}
      </div>

      {/* Labels row */}
      <Show when={props.jiraLabels?.length}>
        <div class="flex flex-wrap gap-1.5 mt-1.5">
          <For each={props.jiraLabels}>
            {(label) => (
              <span class="bg-foreground/[0.06] text-muted-foreground text-[9px] font-medium px-1.5 py-0.5 rounded">
                {label}
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* Date range row */}
      <div class="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 7h12M5 1v4M11 1v4" />
        </svg>
        <span>{relativeTime(props.timestamp)}</span>
        <span class="text-muted-foreground/50">{"\u2192"}</span>
        <Show
          when={props.jiraDueDate}
          fallback={<span class="italic">No due date</span>}
        >
          {(dueDate) => <span>{formatDueDate(dueDate())}</span>}
        </Show>
      </div>

      {/* Screenshot row */}
      <Show when={hasScreenshot()}>
        <div class="flex gap-1.5 mt-1.5">
          <Show when={props.hasElementScreenshot}>
            <img
              src={screenshotUrl(
                props.syncServerUrl!,
                props.syncWorkspace!,
                props.itemId,
                "element",
              )}
              alt="Element screenshot"
              class="w-[52px] h-[34px] object-cover border border-border rounded bg-foreground/[0.04]"
              loading="lazy"
            />
          </Show>
          <Show when={props.hasFullPageScreenshot}>
            <img
              src={screenshotUrl(
                props.syncServerUrl!,
                props.syncWorkspace!,
                props.itemId,
                "full",
              )}
              alt="Full page screenshot"
              class="w-[52px] h-[34px] object-cover border border-border rounded bg-foreground/[0.04]"
              loading="lazy"
            />
          </Show>
        </div>
      </Show>

      {/* Bottom meta row */}
      <div class="flex items-center gap-1.5 mt-1.5">
        <IssueTypeIcon issueType={props.jiraIssueType ?? undefined} />

        <Show
          when={props.jiraTicketId}
          fallback={
            <span class="font-mono text-[10px] text-muted-foreground italic">
              no ticket
            </span>
          }
        >
          <span class="font-mono text-[10px] text-muted-foreground">
            {props.jiraTicketId}
          </span>
        </Show>

        <span class="flex-1" />

        <PriorityIcon priority={props.jiraPriority ?? undefined} />

        <Show when={props.jiraAssignee}>
          <div class="flex items-center gap-1">
            <UserAvatar
              avatarUrl={props.jiraAssigneeAvatar}
              displayName={props.jiraAssignee ?? undefined}
              size={20}
            />
            <span class="text-[10px] text-muted-foreground">
              {props.jiraAssignee}
            </span>
          </div>
        </Show>
      </div>

      {/* Comments */}
      <Show when={props.onSubmitComment}>
        <CommentsSection
          comments={props.jiraComments ?? []}
          onSubmitComment={props.onSubmitComment!}
          onSearchUsers={props.onSearchUsers}
          onRefreshPoll={props.onRefreshStatus}
        />
      </Show>
    </div>
  );
};
```

**Note on SubmitCommentFn vs SubmitGroupCommentFn.** The sidebar uses `SubmitGroupCommentFn` (takes `groupId`). `SelectionCardBody` takes the already-bound `SubmitCommentFn` (no `groupId`) — the caller curries its group id. This matches what `CommentsSection` consumes today (see `components/jira-comments/comments-section.tsx`).

**Step 3: Verify compile**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors. If a generic type mismatch surfaces on `CommentsSection`'s `onSubmitComment`, verify against `packages/react-grab/src/components/jira-comments/types.ts` — the component takes a pre-bound submit fn.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/selection-card-body.tsx
git commit -m "feat(sidebar): extract SelectionCardBody component"
```

---

## Task 2: Refactor `SelectionListTab` to use `<SelectionCardBody>`

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/selection-list-tab.tsx:100-289`

**Step 1: Write the failing test — snapshot must not drift**

No new test file needed. The existing visual tests under `e2e/mocked/jira-selection-label-visual.spec.ts` and any sidebar-card spec act as our regression gate. Before refactoring, confirm the currently-committed snapshots match current output:

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium --grep "selection" -g
```

Expected: all selection-related tests pass. This is the "before" state.

**Step 2: Refactor — replace the inlined card body with `<SelectionCardBody>`**

In `packages/react-grab/src/components/sidebar/selection-list-tab.tsx`, replace the block starting at `{/* JIRA status pill — absolute top-right */}` (line ~145) through the closing of `DevInsights` (line ~280) with:

```tsx
<SelectionCardBody
  summary={summary()}
  timestamp={item.timestamp}
  itemId={item.id}
  hasElementScreenshot={Boolean(item.screenshotElement)}
  hasFullPageScreenshot={Boolean(item.screenshotFullPage)}
  syncServerUrl={props.syncServerUrl}
  syncWorkspace={props.syncWorkspace}
  jiraTicketId={group()?.jiraTicketId}
  jiraStatus={group()?.jiraStatus}
  jiraStatusCategory={group()?.jiraStatusCategory}
  jiraLabels={group()?.jiraLabels}
  jiraDueDate={group()?.jiraDueDate}
  jiraIssueType={group()?.jiraIssueType}
  jiraPriority={group()?.jiraPriority}
  jiraAssignee={group()?.jiraAssignee}
  jiraAssigneeAvatar={group()?.jiraAssigneeAvatar}
  jiraComments={group()?.jiraComments}
  onSubmitComment={
    props.onSubmitJiraComment && group()
      ? bindGroupCommentCallbacks(group()!.id, {
          onSubmitComment: props.onSubmitJiraComment,
          onSearchUsers: props.onSearchJiraUsers,
          onRefreshStatus: props.onRefreshJiraStatus,
        }).onSubmitComment
      : undefined
  }
  onSearchUsers={props.onSearchJiraUsers}
  onRefreshStatus={
    props.onRefreshJiraStatus && group()
      ? () => props.onRefreshJiraStatus?.(group()!.id)
      : undefined
  }
/>

{/* Dev insights (technical info) — stays outside SelectionCardBody, sidebar-only */}
<Show when={props.isDevMode}>
  <DevInsights
    tagName={item.tagName}
    componentName={item.componentName}
    content={item.content}
  />
</Show>
```

Add the import at the top: `import { SelectionCardBody } from "./selection-card-body.jsx";`

Remove now-unused imports: `relativeTime`, `IssueTypeIcon`, `PriorityIcon`, `UserAvatar`, `screenshotUrl`, `CommentsSection`, `bindGroupCommentCallbacks` — but only if they are no longer used elsewhere in the file. Check with a text search of the file before removing each one.

Also remove the now-dead local helpers: `getStatusPillClass`, `getStatusDisplayText`, `formatDueDate` — these are duplicated in `SelectionCardBody`. Leave `isFilterActive`, `applyFilters`, `groupMap`, `filteredItems`, `summary`, `isFlagged`, `hasTicket`, `isSelected` — they are still used by the outer list.

**Step 3: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors.

**Step 4: Run visual tests — snapshots must match**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium --grep @SPEC-010
```

Expected: all tests pass with **no** snapshot updates. If any snapshot drifts, inspect the diff — the refactor must be pixel-identical. Common drift causes: whitespace between elements, stale local helper no longer called, extra `<Show>` wrapping. Fix until snapshots match without `--update-snapshots`.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/sidebar/selection-list-tab.tsx
git commit -m "refactor(sidebar): consume SelectionCardBody in SelectionListTab"
```

---

## Task 3: Extend `JiraDisplayFields` with due-date / issue-type / priority

**Files:**
- Modify: `packages/react-grab/src/types.ts:475-510`

**Step 1: Add three fields to the interface**

In `packages/react-grab/src/types.ts`, append to `JiraDisplayFields`:

```ts
export interface JiraDisplayFields {
  groupStatus?: GroupStatus;
  jiraTicketId?: string;
  jiraUrl?: string;
  jiraStatusCategory?: string;
  jiraAssignee?: string | null;
  jiraReporter?: string | null;
  jiraAssigneeAvatar?: string | null;
  jiraReporterAvatar?: string | null;
  jiraLabels?: string[];
  jiraComments?: ReadonlyArray<JiraComment>;
  jiraFlagged?: boolean;
  jiraFlaggedAt?: string | null;
  jiraFlaggedBy?: string | null;
  jiraFlaggedByAvatar?: string | null;
  jiraPriority?: string | null;    // NEW
  jiraIssueType?: string | null;   // NEW
  jiraDueDate?: string | null;     // NEW
}
```

**Step 2: Add matching entries to `JIRA_DISPLAY_KEYS`**

```ts
export const JIRA_DISPLAY_KEYS = [
  "groupStatus",
  "jiraTicketId",
  "jiraUrl",
  "jiraStatusCategory",
  "jiraAssignee",
  "jiraReporter",
  "jiraAssigneeAvatar",
  "jiraReporterAvatar",
  "jiraLabels",
  "jiraComments",
  "jiraFlagged",
  "jiraFlaggedAt",
  "jiraFlaggedBy",
  "jiraFlaggedByAvatar",
  "jiraPriority",    // NEW
  "jiraIssueType",   // NEW
  "jiraDueDate",     // NEW
] as const satisfies readonly (keyof JiraDisplayFields)[];
```

**Step 3: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors. The `satisfies` clause will fail the compile if the array and interface get out of sync — this is the compile-time SSOT guard.

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add jiraPriority/jiraIssueType/jiraDueDate to JiraDisplayFields"
```

---

## Task 4: Extend `SelectionLabelInstance` with item-level fields

**Files:**
- Modify: `packages/react-grab/src/types.ts:512-535`

**Step 1: Add the four item-scoped fields**

```ts
export interface SelectionLabelInstance extends JiraDisplayFields {
  id: string;
  itemId?: string;
  selectionBounds: OverlayBounds;
  boundsMultiple?: OverlayBounds[];
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  status: SelectionLabelStatus;
  statusText?: string;
  isPromptMode?: boolean;
  inputValue?: string;
  createdAt: number;
  element?: Element;
  elements?: Element[];
  mouseX?: number;
  mouseXOffsetFromCenter?: number;
  mouseXOffsetRatio?: number;
  error?: string;
  hideArrow?: boolean;
  groupId?: string;
  // NEW — from backing CommentItem, used by <SelectionCardBody>
  commentText?: string;
  timestamp?: number;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;
}
```

All four are optional because session-based / primary-selection labels (no backing `itemId`) won't populate them — `SelectionCardBody` only renders when `jiraTicketId` is set, which implies a ticketed (and therefore persisted) selection.

**Step 2: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors. No consumers break — all new fields are optional.

**Step 3: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add item-level fields to SelectionLabelInstance"
```

---

## Task 5: Extend `SelectionLabelProps` with matching fields

**Files:**
- Modify: `packages/react-grab/src/types.ts:748-813`

**Step 1: Add props to `SelectionLabelProps`**

The interface already extends `JiraDisplayFields` via the base, so `jiraPriority`/`jiraIssueType`/`jiraDueDate` are free. Add the item-level fields explicitly:

```ts
export interface SelectionLabelProps
  extends Pick<
    SelectionGroupsViewProps,
    "groups" | "activeGroupId" | "onActiveGroupChange" | "onAddGroup"
  >,
    JiraDisplayFields {
  tagName?: string;
  componentName?: string;
  elementsCount?: number;
  // ... existing props ...

  // NEW — from backing CommentItem, passed through to <SelectionCardBody>
  itemId?: string;
  commentText?: string;
  timestamp?: number;
  hasElementScreenshot?: boolean;
  hasFullPageScreenshot?: boolean;
  syncServerUrl?: string;
  syncWorkspace?: string;
}
```

Place the new props in a coherent group near the other item-id / selection-related props. `syncServerUrl` / `syncWorkspace` are new to this interface — they come from the renderer's outer props.

**Step 2: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add item/sync fields to SelectionLabelProps"
```

---

## Task 6: Populate new fields when building `SelectionLabelInstance`

**Files:**
- Modify: `packages/react-grab/src/core/store.ts` (search for where `SelectionLabelInstance` objects are created from `CommentItem`s; likely named something like `labelFromItem`, `toSelectionLabel`, or inline in a factory)

**Step 1: Locate the builder**

```bash
grep -n "SelectionLabelInstance" packages/react-grab/src/core/store.ts packages/react-grab/src/core/index.tsx
```

Identify the function(s) that construct a `SelectionLabelInstance` from a `CommentItem` + `SelectionGroupWithJira`. There may be one canonical builder or multiple inline spots — inventory all of them before editing.

**Step 2: Populate the item-level fields**

For each call site that builds from a `CommentItem`, add:

```ts
// After existing fields...
commentText: item.commentText,
timestamp: item.timestamp,
hasElementScreenshot: Boolean(item.screenshotElement),
hasFullPageScreenshot: Boolean(item.screenshotFullPage),
```

For each call site that merges `SelectionGroupWithJira` into the instance, ensure the three new JIRA fields flow through (if the merge spreads all keys via `JIRA_DISPLAY_KEYS` or `pickJiraFields`, no code change needed — verify). If the merge hand-picks keys, add:

```ts
jiraPriority: group.jiraPriority,
jiraIssueType: group.jiraIssueType,
jiraDueDate: group.jiraDueDate,
```

**Step 3: Typecheck + targeted tests**

```bash
pnpm --filter react-grab typecheck
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium --grep @SPEC-010
```

Expected: typecheck clean, all SPEC-010 tests pass (no behavior change yet — label still renders the old way).

**Step 4: Commit**

```bash
git add packages/react-grab/src/core/store.ts  # and any other modified files
git commit -m "feat(core): populate item/jira fields on SelectionLabelInstance"
```

---

## Task 7: Plumb new fields through the renderer's persistent-instance call site

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx:226-290` (the third `<SelectionLabel>` block, wrapping persisted instances)

**Step 1: Add the new props in the existing JIRA-field block**

```tsx
<SelectionLabel
  tagName={instance().tagName}
  componentName={instance().componentName}
  // ... existing props ...
  jiraTicketId={instance().jiraTicketId}
  jiraUrl={instance().jiraUrl}
  jiraStatusCategory={instance().jiraStatusCategory}
  jiraAssignee={instance().jiraAssignee}
  jiraReporter={instance().jiraReporter}
  jiraAssigneeAvatar={instance().jiraAssigneeAvatar}
  jiraReporterAvatar={instance().jiraReporterAvatar}
  jiraLabels={instance().jiraLabels}
  jiraComments={instance().jiraComments}
  jiraFlagged={instance().jiraFlagged}
  jiraFlaggedAt={instance().jiraFlaggedAt}
  jiraFlaggedBy={instance().jiraFlaggedBy}
  jiraFlaggedByAvatar={instance().jiraFlaggedByAvatar}
  // NEW
  jiraPriority={instance().jiraPriority}
  jiraIssueType={instance().jiraIssueType}
  jiraDueDate={instance().jiraDueDate}
  itemId={instance().itemId}
  commentText={instance().commentText}
  timestamp={instance().timestamp}
  hasElementScreenshot={instance().hasElementScreenshot}
  hasFullPageScreenshot={instance().hasFullPageScreenshot}
  syncServerUrl={props.syncServerUrl}
  syncWorkspace={props.syncWorkspace}
  // ... existing handlers ...
/>
```

`props.syncServerUrl` / `props.syncWorkspace` should already be on `ReactGrabRendererProps`. Grep to confirm:

```bash
grep -n "syncServerUrl" packages/react-grab/src/components/renderer.tsx packages/react-grab/src/types.ts
```

If the renderer doesn't receive them, trace back through the component chain (`core/index.tsx` → `Sidebar` passes them) and add them to `ReactGrabRendererProps`.

**Step 2: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors.

**Step 3: Run the label test — still no visual change expected yet**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium
```

Expected: pass. The label component itself hasn't changed to consume these props yet — next task does that.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx packages/react-grab/src/types.ts
git commit -m "feat(renderer): thread item/jira fields to SelectionLabel"
```

---

## Task 8: Render `<SelectionCardBody>` inside the expanded/ticketed label

**Files:**
- Modify: `packages/react-grab/src/components/selection-label/index.tsx:779-786` (the `<Show when={props.onSubmitJiraComment || (props.jiraComments?.length ?? 0) > 0}>` block)
- Modify: `packages/react-grab/src/components/selection-label/index.tsx:712-727` (the `<Show when={props.jiraTicketId}>` block rendering `JiraMeta`)

**Step 1: Replace `<JiraMeta>` + bare `<CommentsSection>` with `<SelectionCardBody>`**

Inside the `canInteract() && props.isPromptMode && !props.isPendingDismiss` block, within `<BottomSection>`, locate:

```tsx
<Show when={props.jiraTicketId}>
  {(ticketId) => (
    <JiraMeta
      jiraTicketId={ticketId()}
      jiraUrl={props.jiraUrl}
      jiraAssignee={props.jiraAssignee}
      jiraReporter={props.jiraReporter}
      jiraAssigneeAvatar={props.jiraAssigneeAvatar}
      jiraReporterAvatar={props.jiraReporterAvatar}
      jiraStatus={props.groupStatus}
      labels={props.jiraLabels}
    />
  )}
</Show>
```

And further down:

```tsx
<Show when={props.onSubmitJiraComment || (props.jiraComments?.length ?? 0) > 0}>
  <CommentsSection
    comments={props.jiraComments ?? []}
    onSubmitComment={props.onSubmitJiraComment ?? (async () => ({ id: "", created: "" }))}
    onSearchUsers={props.onSearchJiraUsers}
    onRefreshPoll={() => props.onRefreshJiraStatus?.()}
  />
</Show>
```

Replace **both** blocks with a single `<Show when={props.jiraTicketId && props.itemId && props.timestamp !== undefined}>` that renders `<SelectionCardBody>`:

```tsx
<Show
  when={
    props.jiraTicketId &&
    props.itemId &&
    props.timestamp !== undefined
  }
>
  <SelectionCardBody
    summary={
      props.commentText ??
      props.componentName ??
      props.tagName ??
      ""
    }
    timestamp={props.timestamp!}
    itemId={props.itemId!}
    hasElementScreenshot={props.hasElementScreenshot}
    hasFullPageScreenshot={props.hasFullPageScreenshot}
    syncServerUrl={props.syncServerUrl}
    syncWorkspace={props.syncWorkspace}
    jiraTicketId={props.jiraTicketId}
    jiraStatus={props.groupStatus}
    jiraStatusCategory={props.jiraStatusCategory}
    jiraLabels={props.jiraLabels}
    jiraDueDate={props.jiraDueDate}
    jiraIssueType={props.jiraIssueType}
    jiraPriority={props.jiraPriority}
    jiraAssignee={props.jiraAssignee}
    jiraAssigneeAvatar={props.jiraAssigneeAvatar}
    jiraComments={props.jiraComments}
    onSubmitComment={props.onSubmitJiraComment}
    onSearchUsers={props.onSearchJiraUsers}
    onRefreshStatus={
      props.onRefreshJiraStatus
        ? () => props.onRefreshJiraStatus?.()
        : undefined
    }
  />
</Show>
```

Preserve the existing `ReplyToPrompt` + input textarea + submit button below this block — those are prompt-mode UI, unrelated to ticket display.

Add the import: `import { SelectionCardBody } from "../sidebar/selection-card-body.jsx";`

**Step 2: Remove the now-unused `<JiraMeta>` and `<CommentsSection>` imports from this file**

Check they aren't referenced elsewhere in `index.tsx`, then delete:

```ts
import { JiraMeta } from './jira-meta.js';
import { CommentsSection } from '../jira-comments/comments-section.js';
```

**Step 3: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors.

**Step 4: Run the label spec (expect snapshot drift — visual IS changing here)**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium
```

Expected: **fail** on snapshot mismatch for the ticketed-label screenshots — this is the intended change. Note which tests fail; next task updates them.

**Step 5: Commit (test-failing commit is OK here; next task fixes snapshots)**

```bash
git add packages/react-grab/src/components/selection-label/index.tsx
git commit -m "feat(selection-label): render SelectionCardBody for ticketed selections"
```

---

## Task 9: Update visual snapshots for the label

**Files:**
- Modify: `packages/react-grab/e2e/mocked/jira-selection-label-visual.spec.ts-snapshots/*.png`

**Step 1: Review which tests changed**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium
```

Open the HTML report to visually inspect each diff:

```bash
pnpm --filter react-grab exec playwright show-report
```

For each failing test, confirm the diff matches intent: the label should now show the full card (status pill, summary, labels, date row, screenshots, meta row, comments) instead of the old `JiraMeta` one-liner.

**Step 2: Update snapshots only if the diff looks correct**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium --update-snapshots
```

**Do not run with `--update-snapshots` blindly.** Every updated snapshot is a design-approved change — spot-check each one in the report before committing.

**Step 3: Re-run without updating to confirm green**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/jira-selection-label-visual.spec.ts --project=chromium
```

Expected: all pass.

**Step 4: Commit**

```bash
git add packages/react-grab/e2e/mocked/jira-selection-label-visual.spec.ts-snapshots/
git commit -m "test(jira-selection-label): update snapshots for new card layout"
```

---

## Task 10: Delete the now-dead `JiraMeta` component

**Files:**
- Delete: `packages/react-grab/src/components/selection-label/jira-meta.tsx`

**Step 1: Confirm no remaining references**

```bash
grep -r "jira-meta\|JiraMeta" packages/react-grab/src packages/react-grab/e2e
```

Expected: 0 matches (or only a match inside `jira-meta.tsx` itself).

If anything else references `JiraMeta`, **stop** and fix the caller first. Don't delete something still in use.

**Step 2: Delete the file**

```bash
rm packages/react-grab/src/components/selection-label/jira-meta.tsx
```

**Step 3: Typecheck**

```bash
pnpm --filter react-grab typecheck
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add -u packages/react-grab/src/components/selection-label/jira-meta.tsx
git commit -m "refactor(selection-label): remove JiraMeta (replaced by SelectionCardBody)"
```

---

## Task 11: Full targeted test pass + lint

**Files:** none — verification only.

**Step 1: Run all three tagged specs**

```bash
pnpm --filter react-grab exec playwright test --project=chromium --grep "@SPEC-004|@SPEC-010|@SPEC-013"
```

Expected: all pass. If any fail, triage the specific failure. Do not run the full suite locally — too slow (see user memory `feedback_never_run_all_tests.md`).

**Step 2: Lint + typecheck gates**

```bash
pnpm typecheck && pnpm lint
```

Expected: 0 errors on both.

**Step 3: Format (only if it modifies files)**

```bash
pnpm format
git status
```

If `git status` shows modifications, stage + commit:

```bash
git add -u
git commit -m "chore: oxfmt on touched files"
```

---

## Task 12: Sidebar sanity check — ensure the refactor is pixel-identical there

**Files:** none — verification only.

**Step 1: Run any sidebar card tests**

```bash
pnpm --filter react-grab exec playwright test e2e/mocked/ --project=chromium --grep "sidebar"
```

Expected: all pass with no snapshot changes (Task 2 already verified this, but re-run as a final sanity gate).

If snapshots drift, **do not** update them blindly — the refactor was supposed to be behavior-preserving. Investigate root cause.

---

## Task 13: Final PR

**Files:** none — handoff to the user.

**Step 1: Push the branch**

```bash
git push -u origin feat/selection-label-stats-bar-parity
```

**Step 2: Open a PR with gh**

```bash
gh pr create --title "feat(selection-label): stats-bar card parity with sidebar" --body "$(cat <<'EOF'
## Summary
- Extract the sidebar stats-bar card body into `<SelectionCardBody>` (shared by sidebar + selection label)
- Expanded/ticketed selection label now renders the same 7-row card: status pill, summary, labels, date range, screenshots, meta row, comments
- Add `jiraPriority`/`jiraIssueType`/`jiraDueDate` to `JiraDisplayFields` (SSOT for JIRA display) and item-level fields (`commentText`, `timestamp`, screenshot flags) to `SelectionLabelInstance`
- Remove the now-dead `JiraMeta` component

## Design
See `docs/plans/2026-04-16-selection-label-stats-bar-parity-design.md` and `poc-selection-label.html` (option 1 — full parity).

## Test plan
- [x] `@SPEC-004` passes
- [x] `@SPEC-010` passes (snapshots updated for the new label layout — reviewed in HTML report)
- [x] `@SPEC-013` passes
- [x] Sidebar snapshots unchanged (refactor is behavior-preserving)
- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Post-execution checklist

- [ ] All tasks 1-13 committed
- [ ] Branch pushed
- [ ] PR opened
- [ ] SPEC-004, SPEC-010, SPEC-013 green in CI
- [ ] No `// HACK:` comments added
- [ ] No `as` casts added (per repo style guide)
- [ ] No new dependencies

## Rollback

```bash
git checkout main
git branch -D feat/selection-label-stats-bar-parity
```

No data migration, no schema change, no feature flag — straight revert if needed.
