import type { ReproduceStep } from "../types.js";
import { originOf, pageKey } from "./page-key.js";

/** Where a guide is: which selection, and the index of its current step. */
export interface GuidePosition {
  selectionId: string;
  stepIndex: number;
}

export type GuideStart = { kind: "here" } | { kind: "open-page"; url: string };

// Step 0 is the navigate to where capture started; the guide acts from 1.
export const FIRST_ACTION_STEP_INDEX = 1;

/**
 * How a guide over these steps starts from the current page (ADR-0026):
 * here, after opening the first step's page on this site, or not at all
 * (no steps to act on, or another site).
 */
export const guideStart = (
  steps: ReadonlyArray<ReproduceStep> | undefined,
  currentUrl: string,
): GuideStart | undefined => {
  const [first] = steps ?? [];
  if (first?.type !== "navigate") return undefined;
  if ((steps?.length ?? 0) <= FIRST_ACTION_STEP_INDEX) return undefined;
  const origin = originOf(first.url);
  if (!origin || origin !== originOf(currentUrl)) return undefined;
  return pageKey(first.url) === pageKey(currentUrl)
    ? { kind: "here" }
    : { kind: "open-page", url: first.url };
};

export const isGuideFinished = (
  position: GuidePosition,
  steps: ReadonlyArray<ReproduceStep>,
): boolean => position.stepIndex >= steps.length;

export const nextPosition = (position: GuidePosition): GuidePosition => ({
  ...position,
  stepIndex: position.stepIndex + 1,
});
