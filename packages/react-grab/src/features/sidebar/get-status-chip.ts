import type { SelectionGroupWithJira } from "./jira-types.js";
import { resolveDisplayColor } from "./resolve-display-color.js";
import { type StatusColorConfig, getStatusLabel } from "./status-colors.js";

export interface StatusChipData {
  label: string;
  color: StatusColorConfig;
}

export const getStatusChip = (
  group: Pick<
    SelectionGroupWithJira,
    "jiraTicketId" | "jiraStatus" | "jiraFlagged"
  >,
): StatusChipData => {
  const label = getStatusLabel(group);
  const statusForColor = group.jiraTicketId ? label : undefined;
  return {
    label,
    color: resolveDisplayColor(statusForColor, group.jiraFlagged),
  };
};
