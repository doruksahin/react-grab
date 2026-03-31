# Toggle Hide/Reveal Selections v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the 2-state visibility toggle (hidden/shown) to a 3-state cycle (Reveal → Normal → Hide) where "Reveal" permanently pins all comment-associated selection overlays on screen without hovering.

**Architecture:** Replace `selectionsHidden: boolean` with `selectionVisibility: "reveal" | "normal" | "hidden"` in `ToolbarState`. In "reveal" mode, call the existing `showAllCommentItemPreviews()` to pin all comment selections with `createdAt: 0` (prevents auto-fade). In "hidden" mode, gate all visibility memos to `false`. In "normal" mode, preserve the existing hover-based behavior. A reactive effect watches the visibility state and triggers reveal/clear when it changes.

**Tech Stack:** SolidJS (signals, createMemo, createEffect), Tailwind CSS, SVG icons

**Iterates on:** `docs/plans/reveal-hide-toggle/implementation-plan.md` (v1 — boolean toggle)

---

## Codebase Orientation

| Concept | File | What to look for |
|---------|------|-----------------|
| Current toggle state | `packages/react-grab/src/types.ts:364-371` | `ToolbarState.selectionsHidden: boolean` — replace with enum |
| State persistence | `packages/react-grab/src/components/toolbar/state.ts:39-42` | `selectionsHidden` parsing in `loadToolbarState` — change to string enum |
| Toolbar button | `packages/react-grab/src/components/toolbar/toolbar-content.tsx:156-175` | `defaultVisibilityButton` — change to 3-state cycle with 3 icons |
| Icon components | `packages/react-grab/src/components/icons/icon-eye.tsx`, `icon-eye-off.tsx` | Existing icons — add a third "filled eye" variant |
| Visibility gating | `packages/react-grab/src/core/index.tsx:3257-3268` | `selectionsHidden` memo and `selectionVisible` gating — change to enum checks |
| Reveal logic | `packages/react-grab/src/core/index.tsx:4024-4028` | `showAllCommentItemPreviews()` — already exists, call on reveal |
| Clear logic | `packages/react-grab/src/core/index.tsx:3672-3680` | `clearCommentsHoverPreviews()` — call when leaving reveal |
| Hover preview tracking | `packages/react-grab/src/core/index.tsx:335` | `commentsHoverPreviews` array — tracks boxes/labels for cleanup |
| updateToolbarState | `packages/react-grab/src/core/index.tsx:337-354` | Spreads updates into ToolbarState — has `selectionsHidden` |
| Toolbar prop passthrough | `packages/react-grab/src/components/toolbar/index.tsx:100-101` | `selectionsHidden` and `onToggleSelectionsHidden` props |
| Renderer passthrough | `packages/react-grab/src/components/renderer.tsx:220-221` | Passes to `<Toolbar>` |
| ReactGrabRendererProps | `packages/react-grab/src/types.ts:554-555` | `selectionsHidden?: boolean` — change to enum |
| PoC | `docs/plans/reveal-hide-toggle/poc.html` | 3-state PoC (already updated) |

---

### Task 1: Change `ToolbarState` type from boolean to enum

**Files:**
- Modify: `packages/react-grab/src/types.ts:364-371`

**Step 1: Define the union type and replace field**

In `types.ts`, change `selectionsHidden: boolean` to `selectionVisibility`:

```typescript
export type SelectionVisibility = "reveal" | "normal" | "hidden";

export interface ToolbarState {
  edge: "top" | "bottom" | "left" | "right";
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction?: string;
  selectionVisibility: SelectionVisibility;
}
```

**Step 2: Update `ReactGrabRendererProps`**

Find `selectionsHidden?: boolean` and `onToggleSelectionsHidden?: () => void` in `ReactGrabRendererProps` (around line 554) and replace:

```typescript
selectionVisibility?: SelectionVisibility;
onCycleSelectionVisibility?: () => void;
```

**Step 3: Verify type errors appear**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Many errors — every usage of `selectionsHidden` will fail. This is expected.

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): replace selectionsHidden boolean with selectionVisibility enum"
```

---

### Task 2: Update toolbar state persistence

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/state.ts:39-42`

**Step 1: Replace `selectionsHidden` parsing with `selectionVisibility`**

Replace the `selectionsHidden` block (lines 39-42) with:

```typescript
selectionVisibility:
  record.selectionVisibility === "reveal" ||
  record.selectionVisibility === "normal" ||
  record.selectionVisibility === "hidden"
    ? record.selectionVisibility
    : "normal",
```

