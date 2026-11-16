import { describe, expect, it } from "vitest";
import type { SelectionGroup } from "../types.js";
import {
  activeSelections,
  archiveScopeFor,
  archiveTargetFor,
  canArchive,
  isArchived,
  isSelectionArchived,
} from "./archive-policy.js";

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
  group("open"),
  group("ticketed", { jiraTicketId: "SCRUM-1" }),
  group("synthetic", { synthetic: true, jiraTicketId: "SCRUM-8" }),
  group("archived", { jiraTicketId: "SCRUM-2", archivedAt: 10 }),
];

describe("archive policy", () => {
  it("knows an archived group by its archive time", () => {
    expect(isArchived(groups[3])).toBe(true);
    expect(isArchived(groups[1])).toBe(false);
    expect(isArchived(undefined)).toBe(false);
  });

  it("archives only a ticketed group that is on the board", () => {
    expect(canArchive(groups[0])).toBe(false);
    expect(canArchive(groups[1])).toBe(true);
    expect(canArchive(groups[2])).toBe(true);
    expect(canArchive(groups[3])).toBe(false);
  });

  it("archives a selection through the group that holds its ticket", () => {
    expect(archiveTargetFor({ groupId: "synthetic" }, groups)?.id).toBe(
      "synthetic",
    );
    expect(archiveTargetFor({ groupId: "ticketed" }, groups)?.id).toBe(
      "ticketed",
    );
    expect(archiveTargetFor({ groupId: "open" }, groups)).toBeUndefined();
    expect(archiveTargetFor({ groupId: null }, groups)).toBeUndefined();
  });

  it("leaves selections in archived groups off the board", () => {
    const items = [
      { id: "a", groupId: "archived" },
      { id: "b", groupId: "ticketed" },
      { id: "c", groupId: null },
    ];
    expect(isSelectionArchived(items[0], groups)).toBe(true);
    expect(activeSelections(items, groups).map((item) => item.id)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("archiveScopeFor", () => {
  const items = [
    { groupId: "ticketed" },
    { groupId: "ticketed" },
    { groupId: "synthetic" },
    { groupId: "open" },
  ];

  it("archives the whole ticketed group, with how many selections go", () => {
    expect(archiveScopeFor(items[0], groups, items)).toEqual({
      group: groups[1],
      selectionCount: 2,
    });
  });

  it("archives a loose selection's own ticket alone", () => {
    expect(archiveScopeFor(items[2], groups, items)?.selectionCount).toBe(1);
  });

  it("has nothing to archive without a ticket or when already archived", () => {
    expect(archiveScopeFor(items[3], groups, items)).toBeUndefined();
    expect(
      archiveScopeFor({ groupId: "archived" }, groups, items),
    ).toBeUndefined();
  });
});
