import type { CommentItem } from "../shared-types.js";
import type { SelectionGroup } from "../features/selection-groups/types.js";
import type {
  JiraIssueType,
  JiraPort,
  JiraPriority,
  JiraSite,
  JiraTicketStatus,
  JiraUser,
  ScreenshotKind,
  StorageAdapter,
} from "../features/sync/types.js";

/*
 * In-memory ports for tests: unit tests, and the e2e app's populate(), which
 * hands them to initSync through the same seam a host app or the extension
 * uses (ADR-0023). Every value passes through structuredClone on the way in
 * and out, as it would across the extension's message channels, so a fake
 * can never hand back something a real port could not.
 */

const copy = <Value>(value: Value): Value => structuredClone(value);

const notFound = (what: string) =>
  Promise.reject(new Error(`${what} not found`));

export interface FakeStorageData {
  comments?: CommentItem[];
  groups?: SelectionGroup[];
}

export const createFakeStorage = (
  data: FakeStorageData = {},
): StorageAdapter => {
  const comments = new Map(
    (data.comments ?? []).map((item) => [item.id, copy(item)]),
  );
  const groups = new Map(
    (data.groups ?? []).map((group) => [group.id, copy(group)]),
  );
  const screenshots = new Map<string, Blob>();
  const screenshotKey = (selectionId: string, kind: ScreenshotKind) =>
    `${selectionId}/${kind}`;

  return {
    loadComments: async () => copy([...comments.values()]),
    upsertComment: async (item) => {
      comments.set(item.id, copy(item));
    },
    deleteComment: async (commentId) => {
      comments.delete(commentId);
    },
    loadGroups: async () => copy([...groups.values()]),
    upsertGroup: async (group) => {
      groups.set(group.id, copy(group));
    },
    deleteGroup: async (groupId) => {
      groups.delete(groupId);
    },
    uploadScreenshot: async (selectionId, kind, blob) => {
      const key = screenshotKey(selectionId, kind);
      screenshots.set(key, blob);
      return `screenshots/${key}`;
    },
    loadScreenshot: async (selectionId, kind) => {
      const blob = screenshots.get(screenshotKey(selectionId, kind));
      return blob ? copy(blob) : notFound(`screenshot ${selectionId}/${kind}`);
    },
    uploadRecording: async (commentId) => `memory://recordings/${commentId}`,
  };
};

export interface FakeJiraData {
  site?: JiraSite;
  issueTypes?: JiraIssueType[];
  priorities?: JiraPriority[];
  labels?: string[];
  /** Ticket status by group id. */
  ticketStatuses?: Record<string, JiraTicketStatus>;
  users?: JiraUser[];
}

export const createFakeJiraPort = (data: FakeJiraData = {}): JiraPort => {
  const ticketStatuses = new Map(
    Object.entries(copy(data.ticketStatuses ?? {})),
  );
  let nextId = 1;
  const newId = () => `fake-${nextId++}`;

  return {
    getSite: async () => (data.site ? copy(data.site) : notFound("Jira site")),
    listIssueTypes: async () => copy(data.issueTypes ?? []),
    listPriorities: async () => copy(data.priorities ?? []),
    listLabels: async () => copy(data.labels ?? []),
    getTicketStatus: async (groupId) => {
      const status = ticketStatuses.get(groupId);
      return status ? copy(status) : notFound(`ticket for group ${groupId}`);
    },
    createTicket: async (_groupId, ticket) => {
      const jiraTicketId = `${ticket.projectKey}-${newId()}`;
      return copy({
        jiraTicketId,
        jiraUrl: `${data.site?.siteUrl ?? "https://jira.invalid"}/browse/${jiraTicketId}`,
      });
    },
    addComment: async (groupId, comment) => {
      const id = newId();
      const created = new Date(0).toISOString();
      const status = ticketStatuses.get(groupId);
      if (status) {
        status.comments.push({
          id,
          parentId: comment.parentId ?? null,
          author: "You",
          authorAvatar: null,
          body: comment.body,
          createdAt: created,
        });
      }
      return { id, created };
    },
    searchUsers: async (query) =>
      copy(
        (data.users ?? []).filter((user) =>
          user.displayName.toLowerCase().includes(query.toLowerCase()),
        ),
      ),
  };
};
