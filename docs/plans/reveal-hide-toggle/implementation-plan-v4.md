# Selection Visibility Feature Module — Implementation Plan v4

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the selection visibility (reveal/hide) logic from the monolithic `core/index.tsx` into a self-contained feature module at `src/features/selection-visibility/`, making the reveal system's boundaries explicit and preventing the class of bug where hover code accidentally touches reveal state.

**Architecture:** Create a `createSelectionVisibility(deps)` factory function that owns all reveal state (`revealedPreviews[]`), handlers, and effects behind a clean interface. The factory accepts explicit dependencies from `core/index.tsx` (signals, store actions, element utilities). It returns a narrow public API (`handlers`, `guards`, `state`). Types stay in `types.ts` (SSOT). The existing hover system in `core/index.tsx` uses the returned guards to know when to skip items. The toolbar and comments UI import nothing new — they already receive props from the renderer chain.

**Tech Stack:** SolidJS (signals, createMemo, createEffect), TypeScript

**Refactors:** `implementation-plan-v3.md` (functional but all logic inlined in `core/index.tsx`)

---

## Current State (post-v3)

The following reveal-related code is currently inline in `core/index.tsx` and needs extraction:

| Symbol | Line | What it does |
|--------|------|-------------|
| `revealedPreviews` | 337 | Tracking array for pinned previews |
| `selectionsRevealed` | 3259 | Memo: reads `currentToolbarState()?.selectionsRevealed` |
| `clearRevealedPreviews` | 3681 | Clears all pinned preview boxes/labels |
| `showRevealedPreviews` | 3691 | Shows previews for items where `revealed === true` |
| `createEffect(on(commentItems, ...))` | 4061 | Re-renders reveal previews when comment items change |
| `handleToggleCommentItemRevealed` | 4073 | Toggles one item's `revealed` field |
| `handleToggleSelectionsRevealed` | 4083 | Parent toggle: overrides all children + updates toolbar state |

Hover guards (remain in `core/index.tsx` but call into feature module):

| Symbol | Line | Guard logic |
|--------|------|------------|
| `handleCommentItemHover` | 4001 | `if (item.revealed) return` |
| `handleCommentsButtonHover` | 4013 | `if (!item.revealed)` filter |
| `handleCommentsCopyAllHover` | 4046 | `if (!item.revealed)` filter |

---

### Task 1: Create feature module directory and types

**Files:**
- Create: `packages/react-grab/src/features/selection-visibility/types.ts`

**Step 1: Create the deps and return type interfaces**

```typescript
import type { Accessor, Setter } from "solid-js";
import type {
  CommentItem,
  GrabbedBox,
  OverlayBounds,
  SelectionLabelInstance,
  ToolbarState,
} from "../../types.js";

/**
 * Tracking entry for a pinned preview (grabbed box + optional label).
 */
export interface PreviewEntry {
  boxId: string;
  labelId: string | null;
}

/**
 * Dependencies injected from core/index.tsx into the selection visibility module.
 * Explicit interface = explicit boundary. Core owns these; the module borrows them.
 */
export interface SelectionVisibilityDeps {
  /** Reactive signal of all comment items */
  commentItems: Accessor<CommentItem[]>;
  /** Setter for the comment items signal */
  setCommentItems: Setter<CommentItem[]>;
  /** Persist comment items to sessionStorage */
  persistCommentItems: (items: CommentItem[]) => CommentItem[];
  /** Resolve a comment item to its connected DOM elements */
  getConnectedCommentElements: (item: CommentItem) => Element[];
  /** Compute overlay bounds for a DOM element */
  createElementBounds: (element: Element) => OverlayBounds;
  /** Add a preview (grabbed box + label) with tracking */
  addCommentItemPreview: (
    item: CommentItem,
    previewBounds: OverlayBounds[],
    previewElements: Element[],
    idPrefix: string,
    trackingArray: PreviewEntry[],
  ) => void;
  /** Store actions for managing grabbed boxes and labels */
  actions: {
    removeGrabbedBox: (boxId: string) => void;
    removeLabelInstance: (instanceId: string) => void;
  };
  /** Reactive signal of toolbar state */
  currentToolbarState: Accessor<ToolbarState | null>;
  /** Update toolbar state (merges partial updates) */
  updateToolbarState: (updates: Partial<ToolbarState>) => ToolbarState;
}

/**
 * Public API returned by createSelectionVisibility.
 * This is the ONLY way core/index.tsx interacts with the reveal system.
 */
export interface SelectionVisibilityAPI {
  /** Whether the parent toggle is currently ON */
  selectionsRevealed: Accessor<boolean>;
  /** Check if a specific comment item is individually revealed */
  isItemRevealed: (commentItemId: string) => boolean;
  /** Toggle the parent (overrides all children) */
  handleToggleParent: () => void;
  /** Toggle an individual comment item's revealed state */
  handleToggleItem: (commentItemId: string) => void;
  /** Dispose reactive effects (call on cleanup) */
  dispose: () => void;
}
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/types.ts
git commit -m "feat(selection-visibility): define feature module types and dependency interface"
```

