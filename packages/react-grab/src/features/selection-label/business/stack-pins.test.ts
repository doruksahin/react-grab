import { describe, expect, it } from "vitest";
import { stackPins } from "./stack-pins.js";

const SIZE = { width: 200, height: 30, gap: 6 };

const anchor = (id: string, x: number, y: number, height = 40) => ({
  id,
  rect: { x, y, width: 300, height },
});

describe("stackPins", () => {
  it("leaves pins of separate elements where they are", () => {
    const offsets = stackPins(
      [anchor("a", 0, 0), anchor("b", 0, 200), anchor("c", 400, 0)],
      SIZE,
    );
    expect([...offsets.values()]).toEqual([0, 0, 0]);
  });

  it("stacks pins of the same element with the gap between them", () => {
    const offsets = stackPins(
      [anchor("a", 0, 0), anchor("b", 0, 0), anchor("c", 0, 0)],
      SIZE,
    );
    expect(offsets.get("a")).toBe(0);
    expect(offsets.get("b")).toBe(36);
    expect(offsets.get("c")).toBe(72);
  });

  it("moves a pin below a nearby element's pin it would cover", () => {
    // b's own spot (46..76) is where a's pin is, so b goes to 82..112.
    const offsets = stackPins(
      [anchor("a", 0, 0), anchor("b", 50, 20, 20)],
      SIZE,
    );
    expect(offsets.get("a")).toBe(0);
    expect(offsets.get("b")).toBe(36);
  });

  it("does not depend on input order", () => {
    const forward = stackPins([anchor("a", 0, 0), anchor("b", 0, 0)], SIZE);
    const backward = stackPins([anchor("b", 0, 0), anchor("a", 0, 0)], SIZE);
    expect(backward).toEqual(forward);
  });

  it("keeps clearing pins until none overlap", () => {
    const offsets = stackPins(
      [anchor("a", 0, 0), anchor("b", 0, 36), anchor("c", 0, 0)],
      SIZE,
    );
    const tops = ["a", "b", "c"].map((id) => {
      const rect = id === "b" ? { y: 36 } : { y: 0 };
      return rect.y + 40 + 6 + (offsets.get(id) ?? 0);
    });
    const sorted = [...tops].sort((left, right) => left - right);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index] - sorted[index - 1]).toBeGreaterThanOrEqual(36);
    }
  });
});
