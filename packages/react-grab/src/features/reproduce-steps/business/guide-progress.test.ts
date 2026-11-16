import { describe, expect, it } from "vitest";
import type { ReproduceStep } from "../types.js";
import { guideStart, isGuideFinished, nextPosition } from "./guide-progress.js";

const SETTINGS = "https://app.example.com/settings";

const steps: ReproduceStep[] = [
  { type: "navigate", url: SETTINGS },
  { type: "click", selectors: ["#billing"], offsetX: 1, offsetY: 1 },
];

describe("guideStart", () => {
  it("starts here when the current page is the first step's page", () => {
    expect(guideStart(steps, `${SETTINGS}?tab=2#top`)).toEqual({
      kind: "here",
    });
  });

  it("opens the first step's page on the same site", () => {
    expect(guideStart(steps, "https://app.example.com/home")).toEqual({
      kind: "open-page",
      url: SETTINGS,
    });
  });

  it("does not start on another site", () => {
    expect(
      guideStart(steps, "https://other.example.com/settings"),
    ).toBeUndefined();
  });

  it("never starts from or to a URL that is not a web page", () => {
    const script: ReproduceStep[] = [
      { type: "navigate", url: "javascript:alert(1)" },
      ...steps.slice(1),
    ];
    expect(guideStart(script, "file:///Users/me/page.html")).toBeUndefined();
    expect(guideStart(script, "javascript:void 0")).toBeUndefined();
    expect(guideStart(steps, "file:///Users/me/page.html")).toBeUndefined();
    expect(
      guideStart(
        [{ type: "navigate", url: "data:text/html,x" }, ...steps.slice(1)],
        "data:text/html,y",
      ),
    ).toBeUndefined();
  });

  it("does not start without a step to act on", () => {
    expect(guideStart(steps.slice(0, 1), SETTINGS)).toBeUndefined();
    expect(guideStart(undefined, SETTINGS)).toBeUndefined();
  });

  it("does not start when the flow has no leading navigate", () => {
    expect(guideStart(steps.slice(1), SETTINGS)).toBeUndefined();
  });
});

describe("progress", () => {
  it("moves to the next step and finishes after the last", () => {
    const first = { selectionId: "c-1", stepIndex: 1 };
    expect(isGuideFinished(first, steps)).toBe(false);
    const after = nextPosition(first);
    expect(after).toEqual({ selectionId: "c-1", stepIndex: 2 });
    expect(isGuideFinished(after, steps)).toBe(true);
  });
});
