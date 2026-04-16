# Collapsible Selection Labels

**Date:** 2026-04-16
**Scope:** Persistent label instances only (renderer type #3)
**Feature flag:** `Options.collapsibleLabels`

## Problem

Persistent selection labels show the full JIRA card (ticket, status, assignee, comments, editor) pinned to each selected element. On pages with multiple selections, these labels occlude the UI and compete for attention. Users need a way to collapse them to a minimal indicator and expand on demand.

## Design

### Collapsed state: dot

When collapsed, a label renders as a small purple dot (8-10px) anchored near the selected element. Click to expand. The dot is the same accent color used in the selection system (`#7c5cfc`).

### Default behavior

Labels start **expanded** (current behavior) unless `collapsibleLabels` is enabled in `Options`. When enabled, labels start **collapsed** by default. This is feature-flagged so consumers can opt in.

## Architecture

### Feature structure

```
features/collapsible-label/
  index.ts                     — barrel export
  types.ts                     — CollapsibleLabelAPI, CollapsibleLabelConfig
  use-collapsible-label.ts     — per-instance collapsed signal, toggle, feature flag gate

components/collapsible-label/
  collapsed-dot.tsx            — pure positioned dot UI
```

### Layer responsibilities

| Layer | File | Responsibility |
|---|---|---|
| Feature hook | `use-collapsible-label.ts` | Owns `collapsed` signal per instance. Reads feature flag. Exposes `isCollapsed()`, `collapse()`, `expand()`, `toggle()` |
| Collapsed UI | `collapsed-dot.tsx` | Pure positioned dot. Takes `selectionBounds` + `onExpand`. Computes its own simple position (center-bottom of bounds) |
| Expanded UI | `selection-label/index.tsx` | Existing component. Accepts new `onCollapse?: () => void` prop. When present, renders collapse button in header |
| Composition | `renderer.tsx` | Wires hook to both UIs via `<Show>` toggle. Neither child knows about the other |

### Feature flag flow

```
Options.collapsibleLabels (boolean)
  -> core/index.tsx threads to renderer props
    -> renderer passes as defaultCollapsed to useCollapsibleLabel
      -> hook initializes isCollapsed() signal
```

### Composition in renderer.tsx

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
          {...existingProps}
          onCollapse={collapsible.collapse}
        />
      </Show>
    );
  }}
</Index>
```

### Changes to existing code

**SelectionLabel** (`selection-label/index.tsx`):
- New prop: `onCollapse?: () => void`
- When present: render a small collapse button in the tag row (next to TagBadge)
- No other changes to positioning, state, or rendering logic

**SelectionLabelProps** (`types.ts`):
- Add `onCollapse?: () => void`

**Options** (`types.ts`):
- Add `collapsibleLabels?: boolean`

**renderer.tsx**:
- Import `useCollapsibleLabel` and `CollapsedDot`
- Wrap persistent instance block with collapse logic (see composition above)
- Thread `collapsibleLabels` from props

**core/index.tsx**:
- Thread `options.collapsibleLabels` to renderer props

### CollapsedDot positioning

Simple positioning — no arrow, no complex viewport logic:
- Anchor to bottom-center of `selectionBounds`
- Small gap below the element
- Fixed position, same z-index as selection labels
- `pointer-events: auto` for click handling

### Types

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
