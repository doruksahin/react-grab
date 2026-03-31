# Toggle Hide/Reveal Selections v3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the reveal toggle so it is completely independent from comment hover behavior. Remove the "normal" state — make it a simple 2-state toggle (reveal ON / reveal OFF). The active selection tool (hover-to-select, drag) must always work regardless of toggle state.

**Architecture:** Separate reveal previews from hover previews using distinct tracking arrays and ID prefixes. The reveal toggle manages `revealedPreviews[]` with prefix `"reveal-pinned"`. Comment hover continues to manage `commentsHoverPreviews[]` with prefix `"comment-hover"`. Guard all comment hover/dismiss functions to not touch reveal previews. Remove the v1/v2 gating of `selectionVisible`, `selectionLabelVisible`, `dragVisible` (the active selection tool should always work). Remove `grabbedBoxes`/`labelInstances` blanket gating at the renderer level.

**Iterates on:** `implementation-plan-v2.md` (3-state toggle, shared preview tracking)

**Bug being fixed:** Reveal previews and hover previews share `commentsHoverPreviews[]`. When comment hover ends, `clearCommentsHoverPreviews()` wipes the reveal previews too.

**Tech Stack:** SolidJS (signals, createMemo, createEffect), Tailwind CSS, SVG icons

---

## Codebase Orientation (current v2 state)

| Concept | File | Lines | Current state |
|---------|------|-------|---------------|
| Type | `src/types.ts:363-371` | `selectionVisibility: SelectionVisibility` (`"reveal" \| "normal" \| "hidden"`) |
| State persistence | `src/components/toolbar/state.ts:39-42` | Parses `selectionVisibility` enum, defaults to `"normal"` |
| Toolbar button | `src/components/toolbar/toolbar-content.tsx:156-175` | 3-state cycle with 3 icons (filled/outline/off) |
| Visibility memos | `src/core/index.tsx:3258-3264` | `selectionVisibility` + derived `selectionsHidden` memo |
| Cycle handler | `src/core/index.tsx:3266-3273` | `hidden → reveal → normal → hidden` |
| Selection gating | `src/core/index.tsx:3275-3282` | `selectionVisible` gated by `selectionsHidden()` |
| Label gating | `src/core/index.tsx:3314-3315` | `selectionLabelVisible` gated by `selectionsHidden()` |
| Drag gating | `src/core/index.tsx:3400-3407` | `dragVisible` gated by `selectionsHidden()` |
| Renderer gating | `src/core/index.tsx:4148,4151` | `grabbedBoxes`/`labelInstances` blanket-gated by `selectionsHidden()` |
| Hover previews tracking | `src/core/index.tsx:335` | `commentsHoverPreviews[]` — shared by BOTH reveal and hover |
| Reveal effect | `src/core/index.tsx:4045-4054` | Calls `showAllCommentItemPreviews()` on reveal |
| Comment hover guard | `src/core/index.tsx:3989` | Guards individual item hover, but NOT button hover |
| Button hover (BUG) | `src/core/index.tsx:4000-4019` | `handleCommentsButtonHover` calls `clearCommentsHoverPreviews()` unconditionally |
| CopyAll hover (BUG) | `src/core/index.tsx:4029-4037` | `handleCommentsCopyAllHover` calls `clearCommentsHoverPreviews()` unconditionally |
| Dismiss (BUG) | `src/core/index.tsx:3795-3802` | `dismissCommentsDropdown` calls `clearCommentsHoverPreviews()` unconditionally |
| Renderer props | `src/types.ts:554-555` | `selectionVisibility?`, `onCycleSelectionVisibility?` |

All paths are relative to `packages/react-grab/`.

---

### Task 1: Simplify type from 3-state to 2-state

**Files:**
- Modify: `packages/react-grab/src/types.ts`

**Step 1: Remove "normal" from the union**

Find the `SelectionVisibility` type and `ToolbarState` interface. Replace:

```typescript
// Remove old type
export type SelectionVisibility = "reveal" | "normal" | "hidden";
```

The field in `ToolbarState` becomes a simple boolean:

```typescript
export interface ToolbarState {
  edge: "top" | "bottom" | "left" | "right";
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction?: string;
  selectionsRevealed: boolean;
}
```

**Step 2: Remove `SelectionVisibility` type entirely**

Delete the `export type SelectionVisibility = ...` line. Also remove it from `ReactGrabRendererProps` and replace:

