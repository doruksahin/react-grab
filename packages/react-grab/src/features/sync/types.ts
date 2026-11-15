import type { CommentItem } from "../../shared-types.js";
export type { SyncConfig, SyncStatus } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

/**
 * A storage adapter that can be swapped in for sessionStorage.
 * Default implementation: sessionStorage (current behavior).
 * Sync implementation: HTTP to sync-server.
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
  /** Upload a screenshot blob. Returns the storage key/URL. Optional. */
  uploadScreenshot?: (
    selectionId: string,
    type: "full" | "element",
    blob: Blob,
  ) => Promise<string>;
  /** Upload a gzip session recording (SPEC-020). Returns the link to watch it. Optional. */
  uploadRecording?: (commentId: string, gzipBlob: Blob) => Promise<string>;
}
