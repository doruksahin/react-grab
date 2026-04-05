---
date: '2026-04-05'
references:
- PRD-002
- ADR-0002
- SPEC-001
status: implemented
---

# SPEC-002 Group Detail View

## Overview

Implement Phase 2 of PRD-002: a group detail view that renders inside the sidebar shell built in SPEC-001. When a user clicks a group card in the groups list, the sidebar transitions in-place to the detail view, showing every selection in that group with its component name, HTML tag, comment text, source file path and line number (extracted from the `content` field), relative timestamp, element and full-page screenshot thumbnails, CSS selector, and collapsible raw HTML. A back button returns to the groups list.

This SPEC resolves R-003 (navigation mechanism) by committing to a signal-based view stack — no router, no URL changes. It explicitly specifies `pointer-events: auto` on all new interactive containers (the lesson learned from the Phase 1 bug), defines screenshot URL construction (screenshots are R2 storage keys, not data URIs — Issue 1), the fallback behavior for missing screenshots (A-018), the regex-based file path extraction strategy and its failure mode (A-014), focus management across view transitions (A-019), and the correct IntersectionObserver `root` for a scrollable container (Issue 6). Phase 3 (JIRA integration) and Phase 4 (focus trapping) remain out of scope.

## Technical Design

### Navigation: Signal-Based View Stack (R-003 resolved)

The sidebar uses a single `activeDetailGroupId` signal to switch between the list view and the detail view. There is no router, no URL mutation, and no browser history entry. The signal lives inside the `Sidebar` component — the smallest scope that needs it.

**Decision rationale (R-003):** A router would add bundle weight and URL side-effects to a script injected into third-party host pages. There are no cross-sidebar deep-link requirements in Phase 2. A show/hide toggle was rejected because it would mount the detail view for every group simultaneously, wasting memory. A signal-based view stack (mount one view, unmount the other) is the minimal correct solution.

```typescript
// In Sidebar (components/sidebar/index.tsx) — added in Phase 2
const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<string | null>(null);

const activeGroup = createMemo(() =>
  props.groups.find(g => g.id === activeDetailGroupId()) ?? null
);
```

The groups list is shown when `activeDetailGroupId() === null`. The detail view is shown when it is non-null. Both branches are wrapped inside the existing `syncStatus !== "error"` guard from Phase 1 — that guard must not be removed. Full JSX structure (Issue 7 — preserve error state):

```tsx
<Show
  when={props.syncStatus !== "error"}
  fallback={
    <EmptyState
      message="Could not connect to sync server."
      action={{ label: "Retry", onClick: () => { /* Phase 2: retry sync */ } }}
    />
  }
>
  <Show
    when={activeDetailGroupId() !== null}
    fallback={
      <>
        <StatsBar groupedItems={groupedItems()} />
        <FilterTabs activeFilter={activeFilter()} onFilterChange={setActiveFilter} />
        <Show when={props.groups.length > 0} fallback={<EmptyState ... />}>
          <Show when={filteredGroups().length > 0} fallback={<EmptyState ... />}>
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
      ref={detailViewRef}
      group={activeGroup()!}
      commentItems={props.commentItems}
      syncServerUrl={props.syncServerUrl}
      syncWorkspace={props.syncWorkspace}
      onBack={() => setActiveDetailGroupId(null)}
    />
  </Show>
</Show>
```

`activeGroup()!` is safe inside the `<Show when={activeDetailGroupId() !== null}>` branch — the signal is non-null when this branch renders. Solid does not narrow memo types, so the non-null assertion is intentional and documented here.

**Group deletion while detail is open:** If the active group is deleted from `props.groups` while the detail view is open, `activeGroup()` returns `null` and the `<Show>` condition (`activeDetailGroupId() !== null`) remains true, but `activeGroup()!` would be `null` — a runtime crash. Guard against this in `Sidebar`:

```typescript
createEffect(() => {
  const id = activeDetailGroupId();
  if (id !== null && !props.groups.find(g => g.id === id)) {
    // Group was deleted while viewing its detail — return to list silently
    setActiveDetailGroupId(null);
  }
});
```

