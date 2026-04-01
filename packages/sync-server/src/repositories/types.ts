import type { z } from "@hono/zod-openapi";
import type { CommentItem } from "../schemas/comment.js";
import type { SelectionGroup } from "../schemas/group.js";

/** Domain types inferred from Zod schemas (SSOT). */
export type Comment = z.infer<typeof CommentItem>;
export type Group = z.infer<typeof SelectionGroup>;

/** Storage contract for comment/group persistence. */
export interface SyncRepository {
  listComments(workspaceId: string): Promise<Comment[]>;
  persistComments(workspaceId: string, items: Comment[]): Promise<void>;
  listGroups(workspaceId: string): Promise<Group[]>;
  persistGroups(workspaceId: string, items: Group[]): Promise<void>;
  updateGroupJira(workspaceId: string, groupId: string, jiraTicketId: string): Promise<void>;
}

/** Storage contract for binary assets (screenshots). */
export interface ScreenshotStore {
  upload(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(
    key: string,
  ): Promise<{ body: ReadableStream; contentType: string } | null>;
}
