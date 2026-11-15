import type { CommentItem } from "../../shared-types.js";
export type { SyncConfig, SyncStatus } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";
import type {
  AddJiraComment200,
  AddJiraCommentBody,
  CreateJiraTicket200,
  CreateJiraTicketBody,
  GetJiraSite200,
  GetJiraTicketStatus200,
  ListJiraIssueTypes200Item,
  ListJiraPriorities200Item,
  SearchJiraUsers200Item,
  getScreenshot,
} from "../../generated/sync-api.js";

/*
 * The overlay's two server ports (ADR-0023). Every method takes and returns
 * plain data that the structured clone algorithm can copy, and fails by
 * throwing: no response objects, RequestInit or AbortSignal cross a port, so
 * the extension can forward a call by method name.
 */

export type ScreenshotKind = Parameters<typeof getScreenshot>[2];

/**
 * The workspace's comments, groups and uploads. Bound to one workspace by
 * whoever builds it. The HTTP implementation is `createHttpAdapter` in
 * `react-grab/sync-http`.
 */
export interface StorageAdapter {
  /** Load all comments. Called once at init. */
  loadComments: () => Promise<CommentItem[]>;
  /**
   * Write one comment. There is no whole-list write: a client can only send
   * what it changed, so it cannot erase other people's comments (ADR-0019).
   */
  upsertComment: (item: CommentItem) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  /** Load all groups. Called once at init. */
  loadGroups: () => Promise<SelectionGroup[]>;
  /** Write one group's client-owned fields; the server owns its ticket fields. */
  upsertGroup: (group: SelectionGroup) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  /** Upload a screenshot. Returns its storage key. */
  uploadScreenshot: (
    selectionId: string,
    kind: ScreenshotKind,
    blob: Blob,
  ) => Promise<string>;
  /** Load a screenshot uploaded earlier. */
  loadScreenshot: (selectionId: string, kind: ScreenshotKind) => Promise<Blob>;
  /** Upload a gzip session recording (SPEC-020). Returns the link to watch it. */
  uploadRecording: (commentId: string, gzipBlob: Blob) => Promise<string>;
}

export type JiraSite = GetJiraSite200;
export type JiraIssueType = ListJiraIssueTypes200Item;
export type JiraPriority = ListJiraPriorities200Item;
export type JiraTicketStatus = GetJiraTicketStatus200;
export type JiraTicketDraft = CreateJiraTicketBody;
export type CreatedJiraTicket = CreateJiraTicket200;
export type JiraCommentDraft = AddJiraCommentBody;
export type PostedJiraComment = AddJiraComment200;
export type JiraUser = SearchJiraUsers200Item;

/**
 * Jira through the sync server. Group-scoped calls use the workspace the port
 * is bound to. The HTTP implementation is `createHttpJiraPort` in
 * `react-grab/sync-http`.
 */
export interface JiraPort {
  getSite: () => Promise<JiraSite>;
  listIssueTypes: (projectKey: string) => Promise<JiraIssueType[]>;
  listPriorities: () => Promise<JiraPriority[]>;
  listLabels: (projectKey: string) => Promise<string[]>;
  getTicketStatus: (groupId: string) => Promise<JiraTicketStatus>;
  createTicket: (
    groupId: string,
    ticket: JiraTicketDraft,
  ) => Promise<CreatedJiraTicket>;
  addComment: (
    groupId: string,
    comment: JiraCommentDraft,
  ) => Promise<PostedJiraComment>;
  searchUsers: (query: string, projectKey?: string) => Promise<JiraUser[]>;
}

/** What an HTTP port needs to reach the sync server (ADR-0020). */
export interface SyncServerConfig {
  serverUrl: string;
  apiToken: string;
  workspace: string;
}

/**
 * How the sync layer builds the ports a SyncConfig does not inject. The
 * composition root passes the HTTP ones from `react-grab/sync-http`.
 */
export interface SyncPortFactories {
  createStorage: (config: SyncServerConfig) => StorageAdapter;
  createJira: (config: SyncServerConfig) => JiraPort;
}
