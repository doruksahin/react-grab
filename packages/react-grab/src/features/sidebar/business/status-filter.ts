import type { SelectionGroupWithJira } from "../jira-types.js";
import { type FilterState, applyFilters } from "../filter-state.js";
import {
  ALL_ATT_STATUSES,
  NO_TASK_STATUS,
  type StatusColorConfig,
  getStatusLabel,
  getStatusLabelColor,
} from "../status-colors.js";

export interface StatusFilterOption {
  status: string;
  count: number;
  color: StatusColorConfig;
}

export interface StatusFilterOptions {
  /** Groups that match every filter except the status. */
  total: number;
  options: StatusFilterOption[];
}

const STATUS_ORDER = [NO_TASK_STATUS, ...ALL_ATT_STATUSES];

const statusRank = (status: string): number => {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
};

const compareStatuses = (left: string, right: string): number =>
  statusRank(left) - statusRank(right) || left.localeCompare(right);

/**
 * The status choices for the sidebar's status chips: one per status that
 * a group has, counted against the other active filters, in workflow
 * order. The selected status stays listed even when no group has it, so
 * it can be cleared.
 */
export const getStatusFilterOptions = (
  groups: SelectionGroupWithJira[],
  filter: FilterState,
): StatusFilterOptions => {
  const matching = applyFilters(groups, { ...filter, statuses: new Set() });
  const counts = new Map<string, number>();
  for (const group of matching) {
    const status = getStatusLabel(group);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  for (const status of filter.statuses) {
    if (!counts.has(status)) counts.set(status, 0);
  }
  const options = [...counts.keys()].sort(compareStatuses).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
    color: getStatusLabelColor(status),
  }));
  return { total: matching.length, options };
};

/** The one selected status, or null when all statuses are shown. */
export const getSelectedStatus = (filter: FilterState): string | null =>
  [...filter.statuses][0] ?? null;

/** Shows one status, or every status when `status` is null. */
export const selectStatus = (
  filter: FilterState,
  status: string | null,
): FilterState => ({
  ...filter,
  statuses: status === null ? new Set() : new Set([status]),
});
