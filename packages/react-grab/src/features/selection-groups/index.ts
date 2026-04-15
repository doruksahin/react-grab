import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
} from "./types.js";
import type { CommentItem } from "../../types.js";
import {
  assignSelection,
  unassignSelectionsInGroup,
} from "./business/selection-assignment.js";
import { ensureGroupForItem, gcEmptySyntheticGroups } from "./business/synthetic-group.js";
import { canRemoveSelection } from "./business/ticket-lock.js";
import { generateId } from "../../utils/generate-id.js";

export function createSelectionGroups(
  deps: SelectionGroupsDeps,
): SelectionGroupsAPI {
  const [activeGroupId, setActiveGroupId] = createSignal<string | null>(null);

  const handleAddGroup = (name: string) => {
    deps.persistGroups([
      ...deps.groups(),
      { id: generateId("group"), name, createdAt: Date.now(), revealed: false },
    ]);
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    deps.persistGroups(
      deps.groups().map((g) => (g.id === groupId ? { ...g, name } : g)),
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    const remainingComments = unassignSelectionsInGroup(
      deps.commentItems(),
      groupId,
    );
    deps.persistCommentItems(remainingComments);

    deps.persistGroups(deps.groups().filter((g) => g.id !== groupId));
    if (activeGroupId() === groupId) setActiveGroupId(null);
  };

  const reconcileSyntheticGroups = (nextItems: CommentItem[]) => {
    const current = deps.groups();
    const next = gcEmptySyntheticGroups(current, nextItems);
    if (next.length === current.length) return;
    deps.persistGroups(next);
    const activeId = activeGroupId();
    if (activeId && !next.some((g) => g.id === activeId)) {
      setActiveGroupId(null);
    }
  };

  const handleMoveItem = (itemId: string, groupId: string | null) => {
    const updated = assignSelection(deps.commentItems(), itemId, groupId);
    deps.persistCommentItems(updated);
    reconcileSyntheticGroups(updated);
  };

  const handleRemoveItem = (itemId: string): boolean => {
    const before = deps.commentItems();
    const item = before.find((i) => i.id === itemId);
    if (!item) return false;
    if (!canRemoveSelection(item, deps.groups())) return false;

    const updated = before.filter((i) => i.id !== itemId);
    deps.persistCommentItems(updated);
    reconcileSyntheticGroups(updated);
    return true;
  };

  const handleEnsureGroupForItem = (item: { componentName?: string; elementName: string }): string => {
    const result = ensureGroupForItem(item, activeGroupId(), deps.groups());
    if (result.groups !== deps.groups()) {
      deps.persistGroups(result.groups);
    }
    return result.groupId;
  };

  return {
    groups: deps.groups,
    setGroups: (groups) => deps.persistGroups(typeof groups === "function" ? groups(deps.groups()) : groups),
    persistGroups: deps.persistGroups,
    activeGroupId,
    setActiveGroupId,
    handleAddGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleMoveItem,
    handleRemoveItem,
    ensureGroupForItem: handleEnsureGroupForItem,
  };
}

export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroupsViewProps,
} from "./types.js";
