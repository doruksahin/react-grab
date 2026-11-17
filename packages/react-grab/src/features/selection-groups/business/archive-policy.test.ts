import { describe, expect, it } from "vitest";
import type { SelectionGroup } from "../types.js";
import {
  activeSelections,
  archiveScopeFor,
  archivedDeletionFor,
  canArchive,
  isArchived,
  isSelectionArchived,
  restoreScopeFor,
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
  group("loose", { synthetic: true }),
  group("archived-ticketed", { jiraTicketId: "SCRUM-2", archivedAt: 10 }),
  group("archived-open", { archivedAt: 10 }),
  group("archived-loose", { synthetic: true, archivedAt: 10 }),
  group("archived-loose-ticketed", {
    synthetic: true,
    jiraTicketId: "SCRUM-3",
    archivedAt: 10,
  }),
];
const byId = (id: string) => groups.find((candidate) => candidate.id === id)!;

const items = [
  { groupId: "open" },
  { groupId: "open" },
  { groupId: "ticketed" },
  { groupId: "loose" },
  { groupId: "archived-ticketed" },
  { groupId: "archived-open" },
  { groupId: "archived-open" },
  { groupId: "archived-loose" },
  { groupId: "archived-loose-ticketed" },
];

describe("archive policy", () => {
  it("knows an archived group by its archive time", () => {
    expect(isArchived(byId("archived-open"))).toBe(true);
    expect(isArchived(byId("open"))).toBe(false);
    expect(isArchived(undefined)).toBe(false);
  });

  it("archives any group on the board, ticket or not", () => {
    expect(canArchive(byId("open"))).toBe(true);
    expect(canArchive(byId("ticketed"))).toBe(true);
    expect(canArchive(byId("loose"))).toBe(true);
    expect(canArchive(byId("archived-open"))).toBe(false);
  });

  it("leaves selections in archived groups off the board", () => {
    expect(isSelectionArchived({ groupId: "archived-loose" }, groups)).toBe(
      true,
    );
    expect(isSelectionArchived({ groupId: null }, groups)).toBe(false);
    expect(activeSelections(items, groups)).toEqual(items.slice(0, 4));
  });
});

describe("archiveScopeFor", () => {
  it("archives a selection's whole group, with how many selections go", () => {
    expect(archiveScopeFor(items[0], groups, items)).toEqual({
      group: byId("open"),
      selectionCount: 2,
    });
  });

  it("archives a loose selection through its own synthetic group", () => {
    expect(archiveScopeFor(items[3], groups, items)).toEqual({
      group: byId("loose"),
      selectionCount: 1,
    });
  });

  it("has nothing to archive when already archived or without a group", () => {
    expect(archiveScopeFor(items[5], groups, items)).toBeUndefined();
    expect(archiveScopeFor({ groupId: null }, groups, items)).toBeUndefined();
  });
});

describe("restoreScopeFor", () => {
  it("restores an archived selection's group", () => {
    expect(restoreScopeFor(items[5], groups, items)).toEqual({
      group: byId("archived-open"),
      selectionCount: 2,
    });
    expect(restoreScopeFor(items[0], groups, items)).toBeUndefined();
  });
});

describe("archivedDeletionFor", () => {
  it("deletes an archived real group without a ticket as a whole", () => {
    expect(archivedDeletionFor(items[5], groups, items)).toEqual({
      kind: "group",
      group: byId("archived-open"),
      selectionCount: 2,
    });
  });

  it("removes an archived loose selection without a ticket on its own", () => {
    expect(archivedDeletionFor(items[7], groups, items)).toEqual({
      kind: "selection",
    });
  });

  it("never deletes what has a ticket, nor what is on the board", () => {
    expect(archivedDeletionFor(items[4], groups, items)).toBeUndefined();
    expect(archivedDeletionFor(items[8], groups, items)).toBeUndefined();
    expect(archivedDeletionFor(items[0], groups, items)).toBeUndefined();
  });
});
