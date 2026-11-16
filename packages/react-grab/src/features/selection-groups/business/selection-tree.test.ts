import { describe, expect, it } from "vitest";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import { selectionTree } from "./selection-tree.js";

const group = (
  id: string,
  extra: Partial<SelectionGroup> = {},
): SelectionGroup => ({
  id,
  name: id,
  createdAt: 0,
  revealed: false,
  ...extra,
});

const item = (id: string, groupId: string | null): CommentItem => ({
  id,
  groupId,
  content: "<b>x</b>",
  elementName: "b",
  tagName: "b",
  timestamp: 0,
});

describe("selectionTree", () => {
  const groups = [
    group("checkout"),
    group("empty"),
    group("synthetic-1", { synthetic: true, jiraTicketId: "UI-1" }),
  ];
  const items = [
    item("in-checkout", "checkout"),
    item("loose", null),
    item("ticketed-loose", "synthetic-1"),
  ];

  it("puts loose selections in Ungrouped, including a synthetic group's one", () => {
    expect(selectionTree(items, groups).ungrouped.map((i) => i.id)).toEqual([
      "loose",
      "ticketed-loose",
    ]);
  });

  it("lists every presented group with its selections, empty ones too", () => {
    expect(
      selectionTree(items, groups).groups.map((section) => [
        section.group.id,
        section.items.map((i) => i.id),
      ]),
    ).toEqual([
      ["checkout", ["in-checkout"]],
      ["empty", []],
    ]);
  });
});
