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
