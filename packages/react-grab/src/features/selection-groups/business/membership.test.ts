import { describe, it, expect } from "vitest";
import {
  belongsTo,
  isPresentedAsLoose,
  membershipAnomalies,
  presentedGroups,
  ticketScopeFor,
} from "./membership.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";

describe("membership", () => {
  it("belongsTo matches exact groupId", () => {
    expect(belongsTo({ groupId: "g1" }, "g1")).toBe(true);
    expect(belongsTo({ groupId: "g2" }, "g1")).toBe(false);
    expect(belongsTo({ groupId: null }, "g1")).toBe(false);
  });
});

describe("isPresentedAsLoose", () => {
  const realGroup = {
    id: "g1",
    name: "Real",
    createdAt: 0,
    revealed: false,
  } as SelectionGroup;
  const synthGroup = {
    id: "g2",
    name: "Synth",
    createdAt: 0,
    revealed: false,
    synthetic: true,
  } as SelectionGroup;
  const groups = [realGroup, synthGroup];

  it("is true when groupId is null (legacy data)", () => {
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

  it("is true when the item points at a missing group, so it stays visible", () => {
    const item = { id: "a", groupId: "missing" } as unknown as CommentItem;
    expect(isPresentedAsLoose(item, groups, [item])).toBe(true);
  });
});

describe("presentedGroups", () => {
  const real = { id: "real", name: "Checkout", createdAt: 0 } as SelectionGroup;
  const single = {
    id: "single",
    name: "Price",
    createdAt: 0,
    synthetic: true,
  } as SelectionGroup;
  const crowded = {
    id: "crowded",
    name: "Button",
    createdAt: 0,
    synthetic: true,
    jiraTicketId: "SCRUM-9",
  } as SelectionGroup;
  const crowdedUnticketed = {
    id: "crowded-open",
    name: "Header",
    createdAt: 0,
    synthetic: true,
  } as SelectionGroup;
  const items = [
    { id: "a", groupId: "single" },
    { id: "b", groupId: "crowded" },
    { id: "c", groupId: "crowded" },
    { id: "d", groupId: "crowded-open" },
    { id: "e", groupId: "crowded-open" },
  ] as unknown as CommentItem[];

  it("shows real groups and hides a synthetic group with one member", () => {
    expect(presentedGroups([real, single], items).map((g) => g.id)).toEqual([
      "real",
    ]);
  });

  it("shows a synthetic group with more than one member, named after its ticket", () => {
    const shown = presentedGroups([real, crowded, crowdedUnticketed], items);
    expect(shown.map((g) => [g.id, g.name])).toEqual([
      ["real", "Checkout"],
      ["crowded", "SCRUM-9"],
      ["crowded-open", "Header"],
    ]);
  });

  it("does not present a member of a crowded synthetic group as loose", () => {
    const [, b] = items;
    expect(isPresentedAsLoose(b!, [crowded], items)).toBe(false);
  });
});

describe("membershipAnomalies", () => {
  it("names each synthetic group with several members and each missing group", () => {
    const groups = [
      { id: "crowded", name: "Button", createdAt: 0, synthetic: true },
      { id: "single", name: "Price", createdAt: 0, synthetic: true },
    ] as SelectionGroup[];
    const items = [
      { id: "b", groupId: "crowded" },
      { id: "c", groupId: "crowded" },
      { id: "a", groupId: "single" },
      { id: "o", groupId: "gone" },
      { id: "n", groupId: null },
    ] as unknown as CommentItem[];

    expect(membershipAnomalies(groups, items)).toEqual([
      { kind: "crowded-synthetic-group", groupId: "crowded", members: 2 },
      { kind: "missing-group", itemId: "o", groupId: "gone" },
    ]);
  });

  it("finds nothing in consistent data", () => {
    const groups = [{ id: "g", name: "G", createdAt: 0 }] as SelectionGroup[];
    const items = [{ id: "a", groupId: "g" }] as unknown as CommentItem[];
    expect(membershipAnomalies(groups, items)).toEqual([]);
  });
});

describe("ticketScopeFor", () => {
  const real = { id: "real", name: "Checkout", createdAt: 0 } as SelectionGroup;
  const synthetic = {
    id: "synthetic",
    name: "Price",
    createdAt: 0,
    synthetic: true,
  } as SelectionGroup;
  const items = [
    { id: "a", groupId: "real" },
    { id: "b", groupId: "real" },
    { id: "c", groupId: "synthetic" },
  ] as unknown as CommentItem[];

  it("tickets a synthetic group's own selection", () => {
    expect(ticketScopeFor(items[2]!, [real, synthetic], items)).toEqual({
      group: synthetic,
      items: [items[2]],
    });
  });

  it("tickets every selection of a real group", () => {
    expect(ticketScopeFor(items[0]!, [real, synthetic], items)).toEqual({
      group: real,
      items: [items[0], items[1]],
    });
  });

  it("has no scope for a selection whose group is missing", () => {
    expect(
      ticketScopeFor(
        { id: "o", groupId: "gone" } as CommentItem,
        [real],
        items,
      ),
    ).toBeNull();
  });
});
