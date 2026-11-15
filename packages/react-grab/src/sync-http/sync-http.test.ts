import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHttpAdapter,
  createHttpJiraPort,
  SyncHttpError,
} from "./index.js";
import type { SyncHttpConfig } from "./types.js";
import { customFetch } from "../generated/custom-fetch.js";
import type { JiraPort, StorageAdapter } from "../features/sync/types.js";
import {
  createFakeJiraPort,
  createFakeStorage,
} from "../test-support/fake-ports.js";

const config: SyncHttpConfig = {
  serverUrl: "https://sync.example.com/",
  apiToken: "secret-token",
  workspace: "team space",
};

interface RecordedRequest {
  url: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  body: BodyInit | null | undefined;
}

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const recorded = (): RecordedRequest[] =>
  fetchMock.mock.calls.map(([input, init]) => {
    const headers = new Headers(init?.headers);
    return {
      url: String(input),
      method: init?.method ?? "GET",
      authorization: headers.get("Authorization"),
      contentType: headers.get("Content-Type"),
      body: init?.body,
    };
  });

const comment = {
  id: "comment/1",
  groupId: "",
  content: "<li>Walk the dog</li>",
  elementName: "li",
  tagName: "li",
  timestamp: 1,
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request helper", () => {
  it("sends every generated call to the configured server with the token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [comment]));
    await createHttpAdapter(config).loadComments();

    expect(recorded()).toEqual([
      expect.objectContaining({
        url: "https://sync.example.com/workspaces/team%20space/comments",
        method: "GET",
        authorization: "Bearer secret-token",
      }),
    ]);
  });

  it("keeps each port's connection to itself", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, []));
    const other = createHttpAdapter({
      serverUrl: "https://other.example.com",
      apiToken: "other-token",
      workspace: "other",
    });
    await createHttpAdapter(config).loadGroups();
    await other.loadGroups();

    expect(
      recorded().map((request) => [request.url, request.authorization]),
    ).toEqual([
      [
        "https://sync.example.com/workspaces/team%20space/groups",
        "Bearer secret-token",
      ],
      [
        "https://other.example.com/workspaces/other/groups",
        "Bearer other-token",
      ],
    ]);
  });

  it("encodes ids in paths", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));
    await createHttpAdapter(config).deleteComment("comment/1");
    expect(recorded()[0].url).toBe(
      "https://sync.example.com/workspaces/team%20space/comments/comment%2F1",
    );
  });
});

describe("domain values", () => {
  it("returns comments with an empty group id as ungrouped", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [comment]));
    const [loaded] = await createHttpAdapter(config).loadComments();
    expect(loaded.groupId).toBeNull();
  });

  it("writes an ungrouped comment as an empty group id, without preview bounds", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));
    await createHttpAdapter(config).upsertComment({
      ...comment,
      groupId: null,
      revealed: true,
      previewBounds: [],
    });
    const [request] = recorded();
    expect(request.method).toBe("PUT");
    expect(JSON.parse(String(request.body))).toEqual({
      ...comment,
      groupId: "",
      revealed: true,
    });
  });

  it("rejects a response that does not match the server schema", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: 1 }]));
    await expect(createHttpAdapter(config).loadComments()).rejects.toThrow();
  });
});

describe("error mapping", () => {
  it("throws the server's error message with the status", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: "JIRA rejected the request" }),
    );
    const failure = createHttpJiraPort(config).createTicket("group-1", {
      projectKey: "ATT",
      issueType: "Task",
      priority: "Medium",
      summary: "Price label overlaps",
      description: "",
    });
    await expect(failure).rejects.toBeInstanceOf(SyncHttpError);
    await expect(failure).rejects.toMatchObject({
      status: 400,
      message: "JIRA rejected the request",
    });
  });

  it("names the operation when the server sends no message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    await expect(createHttpAdapter(config).loadGroups()).rejects.toThrow(
      "GET /groups failed: 500",
    );
  });

  it("lets a network failure through as the TypeError fetch raised", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(createHttpJiraPort(config).getSite()).rejects.toBeInstanceOf(
      TypeError,
    );
  });

  it("maps a failed binary request too", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "not found" }));
    await expect(
      createHttpAdapter(config).loadScreenshot("comment-1", "element"),
    ).rejects.toMatchObject({ status: 404, message: "not found" });
  });
});

