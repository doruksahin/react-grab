---
date: '2026-04-16'
references:
- PRD-013
- ADR-0013
status: implemented
---

# SPEC-016 Collapsible Selection Labels

## Overview

Implements PRD-013: persistent label instances (renderer type #3) can collapse to a minimal purple dot and expand back to the full card. Feature-flagged via `Options.collapsibleLabels`. When the flag is off, behavior is unchanged — no dot, no collapse button.

Follows ADR-0013's composition pattern: a feature hook owns the per-instance collapsed signal, a pure UI component renders the dot, and renderer.tsx wires them together with a `<Show>` toggle. SelectionLabel is modified only by a single new optional prop (`onCollapse`) and two small conditional blocks that render a chevron button when the prop is present.

## Technical Design

### Layer 1 — Types

**File:** `packages/react-grab/src/types.ts`

Three additions:

- `Options.collapsibleLabels?: boolean` — feature flag on the public init options
- `ReactGrabRendererProps.collapsibleLabelsDefault?: boolean` — threads the flag from core to renderer
- `SelectionLabelProps.onCollapse?: () => void` — optional callback that, when present, renders the collapse button

### Layer 2 — Feature hook

**Files:** `packages/react-grab/src/features/collapsible-label/{types.ts, use-collapsible-label.ts, index.ts}`

`useCollapsibleLabel(config)` returns a per-instance API:

```ts
interface CollapsibleLabelConfig {
  instanceId: string;
  defaultCollapsed?: boolean;
}

interface CollapsibleLabelAPI {
  isCollapsed: Accessor<boolean>;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}
```

Internally it creates a single `createSignal(config.defaultCollapsed ?? false)`. No persistence, no side effects, no DOM access — pure reactive state. Testable in isolation.

### Layer 3 — Collapsed dot UI

**File:** `packages/react-grab/src/components/collapsible-label/collapsed-dot.tsx`

Pure positioned component. Props:

```ts
interface CollapsedDotProps {
  selectionBounds: OverlayBounds;
  onExpand: () => void;
}
```

Renders a 10px circle (`bg-primary`) positioned at `(bounds.x + bounds.width/2, bounds.y + bounds.height + 4px)` with `transform: translateX(-50%)` for centering. Uses `position: fixed`, `z-index: var(--z-overlay)`, `pointer-events: auto`, and the standard `data-react-grab-ignore-events` + `data-react-grab-collapsed-dot` attributes. Hover affordance via `hover:scale-150` transition.

### Layer 4 — SelectionLabel collapse button

**File:** `packages/react-grab/src/components/selection-label/index.tsx`

Two `<Show when={props.onCollapse}>` blocks — one in the idle-state tag row (line ~577) and one in the prompt-mode tag row (line ~678). Each renders the same button markup:

```tsx
<button
  data-react-grab-ignore-events
  data-react-grab-collapse-label
  title="Collapse"
  class="contain-layout shrink-0 flex items-center justify-center size-5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
  onClick={(event) => {
    event.stopImmediatePropagation();
    props.onCollapse?.();
  }}
  onPointerDown={(event) => event.stopImmediatePropagation()}
>
  <IconChevron size={12} />
</button>
```

Both tag rows are needed because persistent instances can render through either the idle path or the prompt-mode path depending on state.

### Layer 5 — Composition in renderer.tsx

**File:** `packages/react-grab/src/components/renderer.tsx`

The persistent-instance `<Index>` block (the only one of the three SelectionLabel call sites that uses this feature) wires the hook to a `<Show>` toggle:

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
          {/* ... existing props unchanged ... */}
          onCollapse={
            props.collapsibleLabelsDefault ? collapsible.collapse : undefined
          }
        />
      </Show>
    );
  }}