The `onGroupClick` callback in `renderer.tsx` had a stub comment `/* Phase 2: navigate to detail */`. Navigation is now **internal** to `Sidebar` — `renderer.tsx` no longer passes `onGroupClick`. The `SidebarProps.onGroupClick` prop is **removed** (it was `required`, so this is a breaking change — see the test audit AC).

### Component Tree

```
Sidebar
├── SidebarHeader                              (unchanged from Phase 1)
├── [syncStatus === "error"] EmptyState        (unchanged from Phase 1)
└── [syncStatus !== "error"]
    ├── [activeDetailGroupId === null]
    │   ├── StatsBar                           (unchanged)
    │   ├── FilterTabs                         (unchanged)
    │   └── GroupList                          (onGroupClick signature extended — see below)
    │       └── GroupCard (repeated)           (onClick receives event — see Focus Management)
    └── [activeDetailGroupId !== null]
        └── GroupDetailView                    NEW
            ├── DetailHeader                   NEW — back button, group name, status badge
            └── SelectionList                  NEW — scrollable container, pointer-events: auto
                └── SelectionCard (repeated)   NEW
                    ├── ComponentName + TagBadge
                    ├── CommentText            (hidden when empty)
                    ├── FilePathLine           (hidden when extraction fails — A-014)
                    ├── RelativeTimestamp
                    ├── ScreenshotPair         NEW — lazy-loaded, both labeled, fallbacks
                    │   ├── ElementSlot        (<img> or "No element screenshot")
                    │   └── FullPageSlot       (<img> or "No full-page screenshot")
                    ├── CssSelector            (monospace, first selector only)
                    └── RawHtmlCollapsible     <details>/<summary>, collapsed by default
```

### Z-Index and Pointer-Events Contract

The detail view replaces the groups list inside the same sidebar container. No new z-index layers are introduced. All new container elements — without exception — must declare `pointer-events: auto` inline. This is the Phase 1 lesson: the Shadow DOM host sets `pointer-events: none` on itself (`mount-root.ts:39`), and every component must explicitly opt in.

**Rule:** Every `<div>` or `<ul>` wrapper introduced by this feature that wraps interactive children must carry `style={{ "pointer-events": "auto" }}`. Leaf interactive elements (`<button>`, `<a>`, `<details>`, `<summary>`, `<img>`) are covered once an ancestor opts in, but explicitly adding the declaration to containers is required for defensibility.

Affected new components with required declarations:

| Component | Element | `pointer-events: auto` required |
|---|---|---|
| `GroupDetailView` | root `<div>` | yes |
| `DetailHeader` | root `<div>` | yes |
| `SelectionList` | scroll container `<div>` | yes |
| `SelectionCard` | root `<div>` | yes |
| `ScreenshotPair` | flex row container `<div>` | yes |

`GroupDetailView` container:

```tsx
<div
  tabIndex={-1}
  ref={props.ref}
  class="flex flex-col flex-1 overflow-hidden"
  style={{ "pointer-events": "auto" }}
  aria-label={`Detail: ${props.group.name}`}
  role="region"
>
```

`SelectionList` scroll container:

```tsx
<div
  ref={scrollContainerRef}
  class="flex-1 overflow-y-auto px-3 py-2"
  style={{ "pointer-events": "auto" }}
>
  <For each={props.items}>{(item) => <SelectionCard item={item} ... />}</For>
</div>
```

`ScreenshotPair` container:

```tsx
<div class="flex gap-2 mt-1.5" style={{ "pointer-events": "auto" }}>
  {/* ElementSlot */}
  {/* FullPageSlot */}
</div>
```

`SelectionCard` root:

```tsx
<div
  class="bg-[#232323] rounded-lg p-3 mb-1.5 border border-white/5"
  style={{ "pointer-events": "auto" }}
>
```

### Focus Management on View Transitions (A-019)

Shadow DOM focus APIs work correctly for open shadow roots — `event.composedPath()` traverses open roots, and `tabIndex` / `focus()` work on elements inside the shadow tree.

