import { describe, it, expect } from "vitest";
import { isUngrouped, belongsTo } from "./membership.js";

describe("membership", () => {
  it("isUngrouped is true when groupId is null", () => {
    expect(isUngrouped({ groupId: null } as any)).toBe(true);
  });
  it("isUngrouped is false when groupId is a string", () => {
    expect(isUngrouped({ groupId: "g1" } as any)).toBe(false);
  });
  it("belongsTo matches exact groupId", () => {
    expect(belongsTo({ groupId: "g1" } as any, "g1")).toBe(true);
    expect(belongsTo({ groupId: "g2" } as any, "g1")).toBe(false);
    expect(belongsTo({ groupId: null } as any, "g1")).toBe(false);
  });
});
