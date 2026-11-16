import type { CommentItem } from "../../../types.js";
import type { ReproduceStep } from "../types.js";

export interface UserFlow {
  title: string;
  steps: ReproduceStep[];
}

type FlowSource = Pick<
  CommentItem,
  "id" | "commentText" | "componentName" | "elementName" | "steps"
>;

/**
 * A selection's steps as a Chrome DevTools Recorder user flow, the JSON the
 * Recorder imports (ADR-0025, phase 3). Undefined when it has no steps.
 */
export const toUserFlow = (item: FlowSource): UserFlow | undefined => {
  if (!item.steps?.length) return undefined;
  return {
    title: item.commentText || item.componentName || item.elementName,
    steps: item.steps,
  };
};

export const userFlowFileName = (item: Pick<CommentItem, "id">): string =>
  `react-grab-steps-${item.id}.json`;
