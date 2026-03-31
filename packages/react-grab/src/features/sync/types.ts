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
  /** Persist the full comments array. Called on every mutation. */
  persistComments: (items: CommentItem[]) => Promise<CommentItem[]>;
  /** Load all groups. Called once at init. */
  loadGroups: () => Promise<SelectionGroup[]>;
  /** Persist the full groups array. Called on every mutation. */
  persistGroups: (groups: SelectionGroup[]) => Promise<SelectionGroup[]>;
}

/**
 * Configuration for sync. Passed via Options.sync.
 */
export interface SyncConfig {
  serverUrl: string;
  workspace: string;
  onSyncError?: (error: Error) => void;
}
