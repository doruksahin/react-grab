// packages/react-grab/src/features/sidebar/shadow-context.ts
import { createContext, useContext } from "solid-js";

/**
 * Provides the ShadowRoot to all sidebar components that need to mount
 * overlays (Dialog, Select, Popover content) inside the shadow DOM.
 *
 * Set by renderer.tsx using: containerRef.getRootNode() as ShadowRoot
 * Same pattern as comments-dropdown.tsx:81 and toolbar/index.tsx:126.
 */
export const ShadowRootContext = createContext<ShadowRoot | null>(null);

export function useShadowRoot(): ShadowRoot | null {
  return useContext(ShadowRootContext);
}

/**
 * Returns the shadow root (or document.body as fallback) cast to HTMLElement,
 * ready to pass as the `mount` prop to any Kobalte Portal component.
 *
 * Use this in every *Portal wrapper inside src/components/ui/ instead of
 * copy-pasting the useShadowRoot() + cast pattern.
 */
export function useShadowMount(): HTMLElement {
  return (useShadowRoot() ?? document.body) as HTMLElement;
}
