import { batch, createSignal, untrack } from "solid-js";
import { unwrap } from "solid-js/store";
import { createSyncStore } from "./store/sync-store.js";
import { withLocalRevealedState } from "./store/with-local-revealed-state.js";
import { withErrorReporting } from "./store/with-error-reporting.js";
import { itemChanges } from "./business/item-changes.js";
import { applyItemChanges } from "./business/apply-item-changes.js";
import { resolveSyncPorts } from "./business/resolve-sync-ports.js";
import {
  persistedCommentFields,
  persistedGroupFields,
} from "./business/persisted-fields.js";
import { migrateLegacyDefaultGroup } from "../../utils/migrate-legacy-groups.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";
import type {
  JiraPort,
  StorageAdapter,
  SyncConfig,
  SyncPortFactories,
} from "./types.js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroupWithJira } from "../selection-groups/types.js";
import { isWriteRefused } from "./business/write-refused-error.js";

const GROUPS_KEY = "react-grab-selection-groups";
const COMMENT_ITEMS_KEY = "react-grab-comment-items";
const POLL_INTERVAL_MS = 30_000;
const MAX_LOCAL_STORAGE_SIZE_BYTES = 5 * 1024 * 1024;

const loadGroupsFromLocalStorage = (): SelectionGroupWithJira[] => {
  try {
    const serialized = localStorage.getItem(GROUPS_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as SelectionGroupWithJira[];
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

/**
 * @param factories build the ports a SyncConfig does not inject; the
 * composition root (core) passes the HTTP ones from `react-grab/sync-http`.
 */
export const createSyncLayer = (factories: SyncPortFactories) => {
  const storeHandle = createSyncStore();
  // Signals, so surfaces that load through a port (screenshots) react once
  // the connection is up.
  const [adapter, setAdapter] = createSignal<StorageAdapter | null>(null);
  const [jira, setJira] = createSignal<JiraPort | null>(null);
  let pollIntervalId: ReturnType<typeof setInterval> | null = null;
  // The storage port of the last init, for retries after a failed connect.
  let activeStorage: StorageAdapter | null = null;
  // Bumped by init and dispose, so a connection started before either one
  // cannot apply its result afterwards.
  let generation = 0;
  let pendingRetry: Promise<void> | null = null;
  // The lists as they were when the server became unreachable; the
  // difference to the current lists is what changed while offline.
  let offlineBaseline: {
    comments: CommentItem[];
    groups: SelectionGroupWithJira[];
  } | null = null;

  // --- Persistence ---
  // Callers still hand over the whole next list — it is the local state. What
  // goes to the server is only what changed relative to this client's own
  // previous state, one item per request (ADR-0019). Changes are computed
  // before the store is updated, so the "before" is never the new state.
  //
  // Both run untracked. Comparing reads every field of every stored item; a
  // caller that persists from inside an effect would otherwise subscribe to
  // all of them, and the write would re-run that effect — an infinite loop.
  const persistComments = (items: CommentItem[]): CommentItem[] =>
    untrack(() => persistCommentsNow(items));

  const persistGroups = (
    groups: SelectionGroupWithJira[],
  ): SelectionGroupWithJira[] => untrack(() => persistGroupsNow(groups));

  const persistCommentsNow = (items: CommentItem[]): CommentItem[] => {
    const storage = adapter();
    if (!storage) {
      const toStore = trimToSizeLimit(items);
      storeHandle.setComments(toStore);
      try {
        localStorage.setItem(COMMENT_ITEMS_KEY, JSON.stringify(toStore));
      } catch (error) {
        logRecoverableError("Failed to save comments to localStorage", error);
      }
      return toStore;
    }

    const changes = itemChanges(
      storeHandle.store.comments,
      items,
      persistedCommentFields,
    );
    storeHandle.setComments(items);
    for (const item of changes.upserts)
      storage.upsertComment(item).catch(reloadIfRefused);
    for (const id of changes.deletedIds)
      storage.deleteComment(id).catch(reloadIfRefused);
    return items;
  };

  const persistGroupsNow = (
    groups: SelectionGroupWithJira[],
  ): SelectionGroupWithJira[] => {
    const storage = adapter();
    if (!storage) {
      storeHandle.setGroups(groups);
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
      } catch (error) {
        logRecoverableError("Failed to save groups to localStorage", error);
      }
      return groups;
    }

    const changes = itemChanges<SelectionGroupWithJira>(
      storeHandle.store.groups,
      groups,
      persistedGroupFields,
    );
    storeHandle.setGroups(groups);
    for (const group of changes.upserts)
      storage.upsertGroup(group).catch(reloadIfRefused);
    for (const id of changes.deletedIds)
      storage.deleteGroup(id).catch(reloadIfRefused);
    return groups;
  };

  // --- Refetching ---
  const refetchGroups = async () => {
    const storage = adapter();
    if (!storage) return;
    storeHandle.setGroups(await storage.loadGroups());
  };

  const refetchComments = async () => {
    const storage = adapter();
    if (!storage) return;
    storeHandle.setComments(await storage.loadComments());
  };

  // A write the server refused by rule (a ticket lock this tab did not know
  // of, ADR-0008) leaves the local lists out of step: the store was updated
  // first, and the write will never succeed. Reloading both lists puts the
  // server's state back. A write that merely failed (network, 5xx) keeps its
  // local change, as before. Either way the error is already reported
  // (withErrorReporting). Refusals that come together, as after "Clear all",
  // share one reload.
  let pendingReload: Promise<void> | null = null;
  const reloadFromServer = (): Promise<void> => {
    pendingReload ??= (async () => {
      try {
        await refetchGroups();
        await refetchComments();
      } catch {
        // Unreachable server: the next successful load corrects the lists.
      } finally {
        pendingReload = null;
      }
    })();
    return pendingReload;
  };

  const reloadIfRefused = (error: unknown): void => {
    if (isWriteRefused(error)) void reloadFromServer();
  };

  // --- JIRA polling ---
  const refreshJiraStatus = async (groupId: string) => {
    const jiraPort = jira();
    if (!jiraPort) return;
    try {
      storeHandle.updateJiraStatus(
        groupId,
        await jiraPort.getTicketStatus(groupId),
      );
    } catch {
      // Silent per SPEC-003
    }
  };

  const pollJira = async () => {
    const ticketed = storeHandle.store.groups.filter((g) => g.jiraTicketId);
    await Promise.all(ticketed.map((g) => refreshJiraStatus(g.id)));
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
    if (config.jiraProjectKey !== undefined) {
      console.warn(
        "react-grab: SyncConfig.jiraProjectKey is deprecated and used only for a workspace without a Jira destination. Choose the workspace's Jira account and project in the extension's settings (ADR-0027).",
      );
    }

    // Throws on a config that cannot reach a server, before any state changes.
    const ports = resolveSyncPorts(config, factories);

    generation += 1;
    activeStorage = null;
    offlineBaseline = null;
    setJira(ports.jira);

    batch(() => {
      storeHandle.setWorkspace(config.workspace);
      storeHandle.setStatus("loading");
    });

    if (!ports.storage) {
      batch(() => {
        storeHandle.setGroups(loadGroupsFromLocalStorage());
        storeHandle.setComments(loadCommentsFromLocalStorage());
        storeHandle.setStatus("local");
      });
      return;
    }

    const revealedPolicy = config.syncRevealedState
      ? ports.storage
      : withLocalRevealedState(ports.storage);
    activeStorage = withErrorReporting(revealedPolicy, config.onSyncError);
    await connect(activeStorage, generation, { loadLocalOnFailure: true });
  };

  // Sends what changed while offline and returns the server's lists with
  // those changes applied. Groups go first: comments refer to them.
  const replayOfflineChanges = (
    storage: StorageAdapter,
    server: { groups: SelectionGroupWithJira[]; comments: CommentItem[] },
  ) => {
    const baseline = offlineBaseline;
    if (!baseline) return server;
    const groupChanges = itemChanges(
      baseline.groups,
      storeHandle.store.groups,
      persistedGroupFields,
    );
    const commentChanges = itemChanges(
      baseline.comments,
      storeHandle.store.comments,
      persistedCommentFields,
    );
    for (const group of groupChanges.upserts)
      storage.upsertGroup(group).catch(() => {});
    for (const id of groupChanges.deletedIds)
      storage.deleteGroup(id).catch(() => {});
    for (const item of commentChanges.upserts)
      storage.upsertComment(item).catch(() => {});
    for (const id of commentChanges.deletedIds)
      storage.deleteComment(id).catch(() => {});
    return {
      groups: applyItemChanges(server.groups, groupChanges),
      comments: applyItemChanges(server.comments, commentChanges),
    };
  };

  // Loads the server's state. Writes go to the server only once it has
  // answered; until then they are kept in localStorage. A failed load has
  // already been reported to onSyncError by the storage port's wrapper.
  const connect = async (
    storage: StorageAdapter,
    connectGeneration: number,
    options: { loadLocalOnFailure: boolean },
  ) => {
    try {
      const [groups, comments] = await Promise.all([
        storage.loadGroups(),
        storage.loadComments(),
      ]);
      if (connectGeneration !== generation) return;
      const next = replayOfflineChanges(storage, { groups, comments });
      setAdapter(storage);
      offlineBaseline = null;
      batch(() => {
        storeHandle.setGroups(next.groups);
        storeHandle.setComments(next.comments);
        storeHandle.setStatus("synced");
      });
      startPolling();
      pollJira();
    } catch (error) {
      if (connectGeneration !== generation) return;
      setAdapter(null);
      batch(() => {
        if (options.loadLocalOnFailure) {
          storeHandle.setGroups(loadGroupsFromLocalStorage());
          storeHandle.setComments(loadCommentsFromLocalStorage());
        }
        storeHandle.setStatus("error", String(error));
      });
      offlineBaseline ??= {
        groups: structuredClone(unwrap(storeHandle.store.groups)),
        comments: structuredClone(unwrap(storeHandle.store.comments)),
      };
    }
  };

  // Connects again with the config of the last init, after a failed one.
  // Calls while a retry runs share it.
  const retry = (): Promise<void> => {
    const storage = activeStorage;
    if (!storage || storeHandle.store.status !== "error") {
      return pendingRetry ?? Promise.resolve();
    }
    pendingRetry ??= connect(storage, generation, {
      loadLocalOnFailure: false,
    }).finally(() => {
      pendingRetry = null;
    });
    return pendingRetry;
  };

  const dispose = () => {
    generation += 1;
    activeStorage = null;
    stopPolling();
  };

  const populate = (data: {
    workspace: string;
    groups?: SelectionGroupWithJira[];
    comments?: CommentItem[];
  }) => {
    batch(() => {
      storeHandle.setWorkspace(data.workspace);
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
    /** Fetches one group's Jira status now, e.g. after posting a comment. */
    refreshJiraStatus,

    /** The storage port, once the server has answered; null while local or offline. */
    adapter,
    /** The Jira port of the last init; null when sync is off. */
    jira,

    init,
    retry,
    dispose,
    populate,
  };
};

export type SyncLayerAPI = ReturnType<typeof createSyncLayer>;
