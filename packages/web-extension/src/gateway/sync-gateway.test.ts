import { beforeEach, describe, expect, it } from "vitest";
import type { SyncHttpConfig } from "react-grab/sync-http";
import {
  createFakeJiraPort,
  createFakeStorage,
} from "react-grab/src/test-support/fake-ports.ts";
import type { Browser } from "wxt/browser";
import { fakeBrowser } from "wxt/testing/fake-browser";
import {
  apiTokenItem,
  saveApiToken,
  saveServerUrl,
  saveSite,
} from "../settings/settings-items.js";
import { createSyncGateway } from "./sync-gateway.js";

const SITE_ORIGIN = "https://app.example.test";
const OTHER_SITE_ORIGIN = "https://other.example.test";
const SERVER_URL = "https://sync.example.test";
const TEST_API_TOKEN = "test-token-for-unit-tests";
const ROTATED_API_TOKEN = "rotated-test-token";
const JIRA_LABELS = ["frontend", "bug"];

const senderFrom = (
  overrides: Partial<Browser.runtime.MessageSender> = {},
): Browser.runtime.MessageSender => ({
  id: fakeBrowser.runtime.id,
  frameId: 0,
  origin: SITE_ORIGIN,
  ...overrides,
});

const createRecordingGateway = () => {
  const storageConfigs: SyncHttpConfig[] = [];
  const jiraConfigs: SyncHttpConfig[] = [];
  const gateway = createSyncGateway({
    createStorage: (config) => {
      storageConfigs.push(config);
      return createFakeStorage();
    },
    createJira: (config) => {
      jiraConfigs.push(config);
      return createFakeJiraPort({ labels: JIRA_LABELS });
    },
  });
  return { gateway, storageConfigs, jiraConfigs };
};