**Instance-scoped state (Issue 3):** `lastFocusedCard` and `detailViewRef` are declared as `let` variables inside the `Sidebar` component function body — **not** at module scope. Module-level `let` would be shared across all `Sidebar` instances in the same JS module (a risk in micro-frontend environments). Declaring inside the component closure scopes them to each instance:

```typescript
export const Sidebar: Component<SidebarProps> = (props) => {
  // instance-scoped — not shared between Sidebar instances
  let lastFocusedCard: HTMLElement | undefined;
  let detailViewRef: HTMLDivElement | undefined;

  const [activeDetailGroupId, setActiveDetailGroupId] = createSignal<string | null>(null);

  createEffect(() => {
    if (activeDetailGroupId() !== null) {
      queueMicrotask(() => detailViewRef?.focus());
    } else if (lastFocusedCard) {
      queueMicrotask(() => {
        if (lastFocusedCard?.isConnected) {
          lastFocusedCard.focus();
        } else {
          // Card no longer in DOM — fall back to sidebar container
          detailViewRef?.closest('[aria-label="React Grab Dashboard"]')?.focus();
        }
      });
    }
  });
  // ...
};
```

`queueMicrotask` is already used in this codebase (`freeze-updates.ts`, `selection-label/index.tsx`) — safe to use here.

**List → Detail:** User clicks a `GroupCard`. The `GroupCard.onClick` callback receives the `MouseEvent` and stores `e.currentTarget` before calling the handler. The `GroupCard` `onClick` prop type changes from `() => void` to `(groupId: string, cardEl: HTMLElement) => void` (Issue 3 — event parameter fix):

```tsx
// group-card.tsx — onClick handler
<div
  ...
  onClick={(e) => props.onClick(props.entry.group.id, e.currentTarget as HTMLElement)}
>
```

```typescript
// group-list.tsx — propagates the card element up
onGroupClick={(id, cardEl) => {
  lastFocusedCard = cardEl;
  setActiveDetailGroupId(id);
}}
```

**Detail → List:** Back button calls `setActiveDetailGroupId(null)`. The `createEffect` above fires and restores focus to `lastFocusedCard` (with DOM connectivity check).

### Screenshot URL Construction (Issue 1 — Blocker resolved)

`screenshotElement` and `screenshotFullPage` on `ServerCommentItem` are **R2 storage key strings** (e.g. `"workspaces/abc/selections/xyz/element"`), not base64 data URIs. This is documented in `src/generated/sync-api.ts:48-51`. The sync-server exposes screenshots via:

```
GET ${serverUrl}/workspaces/${workspace}/screenshots/${selectionId}/${type}
```

The generated `getGetScreenshotUrl` function in `sync-api.ts:525-532` constructs this URL. The sidebar reuses the same pattern directly rather than calling the generated function (the generated function requires workspace ID from the path context, which is the same as the sync workspace name):

```typescript
// features/sidebar/screenshot-url.ts — NEW
/**
 * Builds the URL to fetch a screenshot from the sync server.
 * selectionId is the CommentItem.id.
 * type: 'element' or 'full'.
 *
 * Returns null if serverUrl or workspace is absent (sync is disabled).
 * The <img src> is only set when this returns non-null.
 */
export function screenshotUrl(
  serverUrl: string,
  workspace: string,
  selectionId: string,
  type: 'element' | 'full',
): string {
  return `${serverUrl}/workspaces/${encodeURIComponent(workspace)}/screenshots/${encodeURIComponent(selectionId)}/${type}`;
}
```

The sidebar receives `syncServerUrl` and `syncWorkspace` as new props. These are already available in `renderer.tsx` via `props.syncWorkspace` (already passed to Toolbar) and `props.syncServerUrl` (new — thread from `SyncConfig.serverUrl` in `core/index.tsx`).

**New `SidebarProps` fields:**

```typescript
export interface SidebarProps {
  groups: SelectionGroup[];
  commentItems: CommentItem[];
  syncStatus: SyncStatus;
  syncServerUrl?: string;   // NEW — needed to construct screenshot URLs
  syncWorkspace?: string;   // NEW — already on ReactGrabRendererProps
  onClose: () => void;
  // onGroupClick REMOVED — navigation is now internal
}
```

