import { describe, expect, it, vi } from "vitest";
import { bindGroupCommentCallbacks } from "../bind-group-callbacks.js";
import type { GroupCommentCallbacks } from "../types.js";

describe("bindGroupCommentCallbacks", () => {
  const GROUP_ID = "group-42";

  it("binds groupId into onSubmitComment and forwards other args", async () => {
    const onSubmitComment = vi
      .fn<GroupCommentCallbacks["onSubmitComment"]>()
      .mockResolvedValue({ id: "c1", created: "2026-04-16T00:00:00Z" });

    const bound = bindGroupCommentCallbacks(GROUP_ID, { onSubmitComment });

    const result = await bound.onSubmitComment(
      "hello @alice",
      [{ text: "@alice", accountId: "acc-1" }],
      "parent-1",
    );

    expect(onSubmitComment).toHaveBeenCalledWith(
      GROUP_ID,
      "hello @alice",
      [{ text: "@alice", accountId: "acc-1" }],
      "parent-1",
    );
    expect(result).toEqual({ id: "c1", created: "2026-04-16T00:00:00Z" });
  });

  it("binds groupId into onRefreshPoll", () => {
    const onRefreshStatus = vi.fn<NonNullable<GroupCommentCallbacks["onRefreshStatus"]>>();

    const bound = bindGroupCommentCallbacks(GROUP_ID, {
      onSubmitComment: vi.fn(),
      onRefreshStatus,
    });

    bound.onRefreshPoll();

    expect(onRefreshStatus).toHaveBeenCalledWith(GROUP_ID);
  });

  it("tolerates missing onRefreshStatus without throwing", () => {
    const bound = bindGroupCommentCallbacks(GROUP_ID, {
      onSubmitComment: vi.fn(),
    });

    expect(() => bound.onRefreshPoll()).not.toThrow();
  });

  it("passes onSearchUsers through untouched", () => {
    const onSearchUsers = vi.fn<NonNullable<GroupCommentCallbacks["onSearchUsers"]>>();

    const bound = bindGroupCommentCallbacks(GROUP_ID, {
      onSubmitComment: vi.fn(),
      onSearchUsers,
    });

    expect(bound.onSearchUsers).toBe(onSearchUsers);
  });
});
