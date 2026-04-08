import type { SelectionGroup } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";
import { logRecoverableError } from "../../../utils/log-recoverable-error.js";
import type { StorageAdapter } from "../../sync/types.js";

let activeAdapter: StorageAdapter | null = null;

const GROUPS_KEY = "react-grab-selection-groups";

const loadFromLocalStorage = (): SelectionGroup[] => {
  try {
    const serialized = localStorage.getItem(GROUPS_KEY);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as SelectionGroup[];
    // Filter out the legacy "default" sentinel group on read.
    return parsed
      .filter((group) => group.id !== "default")
      .map((group) => ({
        ...group,
        revealed:
          typeof group.revealed === "boolean" ? group.revealed : false,
      }));
  } catch (error) {
    logRecoverableError("Failed to load groups from localStorage", error);
    return [];
  }
};

let groups: SelectionGroup[] = loadFromLocalStorage();

let onGroupsLoadedCallback: ((groups: SelectionGroup[]) => void) | null = null;

export const registerGroupsLoadedCallback = (
  cb: (groups: SelectionGroup[]) => void,
): void => {
  onGroupsLoadedCallback = cb;
};

export const initGroupStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  groups = await adapter.loadGroups();
  onGroupsLoadedCallback?.(groups);
};

export const persistGroups = (
  nextGroups: SelectionGroup[],
): SelectionGroup[] => {
  groups = nextGroups;

  if (activeAdapter) {
    activeAdapter.persistGroups(groups).catch(() => {
      // Error handling is done inside the adapter
    });
  } else {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    } catch (error) {
      logRecoverableError("Failed to save groups to localStorage", error);
    }
  }

  return groups;
};

export const loadGroups = (): SelectionGroup[] => groups;

export const addGroup = (name: string): SelectionGroup[] =>
  persistGroups([
    ...groups,
    {
      id: generateId("group"),
      name,
      createdAt: Date.now(),
      revealed: false,
    },
  ]);

export const renameGroup = (
  groupId: string,
  name: string,
): SelectionGroup[] =>
  persistGroups(
    groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
  );

export const removeGroup = (groupId: string): SelectionGroup[] =>
  persistGroups(groups.filter((g) => g.id !== groupId));

/**
 * Idempotent migration helper for legacy persisted selections whose
 * `groupId` was the synthetic `"default"` sentinel, `undefined`, or
 * missing entirely. Maps all three to `null`. Real group IDs pass through.
 */
export const migrateLegacyDefaultGroup = <T extends { groupId: string | null }>(
  items: T[],
): T[] =>
  items.map((i) => {
    const raw = (i as { groupId?: unknown }).groupId;
    if (raw === "default" || raw === undefined || raw === null) {
      return { ...i, groupId: null };
    }
    return i;
  });
