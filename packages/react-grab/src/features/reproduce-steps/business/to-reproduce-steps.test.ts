import { parse } from "@puppeteer/replay";
import { describe, expect, it } from "vitest";
import type { CapturedStep } from "../types.js";
import { toReproduceSteps } from "./to-reproduce-steps.js";

const DASHBOARD = "https://app.example.com/dashboard";
const SETTINGS = "https://app.example.com/settings";

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

  it("starts with a navigate to the page", () => {
    const steps = toReproduceSteps([click("#tab", SETTINGS)], SETTINGS);
    expect(steps?.[0]).toEqual({ type: "navigate", url: SETTINGS });
    expect(steps).toHaveLength(2);
  });

  it("starts where the current page was last entered", () => {
    const steps = toReproduceSteps(
      [
        click("#new-ad", DASHBOARD),
        click("#settings-link", DASHBOARD),
        click("#billing-tab", SETTINGS),
      ],
      SETTINGS,
    );
    expect(steps).toEqual([
      { type: "navigate", url: SETTINGS },
      click("#billing-tab", SETTINGS).step,
    ]);
  });

  it("is undefined when no step was taken on the current page", () => {
    expect(
      toReproduceSteps([click("#settings-link", DASHBOARD)], SETTINGS),
    ).toBeUndefined();
  });

  it("navigates to the page as it was when it was entered", () => {
    const entered = `${SETTINGS}?tab=general`;
    const steps = toReproduceSteps(
      [click("#billing-tab", entered)],
      `${SETTINGS}?tab=billing`,
    );
    expect(steps?.[0]).toEqual({ type: "navigate", url: entered });
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
    expect(steps?.map((step) => step.type)).toEqual([
      "navigate",
      "click",
      "click",
    ]);
  });

  it("is undefined when the page URL is too long to store", () => {
    const longUrl = `${SETTINGS}?q=${"x".repeat(3000)}`;
    expect(toReproduceSteps([click("#a", longUrl)], longUrl)).toBeUndefined();
  });

  it("is a flow Chrome DevTools Recorder accepts", () => {
    const steps = toReproduceSteps(
      [
        click('aria/Billing[role="tab"]', SETTINGS),
        change("#coupon", SETTINGS),
      ],
      SETTINGS,
    );
    expect(() => parse({ title: "Selection", steps })).not.toThrow();
  });
});
