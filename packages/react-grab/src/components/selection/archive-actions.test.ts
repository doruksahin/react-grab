import { describe, expect, it, vi } from "vitest";
import type { SelectionGroup } from "../../features/selection-groups/types.js";
import { archivedDeletionFor } from "../../features/selection-groups/business/archive-policy.js";
import {
  archiveMenuAction,
  deleteArchivedGroupMenuAction,
  restoreMenuAction,
} from "./archive-actions.js";

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
  group("loose", { synthetic: true }),
  group("archived-open", { archivedAt: 1 }),
  group("archived-loose", { synthetic: true, archivedAt: 1 }),
];
const items = [
  { groupId: "open" },
  { groupId: "open" },
  { groupId: "loose" },
  { groupId: "archived-open" },
  { groupId: "archived-loose" },
];

const handlers = () => ({
  archiveGroup: vi.fn(),
  restoreGroup: vi.fn(),
  deleteArchivedGroup: vi.fn(),
});

describe("archive menu actions", () => {
  it("names a real group and archives it as a whole", () => {
    const archive = handlers();
    const action = archiveMenuAction(items[0], groups, items, archive);
    expect(action?.label).toBe("Archive group (2 comments)");
    action?.onSelect();
    expect(archive.archiveGroup).toHaveBeenCalledWith("open");
  });

  it("says just Archive for a loose selection", () => {
    expect(archiveMenuAction(items[2], groups, items, handlers())?.label).toBe(
      "Archive",
    );
  });

  it("offers Restore only in the archive", () => {
    expect(restoreMenuAction(items[3], groups, items, handlers())?.label).toBe(
      "Restore group (1 comment)",
    );
    expect(restoreMenuAction(items[4], groups, items, handlers())?.label).toBe(
      "Restore",
    );
    expect(
      restoreMenuAction(items[0], groups, items, handlers()),
    ).toBeUndefined();
  });

  it("offers Delete group only for an archived real group", () => {
    const archive = handlers();
    const action = deleteArchivedGroupMenuAction(
      archivedDeletionFor(items[3], groups, items),
      archive,
    );
    expect(action?.label).toBe("Delete group (1 comment)");
    action?.onSelect();
    expect(archive.deleteArchivedGroup).toHaveBeenCalledWith("archived-open");
    expect(
      deleteArchivedGroupMenuAction(
        archivedDeletionFor(items[4], groups, items),
        archive,
      ),
    ).toBeUndefined();
  });

  it("offers nothing without handlers", () => {
    expect(
      archiveMenuAction(items[0], groups, items, undefined),
    ).toBeUndefined();
  });
});
