import { describe, it, expect } from "vitest";
import { createRoot, createSignal } from "solid-js";
import type { CommentItem } from "../../types.js";
import { createSelectionGroups } from "./index.js";

const seedItems = (): CommentItem[] =>
  [
    { id: "a", groupId: "g1" },
    { id: "b", groupId: "g1" },
    { id: "c", groupId: "g2" },
  ] as unknown as CommentItem[];

describe("createSelectionGroups.handleDeleteGroup", () => {
  it("demotes selections in the deleted group to groupId: null (does NOT delete them)", () => {
    createRoot((dispose) => {
      const [items, setItems] = createSignal<CommentItem[]>(seedItems());
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });

      api.setGroups([
        { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
        { id: "g2", name: "Beta", createdAt: 0, revealed: false },
      ]);

      api.handleDeleteGroup("g1");

      const next = items();
      expect(next.map((i) => i.id)).toEqual(["a", "b", "c"]); // nothing deleted
      expect(next.find((i) => i.id === "a")!.groupId).toBeNull();
      expect(next.find((i) => i.id === "b")!.groupId).toBeNull();
      expect(next.find((i) => i.id === "c")!.groupId).toBe("g2");

      dispose();
    });
  });

  it("resets activeGroupId to null when the active group is deleted", () => {
    createRoot((dispose) => {
      const [items, setItems] = createSignal<CommentItem[]>(seedItems());
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });

      api.setGroups([
        { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
      ]);
      api.setActiveGroupId("g1");

      api.handleDeleteGroup("g1");

      expect(api.activeGroupId()).toBeNull();
      dispose();
    });
  });
});

describe("createSelectionGroups synthetic-group GC", () => {
  it("deletes a synthetic group when its sole item is moved out", () => {
    createRoot((dispose) => {
      const synth = { id: "synth-1", name: "X", createdAt: 0, revealed: false, synthetic: true };
      const real = { id: "real-1", name: "Real", createdAt: 0, revealed: false };
      const initialItems = [
        { id: "a", groupId: "synth-1" },
      ] as unknown as CommentItem[];
      const [items, setItems] = createSignal<CommentItem[]>(initialItems);
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });
      api.setGroups([synth, real]);

      api.handleMoveItem("a", "real-1");

      expect(api.groups().find((g) => g.id === "synth-1")).toBeUndefined();
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });

  it("does NOT delete a real group when emptied", () => {
    createRoot((dispose) => {
      const real = { id: "real-1", name: "Real", createdAt: 0, revealed: false };
      const [items, setItems] = createSignal<CommentItem[]>(
        [{ id: "a", groupId: "real-1" }] as unknown as CommentItem[],
      );
      const api = createSelectionGroups({
        commentItems: items,
        setCommentItems: setItems,
        persistCommentItems: (next) => next,
      });
      api.setGroups([real]);
      api.handleMoveItem("a", null);
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });
});
