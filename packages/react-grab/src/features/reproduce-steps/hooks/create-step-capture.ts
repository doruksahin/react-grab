import { OVERLAY_EVENT_BOUNDARY_ATTRIBUTE } from "../../../constants.js";
import { isEventFromOverlay } from "../../../utils/is-event-from-overlay.js";
import { changeStep, clickStep, stepTarget } from "../business/build-step.js";
import { createSelectionPress } from "../business/selection-press.js";
import { createStepBuffer } from "../business/step-buffer.js";
import { toReproduceSteps } from "../business/to-reproduce-steps.js";
import { MAX_CAPTURED_STEPS } from "../limits.js";
import type {
  CapturedStep,
  ChangeStep,
  ClickStep,
  StepCapture,
  StepCaptureDeps,
} from "../types.js";

// A click inside a component's shadow root is retargeted to its host, which
// would make a plausible but wrong step; shadow DOM is not captured (ADR-0025).
const isRetargeted = (event: Event): boolean =>
  event.composedPath()[0] !== event.target;

/**
 * Captures the clicks and field changes on this page while it stays loaded,
 * keeping the most recent ones (ADR-0025). Only trusted events on the page
 * count: the page's own synthetic events, React Grab's UI and the clicks
 * that select an element are not steps.
 * External bridge: capture-phase listeners on window and document.
 */
export const createStepCapture = (deps: StepCaptureDeps): StepCapture => {
  const buffer = createStepBuffer<CapturedStep>(MAX_CAPTURED_STEPS);
  const selectionPress = createSelectionPress();
  const listeners = new AbortController();
  const listenerOptions = { capture: true, signal: listeners.signal };

  const isPageEvent = (event: Event): event is Event & { target: Element } =>
    event.isTrusted &&
    event.target instanceof Element &&
    !isRetargeted(event) &&
    !deps.isPaused() &&
    !isEventFromOverlay(event, OVERLAY_EVENT_BOUNDARY_ATTRIBUTE);

  const record = (step: ClickStep | ChangeStep) => {
    buffer.add({ step, pageUrl: window.location.href });
    deps.onStep?.(step);
  };

  // Registered on window before the overlay's own listeners, so every press
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
      if (!isPageEvent(event)) return;
      record(clickStep(stepTarget(event.target), event));
    },
    listenerOptions,
  );

  document.addEventListener(
    "change",
    (event) => {
      if (!isPageEvent(event)) return;
      const step = changeStep(event.target);
      if (step) record(step);
    },
    listenerOptions,
  );

  return {
    take: () => toReproduceSteps(buffer.entries(), window.location.href),
    stop: () => listeners.abort(),
  };
};
