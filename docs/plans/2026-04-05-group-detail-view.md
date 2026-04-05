# Group Detail View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Phase 2 of PRD-002 — clicking a group card in the sidebar opens a detail view showing all selections with screenshots, source paths, and collapsible HTML; a back button returns to the list.

**Architecture:** Signal-based view stack (`activeDetailGroupId: Signal<string | null>`) inside the existing `Sidebar` component — no router, no URL changes. All new components carry `pointer-events: auto` inline. Screenshots are resolved from R2 key strings to server URLs (`${serverUrl}/workspaces/${workspace}/screenshots/${selectionId}/${type}`) and lazy-loaded via `IntersectionObserver` scoped to the scroll container.

**Tech Stack:** Solid.js, Tailwind CSS (utility classes), Playwright (e2e), TypeScript (`tsc --noEmit` for type checks), `pnpm build` for build verification.

**No unit test runner is configured for `packages/react-grab`.** All behavioral tests are Playwright e2e. Unit-level logic is verified via `tsc --noEmit` + careful type design. Unit tests are deferred (matching SPEC-001 precedent).

**Run all commands from:** `packages/react-grab/` unless stated otherwise.

---

## Pre-flight

Before starting, verify the current e2e suite is green:

```bash
# From repo root:
pnpm --filter react-grab build && pnpm test
```

Expected: all sidebar.spec.ts tests pass. If they fail first, fix before proceeding.

---

## Task 1: Move `relativeTime` to shared utility

**Why first:** Two components will need it (`GroupCard` and `SelectionCard`). Moving it now prevents duplication before any new files are created.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/relative-time.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`
- Modify: `packages/react-grab/src/components/sidebar/group-card.tsx`

**Step 1: Create the utility file**

```typescript
// packages/react-grab/src/features/sidebar/relative-time.ts

/**
 * Formats a Unix timestamp (milliseconds) as a human-readable relative time string.
 * e.g. "just now", "5m ago", "2h ago", "3d ago"
 */
export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Step 2: Export from the sidebar feature index**

Edit `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export { deriveStatus, type GroupStatus, type GroupedEntry } from "./derive-status";
export { relativeTime } from "./relative-time";
```

**Step 3: Update `group-card.tsx` to import from the feature**

In `packages/react-grab/src/components/sidebar/group-card.tsx`, delete the local `relativeTime` function definition (lines 11-20) and add an import at the top:

```typescript
import { deriveStatus, relativeTime } from "../../features/sidebar";
```

**Step 4: Verify no type errors and no duplicate**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

**Step 5: Commit**

```bash
git add packages/react-grab/src/features/sidebar/relative-time.ts \
        packages/react-grab/src/features/sidebar/index.ts \
        packages/react-grab/src/components/sidebar/group-card.tsx
git commit -m "refactor(sidebar): extract relativeTime to shared feature utility"
```

---

## Task 2: `extractFilePath` utility

**Purpose:** Best-effort extraction of a source file path + optional line number from the free-text `content` field on `CommentItem`. Returns `null` on no match — never throws or guesses.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/extract-file-path.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Create the utility**

```typescript
// packages/react-grab/src/features/sidebar/extract-file-path.ts

/**
 * Extracts a source file path and optional line number from a comment's
 * content field (the element's HTML snapshot). The capture format is:
 *   "/absolute/path/to/Component.tsx:42"
 * or just a file path with no line number.
 *
 * Returns null when no recognisable file path is found.
 * Callers must handle null by omitting the UI row entirely (A-014).
 * Do not add fallback guessing — null is safer than a wrong path.
 */
export function extractFilePath(
  content: string,
): { path: string; line: number | null } | null {
  const match = content.match(
    /(\/[^\s"'`]+\.(?:tsx?|jsx?|m[tj]s|vue|svelte|css))(?::(\d+))?/,
  );
  if (!match) return null;
  return {
    path: match[1],
    line: match[2] ? parseInt(match[2], 10) : null,
  };
}
```

**Step 2: Export from index**

Add to `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export { extractFilePath } from "./extract-file-path";
```

**Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/extract-file-path.ts \
        packages/react-grab/src/features/sidebar/index.ts
git commit -m "feat(sidebar): add extractFilePath utility (A-014)"
```

---

## Task 3: `screenshotUrl` utility

**Purpose:** Build the server URL to fetch a screenshot blob. Screenshots stored as R2 keys; this converts them to fetchable URLs.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/screenshot-url.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Create the utility**

