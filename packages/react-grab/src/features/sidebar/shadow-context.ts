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
