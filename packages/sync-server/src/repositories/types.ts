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
  deleteComment(workspaceId: string, commentId: string): Promise<void>;
  listGroups(workspaceId: string): Promise<Group[]>;
  /** Writes the client-owned fields only; never touches status or jiraTicketId. */
  upsertGroup(workspaceId: string, item: GroupWrite): Promise<void>;
  deleteGroup(workspaceId: string, groupId: string): Promise<void>;
  updateGroupJira(
    workspaceId: string,
    groupId: string,
    jiraTicketId: string,
  ): Promise<void>;
}

/** Storage contract for binary assets (screenshots). */
export interface ScreenshotStore {
  upload(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(
    key: string,
  ): Promise<{ body: ReadableStream; contentType: string } | null>;
}
