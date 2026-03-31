# Element Visibility Detection

How react-grab determines whether a comment's target DOM element is "visible" (connected to the document tree).

---

## Decision Chain

```
commentsDisconnectedItemIds (reactive memo)
  │
  ├─ Triggers: commentItems(), commentsDropdownPosition(), domMutationVersion()
  │
  └─ For each CommentItem:
       └─ getConnectedCommentElements(item) → Element[]
            │
            ├─ Step 1: Check in-memory cache (commentElementMap)
            │   └─ Map<commentId, Element[]>
            │   └─ Filter cached refs by isElementConnected(element)
            │   └─ If ALL cached refs are connected → return them
            │
            ├─ Step 2: Cache miss → reacquireCommentElements(item)
            │   └─ Read item.elementSelectors (CSS selectors stored at copy time)
            │   └─ For each selector: document.querySelector(selector)
            │   └─ Filter results by isElementConnected(element)
            │   └─ If found → cache in commentElementMap, return
            │
            └─ Step 3: Fallback
                └─ Return whatever connected elements remain from Step 1
                └─ If none → empty array → item is "disconnected"
```

**Connected = `Element[]` is non-empty**
**Disconnected = `Element[]` is empty → ID added to `disconnectedItemIds` Set**

---

## isElementConnected

**File:** `src/utils/is-element-connected.ts`

```typescript
const isElementConnected = (element: Element | null | undefined): element is Element =>
  Boolean(element?.isConnected ?? element?.ownerDocument?.contains(element));
```

Uses the native DOM API [`Node.isConnected`](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected). Returns `true` when the element is attached to the document tree. Falls back to `ownerDocument.contains()` for older environments.

**What makes it `true`:**
- Element is in the live DOM (rendered by the host app)

**What makes it `false`:**
- React unmounted the component (route change, conditional render, lazy unload)
- Element was removed from DOM (`removeChild`, React reconciliation)
- Parent element was removed

**What does NOT make it `false`:**
- `display: none` — element is still in the DOM tree
- `visibility: hidden` — still connected
- `opacity: 0` — still connected
- Off-screen (`position: absolute; left: -9999px`) — still connected

---

## Element Selectors

When a comment is created, CSS selectors are generated for the target element(s) and stored in `CommentItem.elementSelectors`.

**File:** `src/core/index.tsx` (createElementSelector)

Selector format: `html > body:nth-of-type(1) > div:nth-of-type(1) > ...`

These selectors are used by `reacquireCommentElements` to re-find elements across page reloads (since element references don't persist). The selectors are path-based (nth-of-type chain from root), so they break if the DOM structure changes (e.g., new sibling elements inserted above the target).

---

## commentElementMap (In-Memory Cache)

**Type:** `Map<string, Element[]>` (comment ID → DOM element references)

**Populated when:**
- A new comment is created (`addCommentItem` call site, line ~899)
- Elements are re-acquired via CSS selectors (`reacquireCommentElements`, line ~398)

**Invalidated when:**
- Page refreshes (map is in-memory, not persisted)
- Comment is cleared (`commentElementMap.clear()`)
- Comment is deleted (`commentElementMap.delete(id)`)

**Not invalidated when:**
- Element is removed from DOM (stale refs stay in map → filtered by `isElementConnected`)

---

## domMutationVersion Signal

**File:** `src/core/index.tsx`

A reactive signal incremented by a `MutationObserver` on `document.body` (`childList: true, subtree: true`). Causes `commentsDisconnectedItemIds` to re-evaluate when the host app's DOM structure changes.

This is what makes visibility detection reactive to external DOM changes (host React app mounting/unmounting components).

---

## Consumers

| Consumer | What it does with disconnected state |
|----------|--------------------------------------|
| `CommentsDropdown` | Applies `opacity-40` to disconnected items, blocks hover preview |
| `selection-visibility` feature module | Skips disconnected items in `showRevealedPreviews()` |

Both consume the same `commentsDisconnectedItemIds` memo — single source of truth.

---

## Limitations

1. **CSS visibility is not detected.** An element hidden via `display: none` or `visibility: hidden` is still "connected." The selection overlay would render on top of an invisible element.

2. **Selector fragility.** The nth-of-type CSS selectors break if the DOM structure changes between sessions (e.g., a new promotional banner inserted above the target element).

3. **MutationObserver cost.** `domMutationVersion` increments on every DOM mutation (any childList change in the subtree). In apps with frequent DOM updates, `commentsDisconnectedItemIds` re-evaluates often. The custom `equals` comparator on the memo mitigates downstream re-renders (only propagates if the actual set of disconnected IDs changes).
