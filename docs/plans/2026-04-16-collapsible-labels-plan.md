# Collapsible Selection Labels — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible dot mode to persistent selection labels so users can minimize JIRA cards to a small purple dot and expand on demand.

**Architecture:** Feature hook (`use-collapsible-label`) owns per-instance collapsed state. `CollapsedDot` is a pure positioned UI component. `renderer.tsx` is the composition shell that wires the `<Show>` toggle between dot and full `SelectionLabel`. Feature-flagged via `Options.collapsibleLabels`.

**Tech Stack:** Solid.js (signals, `<Show>`), Tailwind v4 classes, existing positioning patterns.

**Design doc:** `docs/plans/2026-04-16-collapsible-labels-design.md`

---

### Task 1: Add types

**Files:**
- Modify: `packages/react-grab/src/types.ts:361-377` (Options interface)
- Modify: `packages/react-grab/src/types.ts:736-799` (SelectionLabelProps interface)
- Modify: `packages/react-grab/src/types.ts:542-663` (ReactGrabRendererProps interface)

**Step 1: Add `collapsibleLabels` to `Options`**

In `packages/react-grab/src/types.ts`, add to the `Options` interface (after `screenshot?: ScreenshotConfig;` on line 377):

```ts
export interface Options {
  // ... existing fields ...
  screenshot?: ScreenshotConfig;
  /** When true, persistent labels start collapsed as a dot. Click to expand. */
  collapsibleLabels?: boolean;
}
```

**Step 2: Add `onCollapse` to `SelectionLabelProps`**

In `packages/react-grab/src/types.ts`, add to `SelectionLabelProps` (after `hideArrow?: boolean;`):

```ts
  /** Collapse the label to a minimal dot indicator */
  onCollapse?: () => void;
```

**Step 3: Add `collapsibleLabelsDefault` to `ReactGrabRendererProps`**

In `packages/react-grab/src/types.ts`, add to `ReactGrabRendererProps` (after `labelInstances?: SelectionLabelInstance[];`):

```ts
  /** When true, persistent label instances start collapsed */
  collapsibleLabelsDefault?: boolean;
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/types.ts
git commit -m "feat(collapsible-label): add types for collapsible labels feature flag and props"
```

---

### Task 2: Create the feature hook

**Files:**
- Create: `packages/react-grab/src/features/collapsible-label/types.ts`
- Create: `packages/react-grab/src/features/collapsible-label/use-collapsible-label.ts`
- Create: `packages/react-grab/src/features/collapsible-label/index.ts`

**Step 1: Create `types.ts`**

Create `packages/react-grab/src/features/collapsible-label/types.ts`:

```ts
import type { Accessor } from "solid-js";

export interface CollapsibleLabelConfig {
  instanceId: string;
  defaultCollapsed?: boolean;
}

export interface CollapsibleLabelAPI {
  isCollapsed: Accessor<boolean>;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}
```

**Step 2: Create `use-collapsible-label.ts`**

Create `packages/react-grab/src/features/collapsible-label/use-collapsible-label.ts`:

```ts
import { createSignal } from "solid-js";
import type { CollapsibleLabelAPI, CollapsibleLabelConfig } from "./types.js";

export const useCollapsibleLabel = (
  config: CollapsibleLabelConfig,
): CollapsibleLabelAPI => {
  const [isCollapsed, setIsCollapsed] = createSignal(
    config.defaultCollapsed ?? false,
  );

  return {
    isCollapsed,
    collapse: () => setIsCollapsed(true),
    expand: () => setIsCollapsed(false),
    toggle: () => setIsCollapsed((prev) => !prev),
  };
};
```

**Step 3: Create barrel `index.ts`**

Create `packages/react-grab/src/features/collapsible-label/index.ts`:

```ts
export { useCollapsibleLabel } from "./use-collapsible-label.js";
export type { CollapsibleLabelAPI, CollapsibleLabelConfig } from "./types.js";
```

**Step 4: Commit**

