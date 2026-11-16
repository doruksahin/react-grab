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

/**
 * What a step's target is: a page path, a name a person reads on screen
 * (ARIA or text), or only a CSS selector.
 */
export type StepTargetKind = "page" | "name" | "selector";

/** A step split into the parts a view styles separately. */
export interface StepParts {
  verb: "Open" | "Click" | "Change";
  target: string;
  targetKind: StepTargetKind;
  role?: string;
  /** The page a click led to. */
  destination?: string;
  /** A change step's value is never stored. */
  valueNotSaved?: boolean;
  /** Role and notes, as the sentence shows them in parentheses. */
  details?: string;
}