This handles:
- Fresh installs (no stored value → `"normal"`)
- Old boolean values from v1 (invalid string → `"normal"`)
- Valid enum values → preserved

**Step 2: Verify typecheck for this file**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: `state.ts` errors resolved. Errors elsewhere remain.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/toolbar/state.ts
git commit -m "feat(toolbar-state): persist selectionVisibility enum to localStorage"
```

---

### Task 3: Create filled eye icon for "reveal" state

**Files:**
- Create: `packages/react-grab/src/components/icons/icon-eye-filled.tsx`

**Step 1: Create the icon**

The "reveal" state needs a visually distinct icon — same eye shape but with filled pupil. Follow the pattern from `icon-eye.tsx`:

```tsx
import type { Component } from "solid-js";

interface IconEyeFilledProps {
  size?: number;
  class?: string;
}

export const IconEyeFilled: Component<IconEyeFilledProps> = (props) => {
  const size = () => props.size ?? 14;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
};
```

The only difference from `IconEye` is `fill="currentColor"` on the `<circle>`.

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS for this file (standalone icon)

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/icons/icon-eye-filled.tsx
git commit -m "feat(icons): add filled eye icon for reveal state"
```

---

### Task 4: Update toolbar button to 3-state cycle

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/toolbar-content.tsx`

**Step 1: Update imports**

Replace the icon imports (lines 7-8) and add the new icon + type:

```typescript
import { IconEye } from "../icons/icon-eye.jsx";
import { IconEyeOff } from "../icons/icon-eye-off.jsx";
import { IconEyeFilled } from "../icons/icon-eye-filled.jsx";
```

Add the type import at the top of the file:

```typescript
import type { SelectionVisibility } from "../../types.js";
```

**Step 2: Replace props**

In `ToolbarContentProps`, replace:
```typescript
// Remove these:
selectionsHidden: boolean;
onToggleSelectionsHidden?: () => void;
```

With:
```typescript
selectionVisibility: SelectionVisibility;
onCycleSelectionVisibility?: () => void;
```

**Step 3: Replace `defaultVisibilityButton`**

Replace the entire `defaultVisibilityButton` function (lines 156-175) with:

```tsx
const defaultVisibilityButton = () => {
  const visibility = () => props.selectionVisibility;

  const ariaLabel = () => {
    switch (visibility()) {
      case "reveal": return "Showing all selections (click for normal)";
      case "normal": return "Normal selection mode (click to hide)";
      case "hidden": return "Selections hidden (click to reveal)";
    }
  };

  const icon = () => {
    switch (visibility()) {
      case "reveal":
        return <IconEyeFilled size={14} class="text-black transition-colors" />;
      case "normal":
        return <IconEye size={14} class="text-[#B3B3B3] transition-colors" />;
      case "hidden":
        return <IconEyeOff size={14} class="text-[#B3B3B3] transition-colors" />;
    }
  };

  return (
    <button
      data-react-grab-ignore-events
      data-react-grab-toolbar-visibility
      aria-label={ariaLabel()}
      class={cn(
        "contain-layout flex items-center justify-center cursor-pointer interactive-scale touch-hitbox",
        buttonSpacingClass(),
        hitboxConstraintClass(),
      )}
      onClick={() => props.onCycleSelectionVisibility?.()}
    >
      {icon()}
    </button>
  );
};
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `ToolbarContent` is used without the new prop. Fixed in Task 6.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/toolbar/toolbar-content.tsx
git commit -m "feat(toolbar): update visibility button to 3-state cycle (reveal/normal/hide)"
```

---

### Task 5: Wire 3-state toggle through toolbar/index.tsx

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/index.tsx`

**Step 1: Update `ToolbarProps`**

Replace (around lines 100-101):
```typescript
// Remove:
selectionsHidden?: boolean;
onToggleSelectionsHidden?: () => void;
```

With:
```typescript
selectionVisibility?: SelectionVisibility;
onCycleSelectionVisibility?: () => void;
```

Add import at top:
```typescript
import type { SelectionVisibility } from "../../types.js";
```

**Step 2: Update `<ToolbarContent>` call**

Find where `ToolbarContent` is rendered (around line 1058-1062) and replace:

```typescript
// Remove:
selectionsHidden={props.selectionsHidden ?? false}
onToggleSelectionsHidden={props.onToggleSelectionsHidden}
```

