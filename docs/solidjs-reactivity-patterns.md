# SolidJS Reactivity Patterns for react-grab

Reference document for SolidJS patterns used in this codebase. Sources: SolidJS official docs, context7.

---

## Event Delegation vs Native Events

SolidJS uses **synthetic event delegation** for common events (`click`, `input`, `keydown`, etc.). Instead of attaching listeners to each element, a single listener is attached to `document` and events dispatch as they bubble up.

### `onClick` (delegated)
```tsx
<button onClick={handleClick}>Click</button>
```
- Listener on `document`, not the element
- `event.stopPropagation()` stops DOM bubbling but does NOT prevent other delegated handlers from firing — because they all listen at `document` level
- Performant for large lists

### `on:click` (native)
```tsx
<button on:click={handleClick}>Click</button>
```
- Listener directly on the element via `addEventListener`
- `event.stopPropagation()` works as expected — prevents event from reaching `document` where delegated handlers listen
- Case-sensitive (supports custom events)
- Use when you need true propagation control

### When to use which

| Scenario | Use |
|----------|-----|
| Simple click handler, no nested handlers | `onClick` (delegated) |
| Nested clickable elements where inner must stop outer | `on:click` (native) on inner element |
| Custom events or events with capital letters | `on:click` / `on:CustomEvent` (native) |
| Performance-critical lists with many items | `onClick` (delegated) |

### Common pitfall: stopPropagation with delegation

```tsx
// BUG: Parent onClick STILL fires because both are delegated to document
<div onClick={() => console.log("parent")}>
  <button onClick={(e) => { e.stopPropagation(); console.log("child"); }}>
    Click
  </button>
</div>

// FIX: Use on:click on the child for true propagation control
<div onClick={() => console.log("parent")}>
  <button on:click={(e) => { e.stopPropagation(); console.log("child"); }}>
    Click
  </button>
</div>
```

---

## createEffect Timing

### Initial run
- `createEffect` is scheduled to run **after the current rendering phase completes**
- It runs after all synchronous component code has finished and DOM elements have been created
- It always runs once on initialization to set up tracking

### `on()` helper with `defer`
```tsx
// Runs immediately on creation (default), then on changes
createEffect(on(signal, (value) => { ... }));

// Skips initial run, only fires on subsequent changes
createEffect(on(signal, (value) => { ... }, { defer: true }));
```

**Important:** When using `on()` WITHOUT `{ defer: true }`, the effect runs on the initial value. This is essential for hydrating state on page load.

### createEffect inside createRoot
```tsx
// Effects inside createRoot are owned by that root
const dispose = createRoot((dispose) => {
  createEffect(() => { ... });
  return dispose;
});

// Call dispose() to clean up the effect
```

The `createRoot` creates an ownership boundary. Effects inside it are tracked and can be disposed. This is important for feature modules that create effects outside the main component tree.

**Timing caveat:** When `createRoot` is nested inside another `createRoot` (e.g., a feature module instantiated inside `core/index.tsx`'s main `createRoot`), effects in the inner root are scheduled in a **separate batch**. This causes timing bugs — the inner effect's initial run may fire before/after the parent's effects, leading to stale state on page load.

**Rule: Don't nest `createRoot` for effects that need to participate in the parent's reactive graph.** If a function is called inside an existing `createRoot`, its `createEffect` calls automatically inherit ownership. Only use `createRoot` when you need a truly independent reactive scope (e.g., a detached popup or a test harness).

```tsx
// BAD: nested createRoot creates separate scheduling batch
function createFeature(deps) {
  const dispose = createRoot((dispose) => {
    createEffect(() => { ... }); // runs in separate batch
    return dispose;
  });
  return { dispose };
}

// GOOD: inherits ownership from caller's createRoot
function createFeature(deps) {
  createEffect(() => { ... }); // runs in parent's batch
  // No dispose needed — parent root handles cleanup
}
```

---

## Signal Reactivity and Object Identity

### Arrays and `<For>`
```tsx
const [items, setItems] = createSignal([...]);

// <For> tracks items by reference identity
<For each={items()}>
  {(item) => <div>{item.name}</div>}
</For>
```

- When `setItems` is called with a new array, `<For>` diffs by reference
- `.map()` creates new object references → `<For>` re-renders affected items
- The `item` parameter in the callback is NOT a signal — it's the object reference

### Accessor pattern
```tsx
const [state, setState] = createSignal(initialValue);

// This is reactive — reads the signal inside a tracking context
createEffect(() => {
  console.log(state()); // tracks
});

// This is NOT reactive — reads once and captures the value
const snapshot = state();
createEffect(() => {
  console.log(snapshot); // never re-runs
});
```

---

## Pattern: Feature Module with Dependency Injection

For encapsulating reactive logic outside the main component tree:

```tsx
interface FeatureDeps {
  signal: Accessor<Value>;
  setter: Setter<Value>;
  action: (id: string) => void;
}

function createFeature(deps: FeatureDeps) {
  // Private state — other code cannot access
  let privateState: Entry[] = [];

  // Memos derived from injected signals
  const derived = createMemo(() => deps.signal().someField);

  // Effects — must be inside a reactive ownership context
  // If called outside a component, wrap in createRoot
  const dispose = createRoot((dispose) => {
    createEffect(on(
      () => deps.signal(),
      () => {
        // React to changes
        clear();
        rebuild();
      },
    ));
    return dispose;
  });

  return {
    derived,
    handler: () => { ... },
    dispose,
  };
}
```

**Key points:**
- The factory must be called inside a reactive context (inside `createRoot` or a component)
- Effects using `on()` without `{ defer: true }` will run on the initial value
- The `dispose` function cleans up all effects in the root
- Private state (`privateState`) is encapsulated — external code cannot touch it