```typescript
// Replace these two lines in ReactGrabRendererProps:
// selectionVisibility?: SelectionVisibility;
// onCycleSelectionVisibility?: () => void;

// With:
selectionsRevealed?: boolean;
onToggleSelectionsRevealed?: () => void;
```

**Step 3: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): simplify to boolean selectionsRevealed toggle"
```

---

### Task 2: Update state persistence

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/state.ts`

**Step 1: Replace `selectionVisibility` parsing with `selectionsRevealed`**

Replace the `selectionVisibility` block with:

```typescript
selectionsRevealed:
  typeof record.selectionsRevealed === "boolean"
    ? record.selectionsRevealed
    : false,
```

This handles migration from v2 (`selectionVisibility` string → ignored, defaults `false`).

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/toolbar/state.ts
git commit -m "feat(toolbar-state): persist selectionsRevealed boolean"
```

---

### Task 3: Update toolbar button to 2-state toggle

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/toolbar-content.tsx`

**Step 1: Update imports**

Remove the `SelectionVisibility` type import. Remove `IconEye` import (only need filled and off).

Keep:
```typescript
import { IconEyeFilled } from "../icons/icon-eye-filled.jsx";
import { IconEyeOff } from "../icons/icon-eye-off.jsx";
```

**Step 2: Update props**

Replace in `ToolbarContentProps`:
```typescript
// Remove:
selectionVisibility: SelectionVisibility;
onCycleSelectionVisibility?: () => void;

// Add:
selectionsRevealed: boolean;
onToggleSelectionsRevealed?: () => void;
```

**Step 3: Simplify `defaultVisibilityButton`**

Replace the entire function with a simple 2-state toggle:

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

### Task 4: Wire through toolbar/index.tsx

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/index.tsx`

**Step 1: Update `ToolbarProps`**

Replace:
```typescript
// Remove:
selectionVisibility?: SelectionVisibility;
onCycleSelectionVisibility?: () => void;

// Add:
selectionsRevealed?: boolean;
onToggleSelectionsRevealed?: () => void;
```

Remove the `SelectionVisibility` type import.

**Step 2: Update `<ToolbarContent>` call**

Replace:
```typescript
selectionVisibility={props.selectionVisibility ?? "normal"}
onCycleSelectionVisibility={props.onCycleSelectionVisibility}
```

With:
```typescript
selectionsRevealed={props.selectionsRevealed ?? false}
onToggleSelectionsRevealed={props.onToggleSelectionsRevealed}
```

**Step 3: Replace `selectionVisibility` in all `ToolbarState` object literals**

Search for all `selectionVisibility:` in this file (~7 places in `saveAndNotify` calls). Replace each with:

```typescript
selectionsRevealed: props.selectionsRevealed ?? false,
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/toolbar/index.tsx
git commit -m "feat(toolbar): wire selectionsRevealed through toolbar props"
```

---

### Task 5: Wire through renderer.tsx

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Update prop passthrough**

Replace:
```typescript
selectionVisibility={props.selectionVisibility}
onCycleSelectionVisibility={props.onCycleSelectionVisibility}
```

With:
```typescript
selectionsRevealed={props.selectionsRevealed}
onToggleSelectionsRevealed={props.onToggleSelectionsRevealed}
```

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(renderer): wire selectionsRevealed prop to toolbar"
```

---

### Task 6: Rewrite core orchestrator logic (THE KEY TASK)

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

Read ALL referenced lines before making changes. This task has many small changes spread across the file.

**Step 1: Add separate reveal preview tracking**

Find `commentsHoverPreviews` declaration (line 335). After it, add:

```typescript
let revealedPreviews: { boxId: string; labelId: string | null }[] = [];
```

**Step 2: Create `showRevealedPreviews` and `clearRevealedPreviews`**

