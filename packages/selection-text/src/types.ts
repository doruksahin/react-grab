/**
 * The fields of a Recorder step (ADR-0025) that this package reads. The
 * overlay's generated `ReproduceStep` and the server's `ReproduceStepValue`
 * both satisfy these shapes, so neither side copies the other's type.
 */
export interface NavigateStepFields {
  type: "navigate";
  url: string;
}

export interface TargetStepFields {
  type: "click" | "change";
  selectors: string[];
  assertedEvents?: { type: string; url: string }[];
}

export type StepFields = NavigateStepFields | TargetStepFields;

/** What a step's target is: a page path, a readable name, or a CSS selector. */
export type StepTargetKind = "page" | "name" | "selector";

/** The parts of a step sentence, for renderers that style the target. */
export interface StepParts {
  verb: "Open" | "Click" | "Change";
  target: string;
  targetKind: StepTargetKind;
  /** Role and value note, in parentheses, e.g. "(textbox, value not saved)". */
  detail?: string;
  /** The page a click led to. */
  destination?: string;
}
