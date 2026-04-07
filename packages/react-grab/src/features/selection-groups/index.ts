import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
} from "./types.js";
import {
  loadGroups,
  addGroup as addGroupToStorage,
  renameGroup as renameGroupInStorage,
  removeGroup as removeGroupFromStorage,
  persistGroups as persistGroupsToStorage,
} from "./store/index.js";
import {
  assignSelection,
  unassignSelectionsInGroup,
} from "./business/selection-assignment.js";

export function createSelectionGroups(
  deps: SelectionGroupsDeps,
): SelectionGroupsAPI {
  const [groups, setGroups] = createSignal(loadGroups());
  const [activeGroupId, setActiveGroupId] = createSignal<string | null>(null);

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
    // Demote selections in this group to ungrouped (do NOT delete them).
    const remainingComments = unassignSelectionsInGroup(
      deps.commentItems(),
      groupId,
    );
    deps.persistCommentItems(remainingComments);
    deps.setCommentItems(remainingComments);

    const updated = removeGroupFromStorage(groupId);
    if (activeGroupId() === groupId) setActiveGroupId(null);
    setGroups(updated);
  };

  const handleMoveItem = (itemId: string, groupId: string | null) => {
    const updated = assignSelection(deps.commentItems(), itemId, groupId);
    deps.persistCommentItems(updated);
    deps.setCommentItems(updated);
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
    handleMoveItem,
  };
}

export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroupsViewProps,
} from "./types.js";
