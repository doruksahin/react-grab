# Layered Reveal/Hide Selections v3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken 3-state visibility toggle with a layered 2-level reveal/hide system. A parent toggle (toolbar) overrides all children. Individual per-comment toggles work independently after. The reveal system is fully independent from the existing comment-hover preview system. The active selection tool (hover-to-select, drag) always works regardless of toggle state.

**Architecture:** Each `CommentItem` gains a `revealed: boolean` field (defaults `false`). The toolbar parent toggle overrides all children: ON sets all to `true`, OFF sets all to `false`. Individual toggles in the comments dropdown flip one item's `revealed` field. A separate `revealedPreviews[]` tracking array (with prefix `"reveal-pinned"`) manages pinned overlays independently from the hover system's `commentsHoverPreviews[]`. A reactive effect watches `commentItems()` and re-renders only items where `revealed === true`. All comment-hover handlers are guarded to skip when the item is individually revealed. The v2 gating on `selectionVisible`, `selectionLabelVisible`, `dragVisible`, `grabbedBoxes`, and `labelInstances` is removed — the active selection tool always works.

**Tech Stack:** SolidJS (signals, createMemo, createEffect, createStore), Tailwind CSS, SVG icons

**Iterates on:** `implementation-plan-v2.md` (3-state toggle, shared preview tracking — broken)

**Bug fixed:** Reveal previews and hover previews shared `commentsHoverPreviews[]`. Comment hover/dismiss cleared reveal previews.

**Design decision:** Parent override (not master gate). See `memory/project_reveal_toggle_hierarchy.md`.

---

## Codebase Orientation (current v2 state)

| Concept | File | Lines | What to look for |
|---------|------|-------|-----------------|
| `ToolbarState` type | `src/types.ts:363-371` | Currently has `selectionVisibility: SelectionVisibility` — replace |
| `SelectionVisibility` type | `src/types.ts:363` | `"reveal" \| "normal" \| "hidden"` — delete |
| `CommentItem` type | `src/types.ts:442-453` | Add `revealed: boolean` field |
| `ReactGrabRendererProps` | `src/types.ts:554-555` | `selectionVisibility?`, `onCycleSelectionVisibility?` — replace |
| State persistence | `src/components/toolbar/state.ts:39-42` | Parses `selectionVisibility` enum — change |
| Toolbar button | `src/components/toolbar/toolbar-content.tsx:158-195` | 3-state cycle — simplify to 2-state |
| Toolbar props | `src/components/toolbar/index.tsx:100-101` | `selectionVisibility?`, `onCycleSelectionVisibility?` — replace |
| Toolbar state literals | `src/components/toolbar/index.tsx` | ~7 places with `selectionVisibility:` — replace |
| Renderer passthrough | `src/components/renderer.tsx:220-221` | Passes `selectionVisibility` — replace |
| Renderer CommentsDropdown | `src/components/renderer.tsx:251-262` | Pass new props for per-item toggle |
| CommentsDropdown props | `src/components/comments-dropdown.tsx:32-43` | Add `onToggleItemRevealed` callback |
| CommentsDropdown items | `src/components/comments-dropdown.tsx:279-333` | Add per-item eye toggle button |
| Shared preview tracking | `src/core/index.tsx:335` | `commentsHoverPreviews[]` — keep for hover only |
| Visibility memos | `src/core/index.tsx:3258-3273` | `selectionVisibility`, `selectionsHidden`, `cycleSelectionVisibility` — replace |
| Selection gating (REMOVE) | `src/core/index.tsx:3276` | `if (selectionsHidden()) return false` in `selectionVisible` |
| Label gating (REMOVE) | `src/core/index.tsx:3315` | `if (selectionsHidden()) return false` in `selectionLabelVisible` |
| Drag gating (REMOVE) | `src/core/index.tsx:3402` | `!selectionsHidden() &&` in `dragVisible` |
| Renderer gating (REMOVE) | `src/core/index.tsx:4148,4151` | `selectionsHidden() ? [] :` on `grabbedBoxes`/`labelInstances` |
| Reveal effect | `src/core/index.tsx:4045-4063` | Two `createEffect` blocks — replace |
| Comment hover guard | `src/core/index.tsx:3989` | Guards `handleCommentItemHover` — extend |
| Button hover (BUG) | `src/core/index.tsx:4000-4002` | `handleCommentsButtonHover` calls `clearCommentsHoverPreviews()` unconditionally |
| CopyAll hover (BUG) | `src/core/index.tsx:4029-4030` | `handleCommentsCopyAllHover` calls `clearCommentsHoverPreviews()` unconditionally |
| Dismiss (BUG) | `src/core/index.tsx:3795-3799` | `dismissCommentsDropdown` calls `clearCommentsHoverPreviews()` unconditionally |
| `showAllCommentItemPreviews` | `src/core/index.tsx:4039-4043` | Loops `commentItems()` — will be replaced by selective reveal |
| `addCommentItemPreview` | `src/core/index.tsx:3696-3721` | Adds boxes/labels with `createdAt: 0` — reuse pattern |
| Comment signals | `src/core/index.tsx:322-323` | `commentItems` signal |
| Comment storage | `src/utils/comment-storage.ts` | `loadComments()`, `addCommentItem()`, `persistCommentItems()` |
| Renderer call | `src/core/index.tsx:4255` | Where `selectionVisibility` prop is passed |
| `updateToolbarState` | `src/core/index.tsx:337-354` | Has `selectionVisibility:` — replace |
| Icon imports | `src/components/toolbar/toolbar-content.tsx:7-10` | `IconEye`, `IconEyeOff`, `IconEyeFilled` |