---

### Task 2: Create the factory function

**Files:**
- Create: `packages/react-grab/src/features/selection-visibility/index.ts`

**Step 1: Implement `createSelectionVisibility`**

```typescript
import { createEffect, createMemo, createRoot, on } from "solid-js";
import type {
  PreviewEntry,
  SelectionVisibilityAPI,
  SelectionVisibilityDeps,
} from "./types.js";

const REVEAL_PREFIX = "reveal-pinned";

export function createSelectionVisibility(
  deps: SelectionVisibilityDeps,
): SelectionVisibilityAPI {
  // Private state — hover code CANNOT touch this
  let revealedPreviews: PreviewEntry[] = [];

  const selectionsRevealed = createMemo(
    () => deps.currentToolbarState()?.selectionsRevealed ?? false,
  );

  const clearRevealedPreviews = () => {
    for (const { boxId, labelId } of revealedPreviews) {
      deps.actions.removeGrabbedBox(boxId);
      if (labelId) {
        deps.actions.removeLabelInstance(labelId);
      }
    }
    revealedPreviews = [];
  };

  const showRevealedPreviews = () => {
    for (const item of deps.commentItems()) {
      if (!item.revealed) continue;
      const connectedElements = deps.getConnectedCommentElements(item);
      const previewBounds = connectedElements.map((element) =>
        deps.createElementBounds(element),
      );
      deps.addCommentItemPreview(
        item,
        previewBounds,
        connectedElements,
        REVEAL_PREFIX,
        revealedPreviews,
      );
    }
  };

  // Re-render reveal previews whenever comment items change
  // (includes revealed field toggles, additions, removals)
  const disposeEffect = createRoot((dispose) => {
    createEffect(
      on(
        () => deps.commentItems(),
        () => {
          clearRevealedPreviews();
          showRevealedPreviews();
        },
      ),
    );
    return dispose;
  });

  const isItemRevealed = (commentItemId: string): boolean => {
    const item = deps.commentItems().find((i) => i.id === commentItemId);
    return item?.revealed ?? false;
  };

  const handleToggleItem = (commentItemId: string) => {
    const items = deps.commentItems();
    const updatedItems = items.map((item) =>
      item.id === commentItemId
        ? { ...item, revealed: !item.revealed }
        : item,
    );
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);
  };

  const handleToggleParent = () => {
    const newRevealed = !selectionsRevealed();

    // Override all children
    const items = deps.commentItems();
    const updatedItems = items.map((item) => ({
      ...item,
      revealed: newRevealed,
    }));
    deps.setCommentItems(updatedItems);
    deps.persistCommentItems(updatedItems);

    // Update toolbar state
    deps.updateToolbarState({ selectionsRevealed: newRevealed });
  };

  return {
    selectionsRevealed,
    isItemRevealed,
    handleToggleParent,
    handleToggleItem,
    dispose: disposeEffect,
  };
}

export type { SelectionVisibilityAPI, SelectionVisibilityDeps, PreviewEntry } from "./types.js";
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (module is self-contained, no callers yet)

**Step 3: Commit**

```bash
git add packages/react-grab/src/features/selection-visibility/index.ts
git commit -m "feat(selection-visibility): implement createSelectionVisibility factory"
```

---

### Task 3: Wire feature module into core/index.tsx

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

This is the key integration task. Read each referenced line before making changes.

**Step 1: Add import**

At the top of `core/index.tsx`, add:

```typescript
import { createSelectionVisibility } from "../features/selection-visibility/index.js";
```

**Step 2: Instantiate the module**

Find the `revealedPreviews` declaration (line 337). Replace it and add the module instantiation. Place it AFTER `updateToolbarState` is defined (line 356) and AFTER `getConnectedCommentElements` is defined (line 403), because those are dependencies.

Find a suitable location — right after `getFirstConnectedCommentElement` (around line 407). Add:

```typescript
const visibility = createSelectionVisibility({
  commentItems,
  setCommentItems,
  persistCommentItems,
  getConnectedCommentElements,
  createElementBounds,
  addCommentItemPreview,
  actions: {
    removeGrabbedBox: actions.removeGrabbedBox,
    removeLabelInstance: actions.removeLabelInstance,
  },
  currentToolbarState,
  updateToolbarState,
});
```

**IMPORTANT:** There's a dependency ordering issue. `addCommentItemPreview` is defined much later (line 3709). Since it's a `const` arrow function (not hoisted), it won't be available at line 407.

**Solution:** Move the `createSelectionVisibility()` call to AFTER `addCommentItemPreview` is defined. Find `addCommentItemPreview` (line 3709) and place the instantiation after it (around line 3750). The `selectionsRevealed` memo can still be accessed from the returned API.

Actually, the cleaner solution: `addCommentItemPreview` is already defined at line 3709. Place the `createSelectionVisibility()` call right after `showCommentItemPreview` (around line 3760):

```typescript
// After showCommentItemPreview definition:
const visibility = createSelectionVisibility({
  commentItems,
  setCommentItems,
  persistCommentItems,
  getConnectedCommentElements,
  createElementBounds,
  addCommentItemPreview,
  actions: {
    removeGrabbedBox: actions.removeGrabbedBox,
    removeLabelInstance: actions.removeLabelInstance,
  },
  currentToolbarState,
  updateToolbarState,
});
```

**Step 3: Remove old inline code**

Delete these (they're now inside the feature module):

1. **Line 337**: `let revealedPreviews: ...` — DELETE

2. **Lines 3259-3261**: `const selectionsRevealed = createMemo(...)` — DELETE

3. **Lines 3681-3689**: `const clearRevealedPreviews = () => { ... }` — DELETE

4. **Lines 3691-3706**: `const showRevealedPreviews = () => { ... }` — DELETE

5. **Lines 4061-4071**: `createEffect(on(() => commentItems(), ...))` — DELETE

6. **Lines 4073-4081**: `const handleToggleCommentItemRevealed = ...` — DELETE

7. **Lines 4083-4098**: `const handleToggleSelectionsRevealed = ...` — DELETE

**Step 4: Replace references to old symbols with module API**

Search for all usages of the deleted symbols and replace:

| Old reference | Replace with |
|---------------|-------------|
| `selectionsRevealed()` | `visibility.selectionsRevealed()` |
| `handleToggleSelectionsRevealed` | `visibility.handleToggleParent` |
| `handleToggleCommentItemRevealed` | `visibility.handleToggleItem` |

Specifically:

**In `handleCommentItemHover` (line 4001):**
```typescript
// Change:
if (item.revealed) return;
// To:
if (visibility.isItemRevealed(item.id)) return;
```

**In `handleCommentsButtonHover` (line 4013):**
```typescript
// Change:
if (!item.revealed) {
// To:
if (!visibility.isItemRevealed(item.id)) {
```

**In `handleCommentsCopyAllHover` (line 4046):**
```typescript
// Change:
if (!item.revealed) {
// To:
if (!visibility.isItemRevealed(item.id)) {
```

**In `<ReactGrabRenderer>` props (around line 4289-4291):**
```typescript
// Change:
selectionsRevealed={selectionsRevealed()}
onToggleSelectionsRevealed={handleToggleSelectionsRevealed}
onToggleCommentItemRevealed={handleToggleCommentItemRevealed}
// To:
selectionsRevealed={visibility.selectionsRevealed()}
onToggleSelectionsRevealed={visibility.handleToggleParent}
onToggleCommentItemRevealed={visibility.handleToggleItem}
```

**In `setToolbarState` API (around line 4404):**
```typescript
// Change:
selectionsRevealed: state.selectionsRevealed ?? currentState?.selectionsRevealed ?? false,
// Keep as-is (this is the public API, not the feature module)
```

**Step 5: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (zero errors)

**Step 6: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "refactor(core): wire createSelectionVisibility and remove inline reveal logic"
```

---

### Task 4: Verify e2e tests pass

**Step 1: Run relevant tests**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && npx playwright test e2e/toolbar.spec.ts e2e/selection.spec.ts --reporter=line
```

Expected: All tests pass (behavior unchanged, only code organization changed).

**Step 2: Build**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

Expected: Build succeeds.

**Step 3: Commit if fixes needed**

---

### Task 5: Manual verification

Test these scenarios in the dev server:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Parent toggle ON | All children set to revealed, all overlays appear |
| 2 | Individual toggle OFF (parent ON) | That one overlay disappears |
| 3 | Parent toggle OFF | All overlays disappear |
| 4 | Hover comments button (some revealed) | Only non-revealed items get hover preview |
| 5 | Leave comments hover | Revealed items stay, hover items clear |
| 6 | Active selection tool (any state) | Hover-to-select always works |
| 7 | Page reload | Toggle state persists |

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/features/selection-visibility/types.ts` | Create | `SelectionVisibilityDeps`, `SelectionVisibilityAPI`, `PreviewEntry` interfaces |
| `src/features/selection-visibility/index.ts` | Create | `createSelectionVisibility()` factory — owns `revealedPreviews[]`, effects, handlers |
| `src/core/index.tsx` | Modify | Import module, instantiate with deps, delete 7 inline symbols, replace references with `visibility.*` |

## What stays in `types.ts` (SSOT)

- `ToolbarState.selectionsRevealed: boolean`
- `CommentItem.revealed: boolean`
- `ReactGrabRendererProps.selectionsRevealed`, `onToggleSelectionsRevealed`, `onToggleCommentItemRevealed`
- `GrabbedBox`, `SelectionLabelInstance`, `OverlayBounds`

## What moves to feature module

- `revealedPreviews[]` private state
- `clearRevealedPreviews()` / `showRevealedPreviews()`
- `selectionsRevealed` memo
- `createEffect` for reactive re-rendering
- `handleToggleCommentItemRevealed` → `handleToggleItem`
- `handleToggleSelectionsRevealed` → `handleToggleParent`

## What stays in `core/index.tsx`

- Hover handlers (`handleCommentItemHover`, `handleCommentsButtonHover`, etc.) — they call `visibility.isItemRevealed()` as a guard
- `addCommentItemPreview` — shared utility used by both hover and reveal systems
- `commentsHoverPreviews[]` — hover-only tracking, untouched
- `updateToolbarState` — general purpose, not reveal-specific

## Extensibility

The `SelectionVisibilityDeps` interface is the extension point. Future features can:
- **Groups:** Create `createSelectionGroups(deps)` with similar pattern, compose with visibility
- **Copy by selection:** Read `visibility.isItemRevealed()` to know which items are selected for copy
- **Alternative override strategies:** Swap parent override logic by replacing `handleToggleParent` without touching core