**`ReactGrabRendererProps` addition:** `syncServerUrl?: string` — threaded from `core/index.tsx` using `config.sync?.serverUrl`.

**Lazy loading:** `<img src>` is not set until the card enters the viewport. The browser makes a GET request to the screenshot endpoint only when the `src` attribute is present — so deferring `src` prevents eager loading of all screenshots at mount time. The `IntersectionObserver` approach replaces the `src` being absent with the skeleton, then sets it on viewport entry.

### Screenshot Handling (A-018)

`screenshotElement` and `screenshotFullPage` are both `string | undefined`. Either or both may be absent. The UI handles all four combinations:

| `screenshotElement` | `screenshotFullPage` | Rendered |
|---|---|---|
| present | present | Both slots with `<img>` |
| present | absent | Element `<img>` + "No full-page screenshot" label |
| absent | present | "No element screenshot" label + Full-page `<img>` |
| absent | absent | `ScreenshotPair` hidden entirely |

### Lazy Loading via IntersectionObserver (Issue 6 — root fix)

The `SelectionList` is a scrollable container (`overflow-y: auto`, fixed height within the sidebar). Every selection card is within the viewport (the sidebar is fixed-position and full-height), so using the **viewport** as the `IntersectionObserver` root would make all cards immediately "visible" — defeating lazy loading. The root must be the scroll container itself.

**`useLazyVisible` hook signature** — accepts an optional `root` (the scroll container):

```typescript
// features/sidebar/use-lazy-visible.ts — NEW
import { createSignal, onMount, onCleanup } from "solid-js";

export function useLazyVisible(
  ref: () => Element | undefined,
  root: () => Element | null = () => null,
): () => boolean {
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const el = ref();
    if (!el) { setVisible(true); return; }

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

In `SelectionCard`, the scroll container ref is passed down from `SelectionList`:

```tsx
// selection-list.tsx
let scrollContainerRef: HTMLDivElement | undefined;

<div ref={scrollContainerRef} class="flex-1 overflow-y-auto px-3 py-2" style={{ "pointer-events": "auto" }}>
  <For each={props.items}>
    {(item) => (
      <SelectionCard
        item={item}
        scrollRoot={() => scrollContainerRef ?? null}
        ...
      />
    )}
  </For>
</div>
```

In `SelectionCard`, `ScreenshotPair` uses `useLazyVisible` with the scroll root:

```tsx
// screenshot-pair.tsx
const [containerRef, setContainerRef] = createSignal<Element | undefined>();
const visible = useLazyVisible(() => containerRef(), props.scrollRoot);
```

### Collapsible Raw HTML (Issue 5 — max-height note, Issue 10 — CSS reset)

Uses native `<details>`/`<summary>` — no JavaScript required, browser-native toggle.

**CSS reset:** Verify the shadow root stylesheet does not override `<details>` display behavior. If a global `* { display: block }` or similar reset is present, add `details { display: block } summary { display: list-item; cursor: pointer }` to the shadow root styles. The existing Tailwind reset used in this project does not break `<details>` — no action expected, but verify before shipping.

**Content length:** `content` is an HTML snapshot and may be large. `overflow-x: auto` on the `<pre>` handles horizontal overflow. Add `max-height: 200px; overflow-y: auto` to prevent a single card from dominating the scroll list. This is accepted as the Phase 2 behavior; Phase 3+ may add a "show more" affordance.

```tsx
<details class="mt-1.5">
  <summary class="text-[10px] text-white/30 cursor-pointer select-none hover:text-white/50">
    Raw HTML
  </summary>
  <pre class="mt-1 text-[9px] text-white/40 bg-white/5 rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
    {props.item.content}
  </pre>
