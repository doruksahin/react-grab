import type { JiraPort } from "../features/sync/types.js";
import {
  addJiraComment,
  createJiraTicket,
  getJiraSite,
  getJiraTicketStatus,
  listJiraIssueTypes,
  listJiraLabels,
  listJiraPriorities,
  searchJiraUsers,
} from "../generated/sync-api.js";
import { createSyncRequest, pathSegment, successData } from "./request.js";
import type { SyncHttpConfig } from "./types.js";

/** The Jira port over HTTP. Group-scoped calls use the configured workspace. */
export const createHttpJiraPort = (config: SyncHttpConfig): JiraPort => {
  const request = createSyncRequest(config);
  const workspace = pathSegment(config.workspace);

  return {
    getSite: async () =>
      successData("GET /jira/site", await getJiraSite(request.options())),

    listIssueTypes: async (projectKey) =>
      successData(
        "GET /jira/issue-types",
        await listJiraIssueTypes({ projectKey }, request.options()),
      ),

    listPriorities: async () =>
      successData(
        "GET /jira/priorities",
        await listJiraPriorities(request.options()),
      ),

    listLabels: async (projectKey) =>
      successData(
        "GET /jira/labels",
        await listJiraLabels({ projectKey }, request.options()),
      ),

    getTicketStatus: async (groupId) =>
      successData(
        "GET /groups/:groupId/jira-status",
        await getJiraTicketStatus(
          workspace,
          pathSegment(groupId),
          request.options(),
        ),
      ),

    createTicket: async (groupId, ticket) =>
      successData(
        "POST /groups/:groupId/jira-ticket",
        await createJiraTicket(
          workspace,
          pathSegment(groupId),
          ticket,
          request.options(),
        ),
      ),

    addComment: async (groupId, comment) =>
      successData(
        "POST /groups/:groupId/jira-comment",
        await addJiraComment(
          workspace,
          pathSegment(groupId),
          comment,
          request.options(),
        ),
      ),

    searchUsers: async (query, projectKey) =>
      successData(
        "GET /jira/users",
        await searchJiraUsers(
          projectKey === undefined ? { query } : { query, project: projectKey },
          request.options(),
        ),
      ),
  };
};