All file paths relative to `packages/react-grab/`.

---

### Task 1: Update `CommentItem` type and `ToolbarState` type

**Files:**
- Modify: `packages/react-grab/src/types.ts`

**Step 1: Add `revealed` to `CommentItem`**

Find the `CommentItem` interface (line 442) and add the field:

```typescript
export interface CommentItem {
  id: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  elementsCount?: number;
  previewBounds?: OverlayBounds[];
  elementSelectors?: string[];
  commentText?: string;
  timestamp: number;
  revealed: boolean;
}
```

**Step 2: Replace `SelectionVisibility` with `selectionsRevealed` in `ToolbarState`**

Delete the `SelectionVisibility` type. Replace the field:

```typescript
// DELETE this line:
export type SelectionVisibility = "reveal" | "normal" | "hidden";

export interface ToolbarState {
  edge: "top" | "bottom" | "left" | "right";
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction?: string;
  selectionsRevealed: boolean;
}
```

**Step 3: Update `ReactGrabRendererProps`**

Find `selectionVisibility?` and `onCycleSelectionVisibility?` (around line 554) and replace:

```typescript
selectionsRevealed?: boolean;
onToggleSelectionsRevealed?: () => void;
onToggleCommentItemRevealed?: (commentItemId: string) => void;
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add revealed to CommentItem, replace SelectionVisibility with selectionsRevealed boolean"
```

---

### Task 2: Update state persistence

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/state.ts`

**Step 1: Replace `selectionVisibility` parsing with `selectionsRevealed`**

Find the `selectionVisibility` block (lines 39-44) and replace with:

```typescript
selectionsRevealed:
  typeof record.selectionsRevealed === "boolean"
    ? record.selectionsRevealed
    : false,
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/toolbar/state.ts
git commit -m "feat(toolbar-state): persist selectionsRevealed boolean"
```

---

### Task 3: Update comment storage for `revealed` field

**Files:**
- Modify: `packages/react-grab/src/utils/comment-storage.ts`

**Step 1: Read the file first**

Read `packages/react-grab/src/utils/comment-storage.ts` to understand how `CommentItem` objects are loaded and stored.

**Step 2: Ensure `revealed` defaults to `false` on load**

In the `loadComments` function (or wherever `CommentItem` objects are parsed from `sessionStorage`), ensure that loaded items get `revealed: false` if the field is missing (backward compat). The simplest approach is to add a mapping in the load function:

Find where the parsed items are returned and add:

```typescript
// After parsing items from sessionStorage, ensure revealed field exists:
return items.map((item) => ({
  ...item,
  revealed: typeof item.revealed === "boolean" ? item.revealed : false,
}));
```

**Step 3: Ensure `addCommentItem` sets `revealed: false` by default**

Find `addCommentItem` and ensure new items always have `revealed: false`. The caller constructs the `CommentItem`, so check where comments are created in `core/index.tsx` — that's where `revealed: false` needs to be set. But since the type now requires it, TypeScript will enforce it.

**Step 4: Commit**

```bash
git add packages/react-grab/src/utils/comment-storage.ts
git commit -m "feat(comment-storage): ensure revealed field defaults to false on load"
```

---

### Task 4: Update toolbar button to 2-state toggle

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/toolbar-content.tsx`

