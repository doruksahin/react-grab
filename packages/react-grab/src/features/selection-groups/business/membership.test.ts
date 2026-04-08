import { describe, it, expect } from "vitest";
import { isUngrouped, belongsTo, isPresentedAsLoose } from "./membership.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";

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

describe("isPresentedAsLoose", () => {
  const realGroup = { id: "g1", name: "Real", createdAt: 0, revealed: false } as SelectionGroup;
  const synthGroup = { id: "g2", name: "Synth", createdAt: 0, revealed: false, synthetic: true } as SelectionGroup;
  const groups = [realGroup, synthGroup];

  it("is true when groupId is null (genuinely loose)", () => {
    const item = { id: "a", groupId: null } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(true);
  });

  it("is false when item is in a real group", () => {
    const item = { id: "a", groupId: "g1" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(false);
  });

  it("is true when item is the only one in a synthetic group", () => {
    const item = { id: "a", groupId: "g2" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(true);
  });

  it("is false when a synthetic group has 2+ items (defensive — picker prevents this in practice)", () => {
    const a = { id: "a", groupId: "g2" } as unknown as CommentItem;
    const b = { id: "b", groupId: "g2" } as unknown as CommentItem;
    expect(isPresentedAsLoose(a, groups, [a, b])).toBe(false);
    expect(isPresentedAsLoose(b, groups, [a, b])).toBe(false);
  });

  it("is false when the item points at a missing group (orphaned)", () => {
    const item = { id: "a", groupId: "missing" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(false);
  });
});
