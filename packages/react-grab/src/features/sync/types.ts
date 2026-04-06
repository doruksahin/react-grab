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
  syncRevealedState: boolean;
  onSyncError: (error: Error) => void;
  /** Options forwarded to init() — use this to set screenshot config etc. */
  options?: import("../../types.js").Options;
}

export type SyncStatus = "local" | "synced" | "error";
