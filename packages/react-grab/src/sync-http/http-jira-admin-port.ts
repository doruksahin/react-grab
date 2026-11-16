import {
  type AddJiraAccountBody,
  type JiraAccountSummary,
  type ListJiraAccountProjects200Item,
  type SetJiraDestinationBody,
  type WorkspaceSummary,
  addJiraAccount,
  listJiraAccountProjects,
  listJiraAccounts,
  listWorkspaces,
  removeJiraAccount,
  replaceJiraCredential,
  setJiraDestination,
} from "../generated/sync-api.js";
import type { JiraDestination } from "../features/sync/types.js";
import { createSyncRequest, successData } from "./request.js";
import type { SyncServerConnection } from "./types.js";

export type { JiraAccountSummary, WorkspaceSummary };
export type JiraProjectSummary = ListJiraAccountProjects200Item;
export type NewJiraAccount = AddJiraAccountBody;
export type JiraDestinationChoice = SetJiraDestinationBody;

/**
 * Jira accounts and workspace destinations (ADR-0027). Built with the admin
 * token, which only the extension's service worker holds; the overlay never
 * gets this port.
 */
export interface JiraAdminPort {
  listAccounts: () => Promise<JiraAccountSummary[]>;
  addAccount: (account: NewJiraAccount) => Promise<JiraAccountSummary>;
  replaceCredential: (
    accountId: string,
    apiToken: string,
  ) => Promise<JiraAccountSummary>;
  removeAccount: (accountId: string) => Promise<void>;
  listProjects: (accountId: string) => Promise<JiraProjectSummary[]>;
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  setDestination: (
    workspaceId: string,
    choice: JiraDestinationChoice,
  ) => Promise<JiraDestination>;
}

/** The admin port over HTTP; `apiToken` here is the admin token. */
export const createHttpJiraAdminPort = (
  connection: SyncServerConnection,
): JiraAdminPort => {
  const request = createSyncRequest(connection);
  return {
    listAccounts: async () =>
      successData(
        "GET /jira-accounts",
        await listJiraAccounts(request.options()),
      ),
    addAccount: async (account) =>
      successData(
        "POST /jira-accounts",
        await addJiraAccount(account, request.options()),
      ),
    replaceCredential: async (accountId, apiToken) =>
      successData(
        "PUT /jira-accounts/:id/credential",
        await replaceJiraCredential(accountId, { apiToken }, request.options()),
      ),
    removeAccount: async (accountId) => {
      successData(
        "DELETE /jira-accounts/:id",
        await removeJiraAccount(accountId, request.options()),
      );
    },
    listProjects: async (accountId) =>
      successData(
        "GET /jira-accounts/:id/projects",
        await listJiraAccountProjects(accountId, request.options()),
      ),
    listWorkspaces: async () =>
      successData("GET /workspaces", await listWorkspaces(request.options())),
    setDestination: async (workspaceId, choice) =>
      successData(
        "PUT /workspaces/:id/jira",
        await setJiraDestination(workspaceId, choice, request.options()),
      ),
  };
};
