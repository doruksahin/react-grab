import type {
  ChangeStep,
  ClickStep,
  ReproduceStep,
} from "../../generated/sync-api.js";

export type { ChangeStep, ClickStep, ReproduceStep };

/** A captured step and the page URL at the time it happened. */
export interface CapturedStep {
  step: ClickStep | ChangeStep;
  pageUrl: string;
}

/** Point of a click in viewport coordinates. */
export interface ClickPoint {
  clientX: number;
  clientY: number;
}

export interface StepCapture {
  /** The flow that led here, or undefined when nothing was captured. */
  take: () => ReproduceStep[] | undefined;
  stop: () => void;
}

export interface StepCaptureDeps {
  /** True while React Grab is selecting: those clicks pick elements, not act. */
  isPaused: () => boolean;
  /** Called for each captured step, e.g. to mark it in a session recording. */
  onStep?: (step: ClickStep | ChangeStep) => void;
}
