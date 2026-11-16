import { describe, expect, it } from "vitest";
import { needsAttention } from "./needs-attention.js";
import { orderSelections } from "./order-selections.js";
import { sectionsByStatus } from "./sections-by-status.js";
import { selectionStatus } from "./selection-status.js";

describe("selectionStatus", () => {
  const groups = new Map([
    ["real", { jiraTicketId: "SCRUM-1", jiraStatus: "In Progress" }],
    ["synthetic", { jiraTicketId: "SCRUM-8", jiraStatus: undefined }],
    ["open", { jiraTicketId: undefined, jiraStatus: undefined }],
  ]);

  it("takes the status of the group's ticket", () => {
    expect(selectionStatus({ groupId: "real" }, groups)).toBe("In Progress");
  });

  it("treats a ticket without a status yet as To Do", () => {
    expect(selectionStatus({ groupId: "synthetic" }, groups)).toBe("To Do");
  });

  it("is No Task without a ticket or a group", () => {
    expect(selectionStatus({ groupId: "open" }, groups)).toBe("No Task");
    expect(selectionStatus({ groupId: null }, groups)).toBe("No Task");
  });
});

describe("needsAttention", () => {
  it("does not count a selection whose page is unknown", () => {
    expect(needsAttention({ flagged: false, location: "unknown" })).toBe(
      false,
    );
  });

  it("asks for attention when flagged or not on this page", () => {
    expect(needsAttention({ flagged: true, location: "on-page" })).toBe(true);
    expect(needsAttention({ flagged: false, location: "gone" })).toBe(true);
    expect(needsAttention({ flagged: false, location: "on-page" })).toBe(false);
  });
});

describe("orderSelections", () => {
  const items = [
    { id: "old", timestamp: 1, attention: false },
    { id: "new", timestamp: 3, attention: false },
    { id: "hidden", timestamp: 2, attention: true },
  ];
  const ids = (list: typeof items) => list.map((item) => item.id);

  it("puts the newest first", () => {
    expect(
      ids(orderSelections(items, "newest", (item) => item.attention)),
    ).toEqual(["new", "hidden", "old"]);
  });

  it("puts the ones that need attention first, then the newest", () => {
    expect(
      ids(orderSelections(items, "attention", (item) => item.attention)),
    ).toEqual(["hidden", "new", "old"]);
  });
});

describe("sectionsByStatus", () => {
  it("groups by status in workflow order", () => {
    const sections = sectionsByStatus(
      ["a:In Progress", "b:No Task", "c:In Progress"],
      (item) => item.split(":")[1],
    );
    expect(sections.map((section) => [section.status, section.items])).toEqual([
      ["No Task", ["b:No Task"]],
      ["In Progress", ["a:In Progress", "c:In Progress"]],
    ]);
  });
});