**Step 1: Update imports**

Remove `IconEye` import (no longer needed — was for "normal" state). Remove `SelectionVisibility` type import. Keep:

```typescript
import { IconEyeFilled } from "../icons/icon-eye-filled.jsx";
import { IconEyeOff } from "../icons/icon-eye-off.jsx";
```

**Step 2: Update props**

In `ToolbarContentProps`, replace:

```typescript
// REMOVE these:
// selectionVisibility: SelectionVisibility;
// onCycleSelectionVisibility?: () => void;

// ADD these:
selectionsRevealed: boolean;
onToggleSelectionsRevealed?: () => void;
```

**Step 3: Replace `defaultVisibilityButton`**

Replace the entire function (lines 158-195) with:

```tsx
const defaultVisibilityButton = () => (
  <button
    data-react-grab-ignore-events
    data-react-grab-toolbar-visibility
    aria-label={props.selectionsRevealed ? "Hide all selections" : "Reveal all selections"}
    aria-pressed={props.selectionsRevealed}
    class={cn(
      "contain-layout flex items-center justify-center cursor-pointer interactive-scale touch-hitbox",
      buttonSpacingClass(),
      hitboxConstraintClass(),
    )}
    onClick={() => props.onToggleSelectionsRevealed?.()}
  >
    {props.selectionsRevealed ? (
      <IconEyeFilled size={14} class="text-black transition-colors" />
    ) : (
      <IconEyeOff size={14} class="text-[#B3B3B3] transition-colors" />
    )}
  </button>
);
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/toolbar/toolbar-content.tsx
git commit -m "feat(toolbar): simplify visibility button to 2-state reveal toggle"
```

---

### Task 5: Add per-item eye toggle to comments dropdown

**Files:**
- Modify: `packages/react-grab/src/components/comments-dropdown.tsx`

**Step 1: Add new prop to `CommentsDropdownProps`**

Add (around line 37):

```typescript
onToggleItemRevealed?: (commentItemId: string) => void;
```

**Step 2: Add per-item eye toggle button**

Find the `<For each={props.items}>` render block (line 279). Inside each item's `<div>`, after the timestamp `<span>` (line 331), add the eye toggle button:

The current item layout is:
```
<span> (name + comment text) </span>
<span> (timestamp) </span>
```

Change to:
```
<span> (name + comment text) </span>
<span> (timestamp) </span>
<button> (eye toggle) </button>
```

Add after the timestamp span (line 331), before the closing `</div>` of the item (line 332):

```tsx
<button
  data-react-grab-ignore-events
  class="shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded hover:bg-black/5 transition-colors"
  onClick={(event) => {
    event.stopPropagation();
    props.onToggleItemRevealed?.(item.id);
  }}
  onPointerDown={(event) => event.stopPropagation()}
  aria-label={item.revealed ? "Hide this selection" : "Reveal this selection"}
>
  {item.revealed ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-500">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
      <circle cx="12" cy="12" r="3" fill="currentColor"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-black/20 group-hover:text-black/40 transition-colors">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/>
      <path d="m2 2 20 20"/>
    </svg>
  )}
</button>
```

**Note:** We inline the SVGs here instead of importing the icon components because `CommentsDropdown` is in a different component layer and doesn't import from the icons directory. The SVGs are small and self-contained.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/comments-dropdown.tsx
git commit -m "feat(comments-dropdown): add per-item reveal/hide eye toggle"
```

---

### Task 6: Wire through toolbar/index.tsx

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/index.tsx`

**Step 1: Update `ToolbarProps`**

