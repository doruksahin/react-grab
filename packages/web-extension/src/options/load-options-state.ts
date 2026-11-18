import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import {
  personalJiraAccountItem,
  readSyncSettings,
} from "../settings/settings-items.js";
import type {
  JiraUserIdentity,
  SiteSettingsByOrigin,
} from "../settings/types.js";
import { describeError } from "./describe-error.js";

/**
 * Whether the server answers with the sync token. Listing the workspaces
 * proves both: the server is reachable and accepts the token (/health does not
 * check the token).
 */
export type ServerConnection =
  | { kind: "not-configured" }
  | { kind: "connected"; workspaces: WorkspaceSummary[] }
  | { kind: "failed"; message: string };

/** What the server knows about Jira accounts, through the admin token (ADR-0027). */
export type JiraAdminState =
  | { kind: "ready"; accounts: JiraAccountSummary[] }
  | { kind: "no-admin-token" }
  | { kind: "failed"; message: string };

export interface OptionsState {
  serverUrl: string;
  hasApiToken: boolean;
  hasAdminToken: boolean;
  sites: SiteSettingsByOrigin;
  connection: ServerConnection;
  jira: JiraAdminState;
  /** Who the user's own Jira token signs in as; never the token (ADR-0031). */
  personalJira: JiraUserIdentity | null;
}

const loadConnection = async (
  isConfigured: boolean,
): Promise<ServerConnection> => {
  if (!isConfigured) return { kind: "not-configured" };
  try {
    const workspaces = await settingsMessenger.sendMessage(
      "listWorkspaces",
      undefined,
    );
    return { kind: "connected", workspaces };
  } catch (error) {
    return { kind: "failed", message: describeError(error) };
  }
};

const loadJiraAdminState = async (
  hasAdminToken: boolean,
): Promise<JiraAdminState> => {
  if (!hasAdminToken) return { kind: "no-admin-token" };
  try {
    const accounts = await settingsMessenger.sendMessage(
      "listJiraAccounts",
      undefined,
    );
    return { kind: "ready", accounts };
  } catch (error) {
    return { kind: "failed", message: describeError(error) };
  }
};

export const loadOptionsState = async (): Promise<OptionsState> => {
  const settings = await readSyncSettings();
  const isConfigured = Boolean(settings.serverUrl && settings.apiToken);
  const hasAdminToken = Boolean(settings.serverUrl && settings.adminToken);
  const [connection, jira, personalJiraAccount] = await Promise.all([
    loadConnection(isConfigured),
    loadJiraAdminState(hasAdminToken),
    personalJiraAccountItem.getValue(),
  ]);
  return {
    serverUrl: settings.serverUrl ?? "",
    hasApiToken: Boolean(settings.apiToken),
    hasAdminToken: Boolean(settings.adminToken),
    sites: settings.sites,
    connection,
    jira,
    personalJira: personalJiraAccount
      ? {
          accountId: personalJiraAccount.accountId,
          displayName: personalJiraAccount.displayName,
        }
      : null,
  };
};
