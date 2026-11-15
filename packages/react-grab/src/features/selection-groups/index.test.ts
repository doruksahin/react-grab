import { describe, it, expect, vi } from "vitest";
import { createRoot, createSignal } from "solid-js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "./types.js";
const { logRecoverableError } = vi.hoisted(() => ({
  logRecoverableError: vi.fn(),
}));
vi.mock("../../utils/log-recoverable-error.js", () => ({
  logRecoverableError,
}));

const { createSelectionGroups } = await import("./index.js");

const seedItems = (): CommentItem[] =>
  [
    { id: "a", groupId: "g1" },
    { id: "b", groupId: "g1" },
    { id: "c", groupId: "g2" },
  ] as unknown as CommentItem[];

const makeDeps = (
  initialItems: CommentItem[],
  initialGroups: SelectionGroup[] = [],
) => {
  const [items, setItems] = createSignal<CommentItem[]>(initialItems);
  const [groups, setGroups] = createSignal<SelectionGroup[]>(initialGroups);
  return {
    commentItems: items,
    persistCommentItems: (next: CommentItem[]) => { setItems(next); return next; },
    groups,
    persistGroups: (next: SelectionGroup[]) => { setGroups(next); return next; },
    rawItems: items,
    rawGroups: groups,
    setItems,
  };
};

