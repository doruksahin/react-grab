import type { SelectionGroup } from "../types.js";
import { createDefaultGroup, DEFAULT_GROUP_ID } from "../types.js";
import { generateId } from "../../../utils/generate-id.js";
import { logRecoverableError } from "../../../utils/log-recoverable-error.js";
import type { StorageAdapter } from "../../sync/types.js";

let activeAdapter: StorageAdapter | null = null;

const GROUPS_KEY = "react-grab-selection-groups";

const loadFromLocalStorage = (): SelectionGroup[] => {
  try {
    const serialized = localStorage.getItem(GROUPS_KEY);
    if (!serialized) return [createDefaultGroup()];
    const parsed = JSON.parse(serialized) as SelectionGroup[];
    const validated = parsed.map((group) => ({
      ...group,
      revealed:
        typeof group.revealed === "boolean" ? group.revealed : false,
    }));
    const hasDefault = validated.some((g) => g.id === DEFAULT_GROUP_ID);
    return hasDefault ? validated : [createDefaultGroup(), ...validated];
  } catch (error) {
    logRecoverableError("Failed to load groups from localStorage", error);
    return [createDefaultGroup()];
  }
};

let groups: SelectionGroup[] = loadFromLocalStorage();

export const initGroupStorage = async (adapter: StorageAdapter): Promise<void> => {
  activeAdapter = adapter;
  const remoteGroups = await adapter.loadGroups();
  groups = remoteGroups;
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
): SelectionGroup[] => {
  if (groupId === DEFAULT_GROUP_ID) return groups;
  return persistGroups(
    groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
  );
};

export const removeGroup = (groupId: string): SelectionGroup[] => {
  if (groupId === DEFAULT_GROUP_ID) return groups;
  return persistGroups(groups.filter((g) => g.id !== groupId));
};
