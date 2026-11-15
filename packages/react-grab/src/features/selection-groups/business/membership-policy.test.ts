import { describe, expect, it } from "vitest";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";
import {
  assignableGroupsFor,
  canDeleteGroup,
  deleteGroup,
  groupForNewSelection,
  moveSelection,
  moveSelections,
} from "./membership-policy.js";
import { isSynthetic } from "./synthetic-group.js";

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
  content: "<button>Buy</button>",
  elementName: "button",
  tagName: "button",
  timestamp: 0,
});

// The live case: two loose selections that each earned a ticket (synthetic
// ticketed groups), a ticketed real group, and two open real groups.
const groups: SelectionGroup[] = [
  group("open-a"),
  group("open-b"),
  group("ticketed", { jiraTicketId: "SCRUM-1" }),
  group("synthetic-8", { synthetic: true, jiraTicketId: "SCRUM-8" }),
  group("synthetic-9", { synthetic: true, jiraTicketId: "SCRUM-9" }),
  group("synthetic-open", { synthetic: true }),
];

const items: CommentItem[] = [
  item("in-open-a", "open-a"),
  item("in-ticketed", "ticketed"),
  item("in-synthetic-8", "synthetic-8"),
  item("in-synthetic-9", "synthetic-9"),
  item("in-synthetic-open", "synthetic-open"),
  item("ungrouped", null),
];

const groupOf = (list: CommentItem[], id: string) =>
  list.find((entry) => entry.id === id)?.groupId;

describe("assignableGroupsFor", () => {
  it("offers only open real groups", () => {
    expect(
      assignableGroupsFor(item("x", "open-a"), groups).map((g) => g.id),
    ).toEqual(["open-a", "open-b"]);
  });

  it("offers nothing to a locked selection, synthetic or real", () => {
    expect(assignableGroupsFor(item("x", "synthetic-8"), groups)).toEqual([]);
    expect(assignableGroupsFor(item("x", "ticketed"), groups)).toEqual([]);
  });
});

describe("moveSelection", () => {
  it("moves an open selection into an open real group", () => {
    const result = moveSelection(items, groups, "in-synthetic-open", "open-b");
    expect(result.status).toBe("moved");
    if (result.status !== "moved") return;
    expect(groupOf(result.items, "in-synthetic-open")).toBe("open-b");
    expect(groupOf(result.items, "in-open-a")).toBe("open-a");
  });

  it("refuses to move a selection out of a ticketed synthetic group (the live bug)", () => {
    expect(
      moveSelection(items, groups, "in-synthetic-8", "synthetic-9"),
    ).toEqual({ status: "refused", reason: "selection-locked" });
    expect(moveSelection(items, groups, "in-synthetic-8", "open-a")).toEqual({
      status: "refused",
      reason: "selection-locked",
    });
  });

  it("refuses to move a selection out of a ticketed real group", () => {
    expect(moveSelection(items, groups, "in-ticketed", null)).toEqual({
      status: "refused",
      reason: "selection-locked",
    });
  });

  it("refuses a ticketed target", () => {
    expect(moveSelection(items, groups, "in-open-a", "ticketed")).toEqual({
      status: "refused",
      reason: "target-ticketed",
    });
  });

  it("refuses a synthetic target, ticketed or not", () => {
    expect(moveSelection(items, groups, "in-open-a", "synthetic-open")).toEqual(
      { status: "refused", reason: "target-synthetic" },
    );
    expect(moveSelection(items, groups, "in-open-a", "synthetic-9")).toEqual({
      status: "refused",
      reason: "target-ticketed",
    });
  });

  it("refuses a target that does not exist", () => {
    expect(moveSelection(items, groups, "in-open-a", "gone")).toEqual({
      status: "refused",
      reason: "target-not-found",
    });
  });

  it("refuses a selection that does not exist", () => {
    expect(moveSelection(items, groups, "gone", "open-a")).toEqual({
      status: "refused",
      reason: "selection-not-found",
    });
  });

  it("lets an open selection leave its group", () => {
    const result = moveSelection(items, groups, "in-open-a", null);
    expect(result.status).toBe("moved");
    if (result.status === "moved")
      expect(groupOf(result.items, "in-open-a")).toBeNull();
  });

  it("refuses exactly the targets the query leaves out", () => {
    for (const source of items) {
      const offered = new Set(
        assignableGroupsFor(source, groups).map((g) => g.id),
      );
      for (const target of groups) {
        const moved =
          moveSelection(items, groups, source.id, target.id).status === "moved";
        expect(moved, `${source.id} → ${target.id}`).toBe(
          offered.has(target.id),
        );
      }
    }
  });
});