describe("createSelectionGroups.handleDeleteGroup", () => {
  it("gives each selection of the deleted group its own synthetic group (does NOT delete them)", () => {
    createRoot((dispose) => {
      const deps = makeDeps(seedItems(), [
        { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
        { id: "g2", name: "Beta", createdAt: 0, revealed: false },
      ]);
      const api = createSelectionGroups(deps);

      api.handleDeleteGroup("g1");

      const next = deps.rawItems();
      expect(next.map((i) => i.id)).toEqual(["a", "b", "c"]); // nothing deleted
      const groupOf = (id: string) =>
        api.groups().find((g) => g.id === next.find((i) => i.id === id)?.groupId);
      expect(groupOf("a")?.synthetic).toBe(true);
      expect(groupOf("b")?.synthetic).toBe(true);
      expect(groupOf("a")?.id).not.toBe(groupOf("b")?.id);
      expect(next.find((i) => i.id === "c")!.groupId).toBe("g2");
      expect(api.groups().some((g) => g.id === "g1")).toBe(false);

      dispose();
    });
  });

  it("resets activeGroupId to null when the active group is deleted", () => {
    createRoot((dispose) => {
      const deps = makeDeps(seedItems(), [
        { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
      ]);
      const api = createSelectionGroups(deps);

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
      const deps = makeDeps(initialItems, [synth, real]);
      const api = createSelectionGroups(deps);

      api.handleMoveItem("a", "real-1");

      expect(api.groups().find((g) => g.id === "synth-1")).toBeUndefined();
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });

  it("does NOT delete a real group when emptied", () => {
    createRoot((dispose) => {
      const real = { id: "real-1", name: "Real", createdAt: 0, revealed: false };
      const deps = makeDeps(
        [{ id: "a", groupId: "real-1" }] as unknown as CommentItem[],
        [real],
      );
      const api = createSelectionGroups(deps);
      api.handleMoveItem("a", null);
      expect(api.groups().find((g) => g.id === "real-1")).toBeDefined();
      dispose();
    });
  });
});

describe("createSelectionGroups.handleRemoveItem", () => {
  const makeApi = (
    initialItems: CommentItem[],
    initialGroups: SelectionGroup[],
  ) => {
    const deps = makeDeps(initialItems, initialGroups);
    const api = createSelectionGroups(deps);
    return { api, items: deps.rawItems };
  };

  it("removes an ungrouped selection", () => {
    createRoot((dispose) => {
      const { api, items } = makeApi(
        [{ id: "a", groupId: null }] as unknown as CommentItem[],
        [],
      );
      expect(api.handleRemoveItem("a").status).toBe("removed");
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
      expect(api.handleRemoveItem("a").status).toBe("removed");
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
      expect(api.handleRemoveItem("a").status).toBe("removed");
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
      expect(api.handleRemoveItem("a").status).toBe("removed");
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
      expect(api.handleRemoveItem("a").status).toBe("refused");
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
      expect(api.handleRemoveItem("a").status).toBe("refused");
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
      expect(api.handleRemoveItem("ghost")).toEqual({
        status: "refused",
        reason: "selection-not-found",
      });
      dispose();
    });
  });
});

describe("createSelectionGroups membership commands", () => {
  const liveGroups = (): SelectionGroup[] => [
    { id: "open", name: "Open", createdAt: 0, revealed: false },
    {
      id: "synthetic-8",
      name: "Header",
      createdAt: 0,
      revealed: false,
      synthetic: true,
      jiraTicketId: "SCRUM-8",
    },
    {
      id: "synthetic-9",
      name: "Button",
      createdAt: 0,
      revealed: false,
      synthetic: true,
      jiraTicketId: "SCRUM-9",
    },
  ];
  const liveItems = () =>
    [
      { id: "header", groupId: "synthetic-8" },
      { id: "button", groupId: "synthetic-9" },
    ] as unknown as CommentItem[];

  it("refuses to move a locked selection and keeps its ticketed synthetic group", () => {
    createRoot((dispose) => {
      const deps = makeDeps(liveItems(), liveGroups());
      const api = createSelectionGroups(deps);

      const result = api.handleMoveItem("header", "synthetic-9");

      expect(result).toEqual({ status: "refused", reason: "selection-locked" });
      expect(deps.rawItems().find((i) => i.id === "header")?.groupId).toBe(
        "synthetic-8",
      );
      expect(deps.rawGroups().map((g) => g.id)).toContain("synthetic-8");
      dispose();
    });
  });

  it("refuses a bulk move into a synthetic group and changes nothing", () => {
    createRoot((dispose) => {
      const deps = makeDeps(
        [{ id: "loose", groupId: "open" }] as unknown as CommentItem[],
        liveGroups(),
      );
      const api = createSelectionGroups(deps);

      expect(api.handleMoveItems(new Set(["loose"]), "synthetic-9")).toEqual({
        status: "refused",
        reason: "target-ticketed",
      });
      expect(deps.rawItems()[0]?.groupId).toBe("open");
      dispose();
    });
  });

  it("refuses to delete a ticketed group", () => {
    createRoot((dispose) => {
      const deps = makeDeps(liveItems(), liveGroups());
      const api = createSelectionGroups(deps);

      expect(api.handleDeleteGroup("synthetic-8")).toEqual({
        status: "refused",
        reason: "group-ticketed",
      });
      expect(deps.rawItems()[0]?.groupId).toBe("synthetic-8");
      dispose();
    });
  });
});

describe("createSelectionGroups ticket metadata", () => {
  const open = (): SelectionGroup[] => [
    { id: "g1", name: "Alpha", createdAt: 0, revealed: false },
  ];

  it("records a new ticket and stops offering the group to new selections", () => {
    createRoot((dispose) => {
      const deps = makeDeps(seedItems(), open());
      const api = createSelectionGroups(deps);
      api.setActiveGroupId("g1");

      api.markTicketCreated("g1", "SCRUM-1", "https://jira/browse/SCRUM-1");

      expect(api.groups()[0]).toMatchObject({
        jiraTicketId: "SCRUM-1",
        jiraUrl: "https://jira/browse/SCRUM-1",
      });
      expect(api.activeGroupId()).toBeNull();
      dispose();
    });
  });

  it("records a resolved ticket", () => {
    createRoot((dispose) => {
      const deps = makeDeps(seedItems(), open());
      const api = createSelectionGroups(deps);
      api.markResolved("g1");
      expect(api.groups()[0]?.jiraResolved).toBe(true);
      dispose();
    });
  });
});

describe("createSelectionGroups membership anomalies", () => {
  it("reports each anomaly once and writes nothing", () => {
    logRecoverableError.mockClear();
    const { deps, persistItems, dispose } = createRoot((dispose) => {
      const deps = makeDeps(
        [
          { id: "b", groupId: "crowded" },
          { id: "c", groupId: "crowded" },
          { id: "o", groupId: "gone" },
        ] as unknown as CommentItem[],
        [
          {
            id: "crowded",
            name: "Button",
            createdAt: 0,
            revealed: false,
            synthetic: true,
          },
        ],
      );
      const persistItems = vi.spyOn(deps, "persistCommentItems");
      createSelectionGroups(deps);
      return { deps, persistItems, dispose };
    });

    expect(logRecoverableError).toHaveBeenCalledTimes(2);
    deps.setItems([...deps.rawItems()]);
    expect(logRecoverableError).toHaveBeenCalledTimes(2);
    expect(persistItems).not.toHaveBeenCalled();
    dispose();
  });
});
