import {
  type JiraAdminPort,
  type SyncServerConnection,
  createHttpJiraAdminPort,
} from "react-grab/sync-http";
import {
  GatewayRefusalError,
  assertExtensionPageSender,
} from "../gateway/sender-policy.js";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { readSyncSettings } from "../settings/settings-items.js";

export type CreateJiraAdminPort = (
  connection: SyncServerConnection,
) => JiraAdminPort;

/** The admin port, built with the admin token only the background reads (ADR-0027). */
const adminPort = async (
  createPort: CreateJiraAdminPort,
): Promise<JiraAdminPort> => {
  const { serverUrl, adminToken } = await readSyncSettings();
  if (!serverUrl) {
    throw new GatewayRefusalError("the sync server is not configured");
  }
  if (!adminToken) {
    throw new GatewayRefusalError(
      "the admin token is not set; enter it under Sync server",
    );
  }
  return createPort({ serverUrl, apiToken: adminToken });
};

/** Reading workspaces needs only the sync token, so teammates without the admin token see them too. */
const syncTokenPort = async (
  createPort: CreateJiraAdminPort,
): Promise<JiraAdminPort> => {
  const { serverUrl, apiToken } = await readSyncSettings();
  if (!serverUrl) {
    throw new GatewayRefusalError("the sync server is not configured");
  }
  if (!apiToken) {
    throw new GatewayRefusalError(
      "the API token is not set; enter it under Sync server",
    );
  }
  return createPort({ serverUrl, apiToken });
};

/**
 * Jira accounts and workspace destinations, for the settings page only. A
 * content script that sends one of these is refused before anything is read.
 */
export const handleJiraAdminRequests = (
  ready: Promise<void>,
  createPort: CreateJiraAdminPort = createHttpJiraAdminPort,
): void => {
  const port = async (
    sender: Parameters<typeof assertExtensionPageSender>[0],
    build = adminPort,
  ): Promise<JiraAdminPort> => {
    await ready;
    assertExtensionPageSender(sender);
    return build(createPort);
  };

  settingsMessenger.onMessage("listJiraAccounts", async ({ sender }) =>
    (await port(sender)).listAccounts(),
  );
  settingsMessenger.onMessage("addJiraAccount", async ({ data, sender }) =>
    (await port(sender)).addAccount(data),
  );
  settingsMessenger.onMessage(
    "replaceJiraCredential",
    async ({ data, sender }) =>
      (await port(sender)).replaceCredential(data.accountId, data.apiToken),
  );
  settingsMessenger.onMessage("removeJiraAccount", async ({ data, sender }) =>
    (await port(sender)).removeAccount(data),
  );
  settingsMessenger.onMessage("listJiraProjects", async ({ data, sender }) =>
    (await port(sender)).listProjects(data),
  );
  settingsMessenger.onMessage("listWorkspaces", async ({ sender }) =>
    (await port(sender, syncTokenPort)).listWorkspaces(),
  );
  settingsMessenger.onMessage(
    "setJiraDestination",
    async ({ data, sender }) => {
      const { workspaceId, ...choice } = data;
      return (await port(sender)).setDestination(workspaceId, choice);
    },
  );
};
