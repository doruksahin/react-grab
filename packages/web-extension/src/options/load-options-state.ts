import type {
  JiraAccountSummary,
  WorkspaceSummary,
} from "react-grab/sync-http";
import { settingsMessenger } from "../messaging/extension-messengers.js";
import { readSyncSettings } from "../settings/settings-items.js";
import type { SiteSettingsByOrigin } from "../settings/types.js";
import { describeError } from "./describe-error.js";

/** What the server knows about Jira, through the admin token (ADR-0027). */
export type JiraAdminState =
  | {
      kind: "ready";
      accounts: JiraAccountSummary[];
      workspaces: WorkspaceSummary[];
    }
  | { kind: "no-admin-token" }
  | { kind: "failed"; message: string };

export interface OptionsState {
  serverUrl: string;
  hasApiToken: boolean;
  hasAdminToken: boolean;
  sites: SiteSettingsByOrigin;
  jira: JiraAdminState;
}

const loadJiraAdminState = async (
  hasAdminToken: boolean,
): Promise<JiraAdminState> => {
  if (!hasAdminToken) return { kind: "no-admin-token" };
  try {
    const [accounts, workspaces] = await Promise.all([
      settingsMessenger.sendMessage("listJiraAccounts", undefined),
      settingsMessenger.sendMessage("listWorkspaces", undefined),
    ]);
    return { kind: "ready", accounts, workspaces };
  } catch (error) {
    return { kind: "failed", message: describeError(error) };
  }
};

export const loadOptionsState = async (): Promise<OptionsState> => {
  const settings = await readSyncSettings();
  const hasAdminToken = Boolean(settings.serverUrl && settings.adminToken);
  return {
    serverUrl: settings.serverUrl ?? "",
    hasApiToken: Boolean(settings.apiToken),
    hasAdminToken: Boolean(settings.adminToken),
    sites: settings.sites,
    jira: await loadJiraAdminState(hasAdminToken),
  };
};
