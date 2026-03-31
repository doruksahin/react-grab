import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
} from "./types.js";
import { DEFAULT_GROUP_ID } from "./types.js";
import {
  loadGroups,
  addGroup as addGroupToStorage,
  renameGroup as renameGroupInStorage,
  removeGroup as removeGroupFromStorage,
  persistGroups as persistGroupsToStorage,
} from "./store/index.js";
import { removeCommentsByGroup } from "./business/group-operations.js";

export function createSelectionGroups(
  deps: SelectionGroupsDeps,
): SelectionGroupsAPI {
  const [groups, setGroups] = createSignal(loadGroups());
  const [activeGroupId, setActiveGroupId] = createSignal<string>(DEFAULT_GROUP_ID);

  const persistGroups = (nextGroups: SelectionGroup[]) => {
    const persisted = persistGroupsToStorage(nextGroups);
    setGroups(persisted);
    return persisted;
  };

  const handleAddGroup = (name: string) => {
    const updated = addGroupToStorage(name);
    setGroups(updated);
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    const updated = renameGroupInStorage(groupId, name);
    setGroups(updated);
  };

  const handleDeleteGroup = (groupId: string) => {
    // Cascade: remove all comments in this group first
    const remainingComments = removeCommentsByGroup(
      deps.commentItems(),
      groupId,
    );
    deps.persistCommentItems(remainingComments);
    deps.setCommentItems(remainingComments);

    const updated = removeGroupFromStorage(groupId);
    setGroups(updated);
  };

  return {
    groups,
    setGroups,
    persistGroups,
    activeGroupId,
    setActiveGroupId,
    handleAddGroup,
    handleRenameGroup,
    handleDeleteGroup,
  };
}

export { DEFAULT_GROUP_ID, DEFAULT_GROUP_NAME } from "./types.js";
export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
} from "./types.js";
