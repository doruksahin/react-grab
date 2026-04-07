// packages/react-grab/src/utils/shadow-context.ts
import { createContext, useContext } from "solid-js";

/**
 * Provides the ShadowRoot to all components that need to mount overlays
 * (Dialog, Select, Tooltip) inside the shadow DOM.
 *
 * Set once by ReactGrabRenderer via the shadowRoot prop passed from
 * mountRoot(). All consumers of useShadowMount() are unconditionally
 * descendants of that provider — there is no fallback because there
 * is no scenario in which the context can be missing.
 */
export const ShadowRootContext = createContext<ShadowRoot | null>(null);

export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}

/**
 * Returns the ShadowRoot cast to HTMLElement, ready to pass as the
 * `mount` prop to any Kobalte Portal component. Kobalte's mount prop
 * accepts any Node at runtime; the cast satisfies its type signature.
 */
export function useShadowMount(): HTMLElement {
  return useShadowRoot() as unknown as HTMLElement;
}