</Index>
```

`onCollapse` is gated by the flag so labels without the feature flag see `undefined` and render as they always have. The agent-session and primary-selection SelectionLabel call sites are untouched.

### Layer 6 — Feature flag threading

**File:** `packages/react-grab/src/core/index.tsx`

The `<ReactGrabRenderer>` JSX (line ~4404) gets one new prop:

```tsx
collapsibleLabelsDefault={initialOptions.collapsibleLabels}
```

`initialOptions` is the merged options object built from script options, pending sync options, and the user's `init(options)` call. No new plumbing needed — `collapsibleLabels` flows through the existing options mechanism.

## Testing Strategy

**E2E tests** — `packages/react-grab/e2e/mocked/collapsible-label.spec.ts`, tagged `@SPEC-016`:

- **Flag off test** (`AC1-AC3`) — activates the overlay with default options, seeds the sync store via `populate()`, clicks a tracked element, and asserts: `[data-react-grab-selection-label]` count > 0, `[data-react-grab-collapsed-dot]` count = 0, `[data-react-grab-collapse-label]` count = 0. Proves non-opting-in consumers see no behavior change.

- **Flag on test** (`AC6, AC11-AC14`) — calls `reinitialize({ collapsibleLabels: true })` to turn on the flag, then seeds + activates. Asserts persistent labels start as dots (not full labels), clicks one dot via shadow-DOM selector, asserts exactly one dot became a label and a collapse button appeared, clicks the chevron, asserts the label collapsed back to a dot and the count returned to the initial state.

Both tests use `reactGrab.screenshot()` for visual regression attachment in the HTML report. Filter with `--grep @SPEC-016` to run just this spec's tests.

**Manual verification** — the feature is also validated in the AdCreative consumer by setting `collapsibleLabels: true` in the `init()` call and confirming dots render per tracked element, clicking expands, clicking the chevron collapses.

**No unit tests** — the feature hook (`use-collapsible-label.ts`) is trivial reactive state (`createSignal` wrapped in setters), not worth unit testing in isolation. The CollapsedDot component is pure positioning with no logic branches. The integration behavior (the only meaningful thing) is covered by E2E.

## Acceptance Criteria

### Flag Off (default — no behavior change)

- [x] AC1: Without `collapsibleLabels: true` in Options, persistent labels render expanded (full card) identical to pre-feature behavior
- [x] AC2: No `[data-react-grab-collapsed-dot]` element renders when flag is off
- [x] AC3: No `[data-react-grab-collapse-label]` button renders when flag is off
- [x] AC4: Agent session labels are unaffected by the flag (no collapse button regardless)
- [x] AC5: Primary selection label is unaffected by the flag (no collapse button regardless)

### Flag On — Collapsed dot

- [x] AC6: With `collapsibleLabels: true`, persistent label instances initially render as dots (no full card visible)
- [x] AC7: The dot is positioned relative to its selected element's bounds (bottom-center + small gap)
- [x] AC8: The dot uses the overlay's primary accent color (`bg-primary`)
- [x] AC9: The dot has a hover affordance (scale transform) indicating interactivity
- [x] AC10: Multiple persistent labels each render as independent dots at their respective elements

### Flag On — Expansion

- [x] AC11: Clicking a dot expands that specific instance to the full SelectionLabel
- [x] AC12: Other labels remain in whatever collapsed/expanded state they were in (per-instance state)
- [x] AC13: The expanded label renders a chevron collapse button in its header row

### Flag On — Collapse

- [x] AC14: Clicking the chevron button collapses the label back to a dot
- [x] AC15: Collapsing one label does not affect the state of other labels
- [x] AC16: The collapse button uses an up-pointing chevron icon to signal "minimize"

### Component integration

- [x] AC17: SelectionLabel's `onCollapse` prop is optional — callers that don't pass it see no collapse button
- [x] AC18: The collapse button renders in both the idle tag row and the prompt-mode tag row (whichever is active)
- [x] AC19: `useCollapsibleLabel` hook owns state per-instance — no global or shared collapsed state
- [x] AC20: CollapsedDot is a pure UI component — it takes bounds + callback and has no internal state

### Feature flag

- [x] AC21: `Options.collapsibleLabels` is optional on the public `init()` options
- [x] AC22: The flag threads from core → renderer props → hook's `defaultCollapsed`
- [x] AC23: The flag also gates the `onCollapse` prop so the collapse button only appears when collapsible is enabled

### E2E verification

- [x] AC24: `collapsible-label.spec.ts` has a flag-off test asserting no dot, no collapse button, labels expanded
- [x] AC25: `collapsible-label.spec.ts` has a flag-on test asserting initial dots, click-to-expand transition, click-chevron-to-collapse transition
- [x] AC26: Tests are tagged with `@SPEC-016` for filtering via `--grep @SPEC-016`