describe("sync gateway", () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await saveServerUrl(SERVER_URL);
    await saveApiToken(TEST_API_TOKEN);
    await saveSite(SITE_ORIGIN, {
      workspace: "app-workspace",
      jiraProjectKey: "ATT",
      recordSteps: false,
      recordSession: false,
    });
    await saveSite(OTHER_SITE_ORIGIN, {
      workspace: "other-workspace",
      jiraProjectKey: "OTH",
      recordSteps: false,
      recordSession: false,
    });
  });

  it("calls the port built for the sender's site and returns its result", async () => {
    const { gateway, jiraConfigs } = createRecordingGateway();

    await expect(
      gateway.callJira("listLabels", ["ATT"], senderFrom()),
    ).resolves.toEqual(JIRA_LABELS);
    expect(jiraConfigs).toEqual([
      {
        serverUrl: SERVER_URL,
        apiToken: TEST_API_TOKEN,
        workspace: "app-workspace",
      },
    ]);
  });

  it("takes the workspace from the sender's origin, never from the message", async () => {
    const { gateway, storageConfigs } = createRecordingGateway();

    await gateway.callStorage(
      "loadGroups",
      [],
      senderFrom({ origin: OTHER_SITE_ORIGIN }),
    );

    expect(storageConfigs.map((config) => config.workspace)).toEqual([
      "other-workspace",
    ]);
  });

  it("reads the settings on every request, so a rotated token applies at once", async () => {
    const { gateway, storageConfigs } = createRecordingGateway();

    await gateway.callStorage("loadComments", [], senderFrom());
    await apiTokenItem.setValue(ROTATED_API_TOKEN);
    await gateway.callStorage("loadComments", [], senderFrom());

    expect(storageConfigs.map((config) => config.apiToken)).toEqual([
      TEST_API_TOKEN,
      ROTATED_API_TOKEN,
    ]);
  });

  it("refuses a sender that is not this extension", async () => {
    const { gateway, storageConfigs } = createRecordingGateway();

    await expect(
      gateway.callStorage(
        "loadComments",
        [],
        senderFrom({ id: "another-extension" }),
      ),
    ).rejects.toThrow("the sender is not this extension");
    expect(storageConfigs).toEqual([]);
  });

  it("refuses a sender in a sub-frame", async () => {
    const { gateway } = createRecordingGateway();

    await expect(
      gateway.callStorage("loadComments", [], senderFrom({ frameId: 3 })),
    ).rejects.toThrow("the sender is not a top frame");
  });

  it("refuses an origin that is not an enabled site", async () => {
    const { gateway } = createRecordingGateway();

    await expect(
      gateway.callStorage(
        "loadComments",
        [],
        senderFrom({ origin: "https://not-enabled.example.test" }),
      ),
    ).rejects.toThrow(
      "https://not-enabled.example.test is not an enabled site",
    );
  });

  it("refuses requests until the sync server is configured", async () => {
    await fakeBrowser.storage.local.remove("sync_api_token");
    const { gateway } = createRecordingGateway();

    await expect(
      gateway.callStorage("loadComments", [], senderFrom()),
    ).rejects.toThrow("the sync server is not configured");
  });

  it("refuses a method that is not on the port, including inherited ones", async () => {
    const { gateway, storageConfigs } = createRecordingGateway();

    for (const method of ["toString", "constructor", "dropDatabase"]) {
      await expect(
        Reflect.apply(gateway.callStorage, gateway, [method, [], senderFrom()]),
      ).rejects.toThrow(`storage.${method} is not allowed`);
    }
    expect(storageConfigs).toEqual([]);
  });

  it("passes a port error through to the caller", async () => {
    const gateway = createSyncGateway({
      createStorage: () => createFakeStorage(),
      createJira: () => createFakeJiraPort(),
    });

    await expect(gateway.callJira("getSite", [], senderFrom())).rejects.toThrow(
      "Jira site not found",
    );
  });

  describe("argument validation", () => {
    const TRAVERSAL = "../../../workspaces/other/comments/x";
    const blob = new Blob(["x"], { type: "image/png" });
    const comment = {
      id: "c1",
      groupId: null,
      content: "<li>x</li>",
      elementName: "li",
      tagName: "li",
      timestamp: 1,
    };
    const draft = {
      projectKey: "ATT",
      issueType: "Task",
      priority: "High",
      summary: "s",
      description: "d",
    };

    const storageCalls: Array<[string, ReadonlyArray<unknown>]> = [
      ["upsertComment", [{ ...comment, id: TRAVERSAL }]],
      ["deleteComment", [TRAVERSAL]],
      ["upsertGroup", [{ id: TRAVERSAL, name: "G", createdAt: 1 }]],
      ["deleteGroup", [TRAVERSAL]],
      ["uploadScreenshot", [TRAVERSAL, "full", blob]],
      ["loadScreenshot", [TRAVERSAL, "element"]],
      [
        "loadScreenshot",
        ["s", "../../../workspaces/OTHER/screenshots/id/full"],
      ],
      ["uploadRecording", [TRAVERSAL, blob]],
      ["deleteComment", [".."]],
      ["uploadScreenshot", ["s", "full", "not a blob"]],
      ["loadComments", ["unexpected extra argument"]],
    ];

    const jiraCalls: Array<[string, ReadonlyArray<unknown>]> = [
      ["getTicketStatus", [TRAVERSAL]],
      ["createTicket", [TRAVERSAL, draft]],
      ["addComment", [TRAVERSAL, { body: "b" }]],
    ];

    it("refuses a path traversal or a malformed value in every id-like argument", async () => {
      const { gateway, storageConfigs, jiraConfigs } = createRecordingGateway();

      for (const [method, args] of storageCalls) {
        await expect(
          Reflect.apply(gateway.callStorage, gateway, [
            method,
            args,
            senderFrom(),
          ]),
          `storage.${method}`,
        ).rejects.toThrow(`storage.${method} got invalid arguments`);
      }
      for (const [method, args] of jiraCalls) {
        await expect(
          Reflect.apply(gateway.callJira, gateway, [
            method,
            args,
            senderFrom(),
          ]),
          `jira.${method}`,
        ).rejects.toThrow(`jira.${method} got invalid arguments`);
      }
      expect(storageConfigs).toEqual([]);
      expect(jiraConfigs).toEqual([]);
    });

    it("accepts valid arguments and passes the parsed values on", async () => {
      const storage = createFakeStorage();
      const gateway = createSyncGateway({
        createStorage: () => storage,
        createJira: () => createFakeJiraPort(),
      });

      await gateway.callStorage("upsertComment", [comment], senderFrom());

      await expect(
        gateway.callStorage("loadComments", [], senderFrom()),
      ).resolves.toEqual([comment]);
    });

    it("binds every Jira project key to the site's project", async () => {
      const projectKeys: Array<string | undefined> = [];
      const gateway = createSyncGateway({
        createStorage: () => createFakeStorage(),
        createJira: () => ({
          ...createFakeJiraPort(),
          listIssueTypes: async (projectKey) => {
            projectKeys.push(projectKey);
            return [];
          },
          listLabels: async (projectKey) => {
            projectKeys.push(projectKey);
            return [];
          },
          searchUsers: async (_query, projectKey) => {
            projectKeys.push(projectKey);
            return [];
          },
          createTicket: async (_groupId, ticket) => {
            projectKeys.push(ticket.projectKey);
            return {
              jiraTicketId: "ATT-1",
              jiraUrl: "https://jira.test/ATT-1",
            };
          },
        }),
      });

      await gateway.callJira("listIssueTypes", ["OTHER"], senderFrom());
      await gateway.callJira("listLabels", ["OTHER"], senderFrom());
      await gateway.callJira("searchUsers", ["ann", "OTHER"], senderFrom());
      await gateway.callJira("searchUsers", ["ann"], senderFrom());
      await gateway.callJira(
        "createTicket",
        ["g1", { ...draft, projectKey: "OTHER" }],
        senderFrom(),
      );

      expect(projectKeys).toEqual(["ATT", "ATT", "ATT", "ATT", "ATT"]);
    });
  });
});
