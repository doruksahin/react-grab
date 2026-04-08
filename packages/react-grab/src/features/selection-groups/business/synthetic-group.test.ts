import { describe, it, expect } from "vitest";
import {
  createSyntheticGroupForItem,
  isSynthetic,
  inferSyntheticGroupName,
} from "./synthetic-group.js";
import type { CommentItem } from "../../../types.js";
import type { SelectionGroup } from "../types.js";

const item = {
  id: "item-a",
  groupId: null,
  componentName: "CardTitle",
  elementName: "h3",
  tagName: "h3",
} as unknown as CommentItem;

describe("synthetic-group", () => {
  describe("inferSyntheticGroupName", () => {
    it("uses componentName when present", () => {
      expect(inferSyntheticGroupName(item)).toBe("CardTitle");
    });
    it("falls back to elementName when componentName is missing", () => {
      const noComp = { ...item, componentName: undefined } as CommentItem;
      expect(inferSyntheticGroupName(noComp)).toBe("h3");
    });
    it("falls back to 'Untitled' when both are missing", () => {
      const bare = { ...item, componentName: undefined, elementName: "" } as CommentItem;
      expect(inferSyntheticGroupName(bare)).toBe("Untitled");
    });
  });

  describe("createSyntheticGroupForItem", () => {
    it("returns a SelectionGroup with synthetic=true and the inferred name", () => {
      const g = createSyntheticGroupForItem(item);
      expect(g.synthetic).toBe(true);
      expect(g.name).toBe("CardTitle");
      expect(g.id).toBeTruthy();
      expect(g.id).not.toBe("default");
      expect(typeof g.createdAt).toBe("number");
      expect(g.revealed).toBe(false);
    });
    it("returns a fresh id on every call", () => {
      const g1 = createSyntheticGroupForItem(item);
      const g2 = createSyntheticGroupForItem(item);
      expect(g1.id).not.toBe(g2.id);
    });
  });

  describe("isSynthetic", () => {
    it("is true for groups with synthetic === true", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false, synthetic: true } as SelectionGroup;
      expect(isSynthetic(g)).toBe(true);
    });
    it("is false for groups without the flag", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false } as SelectionGroup;
      expect(isSynthetic(g)).toBe(false);
    });
    it("is false for groups with synthetic === false", () => {
      const g = { id: "g1", name: "x", createdAt: 0, revealed: false, synthetic: false } as SelectionGroup;
      expect(isSynthetic(g)).toBe(false);
    });
  });
});
