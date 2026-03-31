# Toggle Hide/Reveal Selections — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toolbar button that toggles visibility of all selection overlays (grabbed boxes, selection labels, overlay canvas) without destroying selection state.

**Architecture:** `ToolbarState` gains a `selectionsHidden: boolean` field, persisted to localStorage alongside existing toolbar preferences. The renderer in `core/index.tsx` reads this flag and gates `selectionVisible`, `selectionLabelVisible`, `dragVisible`, and `grabbedBoxes` props. A new eye/eye-off button in the toolbar triggers the toggle.

**Tech Stack:** SolidJS (signals, createMemo, createStore), Tailwind CSS, SVG icons

---

## Codebase Orientation

Before working on any task, read these files to understand the patterns:

| Concept | File | What to look for |
|---------|------|-----------------|
| Shared types | `packages/react-grab/src/types.ts:363-369` | `ToolbarState` interface — add field here |
| State persistence | `packages/react-grab/src/components/toolbar/state.ts` | `loadToolbarState` / `saveToolbarState` — parse + serialize pattern |
| Toolbar buttons | `packages/react-grab/src/components/toolbar/toolbar-content.tsx:136-178` | Button pattern: `data-react-grab-*` attr, `cn()` classes, `buttonSpacingClass()` |
| Icon pattern | `packages/react-grab/src/components/icons/icon-select.tsx` | `Component<{ size?, class? }>` with SVG |
| Visibility gating | `packages/react-grab/src/core/index.tsx:3256-3262` | `selectionVisible` createMemo — this is where we gate |
| Renderer props | `packages/react-grab/src/core/index.tsx:4081-4100` | How visibility props flow to `<ReactGrabRenderer>` |
| Toolbar state signal | `packages/react-grab/src/core/index.tsx:318-319` | `currentToolbarState` signal — how toolbar state is accessed in core |

---

### Task 1: Add `selectionsHidden` to `ToolbarState` type

**Files:**
- Modify: `packages/react-grab/src/types.ts:363-369`

**Step 1: Add field to interface**

In `types.ts`, add `selectionsHidden` to the existing `ToolbarState` interface:

```typescript
export interface ToolbarState {
  edge: "top" | "bottom" | "left" | "right";
  ratio: number;
  collapsed: boolean;
  enabled: boolean;
  defaultAction?: string;
  selectionsHidden: boolean;
}
```

