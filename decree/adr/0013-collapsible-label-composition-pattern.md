---
date: '2026-04-16'
references:
- PRD-013
status: accepted
---

# ADR-0013 Collapsible label composition pattern — feature hook + pure UI + renderer shell

## Context and Problem Statement

PRD-013 requires persistent label instances to be collapsible to a minimal dot. The `SelectionLabel` component that renders the full card is already 400+ lines and handles three distinct rendering modes (agent session, primary selection, persistent instance), complex viewport-aware positioning with arrows, and multiple interaction states (copying, copied, fading, error, prompt mode).

Adding a collapsed/expanded toggle inside `SelectionLabel` itself would thread collapse state through an already crowded component and couple a new, per-instance-only concern to all three rendering modes. Alternatively, creating a wrapper component around `SelectionLabel` duplicates the positioning concern — both the wrapper and the full label would need to know where to render.

The question is how to separate the collapsed-state feature (which only applies to persistent instances, renderer type #3) from the existing SelectionLabel component without duplicating positioning logic or coupling unrelated concerns.

## Decision Drivers

- SelectionLabel has three consumer call sites in renderer.tsx (agent sessions, primary selection, persistent instances) — only persistent instances need collapsibility
- The project's established feature structure (`features/<name>/` + `components/<name>/`) separates reactive state from pure UI
- Renderer.tsx is already the composition shell — it's where renderer-type-specific logic already lives
- Dot positioning is simpler than full-label positioning (no arrow, no viewport-aware flip) — trying to reuse SelectionLabel's positioning for the dot is overkill
- A feature flag gate means the collapse button must conditionally render — only expanded labels that can collapse need the button
- The implementation should leave SelectionLabel unchanged for consumers that don't opt in

## Considered Options

### Option A: Collapsed state inside SelectionLabel

Add `collapsed` signal to SelectionLabel itself. When collapsed, render just a dot inline. When expanded, render the existing card. A `defaultCollapsed?: boolean` prop sets the initial state.

- **Pro**: Self-contained, no new components, single file touched
- **Pro**: Reuses SelectionLabel's positioning logic for the dot too
- **Con**: Adds conditional rendering to an already 400-line component with three rendering paths
- **Con**: Collapse concern leaks into agent session and primary selection paths that don't need it
- **Con**: Dot positioning inherits the full label's viewport-flip and arrow logic — which the dot doesn't need

### Option B: Wrapper component around SelectionLabel

Create `CollapsibleLabelWrapper` that owns the collapsed/expanded signal and conditionally renders either a dot or SelectionLabel.

- **Pro**: Clean separation — SelectionLabel stays untouched
- **Con**: The wrapper needs positioning for the dot fallback — duplicates anchor-to-bounds logic
- **Con**: Two components rendering at the same screen position with slightly different logic is a source of bugs
- **Con**: Adds a layer of indirection for a small amount of state

### Option C: Feature hook + pure UI dot + renderer composition shell

Three separate pieces:

- `features/collapsible-label/use-collapsible-label.ts` — reactive hook owning per-instance `isCollapsed` signal
- `components/collapsible-label/collapsed-dot.tsx` — pure positioned UI component (no state, takes `selectionBounds` + `onExpand`)
- `renderer.tsx` persistent-instance block — composition shell that wires the hook to a `<Show>` toggle between the dot and SelectionLabel, passing `onCollapse` to SelectionLabel only when the feature flag is on

- **Pro**: Clean layered separation — state in feature, UI in component, composition in renderer (matches project's existing feature structure)
- **Pro**: SelectionLabel only grows by a single prop (`onCollapse`) and a single `<Show>` block for the collapse button
- **Pro**: Dot has its own simple positioning (just anchor to bounds center) — no reuse of SelectionLabel's complex logic
- **Pro**: Composition happens at the only call site that needs it (persistent instances block in renderer) — the other two SelectionLabel call sites are untouched
- **Pro**: Feature flag gate lives at composition site where the decision is naturally scoped
- **Con**: Three files instead of one — slightly more indirection, but each file has a single concern

## Decision Outcome

**Option C**: Feature hook + pure UI dot + renderer composition shell.

The existing feature directory convention (`features/<name>/` with `use-*.ts` hooks, `components/<name>/` with pure UI) already provides the layered separation this pattern needs. renderer.tsx is already where per-renderer-type logic diverges, so wiring the `<Show>` toggle there keeps the SelectionLabel component agnostic of collapse semantics.

Option A was rejected because SelectionLabel is already complex and adding state that only matters for one of three rendering paths pollutes the component. Option B was rejected because wrapping requires duplicating positioning or delegating it awkwardly — with the composition pattern, each UI component handles its own simple positioning.

### Consequences

- SelectionLabel gains one new prop (`onCollapse?: () => void`) and two small conditional `<Show>` blocks for the collapse button — existing callers that pass no `onCollapse` see zero behavior change
- `useCollapsibleLabel` is a plain Solid.js hook with `createSignal` — no persistence, no external state, trivially testable
- `CollapsedDot` knows only about bounds + click callback — no SelectionLabel coupling, could be repurposed for other collapsed representations later
- renderer.tsx's persistent-instance block grows by ~10 lines (hook call + `<Show>` with fallback) — the change is isolated and readable
- Feature flag (`Options.collapsibleLabels`) flows from core → renderer props → hook's `defaultCollapsed` and gates the `onCollapse` prop at the composition site
- Adding new collapsible behaviors (keyboard shortcut, alternative collapsed visual, persistence) is straightforward — extend the hook or swap the UI component without touching SelectionLabel
