import type { CapturedStep } from "../types.js";
import { pageKey } from "./page-key.js";

/**
 * The captured steps since the current page was last entered (ADR-0032).
 * Steps on earlier pages are left out, because the flow's navigate step
 * opens this page directly. A page is its origin and path (pageKey).
 */
export const stepsOnCurrentPage = (
  captured: ReadonlyArray<CapturedStep>,
  currentPageUrl: string,
): ReadonlyArray<CapturedStep> => {
  const currentPage = pageKey(currentPageUrl);
  const lastStepElsewhere = captured.findLastIndex(
    (entry) => pageKey(entry.pageUrl) !== currentPage,
  );
  return captured.slice(lastStepElsewhere + 1);
};
