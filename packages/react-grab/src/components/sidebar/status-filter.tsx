import { type Component, For, Show, createMemo } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import type { SelectionGroupWithJira } from "../../features/sidebar/jira-types.js";
import {
  ALL_STATUSES_VALUE,
  getSelectedStatus,
  getStatusFilterOptions,
  selectStatus,
} from "../../features/sidebar/business/status-filter.js";
import {
  ToggleGroup,
  ToggleGroupCount,
  ToggleGroupItem,
} from "../ui/toggle-group.js";
import { StatusDot } from "../ui/status-dot.js";

interface StatusFilterProps {
  groups: SelectionGroupWithJira[];
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

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

  // With no groups and no status chosen there is nothing to filter.
  const hasChoices = () =>
    props.groups.length > 0 || getSelectedStatus(props.filter) !== null;

  return (
    <Show when={hasChoices()}>
      <ToggleGroup
        data-react-grab-status-filter
        aria-label="Filter by status"
        value={getSelectedStatus(props.filter) ?? ALL_STATUSES_VALUE}
        onChange={handleChange}
        class="px-4 pt-3 pb-1"
      >
        <ToggleGroupItem
          value={ALL_STATUSES_VALUE}
          aria-label={`All (${statusOptions().total})`}
        >
          All
          <ToggleGroupCount>{statusOptions().total}</ToggleGroupCount>
        </ToggleGroupItem>
        <For each={statusOptions().options}>
          {(option) => (
            <ToggleGroupItem
              value={option.status}
              aria-label={`${option.status} (${option.count})`}
            >
              <StatusDot color={option.color.hex} />
              {option.status}
              <ToggleGroupCount>{option.count}</ToggleGroupCount>
            </ToggleGroupItem>
          )}
        </For>
      </ToggleGroup>
    </Show>
  );
};
