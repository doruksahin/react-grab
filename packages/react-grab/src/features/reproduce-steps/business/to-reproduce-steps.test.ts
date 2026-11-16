import { parse } from "@puppeteer/replay";
import { describe, expect, it } from "vitest";
import type { CapturedStep } from "../types.js";
import { toReproduceSteps } from "./to-reproduce-steps.js";

const SETTINGS = "https://app.example.com/settings";
const BILLING = "https://app.example.com/settings/billing";

const click = (selector: string, pageUrl: string): CapturedStep => ({
  step: { type: "click", selectors: [selector], offsetX: 4, offsetY: 6 },
  pageUrl,
});

const change = (selector: string, pageUrl: string): CapturedStep => ({
  step: { type: "change", selectors: [selector], value: "" },
  pageUrl,
});

describe("toReproduceSteps", () => {
  it("is undefined when nothing was captured", () => {
    expect(toReproduceSteps([], SETTINGS)).toBeUndefined();
  });

  it("starts with a navigate to where capture started", () => {
    const steps = toReproduceSteps([click("#tab", SETTINGS)], SETTINGS);
    expect(steps?.[0]).toEqual({ type: "navigate", url: SETTINGS });
    expect(steps).toHaveLength(2);
  });

  it("asserts the navigation a click caused in the app", () => {
    const steps = toReproduceSteps(
      [click("#billing-tab", SETTINGS), change("#coupon", BILLING)],
      BILLING,
    );
    expect(steps?.[1]).toMatchObject({
      type: "click",
      assertedEvents: [{ type: "navigation", url: BILLING }],
    });
    expect(steps?.[2]).not.toHaveProperty("assertedEvents");
  });

  it("asserts a navigation by the last click against the current page", () => {
    const steps = toReproduceSteps([click("#billing-tab", SETTINGS)], BILLING);
    expect(steps?.[1]).toMatchObject({
      assertedEvents: [{ type: "navigation", url: BILLING }],
    });
  });

  it("does not assert a navigation for a query or fragment change", () => {
    const steps = toReproduceSteps(
      [click("#search", SETTINGS), click("#result", `${SETTINGS}?q=shoes#top`)],
      `${SETTINGS}?q=shoes#top`,
    );
    expect(steps?.[1]).not.toHaveProperty("assertedEvents");
  });

  it("keeps a click whose navigation URL is too long, without the assertion", () => {
    const longUrl = `${BILLING}?q=${"x".repeat(3000)}`;
    const steps = toReproduceSteps([click("#billing-tab", SETTINGS)], longUrl);
    expect(steps?.[1]).toMatchObject({ type: "click" });
    expect(steps?.[1]).not.toHaveProperty("assertedEvents");
  });

  it("leaves out a step the server would refuse", () => {
    const noSelectors: CapturedStep = {
      step: { type: "click", selectors: [], offsetX: 0, offsetY: 0 },
      pageUrl: SETTINGS,
    };
    const steps = toReproduceSteps(
      [click("#a", SETTINGS), noSelectors, click("#c", SETTINGS)],
      SETTINGS,
    );
    expect(steps).toHaveLength(3);
    expect(steps?.map((step) => step.type)).toEqual([
      "navigate",
      "click",
      "click",
    ]);
  });

  it("is a flow Chrome DevTools Recorder accepts", () => {
    const steps = toReproduceSteps(
      [click('aria/Billing[role="tab"]', SETTINGS), change("#coupon", BILLING)],
      BILLING,
    );
    expect(() => parse({ title: "Selection", steps })).not.toThrow();
  });
});
