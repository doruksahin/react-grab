import { describe, it, expect } from "vitest";
import { defaultSummary, normalizeSummary } from "./default-summary.js";
import type { SelectionGroup } from "../../selection-groups/types.js";
import type { CommentItem } from "../../../types.js";

const group: SelectionGroup = {
  id: "group-1",
  name: "Billing",
  createdAt: 0,
  revealed: false,
};

const makeItem = (overrides: Partial<CommentItem> = {}): CommentItem => ({
  id: "comment-1",
  groupId: "group-1",
  content: "<span>$12</span>",
  elementName: "PriceLabel",
  tagName: "span",
  commentText: "Price label overlaps the badge",
  timestamp: 0,
  ...overrides,
});

describe("defaultSummary (ADR-0022 step 3, S5.1)", () => {
  const loose: SelectionGroup = {
    ...group,
    name: "PriceLabel",
    synthetic: true,
  };

  it("keeps the name of a group the user named", () => {
    expect(defaultSummary(group, [makeItem()])).toBe("Billing");
  });

  it("starts a loose selection's summary from its comment", () => {
    expect(defaultSummary(loose, [makeItem()])).toBe(
      "Price label overlaps the badge",
    );
  });

  it("uses the first non-empty line, with spaces collapsed", () => {
    expect(
      defaultSummary(loose, [
        makeItem({
          commentText: "\n  Checkout   button does nothing\nOn Safari",
        }),
      ]),
    ).toBe("Checkout button does nothing");
  });

  it("cuts a long comment at a word boundary", () => {
    const summary = defaultSummary(loose, [
      makeItem({ commentText: "word ".repeat(40) }),
    ]);
    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary.endsWith("word…")).toBe(true);
  });

  it("falls back to the group name without comment text", () => {
    expect(defaultSummary(loose, [makeItem({ commentText: "  " })])).toBe(
      "PriceLabel",
    );
  });
});

describe("normalizeSummary", () => {
  it("joins lines and collapses spaces", () => {
    expect(normalizeSummary("  Checkout\n  button   fails ")).toBe(
      "Checkout button fails",
    );
  });
});
