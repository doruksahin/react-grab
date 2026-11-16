import { OVERLAY_EVENT_BOUNDARY_ATTRIBUTE } from "../../../constants.js";
import { isEventFromOverlay } from "../../../utils/is-event-from-overlay.js";
import { createSelectionPress } from "../business/selection-press.js";

export interface PageEvent<EventType extends Event> {
  event: EventType;
  target: Element;
}

export interface PageEventsDeps {
  /** True while React Grab is selecting: those clicks pick elements, not act. */
  isPaused: () => boolean;
  onClick?: (pageEvent: PageEvent<MouseEvent>) => void;
  onChange?: (pageEvent: PageEvent<Event>) => void;
}

// A click inside a component's shadow root is retargeted to its host, which
// would point at the wrong element; shadow DOM is not followed (ADR-0025).
const isRetargeted = (event: Event): boolean =>
  event.composedPath()[0] !== event.target;

/**
 * The user's own clicks and field changes on the page (ADR-0025, ADR-0026):
 * trusted events only, never React Grab's UI, and never the click that ends
 * a React Grab selection. A selection ends on pointerup, which turns
 * selection mode off before the click fires, so a click is judged by the
 * press that started it. Step capture and the step guide both listen here.
 * External bridge: capture-phase listeners on window and document.
 * Returns the function that removes them.
 */
export const createPageEvents = (deps: PageEventsDeps): (() => void) => {
  const selectionPress = createSelectionPress();
  const listeners = new AbortController();
  const listenerOptions = { capture: true, signal: listeners.signal };

  const pageTarget = (event: Event): Element | undefined => {
    if (!event.isTrusted || !(event.target instanceof Element))
      return undefined;
    if (isRetargeted(event) || deps.isPaused()) return undefined;
    if (isEventFromOverlay(event, OVERLAY_EVENT_BOUNDARY_ATTRIBUTE)) {
      return undefined;
    }
    return event.target;
  };

  // Registered on window, before the overlay's own listeners, so every press
  // is seen, even one the overlay stops.
  window.addEventListener(
    "pointerdown",
    () => selectionPress.pressStarted(deps.isPaused()),
    listenerOptions,
  );
  window.addEventListener(
    "pointercancel",
    () => selectionPress.pressCancelled(),
    listenerOptions,
  );

  document.addEventListener(
    "click",
    (event) => {
      if (selectionPress.isSelectionClick(event.detail)) return;
      const target = pageTarget(event);
      if (target) deps.onClick?.({ event, target });
    },
    listenerOptions,
  );

  document.addEventListener(
    "change",
    (event) => {
      const target = pageTarget(event);
      if (target) deps.onChange?.({ event, target });
    },
    listenerOptions,
  );

  return () => listeners.abort();
};