**Step 2: Verify no type errors introduced**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Type errors in `state.ts` (loadToolbarState doesn't return the new field yet) and possibly `index.tsx`. This is expected — we fix them in the next tasks.

**Step 3: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(types): add selectionsHidden to ToolbarState"
```

---

### Task 2: Update toolbar state persistence

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/state.ts:11-46`

**Step 1: Add `selectionsHidden` to `loadToolbarState`**

After the `defaultAction` parsing (around line 40), add:

```typescript
selectionsHidden:
  typeof record.selectionsHidden === "boolean"
    ? record.selectionsHidden
    : false,
```

The full return should now include all 6 fields. `saveToolbarState` already does `JSON.stringify(state)` — it will automatically serialize the new field.

**Step 2: Verify typecheck passes for this file**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: `state.ts` errors resolved. May still have errors elsewhere.

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/toolbar/state.ts
git commit -m "feat(toolbar-state): persist selectionsHidden to localStorage"
```

---

### Task 3: Create eye icon components

**Files:**
- Create: `packages/react-grab/src/components/icons/icon-eye.tsx`
- Create: `packages/react-grab/src/components/icons/icon-eye-off.tsx`

**Step 1: Create `icon-eye.tsx`**

Follow the exact pattern from `icon-select.tsx`:

```tsx
import type { Component } from "solid-js";

interface IconEyeProps {
  size?: number;
  class?: string;
}

export const IconEye: Component<IconEyeProps> = (props) => {
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
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};
```

**Step 2: Create `icon-eye-off.tsx`**

```tsx
import type { Component } from "solid-js";

interface IconEyeOffProps {
  size?: number;
  class?: string;
}

export const IconEyeOff: Component<IconEyeOffProps> = (props) => {
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
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
};
```

**Step 3: Verify icons render (visual)**

These are pure SVG — no runtime dependencies. Verify no syntax errors:
Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS (icons are standalone)

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/icons/icon-eye.tsx packages/react-grab/src/components/icons/icon-eye-off.tsx
git commit -m "feat(icons): add eye and eye-off icons for visibility toggle"
```

---

### Task 4: Add toggle button to toolbar

**Files:**
- Modify: `packages/react-grab/src/components/toolbar/toolbar-content.tsx`

**Step 1: Add `selectionsHidden` and `onToggleSelectionsHidden` to `ToolbarContentProps`**

Add to the existing interface (around line 7):

```typescript
selectionsHidden: boolean;
onToggleSelectionsHidden?: () => void;
```

**Step 2: Add the visibility toggle button**

After `defaultCopyAllButton` (line 149) and before `defaultToggleButton` (line 151), add:

```tsx
const defaultVisibilityButton = () => (
  <button
    data-react-grab-ignore-events
    data-react-grab-toolbar-visibility
    aria-label={props.selectionsHidden ? "Show selections" : "Hide selections"}
    aria-pressed={!props.selectionsHidden}
    class={cn(
      "contain-layout flex items-center justify-center cursor-pointer interactive-scale touch-hitbox",
      buttonSpacingClass(),
      hitboxConstraintClass(),
    )}
    onClick={() => props.onToggleSelectionsHidden?.()}
  >
    {props.selectionsHidden ? (
      <IconEyeOff size={14} class="text-[#B3B3B3] transition-colors" />
    ) : (
      <IconEye size={14} class="text-black/70 transition-colors" />
    )}
  </button>
);
```

**Step 3: Add the button to the toolbar layout**

In the return JSX, after the copyAll grid block (line 278) and before the closing `</div>` of the expandable buttons ref container (line 279), add a new grid block:

```tsx
<div
  class={cn(
    "grid",
    gridTransitionClass(),
    expandGridClass(Boolean(props.enabled)),
  )}
>
  <div class={cn("relative overflow-visible", minDimensionClass())}>
    {defaultVisibilityButton()}
  </div>
</div>
```

**Step 4: Add imports**

At the top of the file, add:

```typescript
import { IconEye } from "../icons/icon-eye.js";
import { IconEyeOff } from "../icons/icon-eye-off.js";
```

**Step 5: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: Errors where `ToolbarContent` is used without the new `selectionsHidden` prop. We fix that in Task 6.

**Step 6: Commit**

```bash
git add packages/react-grab/src/components/toolbar/toolbar-content.tsx
git commit -m "feat(toolbar): add visibility toggle button with eye icons"
```

---

### Task 5: Create UI PoC HTML

**Files:**
- Create: `docs/plans/reveal-hide-toggle/poc.html`

**Step 1: Write a standalone HTML file**

Create an HTML file that shows the toolbar with the new eye button in both states (visible / hidden). This is for visual approval before wiring the logic.

The PoC should show:
- The toolbar bar (horizontal, white pill shape, drop shadow)
- Existing buttons: select icon, comments icon, copy icon, toggle switch, collapse chevron
- **New eye button** between copy and toggle — in both "eye" (visible) and "eye-off" (hidden) states
- A mock selection overlay box that appears/disappears when clicking the eye button

**Step 2: Commit**

```bash
git add docs/plans/reveal-hide-toggle/poc.html
git commit -m "docs: add UI PoC for visibility toggle button"
```

---

### Task 6: Wire visibility toggle in core orchestrator

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx`

This is the main wiring task. The orchestrator in `index.tsx` manages `currentToolbarState` and passes props to `ReactGrabRenderer`.

**Step 1: Create a `selectionsHidden` memo**

Near where `selectionVisible` is defined (around line 3256), add:

```typescript
const selectionsHidden = createMemo(
  () => currentToolbarState()?.selectionsHidden ?? false,
);
```

**Step 2: Gate `selectionVisible`**

Modify the existing `selectionVisible` memo (line 3256-3262) to add a check at the top:

```typescript
const selectionVisible = createMemo(() => {
  if (selectionsHidden()) return false;
  if (!isThemeEnabled()) return false;
  if (!isSelectionBoxThemeEnabled()) return false;
  if (isSelectionSuppressed()) return false;
  if (hasDragPreviewBounds()) return true;
  return isSelectionElementVisible();
});
```

**Step 3: Gate `selectionLabelVisible`**

Modify the existing `selectionLabelVisible` memo (around line 3294) to add a check at the top:

```typescript
const selectionLabelVisible = createMemo(() => {
  if (selectionsHidden()) return false;
  if (store.contextMenuPosition !== null) return false;
  // ... rest unchanged
});
```

**Step 4: Gate `grabbedBoxes` passed to renderer**

Where `<ReactGrabRenderer>` is rendered (around line 4082), change the `grabbedBoxes` prop:

```tsx
grabbedBoxes={selectionsHidden() ? [] : store.grabbedBoxes}
```

**Step 5: Pass `selectionsHidden` and toggle handler to toolbar**

Find where the toolbar receives its props in the renderer flow. The `ReactGrabRendererProps` needs `selectionsHidden` and `onToggleSelectionsHidden`. Trace how toolbar props flow:

In `ReactGrabRendererProps` (in `types.ts`), add:

```typescript
selectionsHidden: boolean;
onToggleSelectionsHidden: () => void;
```

In `index.tsx` where `<ReactGrabRenderer>` is called (around line 4082), add:

```tsx
selectionsHidden={selectionsHidden()}
onToggleSelectionsHidden={() => {
  updateToolbarState({ selectionsHidden: !selectionsHidden() });
}}
```

**Step 6: Wire through renderer to toolbar**

In `renderer.tsx`, pass the new props through to `<Toolbar>` / `<ToolbarContent>`:

```tsx
selectionsHidden={props.selectionsHidden}
onToggleSelectionsHidden={props.onToggleSelectionsHidden}
```

This requires checking how `renderer.tsx` passes props to the toolbar component. Read `components/toolbar/index.tsx` to understand the prop passthrough.

**Step 7: Verify typecheck**

Run: `cd packages/react-grab && pnpm typecheck`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/react-grab/src/core/index.tsx packages/react-grab/src/types.ts packages/react-grab/src/components/renderer.tsx
git commit -m "feat(core): wire selectionsHidden through orchestrator to toolbar and renderer"
```

---

### Task 7: Build, link, and verify in AdCreative

**Step 1: Build react-grab**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/react-grab && pnpm build
```

Expected: Build succeeds, `packages/react-grab/dist/` updated.

**Step 2: Verify link is active**

```bash
ls -la /Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2/node_modules/react-grab
```

Expected: Symlink pointing to `../react-grab/packages/react-grab`

**Step 3: Test in dev server**

```bash
cd /Users/doruk/Desktop/ADCREATIVE/AdCreative-Frontend-V2 && pnpm dev
```

Verify:
- Toolbar shows the eye icon button
- Clicking it hides all selection overlays
- Clicking again reveals them
- State persists across page reloads (localStorage)
- Selections are preserved (hidden, not deleted)

**Step 4: Commit (if any fixes needed)**

---

## File Change Summary

| File | Action | What |
|------|--------|------|
| `src/types.ts` | Modify | Add `selectionsHidden: boolean` to `ToolbarState` + `ReactGrabRendererProps` |
| `src/components/toolbar/state.ts` | Modify | Parse `selectionsHidden` in `loadToolbarState` |
| `src/components/icons/icon-eye.tsx` | Create | Eye SVG icon |
| `src/components/icons/icon-eye-off.tsx` | Create | Eye-off SVG icon |
| `src/components/toolbar/toolbar-content.tsx` | Modify | Add visibility button + props |
| `src/components/renderer.tsx` | Modify | Pass `selectionsHidden` to toolbar |
| `src/core/index.tsx` | Modify | Gate visibility memos + wire toggle handler |
| `docs/plans/reveal-hide-toggle/poc.html` | Create | UI PoC for visual approval |
