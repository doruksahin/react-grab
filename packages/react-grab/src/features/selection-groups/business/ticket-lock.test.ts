import { describe, it, expect } from "vitest";
import {
  isTicketed,
  isSelectionLocked,
  assignableGroupsFor,
  canRemoveSelection,
} from "./ticket-lock.js";
import type { SelectionGroup } from "../types.js";

const mkGroup = (over: Partial<SelectionGroup>): SelectionGroup =>
  ({
    id: "g",
    name: "G",
    createdAt: 0,
    revealed: false,
    ...over,
  }) as SelectionGroup;

describe("isTicketed", () => {
  it("true when jiraTicketId is set", () => {
    expect(isTicketed(mkGroup({ id: "g1", jiraTicketId: "ABC-1" }))).toBe(true);
  });
  it("false when jiraTicketId is absent", () => {
    expect(isTicketed(mkGroup({ id: "g1" }))).toBe(false);
  });
});

describe("isSelectionLocked", () => {
  const ticketed = mkGroup({ id: "t1", jiraTicketId: "ABC-1" });
  const plain = mkGroup({ id: "p1" });
  const synthTicketed = mkGroup({
    id: "s1",
    synthetic: true,
    jiraTicketId: "ABC-2",
  });
  const groups = [ticketed, plain, synthTicketed];

  it("ungrouped selections are never locked", () => {
    expect(isSelectionLocked({ groupId: null }, groups)).toBe(false);
  });
  it("selections in a plain group are not locked", () => {
    expect(isSelectionLocked({ groupId: "p1" }, groups)).toBe(false);
  });
  it("selections in a ticketed real group are locked", () => {
    expect(isSelectionLocked({ groupId: "t1" }, groups)).toBe(true);
  });
  it("selections in a ticketed synthetic group are locked", () => {
    expect(isSelectionLocked({ groupId: "s1" }, groups)).toBe(true);
  });
  it("orphaned groupId (missing group) is not locked", () => {
    expect(isSelectionLocked({ groupId: "missing" }, groups)).toBe(false);
  });
});

describe("assignableGroupsFor", () => {
  const ticketed = mkGroup({ id: "t1", jiraTicketId: "ABC-1" });
  const plainA = mkGroup({ id: "a" });
  const plainB = mkGroup({ id: "b" });
  const synth = mkGroup({ id: "s1", synthetic: true });
  const synthTicketed = mkGroup({
    id: "s2",
    synthetic: true,
    jiraTicketId: "ABC-2",
  });
  const groups = [ticketed, plainA, plainB, synth, synthTicketed];

  it("returns plain non-ticketed groups for an ungrouped selection", () => {
    const result = assignableGroupsFor({ groupId: null }, groups);
    expect(result.map((g) => g.id)).toEqual(["a", "b"]);
  });
  it("returns plain non-ticketed groups for a selection in a plain group", () => {
    const result = assignableGroupsFor({ groupId: "a" }, groups);
    expect(result.map((g) => g.id)).toEqual(["a", "b"]);
  });
  it("returns empty for a selection in a ticketed group (locked)", () => {
    expect(assignableGroupsFor({ groupId: "t1" }, groups)).toEqual([]);
  });
  it("returns empty for a selection in a synthetic ticketed group (locked)", () => {
    expect(assignableGroupsFor({ groupId: "s2" }, groups)).toEqual([]);
  });
  it("excludes synthetic groups from targets even when not ticketed", () => {
    const result = assignableGroupsFor({ groupId: null }, groups);
    expect(result.find((g) => g.id === "s1")).toBeUndefined();
  });
});

describe("canRemoveSelection", () => {
  const ticketed = mkGroup({ id: "t1", jiraTicketId: "ABC-1" });
  const plain = mkGroup({ id: "p1" });
  const synthTicketed = mkGroup({
    id: "s1",
    synthetic: true,
    jiraTicketId: "ABC-2",
  });
  const synthPlain = mkGroup({ id: "s2", synthetic: true });
  const groups = [ticketed, plain, synthTicketed, synthPlain];

  it("ungrouped selections can always be removed", () => {
    expect(canRemoveSelection({ groupId: null }, groups)).toBe(true);
  });
  it("selections in a plain group can be removed", () => {
    expect(canRemoveSelection({ groupId: "p1" }, groups)).toBe(true);
  });
  it("selections in a plain synthetic group can be removed", () => {
    expect(canRemoveSelection({ groupId: "s2" }, groups)).toBe(true);
  });
  it("selections in a ticketed real group cannot be removed", () => {
    expect(canRemoveSelection({ groupId: "t1" }, groups)).toBe(false);
  });
  it("selections in a ticketed synthetic group cannot be removed", () => {
    expect(canRemoveSelection({ groupId: "s1" }, groups)).toBe(false);
  });
  it("orphaned groupId can be removed (nothing to protect)", () => {
    expect(canRemoveSelection({ groupId: "missing" }, groups)).toBe(true);
  });
});
