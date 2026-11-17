import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import type { JiraAdminPort, SyncServerConnection } from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import {
  saveAdminToken,
  saveApiToken,
  saveServerUrl,
} from "../settings/settings-items.js";
import {
  sendAsOptionsPage,
  sendAsOwnContentScript,
} from "../test-support/senders.js";
import { handleJiraAdminRequests } from "./handle-jira-admin-requests.js";

const SERVER_URL = "https://sync.example.test";
const ACCOUNT = {
  id: "acc-1",
  siteUrl: "https://acme.atlassian.net",
  email: "ada@example.com",
  displayName: "Ada",
  workspaceCount: 0,
};

/** ADR-0027: Jira accounts are managed from the settings page, with the admin token. */
describe("Jira admin requests", () => {
  const connections: SyncServerConnection[] = [];
  const port: JiraAdminPort = {
    listAccounts: vi.fn(async () => [ACCOUNT]),
    addAccount: vi.fn(async () => ACCOUNT),
    replaceCredential: vi.fn(async () => ACCOUNT),
    removeAccount: vi.fn(async () => {}),
    listProjects: vi.fn(async () => [{ key: "SCRUM", name: "Scrum" }]),
    listWorkspaces: vi.fn(async () => []),
    setDestination: vi.fn(async () => ({
      siteUrl: ACCOUNT.siteUrl,
      projectKey: "SCRUM",
      signsInAs: "Ada",
    })),
  };

  // The messenger allows one listener per message in a context.
  beforeAll(() => {
    handleJiraAdminRequests(Promise.resolve(), (connection) => {
      connections.push(connection);
      return port;
    });
  });

  // Storage only: a full fakeBrowser.reset() would drop the listeners above.
  beforeEach(async () => {
    await fakeBrowser.storage.local.clear();
    connections.length = 0;
    await saveServerUrl(SERVER_URL);
    await saveApiToken("sync-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a content script, before reading any token", async () => {
    await saveAdminToken("admin-token");
    sendAsOwnContentScript();
    await expect(
      settingsMessenger.sendMessage("listJiraAccounts", undefined),
    ).rejects.toThrow("the sender is not an extension page");
    await expect(
      settingsMessenger.sendMessage("setJiraDestination", {
        workspaceId: "ws",
        jiraAccountId: "acc-1",
        projectKey: "SCRUM",
      }),
    ).rejects.toThrow("the sender is not an extension page");
    expect(connections).toEqual([]);
  });

  it("asks for the admin token when it is not set", async () => {
    sendAsOptionsPage();
    await expect(
      settingsMessenger.sendMessage("listJiraAccounts", undefined),
    ).rejects.toThrow("the admin token is not set");
  });

  it("lists workspaces with the sync token, without the admin token", async () => {
    sendAsOptionsPage();
    await expect(
      settingsMessenger.sendMessage("listWorkspaces", undefined),
    ).resolves.toEqual([]);
    expect(connections).toEqual([
      { serverUrl: SERVER_URL, apiToken: "sync-token" },
    ]);
  });

  it("refuses to list workspaces from a content script", async () => {
    sendAsOwnContentScript();
    await expect(
      settingsMessenger.sendMessage("listWorkspaces", undefined),
    ).rejects.toThrow("the sender is not an extension page");
    expect(connections).toEqual([]);
  });

  it("calls the server with the admin token, never the sync token", async () => {
    await saveAdminToken("admin-token");
    sendAsOptionsPage();
    await expect(
      settingsMessenger.sendMessage("listJiraAccounts", undefined),
    ).resolves.toEqual([ACCOUNT]);
    await settingsMessenger.sendMessage("setJiraDestination", {
      workspaceId: "ws",
      jiraAccountId: "acc-1",
      projectKey: "SCRUM",
    });
    expect(port.setDestination).toHaveBeenCalledWith("ws", {
      jiraAccountId: "acc-1",
      projectKey: "SCRUM",
    });
    expect(connections).toEqual([
      { serverUrl: SERVER_URL, apiToken: "admin-token" },
      { serverUrl: SERVER_URL, apiToken: "admin-token" },
    ]);
  });
});