Replace (around lines 100-101):

```typescript
// REMOVE:
// selectionVisibility?: SelectionVisibility;
// onCycleSelectionVisibility?: () => void;

// ADD:
selectionsRevealed?: boolean;
onToggleSelectionsRevealed?: () => void;
```

Remove `SelectionVisibility` import if present.

**Step 2: Update `<ToolbarContent>` call**

Replace (around lines 1061-1062):

```typescript
// REMOVE:
// selectionVisibility={props.selectionVisibility ?? "normal"}
// onCycleSelectionVisibility={props.onCycleSelectionVisibility}

// ADD:
selectionsRevealed={props.selectionsRevealed ?? false}
onToggleSelectionsRevealed={props.onToggleSelectionsRevealed}
```

**Step 3: Replace `selectionVisibility` in all `ToolbarState` object literals**

Search for all `selectionVisibility:` in this file (~7 places). Replace each with:

```typescript
selectionsRevealed: props.selectionsRevealed ?? false,
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/toolbar/index.tsx
git commit -m "feat(toolbar): wire selectionsRevealed through toolbar props"
```

---

### Task 7: Wire through renderer.tsx

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Update toolbar props passthrough**

Replace (around lines 220-221):

```typescript
// REMOVE:
// selectionVisibility={props.selectionVisibility}
// onCycleSelectionVisibility={props.onCycleSelectionVisibility}

// ADD:
selectionsRevealed={props.selectionsRevealed}
onToggleSelectionsRevealed={props.onToggleSelectionsRevealed}
```

**Step 2: Add `onToggleCommentItemRevealed` to `CommentsDropdown`**

Find the `<CommentsDropdown>` call (around line 251) and add the new prop:

```tsx
<CommentsDropdown
  position={props.commentsDropdownPosition ?? null}
  items={props.commentItems ?? []}
  disconnectedItemIds={props.commentsDisconnectedItemIds}
  onSelectItem={props.onCommentItemSelect}
  onItemHover={props.onCommentItemHover}
  onToggleItemRevealed={props.onToggleCommentItemRevealed}
  onCopyAll={props.onCommentsCopyAll}
  onCopyAllHover={props.onCommentsCopyAllHover}
  onClearAll={props.onCommentsClear}
  onDismiss={props.onCommentsDismiss}
  onDropdownHover={props.onCommentsDropdownHover}
/>
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(renderer): wire selectionsRevealed and per-item toggle to components"
```

---

### Task 8: Rewrite core orchestrator logic (THE KEY TASK)

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

Read ALL referenced lines carefully before making any changes. This task has many small edits spread across the file.

#### Part A: Add separate reveal preview tracking

**Step 1: Add `revealedPreviews` tracking array**

Find `commentsHoverPreviews` declaration (line 335). After it, add:

```typescript
let revealedPreviews: { boxId: string; labelId: string | null }[] = [];
```

#### Part B: Replace visibility memos

**Step 2: Replace the `selectionVisibility` / `selectionsHidden` / `cycleSelectionVisibility` block**

Find (lines 3258-3273) and replace the entire block with:

```typescript
const selectionsRevealed = createMemo(
  () => currentToolbarState()?.selectionsRevealed ?? false,
);
```

**Step 3: Remove `selectionsHidden` guard from `selectionVisible` memo**

Find `selectionVisible` memo (around line 3275). Remove this line:

```typescript
if (selectionsHidden()) return false;  // DELETE THIS LINE
```

**Step 4: Remove `selectionsHidden` guard from `selectionLabelVisible` memo**

Find `selectionLabelVisible` memo (around line 3314). Remove this line:

```typescript
if (selectionsHidden()) return false;  // DELETE THIS LINE
```

**Step 5: Remove `selectionsHidden` guard from `dragVisible` memo**

Find `dragVisible` memo (around line 3400). Remove `!selectionsHidden() &&`:

```typescript
// FROM:
const dragVisible = createMemo(
  () =>
    !selectionsHidden() &&  // DELETE THIS LINE
    isThemeEnabled() &&
    // ...

// TO:
const dragVisible = createMemo(
  () =>
    isThemeEnabled() &&
    // ...
```