```bash
git add packages/react-grab/src/features/collapsible-label/
git commit -m "feat(collapsible-label): add useCollapsibleLabel hook with per-instance collapsed state"
```

---

### Task 3: Create the CollapsedDot component

**Files:**
- Create: `packages/react-grab/src/components/collapsible-label/collapsed-dot.tsx`

**Step 1: Create `collapsed-dot.tsx`**

Create `packages/react-grab/src/components/collapsible-label/collapsed-dot.tsx`:

The dot positions itself at the bottom-center of `selectionBounds` with a small gap. Fixed position, same z-index as selection labels. Uses `data-react-grab-collapsed-dot` attribute.

```tsx
import type { Component } from "solid-js";
import type { OverlayBounds } from "../../types.js";

const DOT_SIZE_PX = 10;
const DOT_GAP_PX = 4;

interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
}

export const CollapsedDot: Component<CollapsedDotProps> = (props) => {
  const position = () => {
    const bounds = props.selectionBounds;
    return {
      left: bounds.x + bounds.width / 2,
      top: bounds.y + bounds.height + DOT_GAP_PX,
    };
  };

  return (
    <div
      data-react-grab-ignore-events
      data-react-grab-collapsed-dot
      class="fixed cursor-pointer transition-transform duration-150 ease-out hover:scale-150"
      style={{
        left: `${position().left}px`,
        top: `${position().top}px`,
        transform: "translateX(-50%)",
        "z-index": "var(--z-overlay)",
        "pointer-events": "auto",
      }}
      onClick={(event) => {
        event.stopImmediatePropagation();
        props.onExpand();
      }}
      onPointerDown={(event) => event.stopImmediatePropagation()}
    >
      <div
        class="rounded-full bg-primary"
        style={{
          width: `${DOT_SIZE_PX}px`,
          height: `${DOT_SIZE_PX}px`,
        }}
      />
    </div>
  );
};
```

Note: Use `bg-primary` which maps to the overlay's accent color. If the project uses a different token for the selection purple, check `packages/react-grab/src/styles/` and adjust. The POC used `#7c5cfc` — verify against the theme tokens.

**Step 2: Commit**

```bash
git add packages/react-grab/src/components/collapsible-label/
git commit -m "feat(collapsible-label): add CollapsedDot positioned component"
```

---

### Task 4: Add collapse button to SelectionLabel

**Files:**
- Modify: `packages/react-grab/src/components/selection-label/index.tsx:539-577` (the `canInteract && !isPromptMode` block — the idle tag row)

**Step 1: Add collapse button**

In `packages/react-grab/src/components/selection-label/index.tsx`, find the idle-state block (the `<Show when={canInteract() && !props.isPromptMode}>` around line 539). Inside the tag row `<div>` that contains `<TagBadge>` (around line 548), add a collapse button **after** the `<TagBadge>` and before the closing `</div>` of the tag row.

The collapse button should only render when `props.onCollapse` is present. It should be a small clickable element that visually indicates "minimize":

```tsx
<Show when={props.onCollapse}>
  <button
    data-react-grab-ignore-events
    data-react-grab-collapse-label
    class="contain-layout shrink-0 flex items-center justify-center size-4 rounded-full hover:bg-accent cursor-pointer transition-colors ml-auto"
    onClick={(event) => {
      event.stopImmediatePropagation();
      props.onCollapse?.();
    }}
    onPointerDown={(event) => event.stopImmediatePropagation()}
  >
    <div class="size-[6px] rounded-full bg-primary" />
  </button>
</Show>
```

This renders a small dot icon inside a hover-circle — visually communicates "this will become a dot" and is consistent with the collapsed dot appearance.

**Step 2: Verify build**

Run: `pnpm build`
Expected: No type errors

**Step 3: Commit**

```bash
git add packages/react-grab/src/components/selection-label/index.tsx
git commit -m "feat(collapsible-label): add onCollapse button to SelectionLabel tag row"
```

---

