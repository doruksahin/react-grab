import { describe, it, expect } from "vitest";
import type { CommentItem } from "../../../types.js";
import {
  assignSelection,
  unassignSelectionsInGroup,
} from "./selection-assignment.js";

const items = [
  { id: "a", groupId: null },
  { id: "b", groupId: "g1" },
  { id: "c", groupId: "g1" },
] as unknown as CommentItem[];

describe("selection-assignment", () => {
  it("assigns a selection to a group", () => {
    const next = assignSelection(items, "a", "g1");
    expect(next.find((i) => i.id === "a")!.groupId).toBe("g1");
  });
  it("unassigns a selection when groupId is null", () => {
    const next = assignSelection(items, "b", null);
    expect(next.find((i) => i.id === "b")!.groupId).toBeNull();
  });
  it("demotes all selections in a group to null", () => {
    const next = unassignSelectionsInGroup(items, "g1");
    expect(
      next.filter((i) => i.groupId === null).map((i) => i.id),
    ).toEqual(["a", "b", "c"]);
  });
});
