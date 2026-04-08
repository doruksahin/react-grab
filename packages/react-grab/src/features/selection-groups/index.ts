import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
} from "./types.js";
import type { CommentItem } from "../../types.js";
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
import { gcEmptySyntheticGroups } from "./business/synthetic-group.js";
import { canRemoveSelection } from "./business/ticket-lock.js";

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

  /**
   * Collapse any synthetic groups that lost their last item as a result of
   * a mutation. Real groups survive emptiness — only synthetic backing
   * stores are GCed. Also clears activeGroupId if it pointed at a dropped
   * group.
   */
  const reconcileSyntheticGroups = (nextItems: CommentItem[]) => {
    const current = groups();
    const next = gcEmptySyntheticGroups(current, nextItems);
    if (next.length === current.length) return;
    persistGroupsToStorage(next);
    const activeId = activeGroupId();
    if (activeId && !next.some((g) => g.id === activeId)) {
      setActiveGroupId(null);
    }
    setGroups(next);
  };

  const handleMoveItem = (itemId: string, groupId: string | null) => {
    const updated = assignSelection(deps.commentItems(), itemId, groupId);
    deps.persistCommentItems(updated);
    deps.setCommentItems(updated);
    reconcileSyntheticGroups(updated);
  };

  /**
   * Remove a selection permanently. Gated by ticket-lock: selections in
   * ticketed groups (real or synthetic) cannot be removed — the JIRA
   * issue would be orphaned. Returns true iff removal actually happened.
   *
   * When a synthetic group loses its last item as a result, the
   * synthetic group itself is garbage-collected. Real groups survive
   * empty.
   */
  const handleRemoveItem = (itemId: string): boolean => {
    const before = deps.commentItems();
    const item = before.find((i) => i.id === itemId);
    if (!item) return false;
    if (!canRemoveSelection(item, groups())) return false;

    const updated = before.filter((i) => i.id !== itemId);
    deps.persistCommentItems(updated);
    deps.setCommentItems(updated);
    reconcileSyntheticGroups(updated);
    return true;
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
    handleRemoveItem,
  };
}

export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroupsViewProps,
} from "./types.js";