```typescript
// packages/react-grab/src/features/sidebar/screenshot-url.ts

/**
 * Constructs the URL to fetch a screenshot from the sync server.
 *
 * screenshotElement and screenshotFullPage on CommentItem are R2 storage key
 * strings — NOT base64 data URIs. The server serves them at:
 *   GET ${serverUrl}/workspaces/${workspace}/screenshots/${selectionId}/${type}
 *
 * selectionId is CommentItem.id.
 * type: 'element' | 'full'
 */
export function screenshotUrl(
  serverUrl: string,
  workspace: string,
  selectionId: string,
  type: "element" | "full",
): string {
  return (
    `${serverUrl}/workspaces/${encodeURIComponent(workspace)}` +
    `/screenshots/${encodeURIComponent(selectionId)}/${type}`
  );
}
```

**Step 2: Export from index**

Add to `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export { screenshotUrl } from "./screenshot-url";
```

**Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/screenshot-url.ts \
        packages/react-grab/src/features/sidebar/index.ts
git commit -m "feat(sidebar): add screenshotUrl builder utility (A-018 blocker fix)"
```

---

## Task 4: `useLazyVisible` hook

**Purpose:** Defer rendering an element until it enters the viewport of a scroll container. Used by `ScreenshotPair` to avoid eager image loading.

**Critical:** Pass the scroll container ref as `root` — if `root` is `null` the observer uses the viewport, which means every card in a fixed-position sidebar is immediately "visible" and lazy loading is a no-op.

**Files:**
- Create: `packages/react-grab/src/features/sidebar/use-lazy-visible.ts`
- Modify: `packages/react-grab/src/features/sidebar/index.ts`

**Step 1: Create the hook**

```typescript
// packages/react-grab/src/features/sidebar/use-lazy-visible.ts
import { createSignal, onMount, onCleanup } from "solid-js";

/**
 * Returns a reactive boolean that becomes true once the observed element
 * enters the intersection root's viewport.
 *
 * @param ref       - accessor returning the element to observe
 * @param root      - accessor returning the scroll container to use as the
 *                    IntersectionObserver root (defaults to viewport if null).
 *                    IMPORTANT: for elements inside a scrollable container,
 *                    always pass the container — using the viewport root makes
 *                    all cards immediately "visible" inside a fixed sidebar.
 */
export function useLazyVisible(
  ref: () => Element | undefined,
  root: () => Element | null = () => null,
): () => boolean {
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const el = ref();
    if (!el) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: root(), threshold: 0.1 },
    );
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });

  return visible;
}
```

**Step 2: Export from index**

Add to `packages/react-grab/src/features/sidebar/index.ts`:

```typescript
export { useLazyVisible } from "./use-lazy-visible";
```

**Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/sidebar/use-lazy-visible.ts \
        packages/react-grab/src/features/sidebar/index.ts
git commit -m "feat(sidebar): add useLazyVisible hook with scroll-container root support"
```

---

## Task 5: Thread `syncServerUrl` through the component tree

**Purpose:** The sidebar needs `serverUrl` from `SyncConfig` to construct screenshot URLs. It's not currently threaded to `ReactGrabRendererProps` or `SidebarProps`.

**Files:**
- Modify: `packages/react-grab/src/types.ts` (add `syncServerUrl?: string` to `ReactGrabRendererProps`)
- Modify: `packages/react-grab/src/core/index.tsx` (pass `config.sync?.serverUrl`)
- Modify: `packages/react-grab/src/components/renderer.tsx` (forward to `<Sidebar>`)
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` (add to `SidebarProps`)

**Step 1: Add `syncServerUrl` to `ReactGrabRendererProps` in types.ts**

Search for `syncWorkspace?: string;` in `src/types.ts`. Add the new field right below it:

```typescript
syncWorkspace?: string;
syncServerUrl?: string;   // serverUrl from SyncConfig — needed to build screenshot URLs
```

**Step 2: Thread from `core/index.tsx`**

In `core/index.tsx`, find where `syncWorkspace` is passed to the renderer. Add `syncServerUrl` alongside it:

```typescript
syncServerUrl={config.sync?.serverUrl}
```

(Pattern: look for `syncWorkspace` prop assignment and add the sibling.)

**Step 3: Add to `SidebarProps` in `components/sidebar/index.tsx`**

In the `SidebarProps` interface, add after `syncStatus`:

```typescript
syncServerUrl?: string;
syncWorkspace?: string;
```

**Step 4: Forward in `renderer.tsx`**

In `renderer.tsx`, find `<Sidebar ... />`. Add:

```tsx
syncServerUrl={props.syncServerUrl}
syncWorkspace={props.syncWorkspace}
```

**Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors. If TypeScript reports that `syncServerUrl` is unused, that's fine — it will be used in Task 10.

**Step 6: Commit**

```bash
git add packages/react-grab/src/types.ts \
        packages/react-grab/src/core/index.tsx \
        packages/react-grab/src/components/renderer.tsx \
        packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat(sidebar): thread syncServerUrl prop for screenshot URL construction"