describe("binary bodies", () => {
  it("uploads a screenshot as the raw blob with its own content type", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { key: "screenshots/c/element" }),
    );
    const blob = new Blob(["png-bytes"], { type: "image/png" });

    const key = await createHttpAdapter(config).uploadScreenshot(
      "comment-1",
      "element",
      blob,
    );

    expect(key).toBe("screenshots/c/element");
    const [request] = recorded();
    expect(request).toMatchObject({
      url: "https://sync.example.com/workspaces/team%20space/screenshots/comment-1/element",
      method: "PUT",
      authorization: "Bearer secret-token",
      contentType: "image/png",
    });
    expect(request.body).toBe(blob);
  });

  it("uploads a recording as raw gzip", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { recordingUrl: "https://sync.example.com/r/abc" }),
    );
    const gzip = new Blob(["gzip-bytes"]);

    const link = await createHttpAdapter(config).uploadRecording(
      "comment-1",
      gzip,
    );

    expect(link).toBe("https://sync.example.com/r/abc");
    expect(recorded()[0]).toMatchObject({
      url: "https://sync.example.com/workspaces/team%20space/recordings/comment-1",
      contentType: "application/gzip",
      body: gzip,
    });
  });

  it("loads a screenshot as a blob", async () => {
    fetchMock.mockResolvedValue(
      new Response("png-bytes", {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const blob = await createHttpAdapter(config).loadScreenshot(
      "comment-1",
      "full",
    );

    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("png-bytes");
    expect(recorded()[0]).toMatchObject({
      url: "https://sync.example.com/workspaces/team%20space/screenshots/comment-1/full",
      method: "GET",
      authorization: "Bearer secret-token",
    });
  });
});

describe("Jira port", () => {
  it("scopes ticket calls to the configured workspace", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { id: "10", created: "now" }),
    );
    const posted = await createHttpJiraPort(config).addComment("group-1", {
      body: "Looks good",
    });

    expect(posted).toEqual({ id: "10", created: "now" });
    expect(recorded()[0]).toMatchObject({
      url: "https://sync.example.com/workspaces/team%20space/groups/group-1/jira-comment",
      method: "POST",
      authorization: "Bearer secret-token",
    });
  });

  it("passes the project to the user search only when given", async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, []));
    const port = createHttpJiraPort(config);
    await port.searchUsers("ali", "ATT");
    await port.searchUsers("ali");

    expect(recorded().map((request) => request.url)).toEqual([
      "https://sync.example.com/jira/users?query=ali&project=ATT",
      "https://sync.example.com/jira/users?query=ali",
    ]);
  });
});

describe("non-JSON responses", () => {
  const htmlResponse = (status: number) =>
    new Response("<html><body>502 Bad Gateway</body></html>", {
      status,
      headers: { "Content-Type": "text/html" },
    });

  it("reports an HTML error page from a generated call as a SyncHttpError", async () => {
    fetchMock.mockResolvedValue(htmlResponse(502));
    const failure = createHttpAdapter(config).loadGroups();
    await expect(failure).rejects.toBeInstanceOf(SyncHttpError);
    await expect(failure).rejects.toMatchObject({
      status: 502,
      message: "GET /groups failed: 502",
    });
  });

  it("reports an HTML error page from a binary call as a SyncHttpError", async () => {
    fetchMock.mockResolvedValue(htmlResponse(502));
    await expect(
      createHttpAdapter(config).loadScreenshot("comment-1", "full"),
    ).rejects.toMatchObject({
      status: 502,
      message: "GET /screenshots failed: 502",
    });
  });
});