#### Part C: Create reveal preview functions

**Step 6: Add `clearRevealedPreviews` and `showRevealedPreviews`**

Find `clearCommentsHoverPreviews` (line 3686). After the closing `};` (line 3694), add:

```typescript
const clearRevealedPreviews = () => {
  for (const { boxId, labelId } of revealedPreviews) {
    actions.removeGrabbedBox(boxId);
    if (labelId) {
      actions.removeLabelInstance(labelId);
    }
  }
  revealedPreviews = [];
};

const showRevealedPreviews = () => {
  for (const item of commentItems()) {
    if (!item.revealed) continue;
    const connectedElements = getConnectedCommentElements(item);
    const previewBounds = connectedElements.map((element) =>
      createElementBounds(element),
    );
    addCommentItemPreview(
      item,
      previewBounds,
      connectedElements,
      "reveal-pinned",
      revealedPreviews,
    );
  }
};
```

**Step 7: Update `addCommentItemPreview` to accept a tracking array parameter**

Find `addCommentItemPreview` (line 3696). Add a 5th parameter for the tracking array:

```typescript
const addCommentItemPreview = (
  item: CommentItem,
  previewBounds: OverlayBounds[],
  previewElements: Element[],
  idPrefix: string,
  trackingArray: { boxId: string; labelId: string | null }[] = commentsHoverPreviews,
) => {
```

Then change the push at the bottom (line 3719):

```typescript
// FROM:
commentsHoverPreviews.push({ boxId, labelId });
// TO:
trackingArray.push({ boxId, labelId });
```

This way existing callers (using `commentsHoverPreviews` as default) keep working, while `showRevealedPreviews` passes `revealedPreviews`.

#### Part D: Create the toggle handler for individual items

**Step 8: Add `handleToggleCommentItemRevealed`**

Place this near `handleCommentItemHover` (around line 3988):

```typescript
const handleToggleCommentItemRevealed = (commentItemId: string) => {
  const items = commentItems();
  const updatedItems = items.map((item) =>
    item.id === commentItemId
      ? { ...item, revealed: !item.revealed }
      : item,
  );
  setCommentItems(updatedItems);
  persistCommentItems(updatedItems);
};
```

**Note:** You'll need to import `persistCommentItems` from `comment-storage.ts`. Check how `addCommentItem` is imported — follow the same pattern. The function persists the updated list to sessionStorage.

#### Part E: Replace the reveal effects

**Step 9: Replace the two `createEffect` blocks**

Find the two effects (around lines 4045-4063) and replace both with:

```typescript
createEffect(
  on(
    () => commentItems().map((item) => item.revealed),
    () => {
      clearRevealedPreviews();
      showRevealedPreviews();
    },
  ),
);
```

This single effect watches the `revealed` field of all comment items. When any item's `revealed` changes (including bulk changes from parent toggle), it re-renders all revealed previews. It uses array comparison, so it fires when any element changes.

#### Part F: Create the parent toggle handler

**Step 10: Add `handleToggleSelectionsRevealed`**

Place near `handleToggleCommentItemRevealed`:

```typescript
const handleToggleSelectionsRevealed = () => {
  const currentState = selectionsRevealed();
  const newRevealed = !currentState;

  // Override all children
  const items = commentItems();
  const updatedItems = items.map((item) => ({
    ...item,
    revealed: newRevealed,
  }));
  setCommentItems(updatedItems);
  persistCommentItems(updatedItems);

  // Update toolbar state
  updateToolbarState({ selectionsRevealed: newRevealed });
};
```

#### Part G: Guard hover handlers

**Step 11: Guard `handleCommentItemHover`**

Find (around line 3988). The guard already checks `selectionVisibility() === "reveal"` — change to check if the specific item is revealed:

```typescript
const handleCommentItemHover = (commentItemId: string | null) => {
  // Don't show hover preview for items already revealed (they have pinned previews)
  clearCommentsHoverPreviews();
  if (!commentItemId) return;
  const item = commentItems().find(
    (innerItem) => innerItem.id === commentItemId,
  );
  if (!item) return;
  if (item.revealed) return;
  showCommentItemPreview(item, "comment-hover");
};
```

