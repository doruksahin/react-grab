import { describe, expect, it } from "vitest";
import type { SelectionGroup } from "../types.js";
import { moveDestinations } from "./move-destinations.js";

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

const groups = [
  group("open-a"),
  group("open-b"),
  group("ticketed", { jiraTicketId: "SCRUM-1" }),
];

describe("moveDestinations", () => {
  it("offers Ungrouped and the other open groups", () => {
    expect(moveDestinations({ groupId: "open-a" }, groups)).toEqual([
      { id: null, name: "Ungrouped" },
      { id: "open-b", name: "open-b" },
    ]);
  });

  it("leaves Ungrouped out for a selection already there", () => {
    expect(
      moveDestinations({ groupId: null }, groups).map((entry) => entry.id),
    ).toEqual(["open-a", "open-b"]);
  });

  it("offers nothing to a locked selection", () => {
    expect(moveDestinations({ groupId: "ticketed" }, groups)).toEqual([]);
  });
});
