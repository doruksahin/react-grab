import { describe, expect, it } from "vitest";
import { screenshotRefs } from "./screenshot-refs.js";

describe("screenshotRefs", () => {
  it("refers to each uploaded screenshot by selection and kind", () => {
    expect(
      screenshotRefs({
        id: "comment-1",
        screenshotElement: "screenshots/comment-1/element",
        screenshotFullPage: "screenshots/comment-1/full",
      }),
    ).toEqual({
      element: { selectionId: "comment-1", kind: "element" },
      fullPage: { selectionId: "comment-1", kind: "full" },
    });
  });

  it("leaves out a screenshot that was never uploaded", () => {
    expect(
      screenshotRefs({ id: "comment-1", screenshotFullPage: "key" }),
    ).toEqual({ fullPage: { selectionId: "comment-1", kind: "full" } });
  });
});
