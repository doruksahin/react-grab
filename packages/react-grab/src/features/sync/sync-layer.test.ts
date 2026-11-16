import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentItem } from "../../types.js";
import { createSyncLayer } from "./sync-layer.js";
import { WriteRefusedError } from "./business/write-refused-error.js";
import type {
  JiraPort,
  StorageAdapter,
  SyncConfig,
  SyncPortFactories,
  SyncServerConfig,
} from "./types.js";

const factories = {
  createStorage: vi.fn<SyncPortFactories["createStorage"]>(),
  createJira: vi.fn<SyncPortFactories["createJira"]>(),
};

const adapter = {
  loadComments: vi.fn<StorageAdapter["loadComments"]>(),
  upsertComment: vi.fn<StorageAdapter["upsertComment"]>(),
  deleteComment: vi.fn<StorageAdapter["deleteComment"]>(),
  loadGroups: vi.fn<StorageAdapter["loadGroups"]>(),
  upsertGroup: vi.fn<StorageAdapter["upsertGroup"]>(),
  deleteGroup: vi.fn<StorageAdapter["deleteGroup"]>(),
  uploadScreenshot: vi.fn<StorageAdapter["uploadScreenshot"]>(),
  loadScreenshot: vi.fn<StorageAdapter["loadScreenshot"]>(),
  uploadRecording: vi.fn<StorageAdapter["uploadRecording"]>(),
};

const jira = {
  getDestination: vi.fn<JiraPort["getDestination"]>(),
  listIssueTypes: vi.fn<JiraPort["listIssueTypes"]>(),
  listPriorities: vi.fn<JiraPort["listPriorities"]>(),
  listLabels: vi.fn<JiraPort["listLabels"]>(),
  getTicketStatus: vi.fn<JiraPort["getTicketStatus"]>(),
  createTicket: vi.fn<JiraPort["createTicket"]>(),
  addComment: vi.fn<JiraPort["addComment"]>(),
  searchUsers: vi.fn<JiraPort["searchUsers"]>(),
};

const makeComment = (id: string, commentText: string): CommentItem => ({
  id,
  groupId: null,
  content: "<li>Walk the dog</li>",
  elementName: "li",
  tagName: "li",
  commentText,
  timestamp: 1,
});

const makeConfig = (overrides: Partial<SyncConfig> = {}): SyncConfig => ({
  enabled: true,
  workspace: "test-workspace",
  storage: adapter,
  jira,
  syncRevealedState: true,
  onSyncError: vi.fn(),
  ...overrides,
});

const resetPorts = () => {
  localStorage.clear();
  for (const method of [...Object.values(adapter), ...Object.values(jira)])
    method.mockReset();
  factories.createStorage.mockReset();
  factories.createJira.mockReset();
  adapter.upsertComment.mockResolvedValue(undefined);
  adapter.deleteComment.mockResolvedValue(undefined);
  adapter.upsertGroup.mockResolvedValue(undefined);
  adapter.deleteGroup.mockResolvedValue(undefined);
};

const serverComment = makeComment("server-1", "From the server");

describe("sync layer retry", () => {
  beforeEach(() => {
    resetPorts();
    adapter.loadComments.mockResolvedValue([serverComment]);
    adapter.loadGroups.mockRejectedValueOnce(new Error("offline"));
    adapter.loadGroups.mockResolvedValue([]);
  });

  it("keeps a change made while offline and sends it on a successful retry", async () => {
    const layer = createSyncLayer(factories);
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
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());
    const first = layer.retry();
    const second = layer.retry();
    expect(second).toBe(first);
    await first;
    expect(adapter.loadGroups).toHaveBeenCalledTimes(2);
    layer.dispose();
  });

  it("does not connect again after dispose", async () => {
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());
    layer.dispose();
    await layer.retry();
    expect(adapter.loadGroups).toHaveBeenCalledTimes(1);
    expect(layer.status()).toBe("error");
  });
});