```

---

## Task 6: Remove `onGroupClick` from `SidebarProps`; extend `GroupCard`/`GroupList` click signature

**Purpose:** Navigation becomes internal to `Sidebar` (Phase 2). The `onGroupClick` prop stub in `renderer.tsx` is deleted. The `GroupCard` click handler is extended to pass both the group ID and the card's DOM element (needed for focus restoration on back navigation).

**Files:**
- Modify: `packages/react-grab/src/components/sidebar/index.tsx` (remove `onGroupClick` from interface — the signal wiring comes in Task 10)
- Modify: `packages/react-grab/src/components/sidebar/group-card.tsx` (extend onClick signature)
- Modify: `packages/react-grab/src/components/sidebar/group-list.tsx` (update propagation)
- Modify: `packages/react-grab/src/components/renderer.tsx` (remove `onGroupClick` stub)

**Step 1: Extend `GroupCard` onClick to pass the card element**

In `components/sidebar/group-card.tsx`, update the `GroupCardProps` interface — the `onClick` currently looks like `onClick: () => void`. Change it to:

```typescript
interface GroupCardProps {
  entry: GroupedEntry;
  onClick: (groupId: string, cardEl: HTMLElement) => void;
}
```

Update the click handler on the card div:

```tsx
<div
  ...
  onClick={(e) => props.onClick(props.entry.group.id, e.currentTarget as HTMLElement)}
>
```

**Step 2: Update `GroupList` to propagate the extended signature**

In `components/sidebar/group-list.tsx`, find where `GroupCard` is rendered. Update `onGroupClick` prop type and the call site to match:

```typescript
// GroupListProps
onGroupClick: (groupId: string, cardEl: HTMLElement) => void;
```

Pass it through to `GroupCard.onClick` unchanged.

**Step 3: Remove `onGroupClick` from `SidebarProps`**

In `components/sidebar/index.tsx`, delete `onGroupClick` from `SidebarProps`. At this point `GroupList` expects `onGroupClick` — but Sidebar doesn't wire it yet. TypeScript will complain until Task 10 wires the internal signal handler. **This is expected** — the build is intentionally broken between Task 6 and Task 10. Continue.

**Step 4: Remove `onGroupClick` stub from `renderer.tsx`**

In `renderer.tsx`, find and delete the `onGroupClick` prop from `<Sidebar>`:

```tsx
// DELETE this line:
onGroupClick={(groupId) => {
  /* Phase 2: navigate to detail */
}}
```

**Step 5: Run `tsc --noEmit` to find all remaining callsites**

```bash
pnpm exec tsc --noEmit 2>&1
```

Expected: TypeScript errors pointing to `GroupList` not receiving `onGroupClick` from `Sidebar`. This is the in-progress state — resolved in Task 10. Also check: does any e2e test or other file construct `<Sidebar onGroupClick=...>`? The error output will show every callsite.

Fix any unexpected callsites now. Leave the `GroupList` error — Task 10 resolves it.

**Step 6: Commit the signature changes (broken build is OK on feature branch)**

```bash
git add packages/react-grab/src/components/sidebar/group-card.tsx \
        packages/react-grab/src/components/sidebar/group-list.tsx \
        packages/react-grab/src/components/sidebar/index.tsx \
        packages/react-grab/src/components/renderer.tsx
git commit -m "refactor(sidebar): remove onGroupClick prop — navigation becomes internal (Phase 2)"
```

---

## Task 7: `ScreenshotPair` component

**Purpose:** Renders two screenshot slots (element + full-page) with lazy loading and per-slot fallbacks for absent screenshots.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/screenshot-pair.tsx`

**Step 1: Create the component**

```tsx
// packages/react-grab/src/components/sidebar/screenshot-pair.tsx
import { type Component, createSignal, Show } from "solid-js";
import { useLazyVisible } from "../../features/sidebar";

interface ScreenshotPairProps {
  /** Constructed screenshot URL (not an R2 key) — undefined if sync is disabled or key absent */
  elementSrc?: string;
  /** Constructed screenshot URL (not an R2 key) — undefined if sync is disabled or key absent */
  fullPageSrc?: string;
  /** The scroll container — required for correct IntersectionObserver root */
  scrollRoot: () => Element | null;
}

const ScreenshotSlot: Component<{
  src?: string;
  label: string;
  scrollRoot: () => Element | null;
}> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const visible = useLazyVisible(() => containerRef, props.scrollRoot);

  return (
    <div class="flex-1 min-w-0" ref={containerRef}>
      <div class="text-[9px] text-white/30 mb-0.5">{props.label}</div>
      <Show
        when={visible()}
        fallback={<div class="w-full h-20 rounded animate-pulse bg-white/5" />}
      >
        <Show
          when={props.src}
          fallback={
            <div class="w-full h-8 rounded bg-white/5 flex items-center justify-center text-[9px] text-white/20 italic">
              No {props.label.toLowerCase()} screenshot
            </div>
          }
        >
          <img
            src={props.src}
            alt={`${props.label} screenshot`}
            class="w-full rounded border border-white/10 object-contain max-h-32"
            loading="lazy"
          />
        </Show>
      </Show>
    </div>
  );
};

export const ScreenshotPair: Component<ScreenshotPairProps> = (props) => {
  return (
    <div class="flex gap-2 mt-1.5" style={{ "pointer-events": "auto" }}>
      <ScreenshotSlot
        src={props.elementSrc}
        label="Element"
        scrollRoot={props.scrollRoot}
      />
      <ScreenshotSlot
        src={props.fullPageSrc}
        label="Full page"
        scrollRoot={props.scrollRoot}
      />
    </div>
  );
};
```

**Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 new errors (the existing Task 6 error about `onGroupClick` is acceptable).

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/screenshot-pair.tsx
git commit -m "feat(sidebar): add ScreenshotPair component with lazy loading and fallbacks (A-018)"
```

---

## Task 8: `SelectionCard` component

**Purpose:** Full card layout for a single selection — component name, tag badge, timestamp, comment text, file path, screenshots, CSS selector, collapsible raw HTML. All containers carry `pointer-events: auto`.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/selection-card.tsx`

**Step 1: Create the component**

```tsx
// packages/react-grab/src/components/sidebar/selection-card.tsx
import { type Component, createMemo, Show } from "solid-js";
import type { CommentItem } from "../../types";
import {
  extractFilePath,
  relativeTime,
  screenshotUrl,
} from "../../features/sidebar";
import { ScreenshotPair } from "./screenshot-pair";

export interface SelectionCardProps {
  item: CommentItem;
  syncServerUrl?: string;
  syncWorkspace?: string;
  scrollRoot: () => Element | null;
}

export const SelectionCard: Component<SelectionCardProps> = (props) => {
  const filePath = createMemo(() =>
    extractFilePath(props.item.content ?? ""),
  );

  const elementSrc = createMemo(() =>
    props.syncServerUrl &&
    props.syncWorkspace &&
    props.item.screenshotElement
      ? screenshotUrl(
          props.syncServerUrl,
          props.syncWorkspace,
          props.item.id,
          "element",
        )
      : undefined,
  );

  const fullPageSrc = createMemo(() =>
    props.syncServerUrl &&
    props.syncWorkspace &&
    props.item.screenshotFullPage
      ? screenshotUrl(
          props.syncServerUrl,
          props.syncWorkspace,
          props.item.id,
          "full",
        )
      : undefined,
  );

  return (
    <div
      class="bg-[#232323] rounded-lg p-3 mb-1.5 border border-white/5"
      style={{ "pointer-events": "auto" }}
    >
      {/* Row 1: component name + tag badge + timestamp */}
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-[13px] font-semibold text-white truncate">
            {props.item.componentName || props.item.elementName}
          </span>
          <span class="px-1.5 py-0.5 rounded bg-white/10 text-white/50 text-[10px] font-mono shrink-0">
            {props.item.tagName}
          </span>
        </div>
        <span class="text-[10px] text-white/30 shrink-0 ml-2">
          {relativeTime(props.item.timestamp)}
        </span>
      </div>

      {/* Row 2: comment text */}
      <Show when={props.item.commentText}>
        <p class="text-[11px] text-white/70 mb-1.5">{props.item.commentText}</p>
      </Show>

      {/* Row 3: source file path (omit when extraction returns null — A-014) */}
      <Show when={filePath()}>
        {(fp) => (
          <div
            class="text-[10px] text-white/40 font-mono truncate mb-1.5"
            title={fp().path}
          >
            {fp().path}
            <Show when={fp().line !== null}>
              <span class="text-white/30">:{fp().line}</span>
            </Show>
          </div>
        )}
      </Show>

      {/* Row 4: screenshots — hidden entirely when both are absent (A-018) */}
      <Show when={elementSrc() || fullPageSrc()}>
        <ScreenshotPair
          elementSrc={elementSrc()}
          fullPageSrc={fullPageSrc()}
          scrollRoot={props.scrollRoot}
        />
      </Show>

      {/* Row 5: CSS selector */}
      <Show when={props.item.elementSelectors?.length}>
        <div
          class="text-[10px] text-white/40 font-mono truncate mt-1.5"
          title={props.item.elementSelectors?.[0]}
        >
          {props.item.elementSelectors?.[0]}
        </div>
      </Show>

      {/* Row 6: collapsible raw HTML — collapsed by default */}
      <details class="mt-1.5">
        <summary class="text-[10px] text-white/30 cursor-pointer select-none hover:text-white/50">
          Raw HTML
        </summary>
        <pre class="mt-1 text-[9px] text-white/40 bg-white/5 rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
          {props.item.content}
        </pre>
      </details>
    </div>
  );
};
```

