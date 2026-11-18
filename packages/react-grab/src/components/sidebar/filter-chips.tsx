import { type Component, Show, For } from "solid-js";
import type { FilterState } from "../../features/sidebar/filter-state.js";
import { DUE_DATE_PRESET_LABEL } from "../../features/sidebar/due-date/index.js";
import { Badge } from "../ui/badge.js";
import { IconButton } from "../ui/icon-button.js";

interface FilterChipsProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export const FilterChips: Component<FilterChipsProps> = (props) => {
  const chips = () => {
    const result: { label: string; onDismiss: () => void }[] = [];
    // The selected status shows as the pressed status chip (status-filter.tsx).
    if (props.filter.capturedBy) {
      result.push({
        label: `Captured by: ${props.filter.capturedBy}`,
        onDismiss: () =>
          props.onFilterChange({ ...props.filter, capturedBy: null }),
      });
    }
    if (props.filter.assignee) {
      result.push({
        label: `Assignee: ${props.filter.assignee}`,
        onDismiss: () =>
          props.onFilterChange({ ...props.filter, assignee: null }),
      });
    }
    if (props.filter.reporter) {
      result.push({
        label: `Reporter: ${props.filter.reporter}`,
        onDismiss: () =>
          props.onFilterChange({ ...props.filter, reporter: null }),
      });
    }
    if (props.filter.label) {
      result.push({
        label: `Label: ${props.filter.label}`,
        onDismiss: () => props.onFilterChange({ ...props.filter, label: null }),
      });
    }
    if (props.filter.dueDatePreset) {
      result.push({
        label: `Due: ${DUE_DATE_PRESET_LABEL[props.filter.dueDatePreset]}`,
        onDismiss: () =>
          props.onFilterChange({ ...props.filter, dueDatePreset: null }),
      });
    }
    return result;
  };

  return (
    <Show when={chips().length > 0}>
      <div
        data-react-grab-filter-chips
        class="flex flex-wrap gap-1.5 px-4 py-1.5"
      >
        <For each={chips()}>
          {(chip) => (
            <Badge>
              {chip.label}
              <IconButton
                label={`Remove filter ${chip.label}`}
                size="icon-2xs"
                onClick={chip.onDismiss}
              >
                ✕
              </IconButton>
            </Badge>
          )}
        </For>
      </div>
    </Show>
  );
};