describe("sync layer ports", () => {
  beforeEach(() => {
    resetPorts();
    adapter.loadComments.mockResolvedValue([serverComment]);
    adapter.loadGroups.mockResolvedValue([]);
  });

  it("uses injected ports without a server URL or token", async () => {
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());

    expect(layer.status()).toBe("synced");
    expect(layer.comments().map((item) => item.id)).toEqual(["server-1"]);
    expect(factories.createStorage).not.toHaveBeenCalled();
    expect(factories.createJira).not.toHaveBeenCalled();
    expect(layer.jira()).toBe(jira);
    layer.dispose();
  });

  it("builds the HTTP ports from serverUrl, apiToken and workspace when none are injected", async () => {
    factories.createStorage.mockReturnValue(adapter);
    factories.createJira.mockReturnValue(jira);
    const layer = createSyncLayer(factories);
    await layer.init(
      makeConfig({
        storage: undefined,
        jira: undefined,
        serverUrl: "http://localhost:9999",
        apiToken: "test-token",
      }),
    );

    const expected: SyncServerConfig = {
      serverUrl: "http://localhost:9999",
      apiToken: "test-token",
      workspace: "test-workspace",
    };
    expect(factories.createStorage).toHaveBeenCalledWith(expected);
    expect(factories.createJira).toHaveBeenCalledWith(expected);
    expect(layer.status()).toBe("synced");
    layer.dispose();
  });

  it("builds only the missing port", async () => {
    factories.createJira.mockReturnValue(jira);
    const layer = createSyncLayer(factories);
    await layer.init(
      makeConfig({
        jira: undefined,
        serverUrl: "http://localhost:9999",
        apiToken: "test-token",
      }),
    );
    expect(factories.createStorage).not.toHaveBeenCalled();
    expect(factories.createJira).toHaveBeenCalledTimes(1);
    layer.dispose();
  });

  it("requires a token when it has to build an HTTP port", async () => {
    const layer = createSyncLayer(factories);
    await expect(
      layer.init(makeConfig({ jira: undefined, serverUrl: "http://x" })),
    ).rejects.toThrow(/apiToken is required/);
    expect(layer.adapter()).toBeNull();
  });

  it("asks the Jira port for the status of ticketed groups", async () => {
    adapter.loadGroups.mockResolvedValue([
      { id: "group-1", name: "Checkout", createdAt: 1, jiraTicketId: "ATT-1" },
    ]);
    jira.getTicketStatus.mockResolvedValue({
      status: "In Progress",
      statusCategory: "indeterminate",
      assignee: null,
      reporter: null,
      assigneeAvatar: null,
      reporterAvatar: null,
      jiraUrl: "https://acme.atlassian.net/browse/ATT-1",
      labels: [],
      comments: [],
    });
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());

    await vi.waitFor(() => {
      expect(layer.groups()[0]).toMatchObject({ jiraStatus: "In Progress" });
    });
    expect(jira.getTicketStatus).toHaveBeenCalledWith("group-1");
    layer.dispose();
  });

  it("reports a failed write to onSyncError and keeps the local change", async () => {
    const onSyncError = vi.fn();
    adapter.upsertComment.mockRejectedValue(new Error("PUT failed: 500"));
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig({ onSyncError }));

    layer.persistComments([makeComment("new-1", "New"), ...layer.comments()]);

    await vi.waitFor(() => expect(onSyncError).toHaveBeenCalledTimes(1));
    expect(onSyncError.mock.calls[0][0].message).toBe("PUT failed: 500");
    expect(layer.comments().map((item) => item.id)).toEqual([
      "new-1",
      "server-1",
    ]);
    layer.dispose();
  });

  it("keeps revealed state local when it is not synced", async () => {
    localStorage.setItem(
      "react-grab-revealed-comments",
      JSON.stringify({ "server-1": true }),
    );
    adapter.loadComments.mockResolvedValue([
      { ...serverComment, revealed: false },
    ]);
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig({ syncRevealedState: false }));

    expect(layer.comments()[0].revealed).toBe(true);

    layer.persistComments([
      { ...makeComment("new-1", "New"), revealed: true },
      ...layer.comments(),
    ]);
    expect(adapter.upsertComment).toHaveBeenCalledTimes(1);
    expect(adapter.upsertComment.mock.calls[0][0]).not.toHaveProperty(
      "revealed",
    );
    layer.dispose();
  });

  it("sends nothing when only an unsynced revealed flag changes", async () => {
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig({ syncRevealedState: false }));

    layer.persistComments(
      layer.comments().map((item) => ({ ...item, revealed: !item.revealed })),
    );

    await vi.waitFor(() =>
      expect(localStorage.getItem("react-grab-revealed-comments")).toBe(
        JSON.stringify({ "server-1": true }),
      ),
    );
    expect(adapter.upsertComment).not.toHaveBeenCalled();
    layer.dispose();
  });

  it("refreshes one group's Jira status on request", async () => {
    adapter.loadGroups.mockResolvedValue([
      { id: "group-1", name: "Checkout", createdAt: 1 },
    ]);
    jira.getTicketStatus.mockResolvedValue({
      status: "Done",
      statusCategory: "done",
      assignee: null,
      reporter: null,
      assigneeAvatar: null,
      reporterAvatar: null,
      jiraUrl: "https://acme.atlassian.net/browse/ATT-1",
      labels: [],
      comments: [],
    });
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());

    await layer.refreshJiraStatus("group-1");

    expect(jira.getTicketStatus).toHaveBeenCalledWith("group-1");
    expect(layer.groups()[0]).toMatchObject({ jiraStatus: "Done" });
    layer.dispose();
  });
});

describe("a write the server rejects (ADR-0008)", () => {
  const ticketed = makeComment("ticketed", "Has a ticket");
  const free = makeComment("free", "No ticket");

  beforeEach(() => {
    resetPorts();
    adapter.loadComments.mockResolvedValue([ticketed, free]);
    adapter.loadGroups.mockResolvedValue([]);
  });

  it("puts a comment back when the server refuses to delete it", async () => {
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());
    adapter.deleteComment.mockImplementation(async (commentId) => {
      if (commentId === "ticketed") throw new WriteRefusedError("locked");
    });
    adapter.loadComments.mockResolvedValue([ticketed]);

    layer.persistComments([]);

    await vi.waitFor(() =>
      expect(layer.comments().map((item) => item.id)).toEqual(["ticketed"]),
    );
    layer.dispose();
  });

  it("reloads once for many rejected writes", async () => {
    const layer = createSyncLayer(factories);
    await layer.init(makeConfig());
    adapter.deleteComment.mockRejectedValue(new WriteRefusedError("locked"));
    adapter.loadComments.mockClear();

    layer.persistComments([]);

    await vi.waitFor(() =>
      expect(layer.comments().map((item) => item.id)).toEqual([
        "ticketed",
        "free",
      ]),
    );
    expect(adapter.loadComments).toHaveBeenCalledTimes(1);
    layer.dispose();
  });
});
