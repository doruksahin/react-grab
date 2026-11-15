import { describe, expect, it } from "vitest";
import type { CommentItem } from "../../../types.js";
import {
  isSameLabelFields,
  toPreviewLabelFields,
} from "./preview-label-fields.js";
import { isSamePreview } from "./same-preview.js";

const item: CommentItem = {
  id: "a",
  groupId: null,
  content: "<li>a</li>",
  elementName: "li",
  tagName: "li",
  componentName: "TodoItem",
  elementsCount: 1,
  commentText: "Walk the dog",
  timestamp: 5,
  screenshotElement: "screenshots/a/element",
  revealed: true,
};

describe("toPreviewLabelFields", () => {
  it("projects the fields a preview label shows", () => {
    expect(toPreviewLabelFields(item)).toEqual({
      tagName: "li",
      componentName: "TodoItem",
      elementsCount: 1,
      isPromptMode: true,
      inputValue: "Walk the dog",
      groupId: undefined,
      commentText: "Walk the dog",
      timestamp: 5,
      hasElementScreenshot: true,
      hasFullPageScreenshot: false,
    });
  });

  it("is unchanged by fields the label does not show", () => {
    expect(
      isSameLabelFields(
        toPreviewLabelFields(item),
        toPreviewLabelFields({ ...item, revealed: false, pageTitle: "Other" }),
      ),
    ).toBe(true);
  });

  it("changes with any field the label shows", () => {
    for (const change of [
      { commentText: "Feed the cat" },
      { groupId: "g1" },
      { screenshotFullPage: "screenshots/a/full" },
      { componentName: "Other" },
    ]) {
      expect(
        isSameLabelFields(
          toPreviewLabelFields(item),
          toPreviewLabelFields({ ...item, ...change }),
        ),
        JSON.stringify(change),
      ).toBe(false);
    }
  });
});

describe("isSamePreview", () => {
  const element = document.createElement("li");

  it("keeps a preview whose elements and label are the same", () => {
    expect(
      isSamePreview(
        { item, elements: [element] },
        { item: { ...item, revealed: false }, elements: [element] },
      ),
    ).toBe(true);
  });

  it("redraws a preview whose element was replaced", () => {
    expect(
      isSamePreview(
        { item, elements: [element] },
        { item, elements: [document.createElement("li")] },
      ),
    ).toBe(false);
  });
});
