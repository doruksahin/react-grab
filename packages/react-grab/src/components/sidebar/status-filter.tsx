import { type Component, For, createMemo } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import {
  getSelectedStatus,
  getStatusFilterOptions,
  selectStatus,
} from "../../features/sidebar/business/status-filter.js";
import { ChipGroup, ChipGroupCount, ChipGroupItem } from "../ui/chip-group.js";
import { StatusDot } from "../ui/status-dot.js";

interface StatusFilterProps {
  groups: SelectionGroupWithJira[];
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

const ALL_STATUSES_VALUE = "all-statuses";

/** The status chips: each shows how many groups have that status and filters to it. */
export const StatusFilter: Component<StatusFilterProps> = (props) => {
  const statusOptions = createMemo(() =>
    getStatusFilterOptions(props.groups, props.filter),
  );

  const handleChange = (value: string | null) => {
    const status =
      value === null || value === ALL_STATUSES_VALUE ? null : value;
    props.onFilterChange(selectStatus(props.filter, status));
  };

  return (
    <ChipGroup
      data-react-grab-status-filter
      aria-label="Filter by status"
      value={getSelectedStatus(props.filter) ?? ALL_STATUSES_VALUE}
      onChange={handleChange}
      class="px-4 pt-3 pb-1"
    >
      <ChipGroupItem
        value={ALL_STATUSES_VALUE}
        aria-label={`All (${statusOptions().total})`}
      >
        All
        <ChipGroupCount>{statusOptions().total}</ChipGroupCount>
      </ChipGroupItem>
      <For each={statusOptions().options}>
        {(option) => (
          <ChipGroupItem
            value={option.status}
            aria-label={`${option.status} (${option.count})`}
          >
            <StatusDot color={option.color.hex} />
            {option.status}
            <ChipGroupCount>{option.count}</ChipGroupCount>
          </ChipGroupItem>
        )}
      </For>
    </ChipGroup>
  );
};
