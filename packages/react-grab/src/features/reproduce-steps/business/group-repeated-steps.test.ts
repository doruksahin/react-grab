import { describe, expect, it } from "vitest";
import { groupRepeatedSteps } from "./group-repeated-steps.js";

const click = (selector: string) => ({
  type: "click" as const,
  selectors: [selector],
  offsetX: 1,
  offsetY: 1,
});
const open = (url: string) => ({ type: "navigate" as const, url });

describe("groupRepeatedSteps", () => {
  it("folds identical consecutive steps into one run", () => {
    const runs = groupRepeatedSteps([
      open("https://app.example.com/"),
      click("#canvas"),
      click("#canvas"),
      click("text/New board"),
    ]);
    expect(runs.map(({ number, count }) => ({ number, count }))).toEqual([
      { number: 1, count: 1 },
      { number: 2, count: 2 },
      { number: 4, count: 1 },
    ]);
  });

  it("keeps the same step apart when another step sits between", () => {
    const runs = groupRepeatedSteps([
      click("#canvas"),
      click("text/New board"),
      click("#canvas"),
    ]);
    expect(runs.map((run) => run.count)).toEqual([1, 1, 1]);
  });

  it("folds steps that read the same even when their selectors differ", () => {
    const runs = groupRepeatedSteps([click("aria/Save"), click("text/Save")]);
    expect(runs).toHaveLength(1);
    expect(runs[0].count).toBe(2);
  });

  it("returns no runs for no steps", () => {
    expect(groupRepeatedSteps([])).toEqual([]);
  });
});
