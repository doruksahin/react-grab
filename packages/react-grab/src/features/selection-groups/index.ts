import { createEffect, createSignal, on } from "solid-js";
import type {
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroup,
  SelectionGroupWithJira,
} from "./types.js";
import type { CommentItem } from "../../types.js";
import {
  deleteGroup,
  groupForNewSelection,
  moveSelection,
  moveSelections,
  removeSelection,
} from "./business/membership-policy.js";
import { membershipAnomalies } from "./business/membership.js";
import { gcEmptySyntheticGroups } from "./business/synthetic-group.js";
import { generateId } from "../../utils/generate-id.js";
import { logRecoverableError } from "../../utils/log-recoverable-error.js";

/*
 * Membership changes go through the commands in business/membership-policy.ts;
 * this orchestrator persists what they accept and returns their result. The
 * surfaces offer only what the policy allows, so a refusal means a stale view
 * or a caller bug: it is returned to the caller and logged, never applied.
 */
const reportRefusal = (command: string, reason: string) =>
  logRecoverableError(`${command} refused`, new Error(reason));

export function createSelectionGroups(
  deps: SelectionGroupsDeps,
): SelectionGroupsAPI {
  const [activeGroupId, setActiveGroupId] = createSignal<string | null>(null);

  // Data the policy would never produce (older writes) is shown by the
  // read-side rules in business/membership.ts and reported once here, so the
  // owner can repair it deliberately. Nothing is written back.
  const reportedAnomalies = new Set<string>();
  createEffect(
    on([deps.groups, deps.commentItems], ([groups, items]) => {
      for (const anomaly of membershipAnomalies(groups, items)) {
        const key = JSON.stringify(anomaly);
        if (reportedAnomalies.has(key)) continue;
        reportedAnomalies.add(key);
        logRecoverableError(
          "Selection group data needs repair",
          new Error(key),
        );
      }
    }),
  );

  const updateGroup = (
    groupId: string,
    patch: Partial<SelectionGroupWithJira>,
  ) => {
    deps.persistGroups(
      deps.groups().map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
    );
  };

  const handleAddGroup = (name: string) => {
    deps.persistGroups([
      ...deps.groups(),
      { id: generateId("group"), name, createdAt: Date.now(), revealed: false },
    ]);
  };

  const handleRenameGroup = (groupId: string, name: string) => {
    updateGroup(groupId, { name });
  };

  const markTicketCreated: SelectionGroupsAPI["markTicketCreated"] = (
    groupId,
    jiraTicketId,
    jiraUrl,
  ) => {
    updateGroup(groupId, { jiraTicketId, jiraUrl });
    // A ticketed group takes no new selections, so it can no longer be the
    // group new selections go into.
    if (activeGroupId() === groupId) setActiveGroupId(null);
  };

  const markResolved: SelectionGroupsAPI["markResolved"] = (groupId) => {
    updateGroup(groupId, { jiraResolved: true });
  };

  // Groups first: new synthetic groups must exist before selections point at them.
  const persistChange = (change: {
    items: CommentItem[];
    groups: SelectionGroup[];
  }) => {
    if (change.groups !== deps.groups()) deps.persistGroups(change.groups);
    deps.persistCommentItems(change.items);
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

  const handleDeleteGroup: SelectionGroupsAPI["handleDeleteGroup"] = (
    groupId,
  ) => {
    const result = deleteGroup(deps.commentItems(), deps.groups(), groupId);
    if (result.status === "refused") {
      reportRefusal("Group delete", result.reason);
      return result;
    }
    persistChange(result);
    if (activeGroupId() === groupId) setActiveGroupId(null);
    return result;
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
    persistChange(result);
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
    persistChange(result);
    reconcileSyntheticGroups(result.items);
    return result;
  };

  const handleRemoveItem: SelectionGroupsAPI["handleRemoveItem"] = (itemId) => {
    const result = removeSelection(deps.commentItems(), deps.groups(), itemId);
    if (result.status === "refused") {
      reportRefusal("Selection remove", result.reason);
      return result;
    }
    deps.persistCommentItems(result.items);
    reconcileSyntheticGroups(result.items);
    return result;
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
    activeGroupId,
    setActiveGroupId,
    handleAddGroup,
    handleRenameGroup,
    handleDeleteGroup,
    handleMoveItem,
    handleMoveItems,
    handleRemoveItem,
    markTicketCreated,
    markResolved,
    ensureGroupForItem: handleEnsureGroupForItem,
  };
}

export type {
  SelectionGroup,
  SelectionGroupsAPI,
  SelectionGroupsDeps,
  SelectionGroupsViewProps,
} from "./types.js";