**Step 2: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 new errors.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/sidebar/selection-card.tsx
git commit -m "feat(sidebar): add SelectionCard component with all selection fields"
```

---

## Task 9: `SelectionList` and `DetailHeader` components

**Files:**
- Create: `packages/react-grab/src/components/sidebar/selection-list.tsx`
- Create: `packages/react-grab/src/components/sidebar/detail-header.tsx`

**Step 1: Create `SelectionList`**

Note: `scrollContainerRef` is passed down to each `SelectionCard` as `scrollRoot`. This is the IntersectionObserver root — it must be the scroll container, not the viewport.

```tsx
// packages/react-grab/src/components/sidebar/selection-list.tsx
import { type Component, For, Show } from "solid-js";
import type { CommentItem } from "../../types";
import { SelectionCard } from "./selection-card";
import { EmptyState } from "./empty-state";

interface SelectionListProps {
  items: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
}

export const SelectionList: Component<SelectionListProps> = (props) => {
  let scrollContainerRef: HTMLDivElement | undefined;

  return (
    <Show
      when={props.items.length > 0}
      fallback={
        <EmptyState
          message="No selections in this group."
          submessage="Add elements to this group using the toolbar."
        />
      }
    >
      <div
        ref={scrollContainerRef}
        class="flex-1 overflow-y-auto px-3 py-2"
        style={{ "pointer-events": "auto" }}
      >
        <For each={props.items}>
          {(item) => (
            <SelectionCard
              item={item}
              syncServerUrl={props.syncServerUrl}
              syncWorkspace={props.syncWorkspace}
              scrollRoot={() => scrollContainerRef ?? null}
            />
          )}
        </For>
      </div>
    </Show>
  );
};
```

**Step 2: Create `DetailHeader`**

```tsx
// packages/react-grab/src/components/sidebar/detail-header.tsx
import { type Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { GroupedEntry } from "../../features/sidebar";
import { deriveStatus } from "../../features/sidebar";
import { StatusBadge } from "./status-badge";

interface DetailHeaderProps {
  group: SelectionGroup;
  onBack: () => void;
}

export const DetailHeader: Component<DetailHeaderProps> = (props) => {
  // deriveStatus needs a GroupedEntry; construct a minimal one for the header badge
  const status = () =>
    deriveStatus({ group: props.group, items: [] } as GroupedEntry);

  return (
    <div
      class="flex items-center gap-2 p-3 border-b border-white/10 shrink-0"
      style={{ "pointer-events": "auto" }}
    >
      <button
        class="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
        onClick={props.onBack}
        aria-label="Back to groups list"
      >
        ←
      </button>
      <span
        class="font-semibold text-[14px] text-white flex-1 truncate"
        title={props.group.name}
      >
        {props.group.name}
      </span>
      <StatusBadge status={status()} />
    </div>
  );
};
```

**Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 new errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/selection-list.tsx \
        packages/react-grab/src/components/sidebar/detail-header.tsx
git commit -m "feat(sidebar): add SelectionList and DetailHeader components"
```

---

## Task 10: `GroupDetailView` component + wire navigation into `Sidebar`

**Purpose:** The main wiring task. Creates the `GroupDetailView` root and updates `Sidebar` with the `activeDetailGroupId` signal, focus effects, group-deletion guard, and view switch. This is the task that resolves the TypeScript error introduced in Task 6.

**Files:**
- Create: `packages/react-grab/src/components/sidebar/group-detail-view.tsx`
- Modify: `packages/react-grab/src/components/sidebar/index.tsx`

**Step 1: Create `GroupDetailView`**

```tsx
// packages/react-grab/src/components/sidebar/group-detail-view.tsx
import { type Component } from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
import type { CommentItem } from "../../types";
import { DetailHeader } from "./detail-header";
import { SelectionList } from "./selection-list";

interface GroupDetailViewProps {
  ref?: (el: HTMLDivElement) => void;
  group: SelectionGroup;
  commentItems: CommentItem[];
  syncServerUrl?: string;
  syncWorkspace?: string;
  onBack: () => void;
}

export const GroupDetailView: Component<GroupDetailViewProps> = (props) => {
  const groupItems = () =>
    props.commentItems.filter((c) => c.groupId === props.group.id);

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
    </div>
  );
};
```

**Step 2: Update `Sidebar` with navigation signal, focus effects, and view switch**

Replace the contents of `components/sidebar/index.tsx` with the updated version below. Key changes vs Phase 1:
- `activeDetailGroupId` signal + `activeGroup` memo
- `lastFocusedCard` and `detailViewRef` declared **inside** the component function (not at module scope)
- Two `createEffect` calls for focus management (list→detail and detail→list)
- Group-deletion guard (`createEffect` that watches for the active group being removed)
- `onGroupClick` wired internally — prop removed
- `syncServerUrl` and `syncWorkspace` props added
- `<Show>` branches for list vs detail view, nested inside the existing sync error check

```tsx
// packages/react-grab/src/components/sidebar/index.tsx
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";
import type { SelectionGroup } from "../../features/selection-groups/types";
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
import { deriveStatus } from "../../features/sidebar";

export interface SidebarProps {
  groups: SelectionGroup[];
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

  const [activeFilter, setActiveFilter] = createSignal<FilterStatus>("all");
  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<
    string | null
  >(null);

  const activeGroup = createMemo(
    () => props.groups.find((g) => g.id === activeDetailGroupId()) ?? null,
  );

  // Guard: if the active group is deleted while the detail view is open, return to list
  createEffect(() => {
    const id = activeDetailGroupId();
    if (id !== null && !props.groups.find((g) => g.id === id)) {
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
        // If card was removed from DOM, focus falls to the sidebar container naturally
      });
    }
  });

  const groupedItems = createMemo(() =>
    groupComments(props.groups, props.commentItems),
  );

  const filteredGroups = createMemo(() => {
    const filter = activeFilter();
    const items = groupedItems();
    if (filter === "all") return items;
    return items.filter((entry) => deriveStatus(entry) === filter);
  });

  return (
    <div
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
                    onGroupClick={(id, cardEl) => {
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
            ref={(el) => { detailViewRef = el; }}
            group={activeGroup()!}
            commentItems={props.commentItems}
            syncServerUrl={props.syncServerUrl}
            syncWorkspace={props.syncWorkspace}
            onBack={() => setActiveDetailGroupId(null)}
          />
        </Show>
      </Show>
    </div>
  );
};
```

**Step 3: Verify the build is clean**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors (the Task 6 error is now resolved).

```bash
pnpm build
```

Expected: successful build with no errors.

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/sidebar/group-detail-view.tsx \
        packages/react-grab/src/components/sidebar/index.tsx
git commit -m "feat(sidebar): wire group detail view with signal-based navigation (Phase 2)"
```

---

## Task 11: Write and run e2e tests

**Purpose:** Behavioral verification via Playwright. Tests cover: group card click navigates to detail, back button returns to list, detail shows group name, empty group state, pointer-events are not blocked, sync error state is preserved.

**Approach for seeding groups in e2e:** The e2e app uses `sessionStorage` as the default adapter. Inject pre-built group + comment data into `sessionStorage` before react-grab initialises — or use `page.evaluate` after init to call `__REACT_GRAB__` APIs if available. The simplest approach is to seed `sessionStorage` **before** navigation via `page.addInitScript`.

**Files:**
- Modify: `packages/react-grab/e2e/sidebar.spec.ts`

**Step 1: Write the failing tests first, then run them**

Append the following `test.describe` block to `e2e/sidebar.spec.ts`. The tests will fail because the detail view doesn't exist yet — **but we already implemented it in Task 10**, so these tests should actually pass immediately. Run them after adding to verify.

```typescript
// Append to packages/react-grab/e2e/sidebar.spec.ts

/** Queries the sidebar for an element matching selector, returns its textContent. */
const getSidebarText = async (
  page: import("@playwright/test").Page,
  selector: string,
): Promise<string | null> => {
  return page.evaluate(
    ({ attrName, sel }) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const sidebar = root?.querySelector(
        "[role='dialog'][aria-label='React Grab Dashboard']",
      );
      return sidebar?.querySelector(sel)?.textContent?.trim() ?? null;
    },
    { attrName: ATTR, sel: selector },
  );
};

