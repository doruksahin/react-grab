import { changeStep, clickStep, stepTarget } from "../business/build-step.js";
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
import { createPageEvents } from "./create-page-events.js";

/**
 * Captures the clicks and field changes on this page while it stays loaded,
 * keeping the most recent ones (ADR-0025). Which events count is decided by
 * createPageEvents.
 */
export const createStepCapture = (deps: StepCaptureDeps): StepCapture => {
  const buffer = createStepBuffer<CapturedStep>(MAX_CAPTURED_STEPS);

  const record = (step: ClickStep | ChangeStep) => {
    buffer.add({ step, pageUrl: window.location.href });
    deps.onStep?.(step);
  };

  const stopListening = createPageEvents({
    isPaused: deps.isPaused,
    onClick: ({ event, target }) =>
      record(clickStep(stepTarget(target), event)),
    onChange: ({ target }) => {
      const step = changeStep(target);
      if (step) record(step);
    },
  });

  return {
    take: () => toReproduceSteps(buffer.entries(), window.location.href),
    stop: stopListening,
  };
};
