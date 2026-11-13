import { batch } from "solid-js";
import { createSyncStore } from "./store/sync-store.js";
import { createHttpAdapter } from "./adapter.js";
import { itemChanges } from "./business/item-changes.js";
import {
  toCommentWire,
  toGroupWire,
  saveLocalRevealedStates,
} from "./transforms.js";
import { setApiBaseUrl } from "../../generated/custom-fetch.js";
import { getJiraTicketStatus } from "../../generated/sync-api.js";
import { migrateLegacyDefaultGroup } from "../../utils/migrate-legacy-groups.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";
import type { SyncConfig } from "./types.js";
import type { StorageAdapter } from "./types.js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

const GROUPS_KEY = "react-grab-selection-groups";
const COMMENT_ITEMS_KEY = "react-grab-comment-items";
const POLL_INTERVAL_MS = 30_000;
const MAX_LOCAL_STORAGE_SIZE_BYTES = 5 * 1024 * 1024;

const loadGroupsFromLocalStorage = (): SelectionGroup[] => {
  try {
    const serialized = localStorage.getItem(GROUPS_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as SelectionGroup[];
    return parsed
      .filter((group) => group.id !== "default")
      .map((group) => ({
        ...group,
        revealed: typeof group.revealed === "boolean" ? group.revealed : false,
      }));
  } catch (error) {
    logRecoverableError("Failed to load groups from localStorage", error);
    return [];
  }
};

const loadCommentsFromLocalStorage = (): CommentItem[] => {
  try {
    const serialized = localStorage.getItem(COMMENT_ITEMS_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as CommentItem[];
    const normalized = parsed.map((item) => ({
      ...item,
      elementsCount: Math.max(1, item.elementsCount ?? 1),
      previewBounds: item.previewBounds ?? [],
      elementSelectors: item.elementSelectors ?? [],
      revealed: typeof item.revealed === "boolean" ? item.revealed : false,
    }));
    return migrateLegacyDefaultGroup(normalized);
  } catch (error) {
    logRecoverableError("Failed to load comments from localStorage", error);
    return [];
  }
};

const trimToSizeLimit = (items: CommentItem[]): CommentItem[] => {
  let trimmed = items;
  while (trimmed.length > 0) {
    const serialized = JSON.stringify(trimmed);
    if (new Blob([serialized]).size <= MAX_LOCAL_STORAGE_SIZE_BYTES)
      return trimmed;
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
};

export const createSyncLayer = () => {
  const storeHandle = createSyncStore();
  let adapterRef: StorageAdapter | null = null;
  let syncRevealedState = true;
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;

  // When revealed state is not synced, it lives in localStorage instead. Both
  // lists are saved together so writing one never wipes the other's flags.
  const rememberRevealedLocally = () => {
    if (syncRevealedState) return;
    saveLocalRevealedStates(
      storeHandle.store.comments,
      storeHandle.store.groups,
    );
  };

  // --- Persistence ---
  // Callers still hand over the whole next list — it is the local state. What
  // goes to the server is only what changed relative to this client's own
  // previous state, one item per request (ADR-0019). Changes are computed
  // before the store is updated, so the "before" is never the new state.
  const persistComments = (items: CommentItem[]): CommentItem[] => {
    const adapter = adapterRef;
    if (!adapter) {
      const toStore = trimToSizeLimit(items);
      storeHandle.setComments(toStore);
      try {
        localStorage.setItem(COMMENT_ITEMS_KEY, JSON.stringify(toStore));
      } catch (error) {
        logRecoverableError("Failed to save comments to localStorage", error);
      }
      return toStore;
    }

    const changes = itemChanges(storeHandle.store.comments, items, (item) =>
      toCommentWire(item, syncRevealedState),
    );
    storeHandle.setComments(items);
    for (const item of changes.upserts)
      adapter.upsertComment(item).catch(() => {});
    for (const id of changes.deletedIds)
      adapter.deleteComment(id).catch(() => {});
    rememberRevealedLocally();
    return items;
  };

  const persistGroups = (groups: SelectionGroup[]): SelectionGroup[] => {
    const adapter = adapterRef;
    if (!adapter) {
      storeHandle.setGroups(groups);
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
      } catch (error) {
        logRecoverableError("Failed to save groups to localStorage", error);
      }
      return groups;
    }

    const changes = itemChanges<SelectionGroup>(
      storeHandle.store.groups,
      groups,
      (group) => toGroupWire(group, syncRevealedState),
    );
    storeHandle.setGroups(groups);
    for (const group of changes.upserts)
      adapter.upsertGroup(group).catch(() => {});
    for (const id of changes.deletedIds)
      adapter.deleteGroup(id).catch(() => {});
    rememberRevealedLocally();
    return groups;
  };

  // --- Refetching ---
  const refetchGroups = async () => {
    if (!adapterRef) return;
    const groups = await adapterRef.loadGroups();
    storeHandle.setGroups(groups);
  };

  const refetchComments = async () => {
    if (!adapterRef) return;
    const comments = await adapterRef.loadComments();
    storeHandle.setComments(comments);
  };

  // --- JIRA polling ---
  const pollJira = async () => {
    const workspace = storeHandle.store.workspace;
    const ticketed = [...storeHandle.store.groups].filter(
      (g) => g.jiraTicketId,
    );
    if (!workspace || ticketed.length === 0) return;
    await Promise.allSettled(
      ticketed.map(async (g) => {
        try {
          const result = await getJiraTicketStatus(workspace, g.id);
          if (result.status === 200) {
            storeHandle.updateJiraStatus(g.id, result.data);
          }
        } catch {
          // Silent per SPEC-003
        }
      }),
    );
  };

  const startPolling = () => {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(pollJira, POLL_INTERVAL_MS);
  };

  const stopPolling = () => {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  };

  // --- Init ---
  const init = async (config: SyncConfig) => {
    if (!config.jiraProjectKey) {
      throw new Error(
        "react-grab: SyncConfig.jiraProjectKey is required (e.g. 'ATT')",
      );
    }

    if (config.serverUrl) {
      setApiBaseUrl(config.serverUrl);
    }
    syncRevealedState = config.syncRevealedState;

    batch(() => {
      storeHandle.setConfig(
        config.workspace,
        config.serverUrl,
        config.jiraProjectKey,
      );
      storeHandle.setStatus("loading");
    });

    if (!config.enabled) {
      batch(() => {
        storeHandle.setGroups(loadGroupsFromLocalStorage());
        storeHandle.setComments(loadCommentsFromLocalStorage());
        storeHandle.setStatus("local");
      });
      return;
    }

    try {
      const httpAdapter = createHttpAdapter(config);
      adapterRef = httpAdapter;
      const [groups, comments] = await Promise.all([
        httpAdapter.loadGroups(),
        httpAdapter.loadComments(),
      ]);
      batch(() => {
        storeHandle.setGroups(groups);
        storeHandle.setComments(comments);
        storeHandle.setStatus("synced");
      });
      startPolling();
      pollJira();
    } catch (error) {
      batch(() => {
        storeHandle.setGroups(loadGroupsFromLocalStorage());
        storeHandle.setComments(loadCommentsFromLocalStorage());
        storeHandle.setStatus("error", String(error));
      });
      config.onSyncError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };

  const dispose = () => {
    stopPolling();
  };

  const populate = (data: {
    workspace: string;
    serverUrl: string;
    jiraProjectKey: string;
    groups?: SelectionGroup[];
    comments?: CommentItem[];
  }) => {
    batch(() => {
      storeHandle.setConfig(
        data.workspace,
        data.serverUrl,
        data.jiraProjectKey,
      );
      if (data.groups) storeHandle.setGroups(data.groups);
      if (data.comments) storeHandle.setComments(data.comments);
      storeHandle.setStatus("local");
    });
  };

  return {
    store: storeHandle.store,
    groups: () => storeHandle.store.groups,
    comments: () => storeHandle.store.comments,
    workspace: () => storeHandle.store.workspace,
    serverUrl: () => storeHandle.store.serverUrl,
    jiraProjectKey: () => storeHandle.store.jiraProjectKey,
    status: () => storeHandle.store.status,

    setGroups: storeHandle.setGroups,
    setComments: storeHandle.setComments,
    updateGroup: storeHandle.updateGroup,
    updateJiraStatus: storeHandle.updateJiraStatus,

    persistComments,
    persistGroups,

    refetchGroups,
    refetchComments,
    refetchJira: pollJira,

    adapter: () => adapterRef,

    init,
    dispose,
    populate,
  };
};

export type SyncLayerAPI = ReturnType<typeof createSyncLayer>;
