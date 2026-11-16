import { z } from "@hono/zod-openapi";

// ADR-0025: a subset of the Chrome DevTools Recorder user-flow steps.
const MAX_SELECTORS_PER_STEP = 3;
const MAX_SELECTOR_LENGTH_CHARS = 512;
const MAX_URL_LENGTH_CHARS = 2048;
const MAX_CAPTURED_STEPS = 50;
// One navigate step to the starting page, then the captured steps.
export const MAX_REPRODUCE_STEPS = MAX_CAPTURED_STEPS + 1;

const PageUrl = z.string().url().max(MAX_URL_LENGTH_CHARS);

const StepSelectors = z
  .array(z.string().min(1).max(MAX_SELECTOR_LENGTH_CHARS))
  .min(1)
  .max(MAX_SELECTORS_PER_STEP)
  .openapi({
    description:
      "Alternative selectors in Recorder order: aria/…, CSS, text/…",
  });

const NavigationEvent = z.object({
  type: z.literal("navigation"),
  url: PageUrl,
});

export const NavigateStep = z
  .object({ type: z.literal("navigate"), url: PageUrl })
  .openapi("NavigateStep");

export const ClickStep = z
  .object({
    type: z.literal("click"),
    selectors: StepSelectors,
    offsetX: z.number(),
    offsetY: z.number(),
    assertedEvents: z.array(NavigationEvent).max(1).optional().openapi({
      description: "Set when the click led to another page in the app",
    }),
  })
  .openapi("ClickStep");

export const ChangeStep = z
  .object({
    type: z.literal("change"),
    selectors: StepSelectors,
    value: z.literal("").openapi({
      description: "Always empty: input values are never stored",
    }),
  })
  .openapi("ChangeStep");

export const ReproduceStep = z
  .discriminatedUnion("type", [NavigateStep, ClickStep, ChangeStep])
  .openapi("ReproduceStep", {
    description:
      "One Chrome DevTools Recorder step that led to the selection (ADR-0025)",
  });

export const ReproduceSteps = z.array(ReproduceStep).max(MAX_REPRODUCE_STEPS);

export type ReproduceStepValue = z.infer<typeof ReproduceStep>;
