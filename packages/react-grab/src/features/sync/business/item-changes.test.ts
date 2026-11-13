import { describe, expect, it } from "vitest";
import { itemChanges } from "./item-changes.js";

interface Item {
  id: string;
  name: string;
  /** Stands in for a local-only field the server never sees. */
  local?: number;
}

const wire = (item: Item) => ({ id: item.id, name: item.name });

describe("itemChanges", () => {
  it("reports nothing when the list is the same objects", () => {
    const items: Item[] = [{ id: "a", name: "A" }];
    expect(itemChanges(items, items, wire)).toEqual({
      upserts: [],
      deletedIds: [],
    });
  });

  it("reports an added item as an upsert", () => {
    const added = { id: "b", name: "B" };
    const changes = itemChanges(
      [{ id: "a", name: "A" }],
      [{ id: "a", name: "A" }, added],
      wire,
    );
    expect(changes).toEqual({ upserts: [added], deletedIds: [] });
  });

  it("reports an edited item and nothing else", () => {
    const before: Item[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    const edited = { id: "b", name: "B2" };
    const changes = itemChanges(before, [before[0], edited], wire);
    expect(changes).toEqual({ upserts: [edited], deletedIds: [] });
  });

  it("reports a removed item by id", () => {
    const before: Item[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    expect(itemChanges(before, [before[0]], wire)).toEqual({
      upserts: [],
      deletedIds: ["b"],
    });
  });

  it("ignores a change to a field the server does not store", () => {
    const changes = itemChanges(
      [{ id: "a", name: "A", local: 1 }],
      [{ id: "a", name: "A", local: 2 }],
      wire,
    );
    expect(changes).toEqual({ upserts: [], deletedIds: [] });
  });

  it("treats an equal copy as unchanged even when it is a new object", () => {
    expect(
      itemChanges([{ id: "a", name: "A" }], [{ id: "a", name: "A" }], wire),
    ).toEqual({
      upserts: [],
      deletedIds: [],
    });
  });

  it("handles a list emptied at once, as Clear all does", () => {
    const before: Item[] = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    expect(itemChanges(before, [], wire)).toEqual({
      upserts: [],
      deletedIds: ["a", "b"],
    });
  });
});
