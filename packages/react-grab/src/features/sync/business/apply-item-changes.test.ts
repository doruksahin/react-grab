import { describe, expect, it } from "vitest";
import { applyItemChanges } from "./apply-item-changes.js";

interface Item {
  id: string;
  text: string;
}

describe("applyItemChanges", () => {
  const server: Item[] = [
    { id: "a", text: "server a" },
    { id: "b", text: "server b" },
    { id: "c", text: "server c" },
  ];

  it("adds new items first, replaces changed ones and removes deleted ones", () => {
    const result = applyItemChanges(server, {
      upserts: [
        { id: "new", text: "made offline" },
        { id: "b", text: "edited offline" },
      ],
      deletedIds: ["c"],
    });
    expect(result).toEqual([
      { id: "new", text: "made offline" },
      { id: "a", text: "server a" },
      { id: "b", text: "edited offline" },
    ]);
  });

  it("keeps the server list when there are no changes", () => {
    expect(applyItemChanges(server, { upserts: [], deletedIds: [] })).toEqual(
      server,
    );
  });
});
