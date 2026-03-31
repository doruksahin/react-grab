# Toggle Hide/Reveal Selections — Architecture

## Problem

When multiple elements are selected (grabbedBoxes, labelInstances, agentSessions), the overlay becomes visually noisy. Users need a way to temporarily hide all selection visuals without losing the selection state.

## Affected Layers

```
packages/react-grab/
├── src/
│   ├── core/
│   │   └── store.ts              ← GrabStore has grabbedBoxes, labelInstances
│   │
│   ├── components/
│   │   ├── toolbar/
│   │   │   ├── toolbar-content.tsx  ← Existing buttons: select, copyAll, comments, collapse
│   │   │   ├── toolbar-menu.tsx     ← Overflow menu
│   │   │   └── state.ts            ← ToolbarState persisted to localStorage
│   │   │
│   │   ├── renderer.tsx             ← Orchestrator: computes selectionVisible, dragVisible,
│   │   │                               inspectVisible, passes to OverlayCanvas + labels
│   │   ├── overlay-canvas.tsx       ← Canvas rendering: reads selectionVisible, dragVisible
│   │   ├── selection-label/         ← Per-selection floating labels
│   │   └── icons/                   ← SVG icon components (Component<{ size?, class? }>)
│   │
│   └── types.ts                     ← ToolbarState interface, shared types
```

## Data Flow

```
ToolbarState.selectionsHidden (persisted in localStorage)
        │
        ├─→ toolbar-content.tsx    reads it → renders eye/eye-off icon
        │
        └─→ renderer.tsx           reads it → gates visibility props:
                │                     selectionVisible, dragVisible,
                │                     selectionLabelVisible, grabbedBoxes
                │
                ├─→ overlay-canvas.tsx   (selectionVisible=false → no overlay paint)
                └─→ selection-label/     (visible=false → labels hidden)
```

## Key Design Decisions

1. **State lives in `ToolbarState`**, not `GrabStore` — it's a UI preference, same as `collapsed` and `edge`. Persisted to localStorage.

2. **No new store slice** — `ToolbarState` already exists with `collapsed`, `enabled`, `edge`, `ratio`, `defaultAction`. Adding `selectionsHidden: boolean` follows the same pattern.

3. **Visibility is gated at renderer level** — renderer.tsx already computes `selectionVisible`, `selectionLabelVisible`, etc. We AND these with `!selectionsHidden`. No changes needed in overlay-canvas or selection-label internals.

4. **Selections are preserved** — hiding is purely visual. `grabbedBoxes`, `labelInstances` remain in store. Revealing shows them exactly as they were.

## New Files

| File | Purpose |
|------|---------|
| `components/icons/icon-eye.tsx` | Eye (visible) SVG icon |
| `components/icons/icon-eye-off.tsx` | Eye-off (hidden) SVG icon |

## Modified Files

| File | Change |
|------|--------|
| `types.ts` | Add `selectionsHidden: boolean` to `ToolbarState` |
| `components/toolbar/state.ts` | Parse + default `selectionsHidden` in `loadToolbarState` |
| `components/toolbar/toolbar-content.tsx` | Add toggle button between existing buttons |
| `components/renderer.tsx` | Gate visibility props on `!selectionsHidden` |

## Non-Goals

- No keyboard shortcut (can be added later via plugin hooks)
- No animation on hide/reveal (instant toggle)
- No per-selection hide (this is all-or-nothing)