### Task 5: Wire composition in renderer.tsx

**Files:**
- Modify: `packages/react-grab/src/components/renderer.tsx:1-12` (imports)
- Modify: `packages/react-grab/src/components/renderer.tsx:206-295` (persistent instances `<Index>` block)

**Step 1: Add imports**

At the top of `packages/react-grab/src/components/renderer.tsx`, add:

```ts
import { useCollapsibleLabel } from "../features/collapsible-label/index.js";
import { CollapsedDot } from "./collapsible-label/collapsed-dot.js";
```

**Step 2: Wrap persistent instances with collapse logic**

Replace the `<Index each={props.labelInstances ?? []}>` block (starting at line 206) with the collapsible composition pattern. The key change is wrapping the callback body:

```tsx
<Index each={props.labelInstances ?? []}>
  {(instance) => {
    const collapsible = useCollapsibleLabel({
      instanceId: instance().id,
      defaultCollapsed: props.collapsibleLabelsDefault,
    });

    return (
      <Show
        when={!collapsible.isCollapsed()}
        fallback={
          <CollapsedDot
            selectionBounds={instance().selectionBounds}
            onExpand={collapsible.expand}
          />
        }
      >
        <SelectionLabel
          {/* ... all existing props stay exactly the same ... */}
          onCollapse={collapsible.collapse}
        />
      </Show>
    );
  }}
</Index>
```

Keep ALL existing `SelectionLabel` props untouched. Just add `onCollapse={collapsible.collapse}` at the end. The `return (` before `<SelectionLabel` on the existing line 208 becomes the `<Show when={...}>` wrapper.

**Step 3: Verify build**

Run: `pnpm build`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/react-grab/src/components/renderer.tsx
git commit -m "feat(collapsible-label): wire collapse/expand composition in renderer persistent instances"
```

---

### Task 6: Thread feature flag from Options through core

**Files:**
- Modify: `packages/react-grab/src/core/index.tsx:4404` (renderer props — add `collapsibleLabelsDefault`)
- Modify: `packages/react-grab/src/core/index.tsx:235-244` (initialOptions — make `collapsibleLabels` available)

**Step 1: Thread to renderer props**

In `packages/react-grab/src/core/index.tsx`, find the `<ReactGrabRenderer` JSX (around line 4382). After the `labelInstances` prop (line 4404), add:

```tsx
collapsibleLabelsDefault={initialOptions.collapsibleLabels}
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Clean build, no errors

**Step 3: Commit**

```bash
git add packages/react-grab/src/core/index.tsx
git commit -m "feat(collapsible-label): thread collapsibleLabels option to renderer"
```

---

### Task 7: Manual smoke test

**No files changed — verification only.**

**Step 1: Start dev server**

Run: `pnpm dev` (in one terminal)

**Step 2: Test without feature flag (default)**

Open the consuming app (AdCreative-Frontend-V2). Activate react-grab, select elements. Labels should render **expanded** as before — no behavior change.

**Step 3: Test with feature flag**

In the consuming app's init call, add `collapsibleLabels: true`:

```ts
initSync({
  // ... existing config ...
  options: {
    collapsibleLabels: true,
  },
});
```

- Labels should start as small purple dots
- Clicking a dot should expand to the full label
- The expanded label should show a small dot-icon collapse button in the tag row
- Clicking the collapse button should collapse back to a dot
- Positioning should track the selected element correctly

**Step 4: Verify existing E2E tests still pass**

Run a targeted smoke test to check nothing is broken for the non-collapsible path:

```bash
pnpm --filter react-grab exec playwright test e2e/activation.spec.ts --project=chromium
```

Expected: All tests pass (collapsible is off by default, so no behavior change).

---

### Task 8: Clean up POC file

**Files:**
- Delete: `poc-collapsible-label.html` (root of repo)

**Step 1: Remove POC**

```bash
rm poc-collapsible-label.html
git add poc-collapsible-label.html
git commit -m "chore: remove collapsible label POC"
```