Find `clearCommentsHoverPreviews` (line 3672). After it, add:

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
    const connectedElements = getConnectedCommentElements(item);
    const previewBounds = connectedElements.map((element) =>
      createElementBounds(element),
    );
    if (previewBounds.length === 0) continue;

    for (const [index, bounds] of previewBounds.entries()) {
      const previewElement = connectedElements[index];
      const boxId = `reveal-pinned-${item.id}-${index}`;
      actions.addGrabbedBox({
        id: boxId,
        bounds,
        createdAt: 0,
        element: previewElement,
      });

      let labelId: string | null = null;
      if (index === 0) {
        labelId = `reveal-pinned-label-${item.id}`;
        actions.addLabelInstance({
          id: labelId,
          bounds,
          tagName: item.tagName,
          componentName: item.componentName,
          elementsCount: item.elementsCount,
          status: "idle",
          isPromptMode: Boolean(item.commentText),
          inputValue: item.commentText ?? undefined,
          createdAt: 0,
          element: previewElement,
          mouseX: bounds.x + bounds.width / 2,
        });
      }

      revealedPreviews.push({ boxId, labelId });
    }
  }
};
```

This mirrors `addCommentItemPreview` + `showAllCommentItemPreviews` but tracks in `revealedPreviews` with prefix `"reveal-pinned"`.

**Step 3: Replace `selectionVisibility` memo with `selectionsRevealed`**

Find (around lines 3258-3273) and replace the entire block:

```typescript
// Remove:
const selectionVisibility = createMemo(
  () => currentToolbarState()?.selectionVisibility ?? "normal",
);

const selectionsHidden = createMemo(
  () => selectionVisibility() === "hidden",
);

const cycleSelectionVisibility = () => {
  const current = selectionVisibility();
  const next: SelectionVisibility =
    current === "hidden" ? "reveal" :
    current === "reveal" ? "normal" :
    "hidden";
  updateToolbarState({ selectionVisibility: next });
};
```

With:

```typescript
const selectionsRevealed = createMemo(
  () => currentToolbarState()?.selectionsRevealed ?? false,
);
```

**Step 4: Remove visibility gating from selection memos**

In `selectionVisible` memo (around line 3275), **remove** the `selectionsHidden` guard:

```typescript
// Remove this line:
if (selectionsHidden()) return false;
```

In `selectionLabelVisible` memo (around line 3314), **remove** the `selectionsHidden` guard:

```typescript
// Remove this line:
if (selectionsHidden()) return false;
```

In `dragVisible` memo (around line 3400), **remove** the `!selectionsHidden() &&` condition:

```typescript
// Change from:
!selectionsHidden() &&
isThemeEnabled() &&
// To:
isThemeEnabled() &&
```

**Step 5: Remove blanket gating at renderer props**

Find (around lines 4148, 4151):

```typescript
// Change from:
labelInstances={selectionsHidden() ? [] : computedLabelInstances()}
grabbedBoxes={selectionsHidden() ? [] : computedGrabbedBoxes()}

// To:
labelInstances={computedLabelInstances()}
grabbedBoxes={computedGrabbedBoxes()}
```

**Step 6: Update `updateToolbarState`**

Find (around line 345):
```typescript
// Replace:
selectionVisibility: currentState?.selectionVisibility ?? "normal",

// With:
selectionsRevealed: currentState?.selectionsRevealed ?? false,
```

Remove the `SelectionVisibility` import if present.

**Step 7: Update `setToolbarState` API call**

Search for any other `selectionVisibility:` in the file (public API around line 4350):

```typescript
// Replace:
selectionVisibility: currentState?.selectionVisibility ?? "normal",

// With:
selectionsRevealed: currentState?.selectionsRevealed ?? false,
```

**Step 8: Replace reveal effect**

Find the two `createEffect` blocks (around lines 4045-4063). Replace both with:

```typescript
createEffect(
  on(selectionsRevealed, (revealed, prevRevealed) => {
    if (prevRevealed && !revealed) {
      clearRevealedPreviews();
    }
    if (revealed) {
      clearRevealedPreviews();
      showRevealedPreviews();
    }
  }),
);

