import { describe, it, expect } from "vitest";
import type { CommentItem } from "../../../types.js";
import {
  assignSelection,
  bulkAssignSelections,
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
  it("assigns several selections to a group", () => {
    const next = bulkAssignSelections(items, new Set(["a", "b"]), "g2");
    expect(next.map((i) => i.groupId)).toEqual(["g2", "g2", "g1"]);
  });
});