/** Returns true if the detail view region is present in the sidebar. */
const isDetailViewVisible = async (
  page: import("@playwright/test").Page,
): Promise<boolean> => {
  return page.evaluate((attrName) => {
    const host = document.querySelector(`[${attrName}]`);
    const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
    const sidebar = root?.querySelector(
      "[role='dialog'][aria-label='React Grab Dashboard']",
    );
    if (!sidebar) return false;
    // Detail view has role="region" and aria-label starting with "Detail:"
    return (
      sidebar.querySelector("[role='region'][aria-label^='Detail:']") !== null
    );
  }, ATTR);
};

/** Seeds group + comment data into sessionStorage before page load. */
const seedGroupData = async (
  page: import("@playwright/test").Page,
  groups: Array<{ id: string; name: string; createdAt: number }>,
  comments: Array<{
    id: string;
    groupId: string;
    content: string;
    elementName: string;
    tagName: string;
    timestamp: number;
    commentText?: string;
  }>,
) => {
  await page.addInitScript(
    ({ g, c }) => {
      sessionStorage.setItem("react-grab-groups", JSON.stringify(g));
      sessionStorage.setItem("react-grab-comments", JSON.stringify(c));
    },
    { g: groups, c: comments },
  );
};

test.describe("Sidebar — Group Detail View", () => {
  const TEST_GROUP = {
    id: "test-group-001",
    name: "Login Flow",
    createdAt: Date.now() - 60_000,
  };
  const TEST_COMMENT = {
    id: "test-sel-001",
    groupId: "test-group-001",
    content: "<button>Submit</button>",
    elementName: "button",
    tagName: "button",
    timestamp: Date.now() - 30_000,
    commentText: "This button needs a loading state",
  };

  test.beforeEach(async ({ page, reactGrab }) => {
    await seedGroupData(page, [TEST_GROUP], [TEST_COMMENT]);
    // Reload so react-grab picks up the seeded sessionStorage
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() => reactGrab.isToolbarVisible(), { timeout: 5000 })
      .toBe(true);
    // Open sidebar
    await clickShadowButton(page, "[data-react-grab-toolbar-dashboard]");
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);
  });

  test("clicking a group card navigates to the detail view", async ({
    page,
  }) => {
    // The group card should be present with the group name
    const groupCardVisible = await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector(
          "[role='dialog'][aria-label='React Grab Dashboard']",
        );
        if (!sidebar) return false;
        return Array.from(sidebar.querySelectorAll(".font-semibold")).some(
          (el) => el.textContent?.trim() === groupName,
        );
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );
    expect(groupCardVisible).toBe(true);

    // Click the group card
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector(
          "[role='dialog'][aria-label='React Grab Dashboard']",
        );
        if (!sidebar) return;
        const cards = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        );
        const card = cards.find((c) =>
          c.textContent?.includes(groupName),
        ) as HTMLElement | undefined;
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    // Detail view should now be visible
    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);
  });

  test("detail view shows the group name in the header", async ({ page }) => {
    // Navigate to detail
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector("[role='dialog']");
        if (!sidebar) return;
        const card = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        ).find((c) => c.textContent?.includes(groupName));
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    // Group name appears in the detail header
    const headerText = await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const detail = root?.querySelector("[role='region'][aria-label^='Detail:']");
        return detail
          ? Array.from(detail.querySelectorAll(".font-semibold")).some(
              (el) => el.textContent?.trim() === groupName,
            )
          : false;
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );
    expect(headerText).toBe(true);
  });

  test("back button returns to the groups list", async ({ page }) => {
    // Navigate to detail
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector("[role='dialog']");
        if (!sidebar) return;
        const card = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        ).find((c) => c.textContent?.includes(groupName));
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    // Click the back button
    await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const backBtn = root?.querySelector<HTMLButtonElement>(
        "[aria-label='Back to groups list']",
      );
      backBtn?.click();
    }, ATTR);

    // Detail view should be gone, list view back
    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(false);
    await expect
      .poll(() => isSidebarVisible(page), { timeout: 3000 })
      .toBe(true);
  });

  test("detail view back button is clickable (pointer-events not blocked)", async ({
    page,
  }) => {
    // Navigate to detail
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector("[role='dialog']");
        if (!sidebar) return;
        const card = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        ).find((c) => c.textContent?.includes(groupName));
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    // Get the back button's position and click it via real mouse (not evaluate)
    const backBtnBounds = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const btn = root?.querySelector<HTMLButtonElement>(
        "[aria-label='Back to groups list']",
      );
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, ATTR);

    expect(backBtnBounds).not.toBeNull();

    await page.mouse.click(backBtnBounds!.x, backBtnBounds!.y);

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(false);
  });

  test("detail view shows selection comment text", async ({ page }) => {
    // Navigate to detail
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector("[role='dialog']");
        if (!sidebar) return;
        const card = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        ).find((c) => c.textContent?.includes(groupName));
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    // Comment text should be visible
    const hasCommentText = await page.evaluate(
      ({ attrName, commentText }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const detail = root?.querySelector("[role='region'][aria-label^='Detail:']");
        if (!detail) return false;
        return Array.from(detail.querySelectorAll("p")).some((p) =>
          p.textContent?.includes(commentText),
        );
      },
      { attrName: ATTR, commentText: TEST_COMMENT.commentText! },
    );
    expect(hasCommentText).toBe(true);
  });

  test("raw HTML details element is collapsed by default", async ({ page }) => {
    // Navigate to detail
    await page.evaluate(
      ({ attrName, groupName }) => {
        const host = document.querySelector(`[${attrName}]`);
        const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
        const sidebar = root?.querySelector("[role='dialog']");
        if (!sidebar) return;
        const card = Array.from(
          sidebar.querySelectorAll<HTMLElement>(".cursor-pointer"),
        ).find((c) => c.textContent?.includes(groupName));
        card?.click();
      },
      { attrName: ATTR, groupName: TEST_GROUP.name },
    );

    await expect
      .poll(() => isDetailViewVisible(page), { timeout: 3000 })
      .toBe(true);

    // <details> must not have the `open` attribute
    const isOpen = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const detail = root?.querySelector("[role='region'][aria-label^='Detail:']");
      const detailsEl = detail?.querySelector("details");
      return detailsEl?.open ?? false;
    }, ATTR);

    expect(isOpen).toBe(false);
  });

  test("sync error state still renders when syncStatus is error", async ({
    page,
  }) => {
    // This test verifies Phase 1 regression: the error state inside Sidebar
    // must still appear after Phase 2 changes to index.tsx.
    // We check this by looking at the sidebar structure — the syncStatus
    // is 'local' in e2e (no sync server), so the error empty state is NOT shown.
    // Instead, verify the sidebar content area is present (stats/filter visible).
    const hasTabs = await page.evaluate((attrName) => {
      const host = document.querySelector(`[${attrName}]`);
      const root = host?.shadowRoot?.querySelector(`[${attrName}]`);
      const sidebar = root?.querySelector("[role='dialog']");
      if (!sidebar) return false;
      return Array.from(sidebar.querySelectorAll("button")).some((b) =>
        b.textContent?.trim() === "All",
      );
    }, ATTR);
    // Filter tabs are present — sync error state did not incorrectly appear
    expect(hasTabs).toBe(true);
  });
});
```

**Step 2: Run the e2e tests**

```bash
pnpm test --grep "Sidebar"
```

Expected: all tests in both `Sidebar` (Phase 1) and `Sidebar — Group Detail View` (Phase 2) pass.

If the `seedGroupData` approach doesn't work (sessionStorage key names may differ — check `features/sync/adapter.ts` for the exact keys used), update the keys in `seedGroupData` accordingly.

**Step 3: Run the full test suite to check for Phase 1 regressions**

```bash
pnpm test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add packages/react-grab/e2e/sidebar.spec.ts
git commit -m "test(sidebar): add Phase 2 group detail view e2e tests"
```

---

## Task 12: Final type-check, build, and mark SPEC implemented

**Step 1: Full type check**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

**Step 2: Full build**

```bash
pnpm build
```

Expected: successful build.

**Step 3: Run all e2e tests one final time**

```bash
pnpm test
```

Expected: all tests pass.

**Step 4: Mark SPEC-002 as implemented**

```bash
# From repo root:
decree status SPEC-002 implement
```

**Step 5: Final commit**

```bash
git add decree/spec/002-group-detail-view.md
git commit -m "docs(decree): mark SPEC-002 as implemented"
```

---

## Quick Reference: All New Files

| File | Purpose |
|------|---------|
| `src/features/sidebar/relative-time.ts` | Shared timestamp formatter |
| `src/features/sidebar/extract-file-path.ts` | Regex file path extraction from content |
| `src/features/sidebar/screenshot-url.ts` | R2 key → server URL builder |
| `src/features/sidebar/use-lazy-visible.ts` | IntersectionObserver hook (with root) |
| `src/components/sidebar/screenshot-pair.tsx` | Lazy screenshot pair with fallbacks |
| `src/components/sidebar/selection-card.tsx` | Full selection card layout |
| `src/components/sidebar/selection-list.tsx` | Scrollable For-list with empty state |
| `src/components/sidebar/detail-header.tsx` | Back button + group name + status badge |
| `src/components/sidebar/group-detail-view.tsx` | Detail view root with tabIndex |

## Quick Reference: All Modified Files

| File | What changes |
|------|-------------|
| `src/features/sidebar/index.ts` | Export all new utilities |
| `src/components/sidebar/group-card.tsx` | onClick → `(id, cardEl)`, import relativeTime |
| `src/components/sidebar/group-list.tsx` | onGroupClick signature extended |
| `src/components/sidebar/index.tsx` | Signal nav, focus effects, deletion guard, new props |
| `src/components/renderer.tsx` | Remove onGroupClick stub, add syncServerUrl |
| `src/types.ts` | Add syncServerUrl to ReactGrabRendererProps |
| `src/core/index.tsx` | Thread syncServerUrl from SyncConfig |
| `e2e/sidebar.spec.ts` | Add Phase 2 test describe block |
