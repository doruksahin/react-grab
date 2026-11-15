import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentItem } from "../../types.js";
import type { StorageAdapter, SyncConfig } from "./types.js";

const adapter = vi.hoisted(() => ({
  loadComments: vi.fn(),
  upsertComment: vi.fn(),
  deleteComment: vi.fn(),
  loadGroups: vi.fn(),
  upsertGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

vi.mock("./adapter.js", () => ({
  createHttpAdapter: (): StorageAdapter => adapter,
}));

const { createSyncLayer } = await import("./sync-layer.js");

const makeComment = (id: string, commentText: string): CommentItem => ({
  id,
  groupId: null,
  content: "<li>Walk the dog</li>",
  elementName: "li",
  tagName: "li",
  commentText,
  timestamp: 1,
});

const makeConfig = (): SyncConfig => ({
  enabled: true,
  serverUrl: "http://localhost:9999",
  workspace: "test-workspace",
  jiraProjectKey: "ATT",
  apiToken: "test-token",
  syncRevealedState: true,
  onSyncError: vi.fn(),
});

const serverComment = makeComment("server-1", "From the server");

describe("sync layer retry", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const method of Object.values(adapter)) method.mockReset();
    adapter.upsertComment.mockResolvedValue(undefined);
    adapter.deleteComment.mockResolvedValue(undefined);
    adapter.upsertGroup.mockResolvedValue(undefined);
    adapter.deleteGroup.mockResolvedValue(undefined);
    adapter.loadComments.mockResolvedValue([serverComment]);
    adapter.loadGroups.mockRejectedValueOnce(new Error("offline"));
    adapter.loadGroups.mockResolvedValue([]);
  });

  it("keeps a change made while offline and sends it on a successful retry", async () => {
    const layer = createSyncLayer();
    await layer.init(makeConfig());
    expect(layer.status()).toBe("error");
    expect(layer.adapter()).toBeNull();

    const offlineComment = makeComment("offline-1", "Made while offline");
    layer.persistComments([offlineComment, ...layer.comments()]);
    expect(adapter.upsertComment).not.toHaveBeenCalled();
    expect(localStorage.getItem("react-grab-comment-items")).toContain(
      "offline-1",
    );

    await layer.retry();

    expect(layer.status()).toBe("synced");
    expect(layer.comments().map((item) => item.id)).toEqual([
      "offline-1",
      "server-1",
    ]);
    expect(adapter.upsertComment).toHaveBeenCalledTimes(1);
    expect(adapter.upsertComment.mock.calls[0][0]).toMatchObject({
      id: "offline-1",
    });
    layer.dispose();
  });

  it("runs one connection for retries made while one is in flight", async () => {
    const layer = createSyncLayer();
    await layer.init(makeConfig());
    const first = layer.retry();
    const second = layer.retry();
    expect(second).toBe(first);
    await first;
    expect(adapter.loadGroups).toHaveBeenCalledTimes(2);
    layer.dispose();
  });

  it("does not connect again after dispose", async () => {
    const layer = createSyncLayer();
    await layer.init(makeConfig());
    layer.dispose();
    await layer.retry();
    expect(adapter.loadGroups).toHaveBeenCalledTimes(1);
    expect(layer.status()).toBe("error");
  });
});
