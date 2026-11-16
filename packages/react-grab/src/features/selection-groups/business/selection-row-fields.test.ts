import { describe, expect, it } from "vitest";
import { selectionRowFields } from "./selection-row-fields.js";

describe("selectionRowFields", () => {
  it("leads with the comment and follows with the component", () => {
    expect(
      selectionRowFields({
        commentText: "Plan price is cut off",
        componentName: "PriceTag",
        tagName: "span",
      }),
    ).toEqual({ title: "Plan price is cut off", detail: "PriceTag" });
  });

  it("falls back to the tag when there is no component", () => {
    expect(
      selectionRowFields({ commentText: "Too tight", tagName: "button" }),
    ).toEqual({ title: "Too tight", detail: "button" });
  });

  it("uses the element as the title when there is no comment", () => {
    expect(
      selectionRowFields({
        commentText: "  ",
        componentName: "Header",
        tagName: "nav",
      }),
    ).toEqual({ title: "Header" });
  });

  it("names a multi-element selection by its count", () => {
    expect(selectionRowFields({ tagName: "li", elementsCount: 3 })).toEqual({
      title: "3 elements",
    });
  });
});
