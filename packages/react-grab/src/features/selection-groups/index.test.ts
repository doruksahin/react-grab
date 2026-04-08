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

describe("createSelectionGroups.handleRemoveItem", () => {
  const makeApi = (
    initialItems: CommentItem[],
    initialGroups: Parameters<
      ReturnType<typeof createSelectionGroups>["setGroups"]
    >[0],
  ) => {
    const [items, setItems] = createSignal<CommentItem[]>(initialItems);
    const api = createSelectionGroups({
      commentItems: items,
      setCommentItems: setItems,
      persistCommentItems: (next) => next,
    });
    api.setGroups(initialGroups as never);
    return { api, items };
  };

  it("removes an ungrouped selection", () => {
    createRoot((dispose) => {
      const { api, items } = makeApi(
        [{ id: "a", groupId: null }] as unknown as CommentItem[],
        [],
      );
      expect(api.handleRemoveItem("a")).toBe(true);
      expect(items()).toEqual([]);
      dispose();
    });
  });

  it("removes a selection in a plain group and keeps the empty group", () => {
    createRoot((dispose) => {
      const real = { id: "r1", name: "Real", createdAt: 0, revealed: false };
      const { api, items } = makeApi(
        [{ id: "a", groupId: "r1" }] as unknown as CommentItem[],
        [real],
      );
      expect(api.handleRemoveItem("a")).toBe(true);
      expect(items()).toEqual([]);
      expect(api.groups().find((g) => g.id === "r1")).toBeDefined();
      dispose();
    });
  });

  it("removes a synthetic group when its sole item is removed", () => {
    createRoot((dispose) => {
      const synth = {
        id: "s1",
        name: "S",
        createdAt: 0,
        revealed: false,
        synthetic: true,
      };
      const { api } = makeApi(
        [{ id: "a", groupId: "s1" }] as unknown as CommentItem[],
        [synth],
      );
      expect(api.handleRemoveItem("a")).toBe(true);
      expect(api.groups().find((g) => g.id === "s1")).toBeUndefined();
      dispose();
    });
  });

  it("keeps a synthetic group when at least one item still lives in it", () => {
    createRoot((dispose) => {
      const synth = {
        id: "s1",
        name: "S",
        createdAt: 0,
        revealed: false,
        synthetic: true,
      };
      const { api } = makeApi(
        [
          { id: "a", groupId: "s1" },
          { id: "b", groupId: "s1" },
        ] as unknown as CommentItem[],
        [synth],
      );
      expect(api.handleRemoveItem("a")).toBe(true);
      expect(api.groups().find((g) => g.id === "s1")).toBeDefined();
      dispose();
    });
  });

  it("refuses to remove a selection in a ticketed real group", () => {
    createRoot((dispose) => {
      const ticketed = {
        id: "r1",
        name: "Ticketed",
        createdAt: 0,
        revealed: false,
        jiraTicketId: "ABC-1",
      };
      const { api, items } = makeApi(
        [{ id: "a", groupId: "r1" }] as unknown as CommentItem[],
        [ticketed],
      );
      expect(api.handleRemoveItem("a")).toBe(false);
      expect(items().length).toBe(1);
      expect(api.groups().length).toBe(1);
      dispose();
    });
  });

  it("refuses to remove a selection in a ticketed synthetic group", () => {
    createRoot((dispose) => {
      const ticketedSynth = {
        id: "s1",
        name: "Ticketed Synth",
        createdAt: 0,
        revealed: false,
        synthetic: true,
        jiraTicketId: "ABC-2",
      };
      const { api, items } = makeApi(
        [{ id: "a", groupId: "s1" }] as unknown as CommentItem[],
        [ticketedSynth],
      );
      expect(api.handleRemoveItem("a")).toBe(false);
      expect(items().length).toBe(1);
      expect(api.groups().find((g) => g.id === "s1")).toBeDefined();
      dispose();
    });
  });

  it("resets activeGroupId when it points at a GCed synthetic group", () => {
    createRoot((dispose) => {
      const synth = {
        id: "s1",
        name: "S",
        createdAt: 0,
        revealed: false,
        synthetic: true,
      };
      const { api } = makeApi(
        [{ id: "a", groupId: "s1" }] as unknown as CommentItem[],
        [synth],
      );
      api.setActiveGroupId("s1");
      api.handleRemoveItem("a");
      expect(api.activeGroupId()).toBeNull();
      dispose();
    });
  });

  it("returns false for an unknown item id", () => {
    createRoot((dispose) => {
      const { api } = makeApi([], []);
      expect(api.handleRemoveItem("ghost")).toBe(false);
      dispose();
    });
  });
});
