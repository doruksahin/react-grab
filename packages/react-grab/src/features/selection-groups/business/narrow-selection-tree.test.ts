import { describe, expect, it } from "vitest";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import type { SelectionTree } from "./selection-tree.js";
import { narrowSelectionTree } from "./narrow-selection-tree.js";

const item = (id: string, groupId: string | null): CommentItem => ({
  id,
  groupId,
  content: "<button>Pay</button>",
  elementName: "button",
  tagName: "button",
  timestamp: 1,
  commentText: id,
});

const group = (id: string): SelectionGroup => ({
  id,
  name: id,
  createdAt: 1,
  revealed: false,
});

const tree: SelectionTree<SelectionGroup> = {
  ungrouped: [item("loose", null)],
  groups: [
    { group: group("a"), items: [item("a1", "a"), item("a2", "a")] },
    { group: group("empty"), items: [] },
  ],
};

describe("narrowSelectionTree", () => {
  it("returns the tree unchanged without a search or filter", () => {
    expect(narrowSelectionTree(tree, {})).toBe(tree);
  });

  it("hides sections without a matching selection under an item filter", () => {
    const narrowed = narrowSelectionTree(tree, {
      itemFilter: (candidate) => candidate.id === "a1",
    });
    expect(narrowed.ungrouped).toEqual([]);
    expect(narrowed.groups.map((section) => section.group.id)).toEqual(["a"]);
    expect(narrowed.groups[0]?.items.map((entry) => entry.id)).toEqual(["a1"]);
  });

  it("keeps a matching empty group under a group filter", () => {
    const narrowed = narrowSelectionTree(tree, {
      allowedGroupIds: new Set(["empty"]),
    });
    expect(narrowed.groups.map((section) => section.group.id)).toEqual([
      "empty",
    ]);
  });

  it("drops selections in no group under a group filter", () => {
    const narrowed = narrowSelectionTree(tree, {
      allowedGroupIds: new Set(["a"]),
    });
    expect(narrowed.ungrouped).toEqual([]);
    expect(narrowed.groups[0]?.items).toHaveLength(2);
  });
});
