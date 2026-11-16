import type {
  ChangeStep,
  ClickStep,
  ReproduceStep,
} from "../../generated/sync-api.js";

import type { CommentItem } from "../../types.js";

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

export type GuideStatus =
  | "loading"
  | "looking"
  | "showing"
  | "found"
  | "missing"
  | "removed";

/** What the guide bar shows (ADR-0026). */
export interface GuideView {
  status: GuideStatus;
  /** 1-based number of the current action step; 0 once the guide has ended. */
  stepNumber: number;
  stepCount: number;
  sentence?: string;
}

export interface StepGuideDeps {
  commentItems: () => CommentItem[];
  currentPageUrl: () => string;
  /** True once comments have loaded, so a missing selection means it was removed. */
  commentsLoaded: () => boolean;
  /** True while React Grab is selecting: those clicks do not advance the guide. */
  isPaused: () => boolean;
  /** The selection's own elements that are on the page now. */
  selectionElements: (item: CommentItem) => Element[];
}

export interface StepGuideAPI {
  canStart: (selectionId: string) => boolean;
  start: (selectionId: string) => void;
  skip: () => void;
  stop: () => void;
  view: () => GuideView | undefined;
  /** The element the guide points at now, drawn by the overlay. */
  highlightedElement: () => Element | undefined;
}
