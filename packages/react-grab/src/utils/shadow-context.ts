// packages/react-grab/src/utils/shadow-context.ts
//
// The shadow root is a singleton created exactly once by mountRoot(). It is
// not reactive and never changes for the lifetime of the page, so we store
// it on a module-scoped variable instead of threading it through Solid
// context. This sidesteps owner-chain pitfalls where useContext() snapshots
// happen inside Kobalte-internal computations created before our Provider
// could attach a value, which silently falls through to `document.body`
// for any portalled overlay (Dialog, Select, Tooltip).
//
// mountRoot() calls setShadowMount() synchronously after attachShadow();
// every later useShadowMount() call returns the same node.

let shadowMount: HTMLElement | null = null;

export function setShadowMount(sr: ShadowRoot): void {
  shadowMount = sr as unknown as HTMLElement;

  // ADR-0016: Kobalte's DismissableLayer uses event.target for containment
  // checks. Inside a shadow root, the browser retargets event.target to the
  // shadow host for document-level listeners — so layerEl.contains(target)
  // always returns false, causing menus to dismiss immediately after opening.
  //
  // Fix: register on window (capture step 1) so this fires BEFORE Kobalte's
  // document listener (capture step 2). We override event.target with
  // composedPath()[0] — the actual in-shadow element — so Kobalte's
  // containment check receives the real target.
  //
  // Only intercept events that originated inside our shadow root (composedPath
  // includes the shadow root). This avoids touching events from other parts of
  // the page.
  //
  // stopPropagation is intentionally NOT called — the event must still reach
  // document so that outside-click dismissal of the main menu works when the
  // user clicks on the host page.
  //
  // The same target-override is applied to focusin. When a sub-menu closes
  // and Kobalte returns focus to a sub-trigger inside the shadow root, the
  // focusin event is retargeted to the shadow host at the document level.
  // DismissableLayer's focusOutside check then sees the host (not inside the
  // layer) and incorrectly dismisses the parent menu / dialog. Overriding
  // target here fixes that without affecting FocusScope Tab-key trapping:
  // FocusScope only needs the correct element identity, not propagation changes.
  const overrideTarget = (e: Event) => {
    const path = e.composedPath();
    if (!path.includes(sr)) return;
    const real = path[0];
    if (real instanceof Element) {
      Object.defineProperty(e, "target", {
        get: () => real,
        configurable: true,
      });
    }
  };

  window.addEventListener("pointerdown", overrideTarget, { capture: true });
  window.addEventListener("focusin", overrideTarget, { capture: true });

  // ADR-0016: Kobalte's createInteractOutside / isEventOutside has a critical
  // guard: `if (!contains(ownerDocument(), target)) return false`. This expands
  // to `if (!document.contains(target)) return false`. For elements inside a
  // shadow root, document.contains() returns false (they are not in the main
  // document tree), so isEventOutside always short-circuits and DismissableLayer
  // never fires for any in-shadow click. As a result, sibling sub-menus cannot
  // close each other naturally.
  //
  // Fix: patch document.contains so that elements whose root node is our shadow
  // root are treated as reachable from the document. Scoped tightly — only
  // shadow-root elements are affected; all other calls delegate to the native
  // implementation.
  const nativeContains = Document.prototype.contains.bind(document);
  Object.defineProperty(document, "contains", {
    value(node: Node | null): boolean {
      if (node instanceof Node && node.getRootNode() === sr) return true;
      return nativeContains(node);
    },
    configurable: true,
    writable: true,
  });
}

/**
 * Returns the ShadowRoot cast to HTMLElement, ready to pass as the
 * `mount` prop to any Kobalte Portal component. Kobalte's mount prop
 * accepts any Node at runtime; the cast satisfies its type signature.
 */
export function useShadowMount(): HTMLElement {
  return shadowMount!;
}
