import type { SelectionGroupWithJira } from "../../selection-groups/types.js";
import { NO_TASK_STATUS, getStatusLabel } from "../status-colors.js";

type TicketFields = Pick<SelectionGroupWithJira, "jiraTicketId" | "jiraStatus">;

/**
 * A selection's status is its ticket's: the ticket of its group, which for a
 * loose selection with a ticket is its own synthetic group. No ticket is
 * "No Task" (ADR-0006).
 */
export const selectionStatus = (
  item: { groupId: string | null },
  groupsById: ReadonlyMap<string, TicketFields>,
): string => {
  const group = item.groupId ? groupsById.get(item.groupId) : undefined;
  return group ? getStatusLabel(group) : NO_TASK_STATUS;
};