With:
```typescript
selectionVisibility={props.selectionVisibility ?? "normal"}
onCycleSelectionVisibility={props.onCycleSelectionVisibility}
```

**Step 3: Replace `selectionsHidden` in all `ToolbarState` object literals**

Search for all `selectionsHidden:` in this file. There are ~7 places where `ToolbarState` is constructed inline in `saveAndNotify` calls. Replace each occurrence:

```typescript
// Replace every:
selectionsHidden: props.selectionsHidden ?? false,
// With:
selectionVisibility: props.selectionVisibility ?? "normal",
```

**Step 4: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Only `core/index.tsx` and `renderer.tsx` errors remain.

**Step 5: Commit**

```bash
git add packages/react-grab/src/components/toolbar/index.tsx
git commit -m "feat(toolbar): wire selectionVisibility through toolbar props and state"
```

---

### Task 6: Wire 3-state toggle through renderer.tsx

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx`

**Step 1: Update prop passthrough**

Find (around lines 220-221):
```typescript
// Replace:
selectionsHidden={props.selectionsHidden}
onToggleSelectionsHidden={props.onToggleSelectionsHidden}
```

With:
```typescript
selectionVisibility={props.selectionVisibility}
onCycleSelectionVisibility={props.onCycleSelectionVisibility}
```

**Step 2: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Only `core/index.tsx` errors remain.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(renderer): wire selectionVisibility prop to toolbar"
```

---

### Task 7: Wire 3-state toggle in core orchestrator (index.tsx)

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

This is the main wiring task. Read all referenced lines before making changes.

**Step 1: Replace the `selectionsHidden` memo**

Find (around lines 3257-3259):
```typescript
// Remove:
const selectionsHidden = createMemo(
  () => currentToolbarState()?.selectionsHidden ?? false,
);
```

Replace with:
```typescript
const selectionVisibility = createMemo(
  () => currentToolbarState()?.selectionVisibility ?? "normal",
);

const selectionsHidden = createMemo(
  () => selectionVisibility() === "hidden",
);
```

Note: We keep `selectionsHidden` as a derived memo so the existing gating in `selectionVisible`, `selectionLabelVisible`, `dragVisible` still works unchanged.

**Step 2: Add a reactive effect for "reveal" mode**

After the `selectionsHidden` memo, add an effect that shows/clears all comment previews when switching to/from reveal:

```typescript
createEffect(
  on(selectionVisibility, (visibility, prevVisibility) => {
    if (prevVisibility === "reveal" && visibility !== "reveal") {
      clearCommentsHoverPreviews();
    }
    if (visibility === "reveal") {
      clearCommentsHoverPreviews();
      showAllCommentItemPreviews();
    }
  }),
);
```

**Important:** The `showAllCommentItemPreviews` function (line 4024) and `clearCommentsHoverPreviews` function (line 3672) already exist. They use `createdAt: 0` for boxes/labels, which prevents auto-fade.

**BUT:** There's a dependency ordering issue — `showAllCommentItemPreviews` and `clearCommentsHoverPreviews` are defined much later in the file (lines 3672 and 4024). The `selectionVisibility` memo is at line 3257. In JavaScript, function declarations are hoisted but `const` arrow functions are not. Both preview functions are `const` arrow functions.

**Solution:** Move the `createEffect` to after both functions are defined. Place it right after `showAllCommentItemPreviews` (around line 4029):

```typescript
// RIGHT AFTER showAllCommentItemPreviews (line 4028):
createEffect(
  on(selectionVisibility, (visibility, prevVisibility) => {
    if (prevVisibility === "reveal" && visibility !== "reveal") {
      clearCommentsHoverPreviews();
    }
    if (visibility === "reveal") {
      clearCommentsHoverPreviews();
      showAllCommentItemPreviews();
    }
  }),
);
```

**Step 3: Update `updateToolbarState` function**

Find (around line 345):
```typescript
// Replace:
selectionsHidden: currentState?.selectionsHidden ?? false,
```

With:
```typescript
selectionVisibility: currentState?.selectionVisibility ?? "normal",
```

**Step 4: Create the cycle handler**

The cycle order is: `hidden → reveal → normal → hidden`. Define a helper near the `selectionVisibility` memo:

```typescript
const cycleSelectionVisibility = () => {
  const current = selectionVisibility();
  const next: SelectionVisibility =
    current === "hidden" ? "reveal" :
    current === "reveal" ? "normal" :
    "hidden";
  updateToolbarState({ selectionVisibility: next });
};
```

