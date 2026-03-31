# Reveal/Hide v3/v4 Bug Analysis

## Bug 1: New selection disappears after "Copied" feedback when reveal is toggled ON

### Symptom
When parent reveal is ON and user adds a new selection (comment), the selection briefly shows "Copied" then disappears. Toggling reveal off/on again makes it appear.

### Root Cause
**File:** `packages/react-grab/src/core/index.tsx:893`

New comment items are created with `revealed: false`:
```typescript
const updatedCommentItems = addCommentItem({
  ...
  revealed: false,   // ← PROBLEM: ignores parent toggle state
});
```

When `setCommentItems(updatedCommentItems)` fires, the `createEffect` in the feature module triggers → `clearRevealedPreviews()` + `showRevealedPreviews()`. Since the new item has `revealed: false`, it gets excluded from `showRevealedPreviews()`. The "Copied" text is from `showTemporaryGrabbedBox()` which auto-fades after 1.5s — that's the brief appearance.

### Fix
Set `revealed` based on current parent toggle state:

```typescript
revealed: selectionsRevealed(),   // ← inherit from parent toggle
```

This requires `selectionsRevealed` (or `visibility.selectionsRevealed()`) to be accessible at the call site (line 893). It's already available via the `visibility` API returned by `createSelectionVisibility`.

---

## Bug 2: Individual comment item eye toggle doesn't work

### Symptom
Clicking the per-item eye toggle in the comments dropdown has no visible effect.

### Root Cause
**File:** `packages/react-grab/src/components/comments-dropdown.tsx:293-338`

**SolidJS event delegation conflict.** Both the parent `<div>` (line 293) and the child `<button>` (line 336) use `onClick` — which in SolidJS is a **delegated event** (registered on the document root, not on the element itself). `event.stopPropagation()` on the button stops DOM bubbling but does NOT prevent SolidJS's internal delegation dispatch from reaching the parent handler.

Result: clicking the eye button fires BOTH handlers:
1. `props.onToggleItemRevealed?.(item.id)` — toggles `revealed` ✓
2. `props.onSelectItem?.(item)` — calls `handleCommentItemSelect` which calls `clearCommentsHoverPreviews()` and then either copies content or enters prompt mode ✗

The `onSelectItem` side effect interferes with the toggle — it triggers a copy action, which may re-render state and override the toggle.

### Fix
Use SolidJS native event binding (`on:click`) on the button instead of delegated `onClick`:

```tsx
<button
  on:click={(event) => {           // ← native, not delegated
    event.stopPropagation();
    props.onToggleItemRevealed?.(item.id);
  }}
  on:pointerdown={(event) => event.stopPropagation()}
  ...
>
```

With `on:click` (native DOM event), `stopPropagation()` prevents the event from reaching the document root, so SolidJS's delegated `onClick` on the parent div never fires.

---

## Bug 3: On page refresh, revealed selections not visible (must toggle off/on)

### Symptom
After page refresh, items with `revealed: true` in sessionStorage and `selectionsRevealed: true` in localStorage are correctly loaded, but their selection overlays don't appear. Toggling the parent off and on again makes them appear.

### Root Cause
**File:** `packages/react-grab/src/features/selection-visibility/index.ts:49`

The `createEffect` was wrapped in a **nested `createRoot`**:

```typescript
const disposeEffect = createRoot((dispose) => {
  createEffect(on(() => deps.commentItems(), handler));
  return dispose;
});
```

Per SolidJS docs, `createRoot` creates an **independent ownership boundary** with its own scheduling batch. The `createEffect` inside it runs in a separate reactive context from the parent `createRoot` in `core/index.tsx`.

On page load, the parent root's effects (which set up the renderer, theme, activation state) run in one batch, while the nested root's effect runs in a separate batch. The nested effect's initial run fires before the renderer is fully initialized or before `computedGrabbedBoxes` can process the added boxes in the correct reactive cycle.

When the user toggles off/on manually, everything is within the same reactive context and works correctly.

### Fix
Remove `createRoot` wrapper. Since `createSelectionVisibility()` is called INSIDE the main `createRoot` callback in `core/index.tsx` (line 3720), the `createEffect` inherits ownership from the parent root automatically. No `dispose` function needed — the parent root's disposal handles cleanup.

```typescript
// Before (broken): separate scheduling batch
const disposeEffect = createRoot((dispose) => {
  createEffect(on(() => deps.commentItems(), handler));
  return dispose;
});

// After (fixed): inherits parent ownership
createEffect(on(() => deps.commentItems(), handler));
```

Also removed `dispose` from `SelectionVisibilityAPI` interface and the `onCleanup(() => visibility.dispose())` call in `core/index.tsx`.
