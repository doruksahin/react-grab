import { type Component, For, Show } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import {
  ALL_STATUSES_VALUE,
  type StatusFilterOptions,
  getSelectedStatus,
  selectStatus,
} from "../../features/sidebar/business/status-filter.js";
import {
  ToggleGroup,
  ToggleGroupCount,
  ToggleGroupItem,
} from "../ui/toggle-group.js";
import { StatusDot } from "../ui/status-dot.js";
import { IconEyeOff } from "../icons/icon-eye-off.jsx";

const ATTENTION_VALUE = "attention";

interface StatusFilterProps {
  options: StatusFilterOptions;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  /** Selections that are flagged or not on this page. */
  attentionCount: number;
  attentionOnly: boolean;
  onAttentionOnlyChange: (attentionOnly: boolean) => void;
}

/**
 * The status chips: each counts the selections the list shows in that status
 * and narrows the list to them. "Attention" narrows to the flagged ones and
 * the ones not on this page.
 */
export const StatusFilter: Component<StatusFilterProps> = (props) => {
  const value = () =>
    props.attentionOnly
      ? ATTENTION_VALUE
      : (getSelectedStatus(props.filter) ?? ALL_STATUSES_VALUE);

  const handleChange = (next: string | null) => {
    const attentionOnly = next === ATTENTION_VALUE;
    const status =
      next === null || next === ALL_STATUSES_VALUE || attentionOnly
        ? null
        : next;
    props.onAttentionOnlyChange(attentionOnly);
    props.onFilterChange(selectStatus(props.filter, status));
  };

  // With no selections and nothing chosen there is nothing to filter.
  const hasChoices = () =>
    props.options.total > 0 ||
    getSelectedStatus(props.filter) !== null ||
    props.attentionOnly;

  return (
    <Show when={hasChoices()}>
      <ToggleGroup
        data-react-grab-status-filter
        aria-label="Filter by status"
        value={value()}
        onChange={handleChange}
        class="px-4 pt-3 pb-1"
      >
        <ToggleGroupItem
          value={ALL_STATUSES_VALUE}
          aria-label={`All (${props.options.total})`}
        >
          All
          <ToggleGroupCount>{props.options.total}</ToggleGroupCount>
        </ToggleGroupItem>
        <For each={props.options.options}>
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
        <Show when={props.attentionCount > 0 || props.attentionOnly}>
          <ToggleGroupItem
            data-react-grab-status-filter-attention
            value={ATTENTION_VALUE}
            aria-label={`Needs attention (${props.attentionCount})`}
          >
            <IconEyeOff size={11} class="text-warning-text" />
            Attention
            <ToggleGroupCount>{props.attentionCount}</ToggleGroupCount>
          </ToggleGroupItem>
        </Show>
      </ToggleGroup>
    </Show>
  );
};