describe("customFetch", () => {
  it("refuses a call that names no server", async () => {
    await expect(customFetch("/jira/site", {})).rejects.toThrow(
      /no sync server URL/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const callEveryMethod = async (
  storage: StorageAdapter,
  jira: JiraPort,
): Promise<Record<keyof StorageAdapter | keyof JiraPort, unknown>> => {
  const blob = new Blob(["x"], { type: "image/png" });
  return {
    loadComments: await storage.loadComments(),
    upsertComment: await storage.upsertComment({ ...comment, groupId: null }),
    deleteComment: await storage.deleteComment("c"),
    loadGroups: await storage.loadGroups(),
    upsertGroup: await storage.upsertGroup({
      id: "g",
      name: "G",
      createdAt: 1,
    }),
    deleteGroup: await storage.deleteGroup("g"),
    uploadScreenshot: await storage.uploadScreenshot("c", "full", blob),
    loadScreenshot: await storage.loadScreenshot("c", "full"),
    uploadRecording: await storage.uploadRecording("c", blob),
    getSite: await jira.getSite(),
    listIssueTypes: await jira.listIssueTypes("ATT"),
    listPriorities: await jira.listPriorities(),
    listLabels: await jira.listLabels("ATT"),
    getTicketStatus: await jira.getTicketStatus("g"),
    createTicket: await jira.createTicket("g", {
      projectKey: "ATT",
      issueType: "Task",
      priority: "Medium",
      summary: "S",
      description: "",
    }),
    addComment: await jira.addComment("g", { body: "b" }),
    searchUsers: await jira.searchUsers("a"),
  };
};

const expectCloneable = (results: Record<string, unknown>) => {
  for (const [method, result] of Object.entries(results)) {
    expect(() => structuredClone(result), method).not.toThrow();
    if (!(result instanceof Blob)) {
      expect(structuredClone(result), method).toEqual(result);
    }
  }
};

/*
 * ADR-0023: in the extension a port call crosses two message channels that
 * use the structured clone algorithm. Every value a port returns, and the
 * message of every error it throws, must survive it.
 */
describe("structured clone contract", () => {
  const ticketStatus = {
    status: "In Progress",
    statusCategory: "indeterminate",
    assignee: null,
    reporter: null,
    assigneeAvatar: null,
    reporterAvatar: null,
    jiraUrl: "https://acme.atlassian.net/browse/ATT-1",
    labels: ["ui"],
    comments: [],
  };

  const respond = (url: string, method: string): Response => {
    const path = new URL(url).pathname;
    if (method !== "GET") {
      if (path.includes("/screenshots/"))
        return jsonResponse(200, { key: "k" });
      if (path.includes("/recordings/"))
        return jsonResponse(200, {
          recordingUrl: "https://sync.example.com/r/a",
        });
      if (path.endsWith("/jira-ticket"))
        return jsonResponse(200, {
          jiraTicketId: "ATT-1",
          jiraUrl: "https://j/ATT-1",
        });
      if (path.endsWith("/jira-comment"))
        return jsonResponse(200, { id: "10", created: "now" });
      return jsonResponse(200, { status: "ok" });
    }
    if (path.endsWith("/comments")) return jsonResponse(200, [comment]);
    if (path.endsWith("/groups"))
      return jsonResponse(200, [{ id: "g", name: "G", createdAt: 1 }]);
    if (path.includes("/screenshots/"))
      return new Response("png", { headers: { "Content-Type": "image/png" } });
    if (path.endsWith("/jira-status")) return jsonResponse(200, ticketStatus);
    if (path === "/jira/site")
      return jsonResponse(200, { siteUrl: "https://j" });
    if (path === "/jira/labels") return jsonResponse(200, ["ui"]);
    if (path === "/jira/users")
      return jsonResponse(200, [
        { accountId: "a", displayName: "A", avatarUrl: null },
      ]);
    return jsonResponse(200, [{ id: "1", name: "Task" }]);
  };

  it("returns only cloneable values from every HTTP port method", async () => {
    fetchMock.mockImplementation(async (input, init) =>
      respond(String(input), init?.method ?? "GET"),
    );
    expectCloneable(
      await callEveryMethod(
        createHttpAdapter(config),
        createHttpJiraPort(config),
      ),
    );
  });

  it("holds the fake ports to the same contract", async () => {
    const storage = createFakeStorage({
      comments: [{ ...comment, groupId: null }],
      groups: [{ id: "g", name: "G", createdAt: 1 }],
    });
    const jira = createFakeJiraPort({
      site: { siteUrl: "https://j" },
      issueTypes: [{ id: "1", name: "Task" }],
      priorities: [{ id: "1", name: "Medium" }],
      labels: ["ui"],
      ticketStatuses: { g: ticketStatus },
      users: [{ accountId: "a", displayName: "Ali", avatarUrl: null }],
    });
    await storage.uploadScreenshot("c", "full", new Blob(["x"]));
    expectCloneable(await callEveryMethod(storage, jira));
  });

  it("keeps the server's message on a cloned error", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "JIRA said no" }));
    const error: unknown = await createHttpJiraPort(config)
      .getSite()
      .catch((caught: unknown) => caught);
    expect(structuredClone(error)).toMatchObject({ message: "JIRA said no" });
  });
});