</details>
```

### Source File Path Extraction (A-014)

The `content` field on `ServerCommentItem` is free-text (the element's HTML snapshot). It may contain a source file path and line number written by react-grab's capture mechanism — but this is not guaranteed. Extraction is **best-effort**: if the regex finds no match, the UI omits the file path row entirely. Do not show a broken or empty element.

**New utility:** `features/sidebar/extract-file-path.ts`

```typescript
/**
 * Extracts a source file path and optional line number from a comment's
 * content field.
 *
 * Returns null if the content does not contain a recognisable file path.
 * Callers must handle null gracefully — omit the UI row entirely.
 *
 * A-014: This extraction is regex-based and may be brittle. If the content
 * format changes, update this function. Never guess on a failed match.
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

### `relativeTime` Shared Utility (Issue 9)

`relativeTime` is currently defined at module scope in `components/sidebar/group-card.tsx`. `SelectionCard` also needs it. Move it to a shared location rather than duplicating:

```
features/sidebar/relative-time.ts   # NEW — move from group-card.tsx
```

Both `group-card.tsx` and `selection-card.tsx` import from there:

```typescript
import { relativeTime } from "../../features/sidebar/relative-time";
```

### SelectionCard Full Layout

```tsx
const filePath = createMemo(() => extractFilePath(props.item.content ?? ""));
const screenshotEl = () => props.syncServerUrl && props.syncWorkspace && props.item.screenshotElement
  ? screenshotUrl(props.syncServerUrl, props.syncWorkspace, props.item.id, 'element')
  : undefined;
const screenshotFull = () => props.syncServerUrl && props.syncWorkspace && props.item.screenshotFullPage
  ? screenshotUrl(props.syncServerUrl, props.syncWorkspace, props.item.id, 'full')
  : undefined;

<div class="bg-[#232323] rounded-lg p-3 mb-1.5 border border-white/5"
     style={{ "pointer-events": "auto" }}>

  {/* Row 1: component name + tag badge + timestamp */}
  <div class="flex items-center justify-between mb-1.5">
    <div class="flex items-center gap-1.5">
      <span class="text-[13px] font-semibold text-white">
        {props.item.componentName || props.item.elementName}
      </span>
      <span class="px-1.5 py-0.5 rounded bg-white/10 text-white/50 text-[10px] font-mono">
        {props.item.tagName}
      </span>
    </div>
    <span class="text-[10px] text-white/30">{relativeTime(props.item.timestamp)}</span>
  </div>

  {/* Row 2: comment text */}
  <Show when={props.item.commentText}>
    <p class="text-[11px] text-white/70 mb-1.5">{props.item.commentText}</p>
  </Show>

  {/* Row 3: source file path */}
  <Show when={filePath()}>
    {(fp) => (
      <div class="text-[10px] text-white/40 font-mono truncate mb-1.5" title={fp().path}>
        {fp().path}
        <Show when={fp().line !== null}>
          <span class="text-white/30">:{fp().line}</span>
        </Show>
      </div>
    )}
  </Show>

  {/* Row 4: screenshots (lazy, labeled, fallbacks) */}
  <Show when={screenshotEl() || screenshotFull()}>
    <ScreenshotPair
      elementSrc={screenshotEl()}
      fullPageSrc={screenshotFull()}
      scrollRoot={props.scrollRoot}
    />
  </Show>

  {/* Row 5: CSS selector */}
  <Show when={props.item.elementSelectors?.length}>
    <div class="text-[10px] text-white/40 font-mono truncate mt-1.5"
         title={props.item.elementSelectors?.[0]}>
      {props.item.elementSelectors?.[0]}
    </div>
  </Show>

  {/* Row 6: collapsible raw HTML */}
  <details class="mt-1.5">
    <summary class="text-[10px] text-white/30 cursor-pointer select-none hover:text-white/50">
      Raw HTML
    </summary>
    <pre class="mt-1 text-[9px] text-white/40 bg-white/5 rounded p-2 overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
      {props.item.content}
    </pre>
  </details>
</div>
```

### DetailHeader Component

```tsx
<div class="flex items-center gap-2 p-3 border-b border-white/10 shrink-0"
     style={{ "pointer-events": "auto" }}>
  <button
    class="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
    onClick={props.onBack}
    aria-label="Back to groups list"
  >
    ←
  </button>
  <span class="font-semibold text-[14px] text-white flex-1 truncate" title={props.group.name}>
    {props.group.name}
  </span>
  <StatusBadge status={deriveStatus({ group: props.group, items: [] })} />