describe("moveSelections", () => {
  it("moves the open selections and reports each locked one", () => {
    const result = moveSelections(
      items,
      groups,
      new Set(["in-open-a", "in-synthetic-8", "ungrouped", "gone"]),
      "open-b",
    );
    expect(result.status).toBe("moved");
    if (result.status !== "moved") return;
    expect(result.movedIds).toEqual(["in-open-a", "ungrouped"]);
    expect(result.refused).toEqual([
      { itemId: "in-synthetic-8", reason: "selection-locked" },
      { itemId: "gone", reason: "selection-not-found" },
    ]);
    expect(groupOf(result.items, "in-open-a")).toBe("open-b");
    expect(groupOf(result.items, "in-synthetic-8")).toBe("synthetic-8");
  });

  it("moves nothing when the target itself is refused", () => {
    expect(
      moveSelections(items, groups, new Set(["in-open-a"]), "synthetic-open"),
    ).toEqual({ status: "refused", reason: "target-synthetic" });
  });

  it("refuses when every selection is locked", () => {
    expect(
      moveSelections(items, groups, new Set(["in-synthetic-8"]), "open-a"),
    ).toEqual({ status: "refused", reason: "selection-locked" });
  });
});

describe("deleteGroup", () => {
  it("deletes an open group and leaves its selections ungrouped", () => {
    const result = deleteGroup(items, groups, "open-a");
    expect(result.status).toBe("deleted");
    if (result.status !== "deleted") return;
    expect(result.groups.some((g) => g.id === "open-a")).toBe(false);
    expect(groupOf(result.items, "in-open-a")).toBeNull();
  });

  it("refuses to delete a ticketed group: its selections are locked to it", () => {
    expect(deleteGroup(items, groups, "ticketed")).toEqual({
      status: "refused",
      reason: "group-ticketed",
    });
  });

  it("offers deletion exactly when the command accepts it", () => {
    for (const candidate of groups) {
      expect(canDeleteGroup(candidate), candidate.id).toBe(
        deleteGroup(items, groups, candidate.id).status === "deleted",
      );
    }
  });

  it("refuses a group that does not exist", () => {
    expect(deleteGroup(items, groups, "gone")).toEqual({
      status: "refused",
      reason: "group-not-found",
    });
  });
});

describe("groupForNewSelection", () => {
  const seed = { elementName: "button", componentName: "BuyButton" };

  it("uses the chosen group when it can take selections", () => {
    expect(groupForNewSelection(seed, "open-a", groups)).toEqual({
      groups,
      groupId: "open-a",
    });
  });

  it("creates a synthetic group when none is chosen", () => {
    const result = groupForNewSelection(seed, null, groups);
    const created = result.groups.find((g) => g.id === result.groupId);
    expect(created && isSynthetic(created)).toBe(true);
    expect(result.groups).toHaveLength(groups.length + 1);
  });

  it("never adds a new selection to a ticketed or synthetic group", () => {
    for (const chosen of [
      "ticketed",
      "synthetic-8",
      "synthetic-open",
      "gone",
    ]) {
      const result = groupForNewSelection(seed, chosen, groups);
      expect(result.groupId, chosen).not.toBe(chosen);
      const created = result.groups.find((g) => g.id === result.groupId);
      expect(created && isSynthetic(created), chosen).toBe(true);
    }
  });
});

describe("synthetic single-member invariant", () => {
  it("holds after any move the policy accepts", () => {
    let state = { items, groups };
    for (const source of items) {
      for (const target of [...groups.map((g) => g.id), null]) {
        const result = moveSelection(
          state.items,
          state.groups,
          source.id,
          target,
        );
        if (result.status === "moved")
          state = { ...state, items: result.items };
      }
    }
    for (const synthetic of state.groups.filter(isSynthetic)) {
      const members = state.items.filter((i) => i.groupId === synthetic.id);
      expect(members.length, synthetic.id).toBeLessThanOrEqual(1);
    }
  });
});