**Step 12: Guard `handleCommentsButtonHover`**

Find (around line 4000). Add guard to not clear/show previews for revealed items:

```typescript
const handleCommentsButtonHover = (isHovered: boolean) => {
  cancelCommentsHoverOpenTimeout();
  clearCommentsHoverPreviews();
  if (isHovered) {
    cancelCommentsHoverCloseTimeout();
    if (
      commentsDropdownPosition() === null &&
      clearPromptPosition() === null
    ) {
      // Only show previews for non-revealed items
      for (const item of commentItems()) {
        if (!item.revealed) {
          showCommentItemPreview(item, "comment-all-hover");
        }
      }
      commentsHoverOpenTimeoutId = setTimeout(() => {
        commentsHoverOpenTimeoutId = null;
        setIsCommentsHoverOpen(true);
        openCommentsDropdown();
      }, DROPDOWN_HOVER_OPEN_DELAY_MS);
    }
  } else if (isCommentsHoverOpen()) {
    scheduleCommentsHoverClose();
  }
};
```

**Step 13: Guard `handleCommentsCopyAllHover`**

Find (around line 4029). Same pattern — only preview non-revealed items:

```typescript
const handleCommentsCopyAllHover = (isHovered: boolean) => {
  clearCommentsHoverPreviews();
  if (isHovered) {
    cancelCommentsHoverCloseTimeout();
    for (const item of commentItems()) {
      if (!item.revealed) {
        showCommentItemPreview(item, "comment-all-hover");
      }
    }
  } else if (isCommentsHoverOpen()) {
    scheduleCommentsHoverClose();
  }
};
```

**Step 14: `dismissCommentsDropdown` is fine**

`dismissCommentsDropdown` (line 3795) calls `clearCommentsHoverPreviews()` which only clears `commentsHoverPreviews[]` — it does NOT touch `revealedPreviews[]`. So it's already correct with the separated tracking. **No change needed.**

#### Part H: Remove blanket gating at renderer props

**Step 15: Remove `selectionsHidden` gating from renderer**

Find (around lines 4148, 4151):

```typescript
// FROM:
labelInstances={selectionsHidden() ? [] : computedLabelInstances()}
grabbedBoxes={selectionsHidden() ? [] : computedGrabbedBoxes()}

// TO:
labelInstances={computedLabelInstances()}
grabbedBoxes={computedGrabbedBoxes()}
```

#### Part I: Update `<ReactGrabRenderer>` props

**Step 16: Replace visibility props**

Find (around lines 4255-4258):

```typescript
// FROM:
selectionVisibility={selectionVisibility()}
onCycleSelectionVisibility={cycleSelectionVisibility}

// TO:
selectionsRevealed={selectionsRevealed()}
onToggleSelectionsRevealed={handleToggleSelectionsRevealed}
onToggleCommentItemRevealed={handleToggleCommentItemRevealed}
```

#### Part J: Update `updateToolbarState` and `setToolbarState`

**Step 17: Replace `selectionVisibility` in `updateToolbarState`**

Find (around line 345):

```typescript
// FROM:
selectionVisibility: currentState?.selectionVisibility ?? "normal",
// TO:
selectionsRevealed: currentState?.selectionsRevealed ?? false,
```

**Step 18: Replace in `setToolbarState` API**

Search for any other `selectionVisibility:` in the file (public API, around line 4350):

```typescript
// FROM:
selectionVisibility: currentState?.selectionVisibility ?? "normal",
// TO:
selectionsRevealed: currentState?.selectionsRevealed ?? false,
```

#### Part K: Handle `revealed: false` in comment creation

**Step 19: Add `revealed: false` where new `CommentItem` objects are constructed**

Search `core/index.tsx` for where `CommentItem` objects are created (likely in a function that calls `addCommentItem`). Add `revealed: false` to the constructed object. TypeScript will flag this — just follow the type error.

#### Part L: Verify and commit

**Step 20: Remove unused `SelectionVisibility` import**

If `SelectionVisibility` is imported anywhere in `core/index.tsx`, remove it.

**Step 21: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (zero errors)

