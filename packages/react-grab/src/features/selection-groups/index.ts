import { createSignal } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
} from "./types.js";
import type { CommentItem } from "../../types.js";
import {
  deleteGroup,
  groupForNewSelection,
  moveSelection,
  moveSelections,
} from "./business/membership-policy.js";
import { gcEmptySyntheticGroups } from "./business/synthetic-group.js";
import { canRemoveSelection } from "./business/ticket-lock.js";
import { generateId } from "../../utils/generate-id.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";

/*
 * Membership changes go through the commands in business/membership-policy.ts;
 * this orchestrator persists what they accept and returns their result. The
 * surfaces offer only what `assignableGroupsFor` allows, so a refusal means a
 * stale view or a caller bug: it is returned to the caller and logged, never
 * applied.
 */
const reportRefusal = (command: string, reason: string) =>
  logRecoverableError(`${command} refused`, new Error(reason));

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

  const handleDeleteGroup: SelectionGroupsAPI["handleDeleteGroup"] = (
    groupId,
  ) => {
    const result = deleteGroup(deps.commentItems(), deps.groups(), groupId);
    if (result.status === "refused") {
      reportRefusal("Group delete", result.reason);
      return result;
    }
    deps.persistCommentItems(result.items);
    deps.persistGroups(result.groups);
    if (activeGroupId() === groupId) setActiveGroupId(null);
    return result;
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

  const handleMoveItem: SelectionGroupsAPI["handleMoveItem"] = (
    itemId,
    groupId,
  ) => {
    const result = moveSelection(
      deps.commentItems(),
      deps.groups(),
      itemId,
      groupId,
    );
    if (result.status === "refused") {
      reportRefusal("Selection move", result.reason);
      return result;
    }
    deps.persistCommentItems(result.items);
    reconcileSyntheticGroups(result.items);
    return result;
  };

  const handleMoveItems: SelectionGroupsAPI["handleMoveItems"] = (
    itemIds,
    groupId,
  ) => {
    const result = moveSelections(
      deps.commentItems(),
      deps.groups(),
      itemIds,
      groupId,
    );
    if (result.status === "refused") {
      reportRefusal("Selection move", result.reason);
      return result;
    }
    for (const { itemId, reason } of result.refused) {
      reportRefusal(`Selection move of ${itemId}`, reason);
    }
    deps.persistCommentItems(result.items);
    reconcileSyntheticGroups(result.items);
    return result;
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

  const handleEnsureGroupForItem = (
    item: { componentName?: string; elementName: string },
    selectedGroupId = activeGroupId(),
  ): string => {
    const result = groupForNewSelection(item, selectedGroupId, deps.groups());
    if (result.groups !== deps.groups()) {
      deps.persistGroups(result.groups);
    }
    return result.groupId;
  };

  return {
    groups: deps.groups,
    setGroups: (groups) =>
      deps.persistGroups(
        typeof groups === "function" ? groups(deps.groups()) : groups,
      ),
    persistGroups: deps.persistGroups,
    activeGroupId,
    setActiveGroupId,
    handleAddGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleMoveItem,
    handleMoveItems,
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
