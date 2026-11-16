import type { z } from "@hono/zod-openapi";
import type { CommentItem } from "../schemas/comment.js";
import type { SelectionGroup, SelectionGroupWrite } from "../schemas/group.js";

/** Domain types inferred from Zod schemas (SSOT). */
export type Comment = z.infer<typeof CommentItem>;
export type Group = z.infer<typeof SelectionGroup>;
export type GroupWrite = z.infer<typeof SelectionGroupWrite>;

/**
 * Storage contract for comment/group persistence.
 *
 * Every write targets exactly one item (ADR-0019). There is deliberately no
 * "replace the whole workspace" operation: that is what let a stale client
 * erase other people's comments and the server's ticket links.
 */
export interface SyncRepository {
  listComments(workspaceId: string): Promise<Comment[]>;
  upsertComment(workspaceId: string, item: Comment): Promise<void>;
  findComment(
    workspaceId: string,
    commentId: string,
  ): Promise<Comment | undefined>;
  deleteComment(workspaceId: string, commentId: string): Promise<void>;
  listGroups(workspaceId: string): Promise<Group[]>;
  /** Writes the client-owned fields only; never touches status or jiraTicketId. */
  upsertGroup(workspaceId: string, item: GroupWrite): Promise<void>;
  findGroup(workspaceId: string, groupId: string): Promise<Group | undefined>;
  deleteGroup(workspaceId: string, groupId: string): Promise<void>;
  /** Links the ticket and records the account that created it (its origin). */
  updateGroupJira(
    workspaceId: string,
    groupId: string,
    jiraTicketId: string,
    jiraAccountId: string | null,
  ): Promise<void>;
  /** The group's ticket and the account that reads it; undefined without a ticket. */
  findTicketOrigin(
    workspaceId: string,
    groupId: string,
  ): Promise<TicketOrigin | undefined>;
}

/** A ticket and the account that created it; null for the environment account (ADR-0027). */
export interface TicketOrigin {
  jiraTicketId: string;
  jiraAccountId: string | null;
}

/** A Jira credential in the clear. It exists only inside a request, never in storage. */
export type JiraCredential = { kind: "api-token"; token: string };

/** A credential as stored: AES-GCM ciphertext and the key version that sealed it. */
export interface SealedCredential {
  kind: JiraCredential["kind"];
  ciphertext: string;
  iv: string;
  keyVersion: string;
}

export interface JiraAccount {
  id: string;
  siteUrl: string;
  email: string;
  atlassianAccountId: string;
  displayName: string;
  credential: SealedCredential;
  createdAt: number;
}

export interface JiraAccountRepository {
  list(): Promise<JiraAccount[]>;
  find(id: string): Promise<JiraAccount | undefined>;
  findBySiteUser(
    siteUrl: string,
    atlassianAccountId: string,
  ): Promise<JiraAccount | undefined>;
  insert(account: JiraAccount): Promise<void>;
  updateCredential(id: string, credential: SealedCredential): Promise<void>;
  /** "in-use" when a workspace or a ticket still refers to the account. */
  delete(id: string): Promise<"deleted" | "in-use">;
}

export interface Workspace {
  id: string;
  jiraAccountId: string | null;
  jiraProjectKey: string | null;
}

export interface WorkspaceRepository {
  list(): Promise<Workspace[]>;
  find(id: string): Promise<Workspace | undefined>;
  ensure(id: string): Promise<void>;
  setDestination(
    id: string,
    jiraAccountId: string,
    jiraProjectKey: string,
  ): Promise<void>;
  clearDestination(id: string): Promise<void>;
}

/** Storage contract for binary assets (screenshots). */
export interface ScreenshotStore {
  upload(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(
    key: string,
  ): Promise<{ body: ReadableStream; contentType: string } | null>;
}
