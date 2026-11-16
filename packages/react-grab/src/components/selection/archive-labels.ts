import type { SelectionGroup } from "../../features/selection-groups/types.js";

const scopeText = (group: SelectionGroup, selectionCount: number): string =>
  group.synthetic || selectionCount <= 1
    ? ""
    : ` group (${selectionCount} comments)`;

/** "Archive", or "Archive group (3 comments)" when the ticket is a group's. */
export const archiveLabel = (
  group: SelectionGroup,
  selectionCount: number,
): string => `Archive${scopeText(group, selectionCount)}`;

/** "Restore", or "Restore group (3 comments)". */
export const restoreLabel = (
  group: SelectionGroup,
  selectionCount: number,
): string => `Restore${scopeText(group, selectionCount)}`;

/** How a toast names a group: its ticket key, else its name. */
export const groupTitle = (group: SelectionGroup): string =>
  group.jiraTicketId ?? group.name;
