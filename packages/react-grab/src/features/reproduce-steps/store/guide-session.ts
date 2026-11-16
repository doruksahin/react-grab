import { z } from "zod";
import {
  FIRST_ACTION_STEP_INDEX,
  type GuidePosition,
} from "../business/guide-progress.js";

// Per-tab storage keeps a running guide across a page load and drops it with
// the tab (ADR-0026).
const GUIDE_SESSION_KEY = "react-grab:step-guide";

const guidePositionSchema = z.object({
  selectionId: z.string().min(1),
  stepIndex: z.number().int().min(FIRST_ACTION_STEP_INDEX),
}) satisfies z.ZodType<GuidePosition>;

export const loadGuideSession = (): GuidePosition | undefined => {
  try {
    const stored = sessionStorage.getItem(GUIDE_SESSION_KEY);
    if (!stored) return undefined;
    const parsed = guidePositionSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

export const saveGuideSession = (position: GuidePosition | undefined): void => {
  try {
    if (position) {
      sessionStorage.setItem(GUIDE_SESSION_KEY, JSON.stringify(position));
    } else {
      sessionStorage.removeItem(GUIDE_SESSION_KEY);
    }
  } catch {
    // Storage can be blocked; the guide then only lasts until a page load.
  }
};
