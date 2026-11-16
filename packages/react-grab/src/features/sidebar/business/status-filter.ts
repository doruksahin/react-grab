import type { FilterState } from "../filter-state.js";
import {
  ALL_ATT_STATUSES,
  NO_TASK_STATUS,
  type StatusColorConfig,
  getStatusLabelColor,
} from "../status-colors.js";

export interface StatusFilterOption {
  status: string;
  count: number;
  color: StatusColorConfig;
}

export interface StatusFilterOptions {
  /** Selections that match every filter except the status. */
  total: number;
  options: StatusFilterOption[];
}

/** The filter value that shows every status. */
export const ALL_STATUSES_VALUE = "all-statuses";

const STATUS_ORDER = [NO_TASK_STATUS, ...ALL_ATT_STATUSES];

const statusRank = (status: string): number => {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
};

/** Workflow order: No Task, then the ATT statuses, then any other status. */
export const compareStatuses = (left: string, right: string): number =>
  statusRank(left) - statusRank(right) || left.localeCompare(right);

/** How many times each status occurs, in workflow order. */
export const statusCounts = (
  statuses: readonly string[],
): StatusFilterOption[] => {
  const counts = new Map<string, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.keys()].sort(compareStatuses).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
    color: getStatusLabelColor(status),
  }));
};

/**
 * The sidebar's status chips: one per status among the selections the list
 * shows (each selection's status is its ticket's), counted before the
 * status filter applies. The selected status stays listed even when no
 * selection has it, so it can be cleared.
 */
export const getStatusFilterOptions = (
  statuses: readonly string[],
  filter: FilterState,
): StatusFilterOptions => {
  const missing = [...filter.statuses].filter(
    (status) => !statuses.includes(status),
  );
  const options = [
    ...statusCounts(statuses),
    ...missing.map((status) => ({
      status,
      count: 0,
      color: getStatusLabelColor(status),
    })),
  ].sort((left, right) => compareStatuses(left.status, right.status));
  return { total: statuses.length, options };
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
