import type { SelectionGroupWithJira } from "./jira-types.js";
import { getStatusLabel } from "./status-colors.js";

export interface FilterState {
  statuses: Set<string>;        // empty = all
  assignee: string | null;      // null = all
  reporter: string | null;      // null = all
  label: string | null;         // null = all
}

export const export const export const EMPTY_FILTER: FilterState = {
  statuses: new Set(),
  assignee: null,
  reporter: null,
  label: null,
};;;

export function isFilterActive(filter: FilterState): boolean {
  return filter.statuses.size > 0 || filter.assignee !== null || filter.reporter !== null || filter.label !== null;
}

export function applyFilters(
  groups: SelectionGroupWithJira[],
  filter: FilterState,
): SelectionGroupWithJira[] {
  if (!isFilterActive(filter)) return groups;
  return groups.filter((g) => {
    const status = getStatusLabel(g);
    if (filter.statuses.size > 0 && !filter.statuses.has(status)) return false;
    if (filter.assignee && g.jiraAssignee !== filter.assignee) return false;
    if (filter.reporter && g.jiraReporter !== filter.reporter) return false;
    if (filter.label && !(g.jiraLabels ?? []).includes(filter.label)) return false;
    return true;
  });
}

export function getDistinctAssignees(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraAssignee).filter(Boolean) as string[])].sort();
}

export function getDistinctReporters(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.map(g => g.jiraReporter).filter(Boolean) as string[])].sort();
}

export function getDistinctLabels(groups: SelectionGroupWithJira[]): string[] {
  return [...new Set(groups.flatMap(g => g.jiraLabels ?? []).filter(Boolean))].sort();
}