</div>
```

### File Structure

```
packages/react-grab/src/
├── features/
│   └── sidebar/
│       ├── derive-status.ts          # Phase 1 — unchanged
│       ├── extract-file-path.ts      # NEW: extractFilePath()
│       ├── relative-time.ts          # NEW: relativeTime() — moved from group-card.tsx
│       ├── screenshot-url.ts         # NEW: screenshotUrl() builder
│       ├── use-lazy-visible.ts       # NEW: IntersectionObserver hook (accepts root)
│       └── index.ts                  # Updated: export all new utilities
├── components/
│   └── sidebar/
│       ├── index.tsx                 # Modified: activeDetailGroupId, createEffect×2, group-deletion guard, remove onGroupClick prop
│       ├── group-card.tsx            # Modified: onClick receives (groupId, cardEl), import relativeTime from features
│       ├── group-list.tsx            # Modified: onGroupClick signature extended to (id, cardEl)
│       ├── group-detail-view.tsx     # NEW: detail root (tabIndex, ref, aria, pointer-events)
│       ├── detail-header.tsx         # NEW: back button, name, status badge
│       ├── selection-list.tsx        # NEW: scrollable For-list, exposes scrollContainerRef
│       ├── selection-card.tsx        # NEW: full card layout
│       └── screenshot-pair.tsx      # NEW: lazy screenshot pair with fallbacks
```

**Modified files summary:**
- `components/sidebar/index.tsx` — add `activeDetailGroupId`, `lastFocusedCard` (instance-scoped), `detailViewRef`, two `createEffect` calls (focus), group-deletion guard, view switch `<Show>`, remove `onGroupClick` from `SidebarProps`; add `syncServerUrl` and `syncWorkspace` props
- `components/sidebar/group-card.tsx` — extend `onClick` to `(groupId: string, cardEl: HTMLElement) => void`; import `relativeTime` from `features/sidebar/relative-time`
- `components/sidebar/group-list.tsx` — propagate extended `onGroupClick` signature
- `features/sidebar/index.ts` — export `extractFilePath`, `relativeTime`, `screenshotUrl`, `useLazyVisible`
- `renderer.tsx` — remove `onGroupClick` stub; add `syncServerUrl={props.syncServerUrl}` to `<Sidebar>`; add `syncServerUrl?: string` to `ReactGrabRendererProps`
- `core/index.tsx` — thread `syncServerUrl: config.sync?.serverUrl` to renderer props
- **Test files** — any test that directly constructs `<Sidebar onGroupClick={...}>` must remove the `onGroupClick` prop; run `tsc --noEmit` to find all callsites

## Testing Strategy

### Unit Tests

**`extractFilePath` (features/sidebar/extract-file-path.ts):**
- Extracts path + line from `"/src/components/Foo.tsx:42 extra text"` → `{ path: "/src/components/Foo.tsx", line: 42 }`
- Extracts path with no line from `"/src/components/Foo.tsx"` → `{ path: "/src/components/Foo.tsx", line: null }`
- Returns null for empty string
- Returns null for content with no file pattern (e.g. `"Some comment text"`)
- Returns null for CSS selector strings (e.g. `".my-class > div"`)
- Matches `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.svelte` — does not match `.md` or `.json`
- Does not throw on `undefined` input (caller guards with `?? ""`)

**`screenshotUrl` (features/sidebar/screenshot-url.ts):**
- Builds `${serverUrl}/workspaces/${encodeURIComponent(workspace)}/screenshots/${encodeURIComponent(selectionId)}/element` for type `'element'`
- Builds `…/full` for type `'full'`
- URL-encodes workspace names containing spaces or special characters

**`useLazyVisible` (features/sidebar/use-lazy-visible.ts):**
- Returns `false` before IntersectionObserver fires
- Returns `true` after a simulated intersection entry with `isIntersecting: true`
- Disconnects observer on component cleanup (no leak)
- Accepts `root: () => Element | null` and passes it to `IntersectionObserver({ root })`
- When `root()` returns an element outside the viewport, cards outside the root bounds are not marked visible

**`relativeTime` (features/sidebar/relative-time.ts):**
- Returns `"just now"` for timestamps < 1 minute ago
- Returns `"5m ago"`, `"2h ago"`, `"3d ago"` for respective ranges

**`SelectionCard` (vitest + solid-testing-library):**
- Renders component name and tag badge
- Renders comment text when present; omits paragraph when `commentText` is undefined
- Renders file path row when `extractFilePath` returns a match; omits when null
- Renders line number suffix when `line` is non-null
- Shows screenshot skeleton (`animate-pulse`) before `useLazyVisible` fires; shows `<img>` after
- Shows "No element screenshot" placeholder when `screenshotElement` is absent, `screenshotFullPage` is present
- Shows "No full-page screenshot" placeholder when `screenshotFullPage` is absent, `screenshotElement` is present
- Hides `ScreenshotPair` when both screenshot fields are absent
- Renders no `<img>` when `syncServerUrl` or `syncWorkspace` is absent (sync disabled)
- Renders CSS selector when `elementSelectors[0]` is present; omits when array is empty
- `<details>` has no `open` attribute on mount
- Expands raw HTML on `<details>` click
- All container divs carry `pointer-events: auto`

**`GroupDetailView`:**
- Renders `DetailHeader` with group name
- Renders `SelectionList` with correct item count
- Renders `EmptyState` when the group's comment items list is empty
- Has `tabIndex={-1}` and can be programmatically focused

**`DetailHeader`:**
- Renders back button with `aria-label="Back to groups list"`
- Calls `onBack` when clicked
- Renders group name with `title` attribute

### Integration Tests

**View transitions:**
- Clicking a `GroupCard` mounts `GroupDetailView` and unmounts the list view
- `GroupDetailView` receives focus after transition
- Clicking back button mounts the list view and unmounts `GroupDetailView`
- Previously clicked group card receives focus after back navigation
- If the active group is deleted while the detail is open, the sidebar returns to the list view

**Pointer-events regression (playwright e2e):**
- Back button in `DetailHeader` is clickable
- `<details>` toggle expands/collapses on click
- CSS selector text is selectable

**Signal consistency:**
- Detail view shows only the items belonging to the selected group
- Navigating back then into a different group shows that group's items (no stale detail)

**Screenshot lazy loading (playwright e2e):**
- Cards below the scroll fold of `SelectionList` have no `<img src=...>` in DOM until scrolled into view
- Skeleton placeholder is visible while screenshot is off-screen
- `<img src>` is set to the correct server URL after the card enters the scroll viewport

**Sync disabled (no serverUrl):**
- `ScreenshotPair` is not rendered when `syncServerUrl` is absent

**Phase 1 regression:**
- Groups list, filter tabs, and stats bar are functional after Phase 2 changes to `index.tsx`
- Sync error empty state still renders when `syncStatus === 'error'`

### Manual Verification

- Open detail for a group with 10+ selections — list scrolls independently from sidebar header
- Open a group with no selections — empty state shown
- Open a group with no screenshots — `ScreenshotPair` absent on all cards
- Open a group with partial screenshots — per-card placeholder shown correctly
- File path shown for selections with path in content; absent for those without
- `<details>` collapsed on mount; expands/collapses; does not affect sibling cards
- Dark theme and typography match the groups list view
- No layout shift on host page when transitioning between list and detail views
- Verify `<details>` toggle works in the actual shadow root (CSS reset check)

## Acceptance Criteria

- [ ] `activeDetailGroupId` signal added to `Sidebar` — navigates to detail on `GroupCard` click, returns to list on back button click
- [ ] `SidebarProps.onGroupClick` prop removed; `renderer.tsx` stub removed; all test files that passed `onGroupClick` updated; `tsc --noEmit` reports zero errors after the change (Issue 2)
- [ ] `syncServerUrl?: string` and `syncWorkspace?: string` added to `SidebarProps`; threaded from `renderer.tsx` and `core/index.tsx`
- [ ] Group-deletion guard: if active group is deleted from `props.groups`, sidebar returns to list view automatically
- [ ] `GroupDetailView` component renders inside sidebar when a group is selected
- [ ] `DetailHeader` shows back button (←) with `aria-label="Back to groups list"`, group name with `title`, and status badge
- [ ] `SelectionList` renders a `SelectionCard` for each selection in the group
- [ ] `SelectionCard` renders: component name, HTML tag badge, relative timestamp
- [ ] `SelectionCard` renders comment text when present; omits when absent
- [ ] `SelectionCard` renders source file path + line when `extractFilePath` matches; omits when null (A-014)
- [ ] `extractFilePath` returns `null` on no match — never crashes or guesses (A-014)
- [ ] `screenshotUrl()` builds the correct server URL from `serverUrl`, `workspace`, `selectionId`, and `type` (Issue 1)
- [ ] `ScreenshotPair` shows element screenshot `<img>` labeled "Element" when `screenshotElement` key is present and sync is enabled (A-018)
- [ ] `ScreenshotPair` shows full-page screenshot `<img>` labeled "Full page" when `screenshotFullPage` key is present and sync is enabled (A-018)
- [ ] `ScreenshotPair` shows per-slot placeholder when a slot's key is absent (A-018)
- [ ] `ScreenshotPair` hidden entirely when both screenshot keys are absent (A-018)
- [ ] `ScreenshotPair` not rendered when `syncServerUrl` is absent (sync disabled)
- [ ] Screenshots lazy-load: `<img src>` not set until card enters scroll viewport; `useLazyVisible` receives `SelectionList` scroll container as `root` (Issue 6)
- [ ] `useLazyVisible` disconnects `IntersectionObserver` on component unmount
- [ ] `SelectionCard` renders CSS selector in monospace when `elementSelectors[0]` is present
- [ ] Raw HTML collapsible uses `<details>`/`<summary>` with `max-h-[200px] overflow-y-auto` on `<pre>`; collapsed by default
- [ ] `GroupDetailView`, `DetailHeader`, `SelectionList`, `SelectionCard`, `ScreenshotPair` all carry `pointer-events: auto` on their container elements (Issue 4)
- [ ] `GroupDetailView` has `tabIndex={-1}` and receives programmatic focus after list→detail transition (A-019)
- [ ] Focus returns to clicked `GroupCard` after detail→list transition; falls back to sidebar container if card removed from DOM (A-019)
- [ ] `lastFocusedCard` and `detailViewRef` declared inside `Sidebar` component body, not at module scope (Issue 3)
- [ ] `GroupCard.onClick` receives `(groupId: string, cardEl: HTMLElement)` — event target stored before signal update (Issue 3)
- [ ] `GroupList.onGroupClick` prop type updated to match extended signature
- [ ] Empty state shown when selected group has no selections
- [ ] Sync error empty state from Phase 1 still renders when `syncStatus === 'error'` (Issue 7)
- [ ] `relativeTime` moved to `features/sidebar/relative-time.ts`; imported by both `GroupCard` and `SelectionCard` (Issue 9)
- [ ] `extractFilePath` exported from `features/sidebar/index.ts` (Issue 8)
- [ ] `useLazyVisible` exported from `features/sidebar/index.ts` (Issue 8)
- [ ] `screenshotUrl` exported from `features/sidebar/index.ts` (Issue 8)
- [ ] `relativeTime` exported from `features/sidebar/index.ts` (Issue 8)
- [ ] All new unit tests pass: `extractFilePath` (7 cases), `screenshotUrl` (3 cases), `useLazyVisible` (5 cases), `relativeTime` (4 cases), `SelectionCard` (12 cases), `GroupDetailView` (4 cases), `DetailHeader` (3 cases)
- [ ] Integration tests pass: view transitions, pointer-events, signal consistency, screenshot lazy loading, sync disabled, Phase 1 regression
- [ ] `decree lint` passes with zero errors

### Deferred (Phase 3+)

- [ ] "Create JIRA Ticket" button in detail view (Phase 3)
- [ ] JIRA status polling for `resolved` group status (Phase 3)
- [ ] Keyboard navigation within selection list (Phase 4)
- [ ] Focus trapping inside sidebar (Phase 4)
- [ ] `aria-modal="true"` upgrade (Phase 4)
- [ ] Animate list ↔ detail transition (Phase 4)
- [ ] "Show more" affordance for large raw HTML content (Phase 4)