**Step 22: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): layered reveal/hide with separate tracking and per-item toggles"
```

---

### Task 9: Clean up unused icon

**Files:**
- Optionally delete: `packages/react-grab/src/components/icons/icon-eye.tsx`

Check if `IconEye` (the outline eye without fill) is still imported anywhere:

```bash
cd packages/react-grab && grep -r "icon-eye\." src/ --include="*.tsx" --include="*.ts" | grep -v "icon-eye-off" | grep -v "icon-eye-filled"
```

If no imports remain, delete it:

```bash
git rm packages/react-grab/src/components/icons/icon-eye.tsx
git commit -m "chore: remove unused IconEye component"
```

---

### Task 10: Build and verify

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

Expected: Build succeeds.

**Step 2: Test all scenarios**

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Page load (default) | Parent OFF, all individual toggles OFF, no selections visible |
| 2 | Parent ON | All individual toggles set to ON, all comment selections appear |
| 3 | Parent ON → toggle one child OFF | That selection disappears, others stay |
| 4 | Parent OFF | All selections disappear, all individual toggles set to OFF |
| 5 | Parent ON again | All individual toggles set to ON again (previous OFF was overridden) |
| 6 | Individual ON (parent is OFF) | That one selection appears, parent toolbar state stays OFF |
| 7 | Hover over element (any toggle state) | Active selection tool works normally |
| 8 | Drag element (any toggle state) | Drag preview works normally |
| 9 | Hover comments button (some items revealed) | Only non-revealed items get hover preview |
| 10 | Leave comments hover (some items revealed) | Revealed items stay, hover previews clear |
| 11 | Add new comment while parent is ON | New comment should have `revealed: false` by default (user can toggle it) |
| 12 | Page reload | Parent toggle persists (localStorage). Individual `revealed` states persist (sessionStorage) |
| 13 | Old v2 localStorage values | Gracefully default to `selectionsRevealed: false` |

**Step 3: Commit if fixes needed**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/types.ts` | Modify | Delete `SelectionVisibility`, add `revealed: boolean` to `CommentItem`, replace `selectionVisibility` with `selectionsRevealed` in `ToolbarState` + `ReactGrabRendererProps`, add `onToggleCommentItemRevealed` |
| `src/components/toolbar/state.ts` | Modify | Parse `selectionsRevealed` boolean |
| `src/utils/comment-storage.ts` | Modify | Default `revealed: false` on load |
| `src/components/icons/icon-eye.tsx` | Delete | No longer used |
| `src/components/toolbar/toolbar-content.tsx` | Modify | 2-state toggle: filled eye / eye-off |
| `src/components/comments-dropdown.tsx` | Modify | Add per-item eye toggle button |
| `src/components/toolbar/index.tsx` | Modify | Replace enum props with boolean |
| `src/components/renderer.tsx` | Modify | Wire `selectionsRevealed`, `onToggleCommentItemRevealed` |
| `src/core/index.tsx` | Modify | Separate `revealedPreviews[]` tracking, per-item reveal effect, parent override handler, remove selection gating, guard hover handlers |

## Key architectural decisions

**Separated tracking arrays:**
- `revealedPreviews[]` — managed by reveal effect, prefix `"reveal-pinned"`, only cleared by `clearRevealedPreviews()`
- `commentsHoverPreviews[]` — managed by hover system, prefix `"comment-hover"`, cleared by `clearCommentsHoverPreviews()`
- They never interfere with each other.

**`addCommentItemPreview` gets optional tracking array param:**
- Default: `commentsHoverPreviews` (backward compatible for all existing hover callers)
- `showRevealedPreviews` passes `revealedPreviews` explicitly

**Parent override:** Parent ON sets all `item.revealed = true`. Parent OFF sets all `item.revealed = false`. Individual toggles work after.

**Active selection tool ungated:** `selectionVisible`, `selectionLabelVisible`, `dragVisible`, `grabbedBoxes`, `labelInstances` are never filtered by the toggle. Hover-to-select and drag always work.

**Hover guards per-item:** Hover handlers skip items where `item.revealed === true` (they already have pinned previews via `revealedPreviews`). Items where `item.revealed === false` still get hover previews via `commentsHoverPreviews`.
