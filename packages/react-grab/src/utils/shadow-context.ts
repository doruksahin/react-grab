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
}

/**
 * Returns the ShadowRoot cast to HTMLElement, ready to pass as the
 * `mount` prop to any Kobalte Portal component. Kobalte's mount prop
 * accepts any Node at runtime; the cast satisfies its type signature.
 */
export function useShadowMount(): HTMLElement {
  return shadowMount!;
}
