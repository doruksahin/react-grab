import { createSignal, batch } from "solid-js";
import { createSyncStore } from "./store/sync-store.js";
import { createGroupsResource } from "./resources/groups-resource.js";
import { createCommentsResource } from "./resources/comments-resource.js";
import { createJiraPoller } from "./resources/jira-poller.js";
import { createHttpAdapter } from "./adapter.js";
import { setApiBaseUrl } from "../../generated/custom-fetch.js";
import { migrateLegacyDefaultGroup } from "../selection-groups/store/group-storage.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";
import type { SyncConfig } from "./types.js";
import type { StorageAdapter } from "./types.js";
import type { CommentItem } from "../../types.js";
import type { SelectionGroup } from "../selection-groups/types.js";

const GROUPS_KEY = "react-grab-selection-groups";
const COMMENT_ITEMS_KEY = "react-grab-comment-items";

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

export const createSyncLayer = () => {
  const storeHandle = createSyncStore();
  const [adapter, setAdapter] = createSignal<StorageAdapter | null>(null);

  const groupsResource = createGroupsResource(adapter, storeHandle);
  const commentsResource = createCommentsResource(adapter, storeHandle);
  const jiraPoller = createJiraPoller(storeHandle);

  const init = async (config: SyncConfig) => {
    if (!config.jiraProjectKey) {
      throw new Error("react-grab: SyncConfig.jiraProjectKey is required (e.g. 'ATT')");
    }

    if (config.serverUrl) {
      setApiBaseUrl(config.serverUrl);
    }

    batch(() => {
      storeHandle.setConfig(config.workspace, config.serverUrl, config.jiraProjectKey);
      storeHandle.setStatus("loading");
    });

    if (!config.enabled) {
      batch(() => {
        storeHandle.reconcileGroups(loadGroupsFromLocalStorage());
        storeHandle.reconcileComments(loadCommentsFromLocalStorage());
        storeHandle.setStatus("local");
      });
      return;
    }

    try {
      const httpAdapter = createHttpAdapter(config);
      storeHandle.setStatus("synced");
      setAdapter(() => httpAdapter);
    } catch (error) {
      batch(() => {
        storeHandle.reconcileGroups(loadGroupsFromLocalStorage());
        storeHandle.reconcileComments(loadCommentsFromLocalStorage());
        storeHandle.setStatus("error", String(error));
      });
      config.onSyncError(error instanceof Error ? error : new Error(String(error)));
    }
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
    reconcileGroups: storeHandle.reconcileGroups,
    reconcileComments: storeHandle.reconcileComments,
    updateGroup: storeHandle.updateGroup,
    updateJiraStatus: storeHandle.updateJiraStatus,

    refetchGroups: groupsResource.refetch,
    refetchComments: commentsResource.refetch,
    refetchJira: jiraPoller.refetch,
    ticketedGroups: jiraPoller.ticketedGroups,

    adapter,

    init,
  };
};

export type SyncLayerAPI = ReturnType<typeof createSyncLayer>;
