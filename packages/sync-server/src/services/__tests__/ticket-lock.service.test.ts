import { describe, expect, it } from "vitest";
import type {
  Comment,
  Group,
  SyncRepository,
} from "../../repositories/types.js";
import { TicketLockService } from "../ticket-lock.service.js";

const WORKSPACE = "ws";

const comment = (id: string, groupId: string): Comment => ({
  id,
  groupId,
  content: "<button>Pay</button>",
  elementName: "button",
  tagName: "button",
  timestamp: 1,
});

/** An in-memory repository: only what the service reads and writes. */
const fakeRepo = (comments: Comment[], groups: Group[]) => {
  const state = { comments: [...comments], groups: [...groups] };
  const repo: SyncRepository = {
    listComments: async () => state.comments,
    findComment: async (_, id) => state.comments.find((c) => c.id === id),
    upsertComment: async (_, item) => {
      state.comments = [
        ...state.comments.filter((c) => c.id !== item.id),
        item,
      ];
    },
    deleteComment: async (_, id) => {
      state.comments = state.comments.filter((c) => c.id !== id);
    },
    listGroups: async () => state.groups,
    findGroup: async (_, id) => state.groups.find((g) => g.id === id),
    upsertGroup: async () => {},
    setGroupArchived: async () => {},
    deleteGroup: async (_, id) => {
      state.groups = state.groups.filter((g) => g.id !== id);
    },
    updateGroupJira: async () => {},
    findTicketOrigin: async () => undefined,
  };
  return { repo, state };
};

const open: Group = { id: "open", name: "Open", createdAt: 1 };
const ticketed: Group = {
  id: "ticketed",
  name: "Shipped",
  createdAt: 2,
  jiraTicketId: "UI-1",
};

describe("TicketLockService", () => {
  it("deletes a comment whose group is missing", async () => {
    const { repo, state } = fakeRepo([comment("c", "gone")], [open, ticketed]);
    const result = await new TicketLockService(repo).deleteComment(
      WORKSPACE,
      "c",
    );
    expect(result).toEqual({ status: "done" });
    expect(state.comments).toEqual([]);
  });

  it("refuses to delete a comment in a ticketed group", async () => {
    const { repo, state } = fakeRepo([comment("c", "ticketed")], [ticketed]);
    expect(
      await new TicketLockService(repo).deleteComment(WORKSPACE, "c"),
    ).toEqual({ status: "refused", reason: "selection-has-ticket" });
    expect(state.comments).toHaveLength(1);
  });

  it("treats a missing group as deleted, and refuses a ticketed one", async () => {
    const { repo } = fakeRepo([], [ticketed]);
    const service = new TicketLockService(repo);
    expect(await service.deleteGroup(WORKSPACE, "gone")).toEqual({
      status: "done",
    });
    expect(await service.deleteGroup(WORKSPACE, "ticketed")).toEqual({
      status: "refused",
      reason: "group-has-ticket",
    });
  });

  it("allows a move between groups without a ticket", async () => {
    const other: Group = { id: "other", name: "Other", createdAt: 3 };
    const { repo, state } = fakeRepo([comment("c", "open")], [open, other]);
    expect(
      await new TicketLockService(repo).upsertComment(
        WORKSPACE,
        comment("c", "other"),
      ),
    ).toEqual({ status: "done" });
    expect(state.comments[0]?.groupId).toBe("other");
  });

  it("refuses a move into a ticketed group", async () => {
    const { repo } = fakeRepo([comment("c", "open")], [open, ticketed]);
    expect(
      await new TicketLockService(repo).upsertComment(
        WORKSPACE,
        comment("c", "ticketed"),
      ),
    ).toEqual({ status: "refused", reason: "target-group-has-ticket" });
  });
});
