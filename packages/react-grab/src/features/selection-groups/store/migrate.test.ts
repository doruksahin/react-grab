import { describe, it, expect } from "vitest";
import { migrateLegacyDefaultGroup } from "./group-storage.js";

describe("migrateLegacyDefaultGroup", () => {
  it("maps legacy 'default' / undefined / missing groupId to null", () => {
    const items = [
      { id: "a", groupId: "default" },
      { id: "b", groupId: "g1" },
      { id: "c", groupId: null },
      { id: "d", groupId: undefined },
      { id: "e" }, // field entirely missing
    ] as unknown as { groupId: string | null }[];
    const out = migrateLegacyDefaultGroup(items);
    expect(out[0]!.groupId).toBeNull();
    expect(out[1]!.groupId).toBe("g1");
    expect(out[2]!.groupId).toBeNull();
    expect(out[3]!.groupId).toBeNull();
    expect(out[4]!.groupId).toBeNull();
  });

  it("is idempotent", () => {
    const once = migrateLegacyDefaultGroup([
      { id: "a", groupId: "default" },
    ] as unknown as { groupId: string | null }[]);
    const twice = migrateLegacyDefaultGroup(once);
    expect(twice).toEqual(once);
  });
});
