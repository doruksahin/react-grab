import type { ReproduceStep } from "../types.js";
import { describeStep } from "@react-grab/selection-text";

/** A run of identical consecutive steps, shown as one row. */
export interface StepRun {
  step: ReproduceStep;
  /** 1-based position of the run's first step in the full list. */
  number: number;
  count: number;
}

/**
 * Folds consecutive steps that read the same into one run, so a list shows
 * "Click canvas ×2" once. Only the view folds; the steps and their export
 * stay as recorded.
 */
export const groupRepeatedSteps = (
  steps: readonly ReproduceStep[],
): StepRun[] => {
  const runs: StepRun[] = [];
  let previousText: string | undefined;
  steps.forEach((step, index) => {
    const text = describeStep(step);
    const last = runs.at(-1);
    if (last && text === previousText) {
      last.count += 1;
    } else {
      runs.push({ step, number: index + 1, count: 1 });
    }
    previousText = text;
  });
  return runs;
};
