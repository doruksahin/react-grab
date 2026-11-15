import { describe, expect, it } from "vitest";
import { isPinnedLabel } from "./is-pinned-label.js";

describe("isPinnedLabel", () => {
  it("pins a saved selection", () => {
    expect(isPinnedLabel({ itemId: "comment-1" })).toBe(true);
  });

  it("does not pin a label without a saved selection", () => {
    expect(isPinnedLabel({ itemId: undefined })).toBe(false);
    expect(isPinnedLabel({ itemId: "" })).toBe(false);
  });
});