createEffect(
  on(commentItems, () => {
    if (selectionsRevealed()) {
      clearRevealedPreviews();
      showRevealedPreviews();
    }
  }),
);
```

**Step 9: Guard comment hover handlers**

The key fix. Guard ALL functions that call `clearCommentsHoverPreviews()` or `showAllCommentItemPreviews()` to be no-ops when revealed:

**`handleCommentItemHover`** (around line 3988) — already has a guard, update it:

```typescript
const handleCommentItemHover = (commentItemId: string | null) => {
  if (selectionsRevealed()) return;
  clearCommentsHoverPreviews();
  // ... rest unchanged
};
```

**`handleCommentsButtonHover`** (around line 4000) — add guard at top:

```typescript
const handleCommentsButtonHover = (isHovered: boolean) => {
  if (selectionsRevealed()) return;
  cancelCommentsHoverOpenTimeout();
  clearCommentsHoverPreviews();
  // ... rest unchanged
};
```

**`handleCommentsCopyAllHover`** (around line 4029) — add guard at top:

```typescript
const handleCommentsCopyAllHover = (isHovered: boolean) => {
  if (selectionsRevealed()) return;
  clearCommentsHoverPreviews();
  // ... rest unchanged
};
```

**`dismissCommentsDropdown`** (around line 3795) — guard the `clearCommentsHoverPreviews` call:

```typescript
const dismissCommentsDropdown = () => {
  cancelCommentsHoverOpenTimeout();
  cancelCommentsHoverCloseTimeout();
  stopTrackingDropdownPosition();
  if (!selectionsRevealed()) {
    clearCommentsHoverPreviews();
  }
  setCommentsDropdownPosition(null);
  setIsCommentsHoverOpen(false);
};
```

**Step 10: Update `<ReactGrabRenderer>` call**

Find (around lines 4255-4258):

```typescript
// Replace:
selectionVisibility={selectionVisibility()}
onCycleSelectionVisibility={cycleSelectionVisibility}

// With:
selectionsRevealed={selectionsRevealed()}
onToggleSelectionsRevealed={() => {
  updateToolbarState({ selectionsRevealed: !selectionsRevealed() });
}}
```

**Step 11: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (zero errors)

**Step 12: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): separate reveal previews from hover, remove selection gating"
```

---

### Task 7: Clean up unused icon

**Files:**
- Optionally delete: `packages/react-grab/src/components/icons/icon-eye.tsx`

The "normal" state used the outline eye icon. Since we removed the normal state, `IconEye` is no longer used. Check for any remaining imports:

```bash
cd packages/react-grab && grep -r "icon-eye\." src/ --include="*.tsx" --include="*.ts" | grep -v "icon-eye-off" | grep -v "icon-eye-filled"
```

If no imports remain, delete it. If something still imports it, leave it.

**Commit:**

```bash
git rm packages/react-grab/src/components/icons/icon-eye.tsx 2>/dev/null
git commit -m "chore: remove unused IconEye component"
```

---

### Task 8: Build and verify

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

Expected: Build succeeds.

**Step 2: Test in dev server**

Verify these scenarios:

| Scenario | Expected |
|----------|----------|
| Toggle OFF (default) | No comment selections visible |
| Toggle OFF + hover comments | No comment selections visible (hover blocked) |
| Toggle OFF + hover element to create selection | Selection overlay appears normally (active tool works) |
| Toggle ON | All comment selections appear immediately |
| Toggle ON + hover comments button | Selections stay visible (not duplicated, not cleared) |
| Toggle ON + hover individual comment | Selections stay visible (no change) |
| Toggle ON + leave comment hover | Selections stay visible (not cleared!) |
| Toggle ON + add new comment | New comment's selection appears immediately |
| Toggle ON + delete a comment | Its selection disappears, others remain |
| Toggle ON → Toggle OFF | All revealed selections disappear |
| Page reload | Toggle state persists via localStorage |
| Old v2 localStorage values | Gracefully fall back to `false` |

**Step 3: Commit if fixes needed**

---

## File Change Summary

| File | Action | What changes from v2 |
|------|--------|---------------------|
| `src/types.ts` | Modify | `SelectionVisibility` enum → `selectionsRevealed: boolean` |
| `src/components/toolbar/state.ts` | Modify | Parse boolean instead of enum |
| `src/components/icons/icon-eye.tsx` | Delete | No longer needed (no "normal" state) |
| `src/components/toolbar/toolbar-content.tsx` | Modify | 2-state toggle: filled eye / eye-off |
| `src/components/toolbar/index.tsx` | Modify | Replace enum props with boolean |
| `src/components/renderer.tsx` | Modify | Replace enum props with boolean |
| `src/core/index.tsx` | Modify | Separate `revealedPreviews[]` tracking, remove selection gating, guard hover handlers |

## Key architectural change

**v2 (broken):** One tracking array (`commentsHoverPreviews`) shared between reveal and hover. Hover cleanup wipes reveal.

**v3 (fixed):** Two independent tracking arrays:
- `revealedPreviews[]` — managed by toggle effect only, prefix `"reveal-pinned"`
- `commentsHoverPreviews[]` — managed by hover only, prefix `"comment-hover"` (guarded to no-op when revealed)

Additionally: the active selection tool (`selectionVisible`, `selectionLabelVisible`, `dragVisible`) is no longer gated by the toggle. It always works.
