import type { CommentItem } from "../../types.js";
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
}

/**
 * Configuration for sync. Passed to initSync().
 * Optional `options` field is forwarded to init() when it auto-fires.
 */
export interface SyncConfig {
  enabled: boolean;
  serverUrl: string;
  workspace: string;
  jiraProjectKey: string;
  /**
   * Bearer token the sync server requires on every request (ADR-0020).
   * Required when `enabled` is true. Read it from the host app's own env
   * (for example `VITE_REACT_GRAB_SYNC_TOKEN`); `initSync()` runs only in
   * development builds, so it never ships in a production bundle.
   */
  apiToken?: string;
  syncRevealedState: boolean;
  onSyncError: (error: Error) => void;
  /** Options forwarded to init() — use this to set screenshot config etc. */
  options?: import("../../types.js").Options;
}

export type SyncStatus = "local" | "synced" | "error";
