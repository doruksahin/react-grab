import { isAcceptedStep } from "../limits.js";
import type { CapturedStep, ReproduceStep } from "../types.js";
import { pageKey } from "./page-key.js";

const withNavigation = (
  captured: CapturedStep,
  nextPageUrl: string,
): ReproduceStep => {
  const { step, pageUrl } = captured;
  if (step.type !== "click" || pageKey(nextPageUrl) === pageKey(pageUrl)) {
    return step;
  }
  const asserted: ReproduceStep = {
    ...step,
    assertedEvents: [{ type: "navigation", url: nextPageUrl }],
  };
  // An overlong URL loses only its assertion, not the click.
  return isAcceptedStep(asserted) ? asserted : step;
};

/**
 * The flow that led to the current page, as Chrome DevTools Recorder steps
 * (ADR-0025): a navigate to where capture started, then each step. A click
 * after which the page (origin and path) changed asserts that navigation,
 * as the Recorder does for single-page apps. Steps the server would refuse (an overlong URL)
 * are left out, so a flow never blocks saving its comment.
 */
export const toReproduceSteps = (
  captured: ReadonlyArray<CapturedStep>,
  currentPageUrl: string,
): ReproduceStep[] | undefined => {
  const [first] = captured;
  if (!first) return undefined;

  const steps: ReproduceStep[] = [
    { type: "navigate", url: first.pageUrl },
    ...captured.map((entry, index) =>
      withNavigation(entry, captured[index + 1]?.pageUrl ?? currentPageUrl),
    ),
  ];
  const valid = steps.filter(isAcceptedStep);
  return valid[0]?.type === "navigate" ? valid : undefined;
};
