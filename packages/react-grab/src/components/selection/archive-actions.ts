import type { SelectionGroup } from "../../features/selection-groups/types.js";
import type { ArchivedDeletion } from "../../features/selection-groups/business/archive-policy.js";
import {
  archiveScopeFor,
  restoreScopeFor,
} from "../../features/selection-groups/business/archive-policy.js";
import {
  archiveLabel,
  deleteGroupLabel,
  restoreLabel,
} from "./archive-labels.js";
import type { MenuAction } from "./selection-menu.jsx";

/** What the menus do to archive, restore and delete from the archive (ADR-0030). */
export interface ArchiveHandlers {
  archiveGroup: (groupId: string) => void;
  restoreGroup: (groupId: string) => void;
  deleteArchivedGroup: (groupId: string) => void;
}

interface HasMembership {
  groupId: string | null;
}

/** "Archive" for a loose selection, "Archive group (N comments)" in a group. */
export const archiveMenuAction = (
  item: HasMembership,
  groups: SelectionGroup[],
  items: HasMembership[],
  handlers: ArchiveHandlers | undefined,
): MenuAction | undefined => {
  const scope = archiveScopeFor(item, groups, items);
  if (!handlers || !scope) return undefined;
  return {
    label: archiveLabel(scope.group, scope.selectionCount),
    onSelect: () => handlers.archiveGroup(scope.group.id),
  };
};

/** "Restore", or "Restore group (N comments)". */
export const restoreMenuAction = (
  item: HasMembership,
  groups: SelectionGroup[],
  items: HasMembership[],
  handlers: ArchiveHandlers | undefined,
): MenuAction | undefined => {
  const scope = restoreScopeFor(item, groups, items);
  if (!handlers || !scope) return undefined;
  return {
    label: restoreLabel(scope.group, scope.selectionCount),
    onSelect: () => handlers.restoreGroup(scope.group.id),
  };
};

/** "Delete group (N comments)" for an archived real group without a ticket. */
export const deleteArchivedGroupMenuAction = (
  deletion: ArchivedDeletion<SelectionGroup> | undefined,
  handlers: ArchiveHandlers | undefined,
): MenuAction | undefined => {
  if (!handlers || deletion?.kind !== "group") return undefined;
  return {
    label: deleteGroupLabel(deletion.selectionCount),
    onSelect: () => handlers.deleteArchivedGroup(deletion.group.id),
  };
};