Add import at top of file (if not already present via types):
```typescript
import type { SelectionVisibility } from "../types.js";
```

**Step 5: Update `<ReactGrabRenderer>` call**

Find (around lines 4219-4222):
```typescript
// Replace:
selectionsHidden={selectionsHidden()}
onToggleSelectionsHidden={() => {
  updateToolbarState({ selectionsHidden: !selectionsHidden() });
}}
```

With:
```typescript
selectionVisibility={selectionVisibility()}
onCycleSelectionVisibility={cycleSelectionVisibility}
```

**Step 6: Update `grabbedBoxes` and `labelInstances` gating**

Find (around lines 4112-4115):
```typescript
labelInstances={selectionsHidden() ? [] : computedLabelInstances()}
grabbedBoxes={selectionsHidden() ? [] : computedGrabbedBoxes()}
```

These already reference the `selectionsHidden` derived memo, which now returns `selectionVisibility() === "hidden"`. **No change needed** — the gating still works.

**Step 7: Update `setToolbarState` API call**

Search for any other place in `index.tsx` that constructs a `ToolbarState` with `selectionsHidden`. There's one in the public API (around line 4334):

```typescript
// Replace:
selectionsHidden: currentState?.selectionsHidden ?? false,
```

With:
```typescript
selectionVisibility: currentState?.selectionVisibility ?? "normal",
```

**Step 8: Handle reveal mode when comments change**

When in "reveal" mode, if a new comment is added or removed, the previews should update. Add an effect after the reveal effect (around line 4035):

```typescript
createEffect(
  on(commentItems, () => {
    if (selectionVisibility() === "reveal") {
      clearCommentsHoverPreviews();
      showAllCommentItemPreviews();
    }
  }),
);
```

**Step 9: Prevent comment hover from duplicating in reveal mode**

When in "reveal" mode, the comment hover handler (`handleCommentItemHover`, around line 3974) should be a no-op to avoid duplicating selections. Add a guard at the top:

```typescript
const handleCommentItemHover = (commentItemId: string | null) => {
  if (selectionVisibility() === "reveal") return;
  clearCommentsHoverPreviews();
  // ... rest unchanged
};
```

**Step 10: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (zero errors)

**Step 11: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(core): wire 3-state selectionVisibility with reveal mode effect"
```

---

### Task 8: Build and verify

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab/packages/react-grab && pnpm build
```

Expected: Build succeeds.

**Step 2: Verify symlink**

```bash
ls -la /Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2/node_modules/react-grab
```

Expected: Symlink pointing to `../../react-grab/packages/react-grab`

**Step 3: Test in dev server**

Verify:
- Toolbar shows eye icon (dim = normal mode by default)
- Click 1: cycles to "hidden" (eye-off icon) — all selections disappear, even on hover
- Click 2: cycles to "reveal" (filled eye icon) — all comment selections appear permanently on page
- Click 3: cycles back to "normal" (dim eye) — selections only on hover
- In "reveal" mode: add a new comment → its selection appears immediately
- In "reveal" mode: hovering over comments panel doesn't duplicate selections
- State persists across page reloads (localStorage)
- Old localStorage values from v1 (`selectionsHidden: true/false`) gracefully fall back to `"normal"`

**Step 4: Commit if fixes needed**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/types.ts` | Modify | Replace `selectionsHidden: boolean` with `selectionVisibility: SelectionVisibility` in `ToolbarState` + `ReactGrabRendererProps` |
| `src/components/toolbar/state.ts` | Modify | Parse `selectionVisibility` enum in `loadToolbarState` |
| `src/components/icons/icon-eye-filled.tsx` | Create | Filled eye SVG icon for "reveal" state |
| `src/components/toolbar/toolbar-content.tsx` | Modify | Update button to 3-state cycle with 3 icons |
| `src/components/toolbar/index.tsx` | Modify | Replace `selectionsHidden` props with `selectionVisibility` |
| `src/components/renderer.tsx` | Modify | Pass `selectionVisibility` to toolbar |
| `src/core/index.tsx` | Modify | 3-state memo, reveal/clear effects, cycle handler, comment hover guard |

## Migration from v1

The v1 implementation stored `selectionsHidden: boolean` in localStorage. The v2 `loadToolbarState` parser will not recognize the old boolean value as a valid `SelectionVisibility` string, so it falls back to `"normal"`. This is the correct safe default — users get the standard hover behavior.
