import {
  UpsertCommentBody,
  upsertCommentBodyStepsItemTwoSelectorsItemMax,
  upsertCommentBodyStepsMax,
} from "../../generated/sync-api.zod.js";
import type { ReproduceStep } from "./types.js";

/*
 * The server's step limits (ADR-0025), read from the client Orval generates
 * from its OpenAPI spec, so the overlay never sends a flow it would refuse.
 */

// One navigate step to the starting page, then the captured steps.
export const MAX_CAPTURED_STEPS = upsertCommentBodyStepsMax - 1;

export const STEP_SELECTOR_MAX_LENGTH_CHARS =
  upsertCommentBodyStepsItemTwoSelectorsItemMax;

const stepSchema = UpsertCommentBody.shape.steps.unwrap().element;

export const isAcceptedStep = (step: ReproduceStep): boolean =>
  stepSchema.safeParse(step).success;
