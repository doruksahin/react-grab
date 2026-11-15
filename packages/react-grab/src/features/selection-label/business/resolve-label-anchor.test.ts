import { describe, expect, it } from "vitest";
import { resolveLabelAnchor } from "./resolve-label-anchor.js";

const viewport = { x: 0, y: 0, width: 1000, height: 800 };
const bounds = { x: 100, y: 200, width: 300, height: 50 };

describe("resolveLabelAnchor", () => {
  it("keeps the last position without a measured label", () => {
    expect(
      resolveLabelAnchor({
        bounds,
        pointerX: 150,
        viewport,
        hasMeasurements: false,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("keeps the last position without element bounds", () => {
    expect(
      resolveLabelAnchor({
        bounds: undefined,
        pointerX: 150,
        viewport,
        hasMeasurements: true,
      }),
    ).toEqual({ kind: "keep" });
    expect(
      resolveLabelAnchor({
        bounds: { ...bounds, width: 0 },
        pointerX: 150,
        viewport,
        hasMeasurements: true,
      }),
    ).toEqual({ kind: "keep" });
  });

  it("hides the label while the element is out of view", () => {
    expect(
      resolveLabelAnchor({
        bounds: { ...bounds, y: 900 },
        pointerX: 150,
        viewport,
        hasMeasurements: true,
      }),
    ).toEqual({ kind: "hide" });
  });

  it("anchors at the pointer's x over the element's height", () => {
    expect(
      resolveLabelAnchor({
        bounds,
        pointerX: 150,
        viewport,
        hasMeasurements: true,
      }),
    ).toEqual({
      kind: "track",
      rect: { x: 150, y: 200, width: 0, height: 50 },
    });
  });

  it("anchors at the element's centre without a pointer", () => {
    expect(
      resolveLabelAnchor({
        bounds,
        pointerX: undefined,
        viewport,
        hasMeasurements: true,
      }),
    ).toEqual({
      kind: "track",
      rect: { x: 250, y: 200, width: 0, height: 50 },
    });
  });
});
