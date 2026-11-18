import { isAcceptedStep } from "../limits.js";
import type { CapturedStep, ReproduceStep } from "../types.js";
import { stepsOnCurrentPage } from "./steps-on-current-page.js";

/**
 * The flow that led to a selection on the current page, as Chrome DevTools
 * Recorder steps (ADR-0025): a navigate to this page as it was when it was
 * last entered, then each step taken on it (ADR-0032). Steps the server
 * would refuse (an overlong URL, no usable selector) are left out, so a flow
 * never blocks saving its comment.
 */
export const toReproduceSteps = (
  captured: ReadonlyArray<CapturedStep>,
  currentPageUrl: string,
): ReproduceStep[] | undefined => {
  const onPage = stepsOnCurrentPage(captured, currentPageUrl);
  const [first] = onPage;
  if (!first) return undefined;

  const steps: ReproduceStep[] = [
    { type: "navigate", url: first.pageUrl },
    ...onPage.map((entry) => entry.step),
  ];
  const valid = steps.filter(isAcceptedStep);
  return valid[0]?.type === "navigate" ? valid : undefined;
};
