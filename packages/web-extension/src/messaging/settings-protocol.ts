import type {
  JiraAccountSummary,
  JiraDestination,
  JiraDestinationChoice,
  JiraProjectSummary,
  NewJiraAccount,
  WorkspaceSummary,
} from "react-grab/sync-http";
import type { SiteSettings } from "../settings/types.js";

export interface SaveSiteRequest {
  origin: string;
  site: SiteSettings;
}

export interface ReplaceJiraCredentialRequest {
  accountId: string;
  apiToken: string;
}

export interface SetJiraDestinationRequest extends JiraDestinationChoice {
  workspaceId: string;
}

/**
 * Messages from the extension's own pages. The background accepts none of
 * them from a content script (assertExtensionPageSender, ADR-0023). The Jira
 * ones use the admin token, which only the background reads (ADR-0027).
 */
export interface SettingsProtocol {
  saveSite(request: SaveSiteRequest): void;
  removeSites(origins: string[]): void;
  listJiraAccounts(): JiraAccountSummary[];
  addJiraAccount(account: NewJiraAccount): JiraAccountSummary;
  replaceJiraCredential(
    request: ReplaceJiraCredentialRequest,
  ): JiraAccountSummary;
  removeJiraAccount(accountId: string): void;
  listJiraProjects(accountId: string): JiraProjectSummary[];
  listWorkspaces(): WorkspaceSummary[];
  setJiraDestination(request: SetJiraDestinationRequest): JiraDestination;
}
