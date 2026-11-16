import type { JiraPort } from "../features/sync/types.js";
import {
  addJiraComment,
  createJiraTicket,
  getJiraDestination,
  getJiraTicketStatus,
  listJiraIssueTypes,
  listJiraLabels,
  listJiraPriorities,
  searchJiraUsers,
} from "../generated/sync-api.js";
import { createSyncRequest, successData } from "./request.js";
import type { SyncHttpConfig } from "./types.js";

/**
 * The Jira port over HTTP, for the configured workspace. The workspace's
 * destination decides the project (ADR-0027); the deprecated project key is
 * sent only so a workspace without a destination keeps working until the
 * cut-over.
 */
export const createHttpJiraPort = (config: SyncHttpConfig): JiraPort => {
  const request = createSyncRequest(config);
  const { workspace } = config;
  const legacy =
    config.jiraProjectKey === undefined
      ? {}
      : { projectKey: config.jiraProjectKey };

  return {
    getDestination: async () =>
      successData(
        "GET /workspaces/:id/jira",
        await getJiraDestination(workspace, legacy, request.options()),
      ),

    listIssueTypes: async () =>
      successData(
        "GET /workspaces/:id/jira/issue-types",
        await listJiraIssueTypes(workspace, legacy, request.options()),
      ),

    listPriorities: async () =>
      successData(
        "GET /workspaces/:id/jira/priorities",
        await listJiraPriorities(workspace, legacy, request.options()),
      ),

    listLabels: async () =>
      successData(
        "GET /workspaces/:id/jira/labels",
        await listJiraLabels(workspace, legacy, request.options()),
      ),

    getTicketStatus: async (groupId) =>
      successData(
        "GET /groups/:groupId/jira-status",
        await getJiraTicketStatus(workspace, groupId, request.options()),
      ),

    createTicket: async (groupId, ticket) =>
      successData(
        "POST /groups/:groupId/jira-ticket",
        await createJiraTicket(
          workspace,
          groupId,
          { ...ticket, ...legacy },
          request.options(),
        ),
      ),

    addComment: async (groupId, comment) =>
      successData(
        "POST /groups/:groupId/jira-comment",
        await addJiraComment(workspace, groupId, comment, request.options()),
      ),

    searchUsers: async (query) =>
      successData(
        "GET /workspaces/:id/jira/users",
        await searchJiraUsers(
          workspace,
          { query, ...legacy },
          request.options(),
        ),
      ),
  };
};
